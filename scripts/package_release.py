#!/usr/bin/env python3
"""Build a deterministic extension-only Chrome Web Store candidate (stdlib only).

The explicit allowlist makes new bundled files an intentional release change.
It never reads .env, .local, the Python bridge, or the user's browser profile.
Passing checks means packaging is valid, not that Chrome approved publication.
"""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ALLOWLIST = frozenset({
    "manifest.json", "background.js", "provider.js", "spark.js",
    "panel.html", "panel.css", "panel.js", "i18n.js", "icons.js", "common.js",
    "options.html", "options.js", "options.css", "locales.js",
    "icons/mark.svg", "icons/icon-16.png", "icons/icon-32.png",
    "icons/icon-48.png", "icons/icon-128.png",
    "_locales/en/messages.json", "_locales/tr/messages.json",
})
SENSITIVE_NAMES = re.compile(r"(^|/)(\.[^/]+|.*\.(pem|key|p12|pfx)|.*(?:secret|credential|api-config|bridge-token).*)(/|$)", re.I)
SECRET_VALUE = re.compile(rb"\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{20,}\b")


class ReleaseError(ValueError):
    pass


class LocalAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        value = attributes.get("src") if tag in {"script", "img", "iframe"} else attributes.get("href") if tag == "link" else None
        if value:
            if value.startswith(("https:", "http:", "//")):
                raise ReleaseError("Bundled HTML must not load remote assets.")
            if not value.startswith(("data:", "#")):
                self.paths.append(value.split("?", 1)[0].split("#", 1)[0])


def safe_relative(value):
    if not isinstance(value, str) or not value or "\\" in value:
        raise ReleaseError("Invalid manifest resource path.")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or ":" in value:
        raise ReleaseError("Resources must stay inside the extension directory.")
    return str(path)


def png_size(data):
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ReleaseError("Manifest icons must be PNG files.")
    return struct.unpack(">II", data[16:24])


def validate(extension):
    extension = Path(extension)
    if not extension.is_dir() or extension.is_symlink():
        raise ReleaseError("Extension root must be a real directory.")
    files = {}
    for path in sorted(extension.rglob("*")):
        relative = path.relative_to(extension).as_posix()
        if path.is_symlink():
            raise ReleaseError("Symlinks are not allowed in release packages: " + relative)
        if path.is_dir():
            continue
        if SENSITIVE_NAMES.search(relative):
            raise ReleaseError("Sensitive or hidden file in extension directory: " + relative)
        if relative not in ALLOWLIST:
            raise ReleaseError("File is not on the release allowlist: " + relative)
        data = path.read_bytes()
        if SECRET_VALUE.search(data):
            raise ReleaseError("Possible API credential found; package refused: " + relative)
        files[relative] = data
    try:
        manifest = json.loads(files["manifest.json"])
    except (KeyError, ValueError) as exc:
        raise ReleaseError("A valid manifest.json is required.") from exc
    if manifest.get("manifest_version") != 3:
        raise ReleaseError("This release requires Manifest V3.")
    version = manifest.get("version", "")
    if not re.fullmatch(r"(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}", version) or any(int(v) > 65535 for v in version.split(".")) or not any(int(v) for v in version.split(".")):
        raise ReleaseError("Invalid Chrome extension version.")
    if not isinstance(manifest.get("name"), str) or not manifest["name"].strip():
        raise ReleaseError("Extension name is required.")
    description = manifest.get("description", "")
    if not isinstance(description, str) or not 1 <= len(description) <= 132:
        raise ReleaseError("Manifest description must contain 1–132 characters.")
    permissions = manifest.get("permissions", [])
    if any(p not in {"storage", "activeTab", "scripting", "clipboardWrite"} for p in permissions):
        raise ReleaseError("Review the allowlisted permissions before packaging.")
    hosts = manifest.get("host_permissions", []) + manifest.get("optional_host_permissions", [])
    if any(host != "https://api.openai.com/*" for host in hosts):
        raise ReleaseError("Unexpected network host permission.")
    references = []
    icons = manifest.get("icons", {})
    if "128" not in icons:
        raise ReleaseError("A 128×128 PNG icon is required for the store package.")
    for size, path in icons.items():
        relative = safe_relative(path)
        if relative not in files or png_size(files[relative]) != (int(size), int(size)):
            raise ReleaseError("Icon size/path mismatch: " + relative)
    background = manifest.get("background", {})
    if background.get("service_worker"):
        references.append(background["service_worker"])
    references.extend(background.get("scripts", []))
    action = manifest.get("action", {})
    for resource in (action.get("default_popup"), manifest.get("options_page"), manifest.get("options_ui", {}).get("page")):
        if resource:
            references.append(resource)
    action_icons = action.get("default_icon", {})
    references.extend(action_icons.values() if isinstance(action_icons, dict) else [action_icons])
    for script in manifest.get("content_scripts", []):
        if any(match != "https://app.slack.com/client/*" for match in script.get("matches", [])):
            raise ReleaseError("Content script scope must be limited to Slack web.")
        references.extend(script.get("js", []))
        references.extend(script.get("css", []))
    for resources in manifest.get("web_accessible_resources", []):
        for resource in resources.get("resources", []):
            if "*" in resource:
                if not any(PurePosixPath(path).match(resource) for path in files):
                    raise ReleaseError("Web-accessible resource pattern matches no files.")
            else:
                references.append(resource)
    for name, data in files.items():
        if name.endswith(".html"):
            parser = LocalAssets()
            parser.feed(data.decode("utf-8"))
            references.extend(str(PurePosixPath(name).parent / reference) for reference in parser.paths)
        if name.endswith(".js"):
            source = data.decode("utf-8")
            for pattern in (r'import\s+(?:[^;]*?\s+from\s+)?[\"\']([^\"\']+)[\"\']', r'importScripts\(\s*[\"\']([^\"\']+)[\"\']'):
                for reference in re.findall(pattern, source):
                    references.append(str(PurePosixPath(name).parent / reference))
    for reference in references:
        if safe_relative(reference) not in files:
            raise ReleaseError("Missing bundled resource: " + reference)
    locale = manifest.get("default_locale")
    if locale and "_locales/{}/messages.json".format(locale) not in files:
        raise ReleaseError("Default locale messages are missing.")
    return manifest, files


def package(extension, output):
    manifest, files = validate(extension)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, data in sorted(files.items()):
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data, compresslevel=9)
        temporary.replace(output)
    finally:
        if temporary.exists():
            temporary.unlink()
    report = {
        "name": manifest["name"], "version": manifest["version"],
        "artifact": output.name, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "files": sorted(files), "size_bytes": output.stat().st_size,
        "host_permissions": manifest.get("host_permissions", []),
        "optional_host_permissions": manifest.get("optional_host_permissions", []),
        "status": "Packaged candidate; publication and live acceptance require release checklist.",
        "connection": "Standalone extension: direct OpenAI HTTPS requests; no local server or pairing code.",
    }
    output.with_suffix(".json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extension", type=Path, default=ROOT / "extension")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        manifest, files = validate(args.extension)
        if args.check:
            print("Package validation passed: {} files; version {}.".format(len(files), manifest["version"]))
        else:
            output = args.output or ROOT / "dist" / "spark-reply-{}.zip".format(manifest["version"])
            report = package(args.extension, output)
            print("Created {} ({} bytes)\nSHA-256: {}".format(output, report["size_bytes"], report["sha256"]))
    except (ReleaseError, OSError) as exc:
        print("Release blocked: {}".format(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
