#!/usr/bin/env python3
"""Local bridge and demo server. Python standard library only; Python 3.9+."""
import hmac
import json
import os
from pathlib import Path
import secrets
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from core import SparkError, generate
from configuration import Configuration

ROOT = Path(__file__).resolve().parent.parent
BUSY = threading.BoundedSemaphore(2)


def load_env():
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                if key.startswith("SPARK_"):
                    os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def get_token():
    directory = ROOT / ".local"
    directory.mkdir(mode=0o700, exist_ok=True)
    path = directory / "bridge-token"
    if not path.exists():
        fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(secrets.token_urlsafe(32))
    return path.read_text().strip()


class Handler(BaseHTTPRequestHandler):
    server_version = "SlackSpark/0.2"

    def log_message(self, *args):
        # No message text, URL parameters, request bodies, or API responses in logs.
        pass

    def valid_host(self):
        return self.headers.get("Host") == "127.0.0.1:%s" % self.server.server_port

    def origin_allowed(self):
        origin = self.headers.get("Origin", "")
        parsed = urlparse(origin)
        return origin == "http://127.0.0.1:%s" % self.server.server_port or (
            parsed.scheme == "chrome-extension" and bool(re.fullmatch(r"[a-p]{32}", parsed.netloc))
            and not parsed.path and not parsed.query and not parsed.fragment)

    def authorized(self):
        return self.origin_allowed() and hmac.compare_digest(
            self.headers.get("X-Spark-Token", ""), self.server.bridge_token)

    def reject_pairing(self):
        return self.send(403, {"error": "Bağlantı kodunu kontrol et.", "code": "PAIRING_INVALID"})

    def send(self, status, payload):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        if self.origin_allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Vary", "Origin")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        if not self.valid_host() or not self.origin_allowed():
            return self.send(403, {"error": "Kaynağa izin verilmedi."})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Spark-Token")
        self.end_headers()

    def do_GET(self):
        if not self.valid_host():
            return self.send(403, {"error": "Geçersiz sunucu adresi."})
        route = urlparse(self.path).path
        if self.path == "/health":
            return self.send(200, self.server.configuration.health())
        if self.path == "/config/status":
            if not self.authorized():
                return self.reject_pairing()
            return self.send(200, {**self.server.configuration.health(), "bridge_connected": True})
        paths = {
            "/": ("demo/index.html", "text/html"),
            "/demo.js": ("demo/demo.js", "text/javascript"),
            "/spark.js": ("extension/spark.js", "text/javascript"),
            "/tests.html": ("tests/browser.html", "text/html"),
            "/browser-tests.js": ("tests/browser-tests.js", "text/javascript"),
            "/setup": ("setup/index.html", "text/html"),
            "/setup.js": ("setup/setup.js", "text/javascript"),
            "/panel.html": ("extension/panel.html", "text/html"),
            "/panel.css": ("extension/panel.css", "text/css"),
            "/panel.js": ("extension/panel.js", "text/javascript"),
            "/i18n.js": ("extension/i18n.js", "text/javascript"),
            "/icons.js": ("extension/icons.js", "text/javascript"),
            "/provider.js": ("extension/provider.js", "text/javascript"),
            "/background.js": ("extension/background.js", "text/javascript"),
            "/product-tests.html": ("tests/product.html", "text/html"),
            "/product-tests.js": ("tests/product-tests.js", "text/javascript"),
        }
        if route not in paths:
            return self.send(404, {"error": "Bulunamadı."})
        filename, mime = paths[route]
        try:
            body = (ROOT / filename).read_bytes()
        except FileNotFoundError:
            return self.send(404, {"error": "Bulunamadı."})
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        ancestors = "'self'" if route == "/panel.html" else "'none'"
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors " + ancestors)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.valid_host() or self.path not in ("/suggest", "/configure", "/config/test", "/config/forget"):
            return self.send(403, {"error": "Geçersiz adres."})
        if not self.authorized():
            return self.reject_pairing()
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "JSON bekleniyor.", "code": "REQUEST_INVALID"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 80000:
                return self.send(413, {"error": "İstek çok büyük veya boş.", "code": "REQUEST_INVALID"})
            self.connection.settimeout(5)
            raw = json.loads(self.rfile.read(length))
        except (ValueError, OSError):
            return self.send(400, {"error": "İstek okunamadı.", "code": "REQUEST_INVALID"})
        if not BUSY.acquire(blocking=False):
            return self.send(429, {"error": "Bir öneri zaten hazırlanıyor. Biraz bekle.", "code": "REQUEST_BUSY"})
        try:
            if self.path == "/configure":
                self.send(200, self.server.configuration.configure(raw))
            elif self.path == "/config/test":
                self.send(200, self.server.configuration.test(raw))
            elif self.path == "/config/forget":
                self.send(200, self.server.configuration.forget(raw))
            else:
                self.send(200, generate(raw, self.server.configuration.settings()))
        except SparkError as exc:
            self.send(400, {"error": str(exc), "code": exc.code})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.send(500, {"error": "Öneri hazırlanamadı.", "code": "INTERNAL_ERROR"})
        finally:
            BUSY.release()


def main():
    load_env()
    port = int(os.environ.get("SPARK_PORT", "8787"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.bridge_token = get_token()
    server.configuration = Configuration(ROOT)
    mode = server.configuration.health()["mode"]
    print("Slack Spark | " + mode, flush=True)
    print("Demo: http://127.0.0.1:%s" % port, flush=True)
    print("API setup: http://127.0.0.1:%s/setup" % port, flush=True)
    print("Extension pairing code: " + server.bridge_token, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
