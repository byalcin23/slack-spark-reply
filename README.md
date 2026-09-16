# Spark Reply

Draft replies to Slack conversations without leaving the message composer. Review the visible conversation, describe what you want to say, and choose from three suggestions. **You review and send every message yourself.**

Spark Reply is a standalone Chrome extension using your own OpenAI API key. No local server, desktop helper, or pairing code is required.

## Features

- Reply suggestions and settings in the same panel.
- English, Turkish, and Simplified Chinese interface; English, Turkish, German, French, Spanish, and Hungarian replies.
- Light, dark, and system themes, with compact language and appearance controls.
- Conversation preview with individual message selection.
- A “Replying as” field with account detection where available and a remembered name per Slack workspace.
- Sender identification for supported grouped Slack messages, with uncertain authors left unknown.
- Copy suggestions or insert them into the composer without sending.
- Protection against inserting an old suggestion after the draft or conversation changes.

## Download and share

Current preview: **1.0.4**.

- [Download extension ZIP](https://github.com/byalcin23/slack-spark-reply/raw/refs/heads/main/dist/spark-reply-1.0.4.zip)
- The packed CRX in `dist/` is for supported development/distribution environments only. **Do not use it for normal Chrome installation on macOS or Windows.**

**A packed CRX is not a one-click installation solution for ordinary Chrome on macOS or Windows.** Chrome restricts normal installation to extensions distributed through the Chrome Web Store. The CRX is supplied for supported development/distribution environments; it is not store-signed. See [Chrome's distribution documentation](https://developer.chrome.com/docs/extensions/how-to/distribute).

For a friend testing this preview today, use the ZIP and the development installation below. For installation through a normal store link, an **unlisted Chrome Web Store release** is the intended route. This project has not been submitted to or approved by the store.

## Quick install (Chrome on macOS / Windows)

**Yes, Developer mode is required for this preview. Use the ZIP, not the CRX.**

1. [Download Spark Reply ZIP](https://github.com/byalcin23/slack-spark-reply/raw/refs/heads/main/dist/spark-reply-1.0.4.zip).
2. Extract it: double-click the ZIP on macOS, or right-click → **Extract All** on Windows. Keep the extracted folder on your computer.
3. Paste `chrome://extensions` into Chrome's address bar and press Enter.
4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the extracted **folder** containing `manifest.json`. Do not select or drag in the ZIP or CRX file.
6. Open or reload Slack in Chrome. Click the sparkle button beside the message box.
7. Open **Settings**, enter your own OpenAI API key, and click **Save & test**.
8. Check **Replying as**, enter your Slack display name if needed, and choose **Suggest replies**.

If you downloaded the entire repository using GitHub's **Code → Download ZIP**, select its `extension/` subfolder at step 5.

### “CRX_REQUIRED_PROOF_MISSING” error

Chrome is rejecting the CRX because it lacks the required Chrome Web Store signing proof. **Turning on Developer mode does not make that CRX installable.** Use the ZIP and **Load unpacked** steps above instead.

Installation without Developer mode will require a future Chrome Web Store release. There is no store installation link yet.

To update, replace the extension files, click **Reload** on its extension card, and reload Slack. You may need to re-enter the API key after reloading the extension or fully closing Chrome.

OpenAI API billing is separate from a ChatGPT subscription. Connection tests make a small synthetic API request. Each tester supplies their own key; no key is included in this repository or the downloads.

## Privacy and storage

When you request suggestions, your reply identity, selected message text and available sender identities, current draft, instructions, and language preferences are sent directly to OpenAI over HTTPS.

- API keys are held in extension session storage, not persistent storage or Slack's page.
- Display names and available account identifiers are stored locally per workspace. Edit or clear the name in the panel.
- Language, theme, and model preferences are stored locally.
- The extension does not keep a persistent conversation history or include analytics.
- Requests use `store: false`; this is not a guarantee of zero retention by OpenAI.

See the [privacy policy draft](store/PRIVACY.md). Publisher details must be completed before store publication.

## Development

Python 3 is sufficient for the ZIP builder and Python tests; no Node build is required.

```sh
python3 -m unittest discover -s tests -v
python3 scripts/package_release.py
```

Optional local UI preview:

```sh
python3 server/server.py
```

Open <http://127.0.0.1:8787> for a synthetic Slack-style demo, or <http://127.0.0.1:8787/tests.html> for browser checks. Demo replies are prewritten examples. The development server and legacy Python API bridge are not used by the installed extension and are excluded from release packages.

For packaged browser acceptance checks, supply a Chrome for Testing executable:

```sh
python3 tests/run_extension_acceptance.py --browser '/path/to/chrome-for-testing'
```

These tests use synthetic Slack markup and mocked API responses. See [validation notes](VALIDATION.md) for limits.

To build a signed development CRX, run:

```sh
python3 scripts/package_crx.py --browser '/path/to/chrome-for-testing'
```

The signing key is stored under ignored `.local/`. Keep it private and back it up if you want subsequent CRX packages to retain the same extension ID. Never commit it.

## Project structure

| Path | Purpose |
| --- | --- |
| `extension/spark.js` | Slack DOM adapter, context capture, and draft insertion |
| `extension/panel.*` | Isolated extension UI and settings |
| `extension/background.js` | Session credentials and request handling |
| `extension/provider.js` | OpenAI Responses API client and structured reply validation |
| `scripts/` | Release packaging |
| `tests/` | Python and browser checks |
| `store/` | Listing copy, draft privacy policy, reviewer notes, and artwork |
| `demo/`, `server/`, `setup/` | Development preview and legacy helper files |

## Limitations and publication

Slack web in Chrome is supported; the Slack desktop app is not. At most 12 visible messages are used. The extension does not retrieve full channel history, attachments, images, or linked documents. Slack markup changes can require adapter updates, and automatic account detection is not available in every layout. Always review AI-generated replies.

Store publication still requires publisher/support details, a public privacy-policy URL, reviewer access where required, and Google's review. Follow the [release checklist](store/RELEASE_CHECKLIST.md).

## Roadmap

Planned for future development; these features are not implemented in the current release.

- [ ] Integrate additional AI providers and models beyond the current OpenAI connection.
- [ ] Build a desktop application for macOS.
- [ ] Build a desktop application for Windows.

No delivery dates have been set.
