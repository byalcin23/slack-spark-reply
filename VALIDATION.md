# Validation

## Current preview: 1.0.4

- 23 Python tests passed during release development.
- Packaged browser acceptance checks run against the exact release ZIP in an isolated Chrome for Testing profile.
- Coverage includes trusted extension access, session-only API credentials, sanitized provider failures, identity detection and persistence after panel reload, workspace isolation, duplicate display names, grouped messages, nested Slack markup, timestamp exclusion, native typing, draft insertion without sending, theme/language preferences, and panel dismissal.
- Optional local browser checks cover main/thread separation, hidden messages, changed drafts, navigation, and isolated keyboard events.

## Simplified Chinese interface

All 101 interface strings have Simplified Chinese translations. Packaged acceptance and local UI regressions passed, including Chinese settings/reply labels, saved language preference, and Chinese provider advice while retaining English as the reply language.

## Scope of verification

Browser acceptance uses synthetic Slack markup and mocked OpenAI responses. It does not verify every live Slack layout or guarantee the wording produced by a live model. A successful live OpenAI generation has not been established by these automated checks.

The CRX is signed locally for development/distribution environments that support it. It is not Chrome Web Store-signed or approved, and it is not a normal direct-install option for consumer Chrome on macOS/Windows.

The ZIP builder checks its allowlist, resource references, icon dimensions, permissions, and credential-like strings. Runtime credentials and the CRX private signing key are excluded from Git and release packages.

## References

Sender and message selector coverage was informed by [Slack DM Visible Exporter](https://github.com/byalcin23/slack-dm-visible-exporter). Account detection is restricted to account controls; conversation headers do not identify the current user.
