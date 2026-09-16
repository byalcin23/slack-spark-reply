"""Local API configuration: validate before saving; never return credentials."""
import json
import os
from pathlib import Path
import re
import tempfile
import threading

from core import SparkError, generate


class Configuration:
    def __init__(self, root):
        self.path = Path(root) / ".local" / "api-config.json"
        self.lock = threading.Lock()
        self.saved = {}
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text())
                if isinstance(data, dict) and all(isinstance(v, str) for v in data.values()):
                    self.saved = data
            except (ValueError, OSError):
                pass

    def settings(self):
        with self.lock:
            return {**os.environ, **self.saved}

    def health(self):
        settings = self.settings()
        ready = settings.get("SPARK_LIVE_ENABLED") == "1" and bool(settings.get("SPARK_API_KEY", "").strip())
        return {"ok": True, "mode": "live" if ready else "unconfigured", "provider": "local",
                "has_key": ready, "model": settings.get("SPARK_MODEL", "gpt-4.1-mini")}

    def candidate(self, raw):
        if not isinstance(raw, dict):
            raise SparkError("Geçersiz ayar.")
        current = self.settings()
        key = raw.get("api_key", current.get("SPARK_API_KEY", ""))
        model = raw.get("model", current.get("SPARK_MODEL", "gpt-4.1-mini"))
        if not isinstance(key, str) or not 10 <= len(key.strip()) <= 1024 or any(c.isspace() for c in key.strip()):
            raise SparkError("Geçerli bir API anahtarı gir.", "API_KEY_INVALID" if key else "API_UNCONFIGURED")
        if not isinstance(model, str) or not re.fullmatch(r"[a-zA-Z0-9._:-]{1,120}", model):
            raise SparkError("Geçerli bir model adı gir.")
        return {"SPARK_LIVE_ENABLED": "1", "SPARK_API_KEY": key.strip(), "SPARK_MODEL": model,
                "SPARK_API_URL": "https://api.openai.com/v1/responses", "SPARK_REASONING_EFFORT": ""}

    def test(self, raw):
        settings = self.candidate(raw)
        return self.test_settings(settings)

    @staticmethod
    def test_settings(settings):
        # A real synthetic generation checks credentials, model access, quota and JSON format.
        result = generate({"messages": [{"author": "Demo colleague", "text": "Thanks for updating the guide!"}],
                           "intent": "Write a short, friendly thank-you reply."}, settings)
        return {"ok": True, "provider": "local", "has_key": True, "mode": "live",
                "model": settings["SPARK_MODEL"], "sample": result["replies"][0]["text"]}

    def persist(self, settings):
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.path.parent, 0o700)
        fd, temporary = tempfile.mkstemp(prefix=".api-config-", dir=str(self.path.parent))
        try:
            with os.fdopen(fd, "w") as handle:
                json.dump(settings, handle)
            with self.lock:
                os.replace(temporary, self.path)
                self.saved = settings
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def configure(self, raw):
        settings = self.candidate(raw)
        result = self.test_settings(settings)
        self.persist(settings)
        return result

    def forget(self, raw):
        if not isinstance(raw, dict) or raw.get("confirm") is not True:
            raise SparkError("API bağlantısını kaldırmak için onay gerekli.")
        # Persist a disabled state so a legacy .env key cannot silently reconnect.
        self.persist({"SPARK_LIVE_ENABLED": "0", "SPARK_API_KEY": "",
                      "SPARK_MODEL": self.health()["model"]})
        return self.health()
