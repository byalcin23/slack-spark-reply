# Spark Reply privacy policy

**Publication status:** draft for the standalone Chrome extension. Replace every `MUST_REPLACE_…` field and confirm the implementation before publishing this policy.

**Publisher:** MUST_REPLACE_PUBLISHER_NAME  
**Privacy contact:** MUST_REPLACE_SUPPORT_EMAIL  
**Effective date:** MUST_REPLACE_EFFECTIVE_DATE

## What Spark Reply does

Spark Reply helps you draft replies in Slack's web application. It does not send Slack messages automatically. It connects directly from your Chrome extension to OpenAI using an API key you provide. The publisher does not run a backend that receives these requests.

## Information handled

When you open the reply panel, Spark Reply reads a limited selection of messages visible in the current Slack conversation or thread, including sender names and available Slack member IDs, and the current draft. You can review the selected context before requesting suggestions. Your optional note explains what you want to say. The account control is used to identify who you are replying as. If detection is unavailable, you enter your display name. The display name and available account ID are saved locally in extension storage per workspace to restore your identity after refresh. Edit or clear the name in the panel.

When you request suggestions, your own Slack display name and available member ID, selected messages and sender identities, draft, note, language preferences, and model instructions are sent to OpenAI over HTTPS. Generated suggestions return to the extension for your review. The extension does not retrieve all channel history, attachments, or the contents of linked documents.

Your OpenAI API key is used only to authenticate requests to OpenAI. A connection test may send a small synthetic sample to verify that the key and model work. It does not need your Slack messages.

## Storage and retention

- **API key:** kept in Chrome's extension session storage, accessible only to trusted extension contexts. The extension does not write the key to persistent local or sync storage. Chrome clears session storage when the browser restarts or the extension is reloaded, updated, or disabled. You can remove the connection from settings.
- **Preferences:** interface language, reply language, theme, and selected model are stored locally in your Chrome profile until changed, reset, or the extension is removed. These are not synchronized by Spark Reply.
- **Conversation and drafts:** held temporarily to display the panel, prepare requests, and insert a selected reply. Spark Reply does not maintain a persistent conversation history or save message text in extension storage.
- **API provider:** OpenAI processes the content sent to its API under its own terms and your account's data controls. Requests set `store: false`; this is not a promise of zero retention and does not override the provider's abuse monitoring or account policies. See [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data/).

## Sharing and use

Spark Reply transmits selected content to OpenAI only to provide the requested writing assistance. The API key is sent to OpenAI for authentication. The publisher does not receive conversations, keys, or generated replies through an application backend.

Spark Reply does not include advertising, analytics, tracking pixels, or a sale of user data. It does not use data for advertising, credit decisions, or purposes unrelated to reply drafting. The publisher does not read your Slack conversations through the extension.

Spark Reply's use of user information follows the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is used and transferred only as needed for the extension's disclosed writing assistance.

## Your choices

You decide which visible messages to include and when to request suggestions. You can omit context, close the panel, remove your API connection, or uninstall the extension. Removing the extension clears its local preferences. Removing the connection prevents further authenticated API requests; it does not delete data already processed by OpenAI. Manage or revoke your API key through your OpenAI account and use the provider's processes for provider-held data.

Only include content you are authorized to share with OpenAI. Your workplace may apply additional rules to Slack messages and third-party services.

## Support and changes

If you contact MUST_REPLACE_SUPPORT_EMAIL, the publisher receives the information you choose to include in that communication. Do not send API keys or private Slack messages in support requests. The publisher uses support correspondence to answer your request and deletes it when no longer needed, subject to applicable obligations. Confirm this support handling process before publishing.

Changes to this policy will be published at MUST_REPLACE_PRIVACY_URL with a new effective date. Material changes to the extension's data practices will be explained before those changes take effect.
