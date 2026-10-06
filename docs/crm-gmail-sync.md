# Gmail and SMS contact timeline

The unified CRM screen is `/contacts/communications`, under Sales → Communications. Existing customer records and the SMS inbox remain in their existing screens.

Connect **sales@mechanicalenterprise.com** through Settings → Integrations. Reconnect once to grant the added `gmail.readonly` scope; enable the Gmail API on the existing Google Cloud OAuth project if it is not already enabled. The server verifies the actual Gmail profile before writing any email to the CRM. No send, delete, archive, or label operations are performed.

Click **Sync Gmail · last 30 days**. Each background job reads up to 25 messages, returning a continuation token for **Sync next email page**. Repeat until no continuation remains. Repeat a fresh sync to capture newer sent mail and replies. In production, a read-only poller refreshes sent mail/replies from the last two days every five minutes after the correct account grants permission. It reads one 25-message page per run, continuing through pages before returning to the newest mail. Set `GMAIL_CRM_SYNC_ENABLED=false` to disable it. The manual 30-day sync supports initial backfill. No push subscription is installed.

The existing shared encrypted Google token store is reused. Message IDs provide idempotence; thread IDs are preserved. Only plain-text MIME content is displayed; HTML-only messages show a fallback. Attachments are not downloaded. Multi-recipient messages are stored once, under the first external recipient's contact, with the To header visible. External contacts can currently be searched by name, email, or phone (100 most recently updated matches).

No new schema migration is required beyond existing migration 0081. Missing tables surface as an error, not an empty successful sync. Jobs use the existing in-process registry: interrupted jobs can be safely retried after a restart. Live production Gmail validation requires deploying this change and granting the Google permission.
