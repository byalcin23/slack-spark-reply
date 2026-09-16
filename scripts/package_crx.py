#!/usr/bin/env python3
"""Pack the allowlisted ZIP as a CRX; keep the private signing key out of releases."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True, help='Chrome/Chromium executable')
    args = parser.parse_args()
    subprocess.run(['python3', str(ROOT / 'scripts/package_release.py')], check=True)
    version = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
    key = ROOT / '.local/crx-signing.pem'
    key.parent.mkdir(mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='spark-crx-') as temp:
        folder = Path(temp) / 'extension'
        with zipfile.ZipFile(ROOT / f'dist/spark-reply-{version}.zip') as archive:
            archive.extractall(folder)
        command = [args.browser, '--headless', '--no-first-run', '--no-message-box',
                   '--user-data-dir=' + str(Path(temp) / 'profile'), '--pack-extension=' + str(folder)]
        if key.exists():
            command.append('--pack-extension-key=' + str(key))
        result = subprocess.run(command, capture_output=True, timeout=60)
        packed = folder.with_suffix('.crx')
        if result.returncode or not packed.exists():
            raise SystemExit('Chrome did not produce a CRX. Check the supplied browser executable.')
        if not key.exists():
            shutil.copyfile(folder.with_suffix('.pem'), key)
            key.chmod(0o600)
        output = ROOT / f'dist/spark-reply-{version}.crx'
        shutil.copyfile(packed, output)
        if output.read_bytes()[:4] != b'Cr24':
            raise SystemExit('Invalid CRX header')
        print('Created ' + str(output))
        print('Private signing key retained in .local/; never share or commit it.')

if __name__ == '__main__':
    main()
