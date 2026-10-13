# Outreach Send Queue implementation specification

## Goal
Replace chat-triggered outreach sends with an authenticated CRM page where each personalized email has a Send button at the top of its card, and sending updates that card in place without navigating away.

## Existing system
- `client/src/pages/CrmOutreachReview.tsx` already lists and approves verified direct-email prospect drafts.
- `server/routers/crmOutreachReview.ts` explicitly does not send messages. Approval is not authorization to send.
- Do not change existing review-only endpoints into implicit sends.

## Required implementation
1. Add an authenticated `/crm/outreach-send` page, linked from the CRM navigation. Display named contact, company, verified source, editable personalized subject/body, sender, and the company's complete configured signature. Place Send Email at the top of each prospect card.
2. Add an explicit single-recipient send mutation. Only send when the authenticated user clicks Send for that draft. Use the existing connected sales@mechanicalenterprise.com Gmail integration and token management; never expose Gmail credentials to the browser.
3. Immediately before sending, recheck suppressions, opt-outs, prior CRM communications, current Gmail sent history and incoming replies. Fail closed if reconciliation cannot complete. Reject generic addresses (info@, support@, office@, etc.) and unverified recipients.
4. Ensure idempotency and concurrency safety: atomic claim on the draft, stable idempotency key, prevent double clicks/retries from double sending, persist Gmail message/thread ID, sent timestamp, sender, and audit trail.
5. Render per-card states: Ready, Checking, Sending, Sent ✓ (with timestamp and Gmail link), Blocked (reason), Failed (retry only after safe reconciliation). Keep all cards and drafts in the same view.
6. Use the full configured Gmail signature including any supported HTML/logo assets. Do not claim Gmail automatically appends a signature to API sends; retrieve/persist the authorized signature, or fail with a clear configuration prompt.
7. Reconcile successful sends with CRM Contacts and Communications; preserve thread association and schedule day-2 human call and day-3 email follow-up only if no reply/human interaction. Never send automated follow-ups from a card click.
8. Add tests for duplicate prevention, opt-out, suppression, missing Gmail authorization, send timeout/ambiguous response, concurrent clicks, signature handling, and successful CRM reconciliation.
9. Do not seed contacts from chat unless source URLs and direct business addresses have been independently verified.

## Acceptance criteria
- One click sends exactly one email through the correct account, with no new ChatGPT message.
- In-place confirmation only after Gmail returns a successful send and message ID.
- No accidental resend on reload, retry, double click, or stale state.
- Existing review queue remains review-only until explicit send action.
- Build, typecheck, tests and deployment checks pass before merge.
