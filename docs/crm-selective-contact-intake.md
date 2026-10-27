# Mechanical Enterprise CRM contact intake policy

## What becomes a completed Contact
A completed CRM contact requires **both** a valid email and a phone number with 10–15 digits. Only these sources are eligible:
- **Task prospect:** `gmail-prospecting` (specifically labeled prospecting emails that create follow-up tasks) or `verified-hvac-prospect`.
- **Selected Gmail correspondent:** `gmail-selected`, chosen by an authorized CRM user from the synced Gmail address list, with name and phone supplied.
- **Manual contact:** `crm-manual`, entered with name, email, and phone.
- Existing explicitly linked customers (`crm`) are preserved in Communications, but are not bulk imported or auto-enriched by this new prospecting worker.

A task-sourced prospect without a phone is a **staged prospect**, not a completed Contact. The task and email history remain available while enrichment attempts to find a verified number. If no verified phone exists, the record remains in the Contact Enrichment review queue. Incoming leads, SMS, and emails are never discarded for missing information.

## Gmail
The Gmail integration continues to sync message history, bounces and opt-outs. It **does not** create Contacts or customers for every sender/recipient. An operator can choose **Sales → Tasks → Contact Enrichment → Add contact → Select from Gmail** to import a specific synced correspondent after supplying their verified name and phone. **Add manually** provides the same required fields without a Gmail lookup.

Older automatic Gmail imports are preserved for audit/history but excluded from the completed Contacts list. This change does not delete or overwrite existing contacts.

## Automatic enrichment
On an eligible new or updated contact, the CRM queues enrichment immediately. A durable worker runs each minute to reconcile interrupted requests and existing eligible task prospects. The worker:
1. Checks exact email, valid phone and CRM source.
2. Applies bounce, opt-out and do-not-contact suppression.
3. Requires a verified name and company before querying Lusha for missing phone data.
4. Uses Lusha matching and only accepts provider-classified business/mobile numbers, saving the source and reading the value back.
5. Researches available verified company, LinkedIn and social information without inventing URLs or marking any profile followed.
6. Promotes a task prospect to completed Contacts only after email and phone are valid.

### Cost and safety
Automatic Lusha searches/reveals use an atomic credit reservation in `crmAutoEnrichmentCreditBudget`, default **10 credits per UTC day**, configurable via `CRM_AUTO_ENRICH_DAILY_CREDIT_LIMIT` (0–100). Set `CRM_AUTO_ENRICH_ENABLED=false` to stop the automatic worker. A worker interrupted during a potentially paid call is sent to human review rather than automatically charged again. Provider compliance restrictions, bounce suppressions, and opt-outs are not bypassed. No email, SMS, call, or LinkedIn follow is initiated by enrichment. A cell number never implies SMS consent.
