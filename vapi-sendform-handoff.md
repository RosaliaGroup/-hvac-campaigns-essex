# Vapi `sendForm` — Mechanical Enterprise handoff

Branch: `fix/vapi-mechanical-send-form`. This documents the new **Mechanical-owned**
`sendForm` endpoint and the **manual Vapi dashboard change** the owner must make.
No dashboard change was (or can be) made from the repo.

## What changed (code)

`sendForm` now has a dedicated, authenticated, Mechanical-owned server endpoint
that texts the caller the in-repo **/qualify** booking form via **Telnyx**. It is
separate from the existing tRPC `webhooks.vapiTools` endpoint (which serves
`bookAppointment` / `rescheduleAppointment` / `getCallerInfo` and is left
untouched), so `sendForm` can carry its own shared secret.

- `server/services/vapiSendForm.ts` — endpoint + send/consent/idempotency/history logic
- `server/_core/index.ts` — registers the route
- `.env.example` — documents `VAPI_TOOL_SECRET`
- `client/src/pages/AIAssistantPrompts.tsx` — TOOL 2 doc updated to the new endpoint + `/qualify`

## Endpoint contract

| | |
|---|---|
| **URL** | `https://mechanicalenterprise.com/api/webhooks/vapi/send-form` |
| **Method** | `POST` |
| **Auth header** | `x-vapi-secret: <VAPI_TOOL_SECRET>` (required) |
| **Content-Type** | `application/json` |

`VAPI_TOOL_SECRET` must be set on the backend (Railway). If it is unset the
endpoint returns **503** and sends nothing — it never runs unauthenticated.
Wrong/missing secret → **401**. No `sendForm` call in the body → **400**.

### Request body (standard Vapi tool-calls envelope)

```json
{
  "message": {
    "type": "tool-calls",
    "call": { "id": "<vapi-call-id>" },
    "toolCallList": [
      {
        "id": "<tool-call-id>",
        "function": {
          "name": "sendForm",
          "arguments": "{\"phone\":\"+18624191763\",\"type\":\"booking\"}"
        }
      }
    ]
  }
}
```

`arguments` may be a JSON string (Vapi default) or an object. Fields:
- `phone` (string, required) — caller's number; normalized to E.164 server-side.
- `type` (string, optional) — `"booking"` (default) or `"reschedule"`.
- `name` (string, optional) — used only for the SMS greeting.

### Response body (Vapi tool-result shape)

```json
{ "results": [ { "toolCallId": "<tool-call-id>", "result": "{\"success\":true,\"smsSent\":true,\"formUrl\":\"https://mechanicalenterprise.com/qualify\"}" } ] }
```

The inner `result` string is `{ success, smsSent, formUrl? }` — intentionally
minimal. It never contains phone numbers beyond what Vapi already holds, emails,
provider errors, or credentials. HTTP status is always **200** once authorized
(even on a send failure) so Jessica can gracefully fall back to the manual
`bookAppointment` flow; `smsSent:false` signals the fallback.

Behavior:
- Invalid / missing phone → `{ success:false, smsSent:false }`, nothing sent.
- Opted-out number → `{ success:false, smsSent:false }`, nothing sent.
- Duplicate Vapi retry (same `toolCallId`, or an identical message to the same
  number within 10 min) → `{ success:true, smsSent:true }`, **no second text**.
- Booking and reschedule both link to `https://mechanicalenterprise.com/qualify`
  (origin overridable via `PUBLIC_SITE_URL`); only the SMS wording differs.

## Required Vapi dashboard change (owner action — manual)

In the Vapi dashboard for assistant **Jessica** (`8cf657a7-9b9a-4060-89bd-0d8ae4a5249a`,
org `c9050f68-…`), edit the **`sendForm`** tool:

1. **Server URL** → `https://mechanicalenterprise.com/api/webhooks/vapi/send-form`
   (replace whatever it currently points to — see verification below).
2. **Custom header** → add `x-vapi-secret` = the same value set as `VAPI_TOOL_SECRET`
   on the backend. (If the tool config exposes a generic "server secret" field,
   that maps to Vapi's `X-Vapi-Secret`; use the custom-header form to match
   `x-vapi-secret` exactly as this endpoint reads it.)
3. Keep the tool parameters as-is: `phone` (required), `type`, optional `name`.
4. Leave `bookAppointment` / `rescheduleAppointment` / `getCallerInfo` untouched —
   they continue to use the existing tRPC webhook.

Set `VAPI_TOOL_SECRET` (generate: `openssl rand -hex 32`) in Railway **before**
repointing the tool, or the endpoint will 503.

## How to confirm the old Rosalia endpoint is no longer referenced

1. **Vapi tool config**: the `sendForm` tool's Server URL must be the
   `mechanicalenterprise.com` endpoint above — **not** any `*.netlify` function,
   not `book.rosaliagroup.com`, not a shared/Rosalia function. Check the tool's
   server URL and any tool that previously fanned out by `property`.
2. **Live call test** (staging assistant): trigger `sendForm`; the caller should
   receive an SMS containing `https://mechanicalenterprise.com/qualify` and
   **never** `book.rosaliagroup.com` / `iron65` / a TextBelt sender.
3. **Provider check**: the send appears in **Telnyx** logs from
   `TELNYX_FROM_NUMBER` (+15516007027), not TextBelt/Twilio.
4. **Repo grep** (already clean on this branch):
   `grep -rniE "rosalia|textbelt|book\.rosalia|/lp/heat-pump-rebates" server/services/vapiSendForm.ts`
   returns nothing.
5. **History**: a row lands in `smsInboxMessages` (direction `outbound`,
   `sentByName = "Jessica (AI)"`) with the Telnyx message id.

## Notes / corrections

- **Calendar**: unchanged and intentionally so. Calendar selection remains
  database-backed via `googleCalendarConnections.googleCalendarId` (default
  `"primary"`). No `MECHANICAL_CALENDAR_ID` was added — that env var does not and
  should not exist.
- **Business phone discrepancy** (reported, not changed here):
  `netlify/functions/sendReferralEmails.js` uses one number while the Jessica
  prompts / `appointmentSms.ts` use `(862) 423-9396`. Needs an owner decision on
  the canonical customer-facing number before any copy change.
- **Assistant docs**: `AIAssistantPrompts.tsx` TOOL 2 previously documented
  `/lp/heat-pump-rebates`; it now reflects the chosen `/qualify` + the new
  authenticated endpoint. The server controls the URL regardless of tool args.
