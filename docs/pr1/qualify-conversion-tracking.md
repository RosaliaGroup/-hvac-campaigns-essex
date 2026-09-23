# PR-1 — fix(qualify): error state + conversion tracking

Separate commit, scoped exactly as you specified: no form-field, endpoint, redirect, or URL changes to `/qualify` / `/assessment`.

## (a) `onError` fix

`client/src/pages/Qualify.tsx` — the lead-capture mutation's `onError` used to call `setSubmitted(true)`, showing the visitor the same "You're All Set!" success screen (with their estimated rebate) as a real success, even when the submission never reached the CRM.

Now: a new `submitError` state shows an inline failure banner on the booking step — "We couldn't submit your request — please try again," with a `tel:` link to `(862) 423-9396` — and the submit button relabels to "Try Again." The Turnstile token is cleared on error (tokens are single-use; resending a possibly-already-consumed token on retry would just cause a second, confusing failure — clearing it makes the server fall back to the existing Layer-1 content guard on retry, per `Turnstile.tsx`'s documented behavior).

## (b) Conversion tracking

`Qualify.tsx` now imports `trackConversion` from `client/src/lib/conversions.ts` and fires it **only** in `onSuccess` (confirmed success — never on error, never on button click):

```ts
trackConversion(
  "residential_quote_request",
  { form_type: "assessment", service_category: "assessment", customer_segment: "residential" },
  { dedupeKey: `qualify:${loadedAt.current}` },
);
```

**Event bucket chosen:** `residential_quote_request` — the closest existing category in `ConversionEvent` (this page is the residential heat-pump rebate/assessment funnel; there's no dedicated `assessment` bucket in the current 10-event enum, and adding a new one felt like more surface than this bug-fix PR should touch — `form_type: "assessment"` carries the distinction instead, exactly as you asked). `dedupeKey` prevents a double-fire from a retry or re-render.

### Env vars to set in Netlify

`VITE_ADS_LABEL_RESIDENTIAL_QUOTE_REQUEST` is the one this specific fix needs. From `client/src/lib/conversions.ts`, the full list of per-event labels the codebase already supports (all currently unset except the hardcoded `quote_request` fallback):

| Env var | Feeds this event | Used by |
|---|---|---|
| `VITE_ADS_LABEL_RESIDENTIAL_QUOTE_REQUEST` | `residential_quote_request` | **`/qualify` + `/assessment` (this fix)** |
| `VITE_ADS_LABEL_CONTACT_FORM_SUBMIT` | `contact_form_submit` | Contact page forms |
| `VITE_ADS_LABEL_SCHEDULE_SERVICE` | `schedule_service` | (not currently called from any page — reserved) |
| `VITE_ADS_LABEL_COMMERCIAL_QUOTE_REQUEST` | `commercial_quote_request` | Commercial LP forms |
| `VITE_ADS_LABEL_SERVICE_REQUEST` | `service_request` | (not currently called) |
| `VITE_ADS_LABEL_REPAIR_REQUEST` | `repair_request` | Emergency/repair LP forms |
| `VITE_ADS_LABEL_INSTALLATION_REQUEST` | `installation_request` | Install-intent forms |
| `VITE_ADS_LABEL_REPLACEMENT_REQUEST` | `replacement_request` | (no reachable prod surface per earlier conversion-tracking audit) |
| `VITE_ADS_LABEL_MAINTENANCE_PLAN_INQUIRY` | `maintenance_plan_inquiry` | Maintenance offer forms |

**Where the label comes from in the Ads UI:** Google Ads → Tools & Settings (wrench icon) → **Conversions** → find (or create) the conversion action for that event → open it → **Tag setup** → "Use Google Tag Manager" is not what you want here (this site uses gtag directly) — choose **"Install the tag yourself"** → the snippet shown contains `send_to: 'AW-17768263516/XXXXXXXXXXXXXXXXXXXX'`. The part after the slash (a ~20-22 character string, this account's format looks like `DY_nCO3H4t0cENzeyJhC` per the existing hardcoded `quote_request` fallback) is the label — that's the value for the env var, not the whole `send_to` string. Set it as a **build-time** environment variable in Netlify (Site settings → Environment variables), not a runtime one — these are read via `import.meta.env` at build time, so a new deploy is required after setting them.

Only `VITE_ADS_LABEL_RESIDENTIAL_QUOTE_REQUEST` is required for this specific PR-1 fix to start reporting Ads conversions for `/qualify`/`/assessment`. The rest were already-known gaps from the earlier conversion-tracking audit (see `step0-audit.md`), listed here for completeness since you asked for "the exact variable names I need" — set as many or as few as apply to campaigns you're actually running.
