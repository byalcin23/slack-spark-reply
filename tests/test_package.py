"""Release safety tests; all credentials and extension fixtures are synthetic."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package_release", ROOT / "scripts/package_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def png(size):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    pixels = b"".join(b"\0" + b"\0\0\0\0" * size for _ in range(size))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(pixels)) + chunk(b"IEND", b"")


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.extension = self.root / "extension"
        (self.extension / "icons").mkdir(parents=True)
        self.manifest = {"manifest_version": 3, "name": "Spark Reply", "description": "Draft Slack replies.", "version": "1.0.0", "icons": {"128": "icons/icon-128.png"}, "background": {"service_worker": "background.js"}, "permissions": ["storage"], "host_permissions": ["https://api.openai.com/*"]}
        (self.extension / "icons/icon-128.png").write_bytes(png(128))
        (self.extension / "background.js").write_text("'use strict';\n")
        self.save_manifest()

    def tearDown(self):
        self.temp.cleanup()

    def save_manifest(self):
        (self.extension / "manifest.json").write_text(json.dumps(self.manifest))

    def test_reproducible_zip_root_and_no_sibling_secrets(self):
        (self.root / ".env").write_text("SYNTHETIC_SECRET=never-bundle")
        first, second = self.root / "a.zip", self.root / "b.zip"
        release.package(self.extension, first)
        release.package(self.extension, second)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        with zipfile.ZipFile(first) as archive:
            self.assertIn("manifest.json", archive.namelist())
            self.assertNotIn(".env", archive.namelist())
            self.assertFalse(any(path.startswith("extension/") for path in archive.namelist()))

    def test_sensitive_files_fail_closed(self):
        (self.extension / ".env").write_text("synthetic")
        with self.assertRaisesRegex(release.ReleaseError, "Sensitive"):
            release.validate(self.extension)

    def test_embedded_key_is_rejected(self):
        (self.extension / "background.js").write_text("const credential='sk-proj-" + "x" * 30 + "';")
        with self.assertRaisesRegex(release.ReleaseError, "credential"):
            release.validate(self.extension)

    def test_unreviewed_files_and_symlinks_are_rejected(self):
        extra = self.extension / "unexpected.js"
        extra.write_text("synthetic")
        with self.assertRaisesRegex(release.ReleaseError, "allowlist"):
            release.validate(self.extension)
        extra.unlink()
        extra.symlink_to(self.root / ".env")
        with self.assertRaisesRegex(release.ReleaseError, "Symlinks"):
            release.validate(self.extension)

    def test_missing_nested_html_resource_is_rejected(self):
        self.manifest["action"] = {"default_popup": "panel.html"}
        self.save_manifest()
        (self.extension / "panel.html").write_text('<script src="panel.js"></script>')
        with self.assertRaisesRegex(release.ReleaseError, "Missing bundled"):
            release.validate(self.extension)

    def test_wrong_icon_and_broad_host_are_rejected(self):
        (self.extension / "icons/icon-128.png").write_bytes(png(16))
        with self.assertRaisesRegex(release.ReleaseError, "Icon size"):
            release.validate(self.extension)
        (self.extension / "icons/icon-128.png").write_bytes(png(128))
        self.manifest["host_permissions"] = ["<all_urls>"]
        self.save_manifest()
        with self.assertRaisesRegex(release.ReleaseError, "network host"):
            release.validate(self.extension)

    def test_path_escape_and_remote_html_assets_are_rejected(self):
        self.manifest["background"] = {"service_worker": "../server/core.py"}
        self.save_manifest()
        with self.assertRaisesRegex(release.ReleaseError, "stay inside"):
            release.validate(self.extension)
        self.manifest["background"] = {"service_worker": "background.js"}
        self.save_manifest()
        (self.extension / "panel.html").write_text('<script src="https://example.invalid/remote.js"></script>')
        with self.assertRaisesRegex(release.ReleaseError, "remote assets"):
            release.validate(self.extension)


if __name__ == "__main__":
    unittest.main()
