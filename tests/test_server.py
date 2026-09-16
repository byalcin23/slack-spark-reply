"""Exercise the local bridge over real HTTP without an external API."""
import http.client
import json
from pathlib import Path
import sys
import threading
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
from server import Handler, ThreadingHTTPServer
from configuration import Configuration


class BridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.server.bridge_token = "test-pairing-token"
        cls.directory = tempfile.TemporaryDirectory()
        cls.server.configuration = Configuration(cls.directory.name)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def request(self, headers=None, body=None, path="/suggest"):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        valid = {"Origin": "chrome-extension://abcdefghijklmnopabcdefghijklmnop", "Content-Type": "application/json", "X-Spark-Token": self.server.bridge_token}
        valid.update(headers or {})
        conn.request("POST", path, body if body is not None else json.dumps({"messages": [], "draft": "", "intent": "Say thanks"}), valid)
        response = conn.getresponse()
        result = response.status, json.loads(response.read())
        conn.close()
        return result

    def test_paired_extension_gets_setup_error_instead_of_mock(self):
        with patch.dict("os.environ", {"SPARK_LIVE_ENABLED": "0"}):
            status, data = self.request()
        self.assertEqual(status, 400)
        self.assertIn("kurulmamış", data["error"])
        self.assertNotIn("replies", data)

    def test_only_paired_local_page_can_configure(self):
        body = json.dumps({"api_key": "fake-test-key", "model": "gpt-4.1-mini"})
        self.assertEqual(self.request({"Origin":"https://example.com"}, body=body, path="/configure")[0], 403)
        origin = "http://127.0.0.1:%s" % self.server.server_port
        self.assertEqual(self.request({"Origin": origin, "X-Spark-Token": "wrong"}, body, "/configure")[0], 403)
        with patch.object(self.server.configuration, "configure", return_value={"ok": True, "mode": "live"}) as configure:
            self.assertEqual(self.request({"Origin": origin}, body, "/configure")[0], 200)
            configure.assert_called_once()

    def test_rejects_wrong_token_web_origin_and_host(self):
        for headers in ({"X-Spark-Token": "wrong"}, {"Origin": "https://example.com"}, {"Origin": ""}, {"Host": "attacker.example"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.request(headers)[0], 403)

    def test_rejects_malformed_json_and_non_json(self):
        self.assertEqual(self.request(body="{broken")[0], 400)
        self.assertEqual(self.request({"Content-Type": "text/plain"})[0], 415)


if __name__ == "__main__":
    unittest.main()
