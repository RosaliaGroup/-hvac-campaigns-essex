# PR-1 Step 2 — Results

## Customer-facing URL lock-in test (done)

Traced every URL a Vapi tool, SMS template, or transactional email sends directly to a real customer today (grepped `mechanicalenterprise.com/` across `server/`, `netlify/functions/`, `shared/`):

| URL | Sent by |
|---|---|
| `/referral` | Vapi `sendReferralLink` SMS (`server/services/referralSms.ts` `CUSTOMER_REFERRAL_LINK`, locked by `server/referralSms.test.ts`) + mentioned in `netlify/functions/sendReferralEmails.js`'s referral-program confirmation email |
| `/qualify` | Vapi `sendForm` tool (`server/services/vapiSendForm.ts`) + `sendReferralEmails.js` `BOOKING_URL` |
| `/assessment` | Same `Qualify.tsx` component as `/qualify`; `LiveChatWidget.tsx` `ASSESSMENT_URL` |
| `/rebate-calculator` | Rebate-calculator client confirmation email (`server/routers/rebateCalculator.ts`, as `/rebate-calculator#assessment` — the hash isn't part of route matching) |
| `/pseg-rebate-contractor-nj` | PSE&G rebate-checklist customer email (`server/routers.ts`) |
| `/promos` | Not a send-target, but you asked for it tested live — included for completeness |

Also checked and ruled out as customer-facing: `/lead-dashboard`, `/assessment-submissions` (both are **staff** notification-email links, not sent to customers — confirmed by reading the surrounding email template: "Log in to the dashboard to follow up"). Found one unrelated, pre-existing, low-stakes bug while tracing this: `server/services/campaignEngine.ts:260` has a fallback AI-campaign-recommendation `finalUrl` of `/lp/emergency` (should be `/lp/emergency-hvac`) — this is a *suggested* campaign a staff member reviews before pushing to Google Ads, not sent to anyone automatically, and not part of this PR's scope. Flagging only.

**Test added:** `netlify/edge-functions/inject-meta.test.ts` — new `describe("getRouteStatus — every URL sent directly to customers by Vapi/SMS/email stays registered")`. Asserts every URL above resolves (`isRegistered: true`) and is treated as real marketing content, not CRM/internal (`isInternalOrDynamic: false`). All 11 tests in the file pass. Committed separately (`f1535c8`).

## Push — done

`pr1-technical-hygiene` pushed to `origin` (`github.com/RosaliaGroup/-hvac-campaigns-essex`). No merge, no production deploy. GitHub confirmed the branch exists and offered a "Create a pull request" link — no PR opened.

## Netlify deploy preview — blocked, needs you

This session has no Netlify or GitHub authentication:
- `netlify status` hangs waiting on an interactive browser login that can't complete in this non-interactive sandbox (no stdin).
- `gh auth status` → not logged in; no `GITHUB_TOKEN`/`NETLIFY_AUTH_TOKEN` in `.env`.
- Guessed the likely branch-deploy URL pattern (`https://pr1-technical-hygiene--<site-slug>.netlify.app`) against the site slug from memory (`strong-pothos-11fbc0`) — got a 404. Could be a wrong slug, or this site may only build deploy previews for an actual pull request rather than a bare branch push (common Netlify config) — I don't have visibility into that setting from here.

**I have not run any of the live Step 2 checks** (curl header table, live 301/404s, referral SMS link path, `/assessment`/`/qualify`/`/promos`/rebate-calculator live load, Lighthouse, GA4 DebugView) — there is no confirmed live URL to run them against yet. Everything above this line is real; nothing below is fabricated.

**To unblock, one of:**
1. You run `netlify login` yourself in a real browser session (type `!netlify login` in chat to run it in this session, or run it in your own terminal) and confirm auth is saved — I can then check deploy status and fetch the preview URL.
2. Tell me whether this site builds a preview from a bare branch push, or whether it needs an actual pull request opened first (not merged) — if the latter, say so and I'll open one against `main`.
3. You paste the preview URL yourself once Netlify emails/shows it to you, and I'll run every Step 2 check against it from here.

Once I have a real, working preview URL, this file will be updated in place with actual curl output, screenshots/observations, and pass/fail for each Step 2 item — nothing will be marked done until it's actually been hit.
