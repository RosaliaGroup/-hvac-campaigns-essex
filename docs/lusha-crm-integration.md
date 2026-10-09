# Mechanical Enterprise CRM — Lusha integration

## Connection
The Lusha ChatGPT connector and the Mechanical Enterprise Railway application have separate credentials. The connected ChatGPT app cannot expose or transfer its OAuth token to Railway.

To activate CRM lookups, generate a Lusha API key in your Lusha dashboard and store it as the **Railway service variable `LUSHA_API_KEY`** on the Mechanical Enterprise backend service. Never paste the key into GitHub, a chat, a browser form, or a public repository. A new Railway deployment may be required for the service to pick up the variable.

The CRM's **Sales → Tasks → Contact Enrichment → Review contact** panel shows connection status and an explicit **Check contact with Lusha** button. No Lusha searches or reveals run automatically on page load or startup.

## Credit controls and verification
1. The operator confirms the contact's **full name, company, and email** in CRM.
2. An explicitly approved preview calls Lusha V3 `/contacts/search`; search may consume credits. It never reveals phone numbers.
3. The CRM rejects **COMPLIANCE_RESTRICTED**, **NOT_FOUND**, and mismatched full name/current employer results. Do not retry restricted records through another provider or route.
4. A paid phone reveal is a separate explicit action. The UI shows the provider's credit cost (normally 5 credits). It is disabled when no phone is available. A contact that already has a CRM number is not eligible for a paid phone reveal.
5. The server calls `/contacts/enrich` with `reveal: ["phones"]`, and vendor waterfall disabled. It **revalidates identity** before saving a missing number.
6. The phone is saved as **business** only when Lusha explicitly labels it direct/work/office/business; **cell** only when Lusha explicitly labels it mobile. All writes are read back from CRM.
7. Matched LinkedIn person profiles may be saved with explicit review; **saving a URL never follows the account**.
8. A mobile number is **not SMS opt-in**. Existing SMS consent, opt-outs, and bounce suppression are unchanged.

## Known data-quality issue
A Lusha preview for `anil@fncusa.com` returned an Anil Bansal working at TCS in India. This is not the intended First National contact. The CRM identity matcher rejects this result, even though the name matches.

## Operational limitations
- CRM Lusha lookups require an API key and plan entitlements independent of ChatGPT.
- Lusha may restrict public-sector contacts. These restrictions must be respected.
- A CRM record with only an email address cannot be automatically matched by identity; enrich its verified name and company first.
- The feature is **on demand**, not an unattended bulk credit-spending job.
- LinkedIn follow actions still require a separately authorized social account and a supported API; the CRM only records a manual confirmation.
