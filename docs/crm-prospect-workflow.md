# CRM prospecting workflow

CRM → Sales → Prospecting & Follow-up (`/growth`). The workflow is disabled by default until an administrator selects an active follow-up owner and enables it.

The CRM server researches up to 10 named North Jersey decision-makers once per Eastern hour, 9 AM–5 PM (exclusive), using the existing Anthropic search integration. Every candidate needs a cited public page and an evidence quotation containing its name and direct email. Gabriel Lopez, Giga Holdings, generic inboxes, duplicate companies in a batch and duplicate email addresses are excluded. No model-generated phone number or consent is accepted.

A persistent queue stores the prospect before sending. The worker saves an external contact and a lead (consent `unknown`), checks Gmail Sent across its entire history and skips previous recipients or existing leads. Gmail must be connected in CRM Integrations as sales@mechanicalenterprise.com, with read and send permissions. The CRM connection is separate from ChatGPT's Gmail connector. Each intro attempt consumes one of 10 slots per Eastern hour, atomically across replicas. Ambiguous send failures remain `email_sending` for manual review; they are never automatically retried.

Confirmed introductions create tomorrow's assigned human follow-up, with an immediate notification and another when due. The owner records an outcome in the queue. “Followed up — keep warm” enables one email check-in after seven days and one further check-in 30 days later (three total emails including the intro), after which the sequence completes. Every reply hands control to a human; matching delivery failures permanently suppress that queue address. STOP/opt-out and existing growth channel breakers remain in force. No outbound voice calls are added. SMS intros require an admin-entered mobile number plus a record of actual opt-in; research never sets opt-in. CRM SMS compliance and kill switches are checked at send time.

Research failures leave the workflow enabled, persist the error, and allow independently queued work to continue. Run now returns an async job; completed dispatch counts are not treated as delivered messages. A restart does not erase the queue or the hourly research/send limits. Rows left `preparing`, `email_sending`, or SMS `sending` need mailbox/carrier reconciliation before any manual retry.

## Production cutover

1. Review and approve `drizzle/0082_prospect_workflow.sql` under `drizzle/README.md`. Take and verify a fresh logical backup and diff the live schema. Do not run `db:push`. The SQL creates two new tables and inserts one disabled settings row; it does not alter existing CRM data.
2. Apply that exact SQL manually. Verify both tables, the unique email and due indexes, and the disabled singleton row. Deploy the PR after checks pass.
3. Verify CRM Gmail identity/read/send, Anthropic search, and (for opted-in SMS only) Telnyx availability. Select Ana's actual active team-member record, enable, and run once from the CRM.
4. Inspect a real verified prospect, the created CRM lead/contact, a Gmail-confirmed send, the assigned next-day task, and its notification. Verify an existing Sent recipient is skipped, an unconsented phone is not texted, and a reply stops nurture.
5. Only after successful CRM verification, disable the combined ChatGPT outreach automation `6ac3fad77210819192361cb3367640ba`. Keep the two duplicate ChatGPT automations disabled. Never allow overlapping prospect discovery/send workers during cutover: pause the combined ChatGPT task immediately before enabling the CRM worker, and resume it only if the CRM validation fails after disabling the CRM worker.

Rollback: disable the CRM workflow in its settings first. Leave the new tables and audit rows in place. Revert the application change if needed. Do not drop tables to roll back; retained rows prevent duplicate introductions.
