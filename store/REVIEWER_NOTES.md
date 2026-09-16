# Spark Reply — reviewer and dashboard notes

This document is prepared for the developer dashboard. It is not a submission. Replace publisher fields and complete the acceptance checks in RELEASE_CHECKLIST.md first.

## Single purpose

Help users compose replies in Slack's web application by generating draft alternatives from the conversation context they select, their current draft, and an optional note.

## Permissions justification

| Manifest access | Justification |
| --- | --- |
| `storage` | Save local language/theme/model preferences and hold the user's OpenAI API key in session-only storage. No stored message history. |
| `https://api.openai.com/*` | Submit the user's requested generation and connection-test requests directly to the OpenAI API over HTTPS. |
| Content script at `https://app.slack.com/client/*` | Display the reply button, read selected visible conversation context, and insert the reply chosen by the user into the focused Slack draft. |

If the final manifest includes another permission, document its actual use here before submission. Broad access to all websites, browser history, Slack cookies, Slack API tokens, and a local helper are not needed for this release.

## Data disclosure checklist

Use the current dashboard labels and match the implementation. Do not choose “no data collected” merely because requests go directly to OpenAI.

- **Personal communications:** selected Slack messages and the user's draft.
- **Website content / user-provided content:** selected message text, the optional note, and generated replies.
- **Personally identifiable information:** the replying user’s display name and available Slack member ID, plus sender names and available member IDs in selected message context; messages can contain personal details.
- **Authentication information:** the user-provided OpenAI API key, held only for the browser session and sent only to OpenAI.
- No advertising, analytics, credit scoring, sale of data, or unrelated browsing history collection.
- OpenAI may receive any sensitive information the user includes in selected message content. Do not claim that such information is automatically redacted.

These are implementation-based disclosure recommendations, not a claim that the dashboard has been completed. Chrome requires the listing, privacy fields, privacy policy, and actual behavior to agree. [Official privacy fields guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

## Remote code

All executable JavaScript, CSS, HTML, and icons ship in the extension package. The remote OpenAI response is parsed as JSON/text and displayed as content; it is not executed. No remote script, `eval`, or downloaded executable model is needed. This follows the self-contained code requirement for Manifest V3. [Official MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)

## Test instructions

1. Install the candidate in a clean Chrome profile and pin Spark Reply.
2. Click the toolbar icon. Settings should appear in the extension UI without requiring a new browser tab.
3. Choose English or Turkish. Open settings and confirm labels follow that language. Change the theme and reply language.
4. Enter a reviewer-provided OpenAI API key with available API usage and connect. The key is session-only and API usage may be billed to the key's owner.
5. Open a Slack test workspace in Chrome with synthetic messages. Use a test channel or a conversation with yourself; do not use production customer conversations.
6. Click the sparkle near the composer. Inspect context, exclude an irrelevant message, and enter a note describing the reply you want.
7. Generate suggestions. Verify three different options appear and the selected reply language is used.
8. Insert one suggestion. Verify only the draft changes; no Slack message is sent. If the draft changed while the panel was open, insertion should not overwrite it silently.
9. Open a thread and confirm its context is distinct from the main conversation. Click outside the panel and confirm it closes.
10. Disconnect, then try generation. A setup/error state should appear, not a fabricated live answer. Restart Chrome and confirm the API key is no longer connected.

## Reviewer access — owner action required

Before submitting, the publisher must provide a practical review path in the dashboard's private test instructions. If credentials are needed, create dedicated, limited-access review credentials through the provider and a synthetic Slack workspace, or agree on another supported review path. Never put a personal production key in this repository, public listing, screenshots, ZIP, or these notes. This draft contains no credentials and does not claim that Google will supply paid API access.

## Scope for this candidate

Chrome extension only; Slack desktop application is not supported. The optional local prototype server and demo in the source workspace are development tools and are excluded from the extension package. Chrome Web Store acceptance and live Slack compatibility are separate from automated fixture tests.
