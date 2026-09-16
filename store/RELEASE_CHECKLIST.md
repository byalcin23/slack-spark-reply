# Spark Reply release checklist

Prepared on 2026-09-16. **A packaged candidate is not a published or approved extension.**

## Included release material

- English and Turkish listing copy: `LISTING.md`.
- Privacy policy draft: `PRIVACY.md`.
- Single-purpose statement, permissions, data categories, test instructions: `REVIEWER_NOTES.md`.
- Original mark: `extension/icons/mark.svg`.
- Extension PNG icons: 16, 32, 48, and 128 pixels.
- Store artwork: `assets/icon-512.png`, `assets/promo-440x280.png`.
- Deterministic, allowlisted ZIP builder: `scripts/package_release.py`.

## Owner information required before submission

- [ ] Confirm publisher identity, monitored support email, public support URL, and store account ownership.
- [ ] Replace every `MUST_REPLACE_…` field; publish the policy on a public HTTPS URL and verify it loads without login.
- [ ] Confirm API provider disclosures, support correspondence handling, and data retention wording against the final code and actual support process.
- [ ] Set up the Chrome Web Store developer account and complete the account/identity requirements shown in the dashboard.
- [ ] Select visibility, countries, and distribution preferences.
- [ ] Provide usable private reviewer test instructions and any dedicated review access required.

## Acceptance checks required before release

- [ ] Install the exact packaged files in a clean Chrome profile, not just the development folder.
- [ ] Confirm connection setup works without Python, localhost, or a pairing code.
- [ ] Verify a live OpenAI response with an authorized test key and synthetic input. Check invalid key, quota/rate-limit, timeout, disconnect, and browser restart.
- [ ] Test the final build in real Slack web: DM, channel, thread, edits, changing draft, channel navigation, long context, keyboard input, and narrow window.
- [ ] Verify no request occurs before the user's generation action except an explicit connection test.
- [ ] Inspect extension storage and network traffic: no persistent API key, no saved message history, only intended OpenAI requests.
- [ ] Confirm the extension does not send Slack messages, invoke links from generated content, or execute returned text.
- [ ] Check English/Turkish labels, theme controls, focus behavior, outside-click dismissal, and copy/insert behavior.
- [ ] Review source and package for secrets and confirm no production conversation data appears in screenshots or fixtures.

## Store assets

- [ ] Capture 1–5 screenshots of the final user experience, ideally 1280×800; 640×400 is also supported. Use synthetic names and messages. Do not present a mockup as a verified live session.
- [ ] Review the original 440×280 promotional tile and 128×128 PNG icon.
- [ ] If supplying a marquee image, use 1400×560.

These sizes and required assets come from [Chrome's image requirements](https://developer.chrome.com/docs/webstore/images). Manifest icons use PNG; SVG is an editable source asset, not a manifest icon. [Icon configuration](https://developer.chrome.com/docs/extensions/develop/ui/configure-icons)

## Build locally

From the repository root:

```sh
python3 -m unittest discover -s tests -p test_package.py -v
python3 scripts/package_release.py --check
python3 scripts/package_release.py
```

The builder creates `dist/spark-reply-VERSION.zip` and a JSON inventory with its SHA-256 checksum. It refuses hidden/sensitive files, unknown bundled files, symlinks, likely embedded OpenAI keys, missing referenced files, broad network permissions, and invalid icon dimensions. This is a focused package check, not a complete security audit or approval guarantee.

The ZIP contains `manifest.json` at its root, with only the reviewed extension files. Server code, `.env`, `.local`, demo pages, tests, scripts, store drafts, and user credentials are excluded. A Chrome Web Store upload uses this ZIP, not Chrome's CRX “Pack extension” output. [Package preparation](https://developer.chrome.com/docs/webstore/prepare)

## Submission flow — not yet performed

1. Sign in to the publisher's Chrome Developer Dashboard.
2. Add a new item and upload the candidate ZIP.
3. Complete listing, privacy practices, permission justifications, distribution, and private test instructions.
4. Check that the privacy URL and screenshots describe the exact uploaded build.
5. The owner submits for review. Choose deferred publishing if the owner wants to decide when an approved version becomes public.

Google's review is external and is not included in a one-hour build estimate. Uploading a valid ZIP does not mean the item is approved. [Official publication flow](https://developer.chrome.com/docs/webstore/publish)

## Privacy references

Chrome requires user-data disclosures even when processing is local. A policy must describe collection, use, sharing, and retention; the application's behavior must match its disclosures. [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

The narrow purpose and permissions must be explained in the dashboard. [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

The release keeps the API key in `chrome.storage.session`, which Chrome documents as in-memory storage cleared on extension reload/update/disable and browser restart. Preferences use local storage; session keys are not synced. [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
