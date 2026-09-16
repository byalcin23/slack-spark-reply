import json
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
from configuration import Configuration
from core import SparkError


class ConfigurationTests(unittest.TestCase):
    def test_saves_only_after_real_generation_succeeds_and_health_has_no_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Configuration(directory)
            with patch("configuration.generate", return_value={"replies": [{"text": "API test answer"}]}) as generate:
                result = config.configure({"api_key": "fake-test-secret", "model": "gpt-4.1-mini"})
            self.assertEqual(generate.call_args.args[1]["SPARK_API_URL"], "https://api.openai.com/v1/responses")
            self.assertEqual(result["sample"], "API test answer")
            self.assertEqual(stat.S_IMODE(config.path.stat().st_mode), 0o600)
            self.assertEqual(Configuration(directory).health()["mode"], "live")
            self.assertNotIn("fake-test-secret", json.dumps(config.health()))
            self.assertNotIn("fake-test-secret", json.dumps(result))

    def test_failed_api_test_does_not_save_or_replace_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Configuration(directory)
            with patch("configuration.generate", side_effect=SparkError("API rejected")):
                with self.assertRaises(SparkError):
                    config.configure({"api_key": "fake-test-secret"})
            self.assertFalse(config.path.exists())
            self.assertEqual(config.saved, {})

    def test_invalid_key_or_model_never_calls_api(self):
        with tempfile.TemporaryDirectory() as directory, patch("configuration.generate") as generate:
            config = Configuration(directory)
            for raw in ({"api_key": ""}, {"api_key": "fake-test-secret", "model": "invalid\nmodel"}, []):
                with self.assertRaises(SparkError): config.configure(raw)
            generate.assert_not_called()


if __name__ == "__main__": unittest.main()
