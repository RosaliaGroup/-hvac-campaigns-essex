# PR-1 Step 0 — Repo Audit

Branch: `pr1-technical-hygiene` (based on `origin/main` @ `196a286`, confirmed identical — local `main` ref was stale, not the repo state itself). Read-only audit; see `step1-changes.md` for what was actually implemented and, critically, what was deliberately **not** changed pending owner sign-off.

## 1. File locations

| Item | Location | Notes |
|---|---|---|
| Redirects/headers | `netlify.toml` and `client/public/_redirects` | Both define a catch-all `/* → /200.html 200`. **`_redirects` is evaluated before `netlify.toml` and wins first-match** — Netlify's documented precedence. This means `netlify.toml`'s `[[redirects]]` blog 301s were never actually reachable through that mechanism; they work because they're *also* implemented directly in `netlify/edge-functions/inject-meta.ts`'s `handler()`, which returns a 301 before `context.next()` runs. `[[headers]]` blocks are unaffected (separate Netlify subsystem) — the new noindex headers added in this PR work normally. |
| SPA fallback | `/* → /200.html` (both files) | `200.html` is a deliberately-preserved *empty* SPA shell (see `scripts/prerender.ts`), distinct from the prerendered `index.html`. Already correct before this PR. |
| Prerender script | `scripts/prerender.ts` | Pre-existing, already prerenders every sitemap URL to a flat `{route}.html`. Not built from scratch in this PR — item A's real gap was true 404 status + route-scoped metadata, both fixed in `inject-meta.ts`. |
| Sitemap generator | `scripts/generate-sitemap.ts` | Pre-existing; extended in this PR to also emit `netlify/edge-functions/routes-manifest.json` (broader, unfiltered) and to apply a new sitemap-only exclusion list (item C). |
| CRM route gating | `client/src/lib/navigation.ts` (`isInternalRoute` / `INTERNAL_ROUTE_PREFIXES`) | Pre-existing, already gates the chat widget and dashboard chrome. Reused as the single source of truth for item B's noindex headers, item A's 404 classification, and the new `useCrmMeta` hook — rather than inventing a second list that could drift. |
| Homepage | `client/src/pages/Home.tsx` | |
| Header/Footer/logo | `client/src/components/Navigation.tsx:38`, `Footer.tsx:15` | Logo still served from `files.manuscdn.com` (third-party session-scoped host) — **not migrated in this PR**. Downloading the asset from this sandboxed environment failed (DNS to files.manuscdn.com doesn't resolve outside a browser context, and extracting the already-rendered image via the browser hit a base64-exfiltration guard with no other download path available). Needs a human to save the image and commit it to `client/public/assets/logo.png`, or a session with direct network access. `og-default.png` (og:image default) was checked and is already a committed local asset — not on manuscdn, no action needed there. |
| `/commercial` case studies | `client/src/components/CaseStudies.tsx` | |
| `/promos` | `client/src/pages/PromosLanding.tsx` + `client/src/components/ResidentialCaseStudies.tsx` | |
| `/courses` | `client/src/pages/Courses.tsx` + `CourseDetail.tsx` | |
| Netlify functions | `netlify/functions/sendCallRecap.js`, `sendReferralEmails.js` only | Small surface — CRM/lead/booking API traffic proxies `/api/*` to the Railway backend, not Netlify functions. Untouched. |

### Bigger-than-expected finding: item A was half-built already

`scripts/prerender.ts` already prerenders every sitemap URL correctly (flat `{route}.html`, empty-shell `200.html` for non-prerendered routes). What it did **not** do: return a true HTTP 404 for unregistered routes (everything fell through to `/200.html` status 200), and it fabricated full SEO metadata for *any* `/hvac-[a-z-]+-nj`-shaped path via pattern matching alone — including non-existent ones like `/hvac-paterson-nj` — rather than checking whether that path was actually a registered route. Both are fixed in this PR (see `step1-changes.md` item A).

## 2. `/assessment` + `/qualify` dependency trace

**`/assessment` and `/qualify` are the same component** — both routes mount `Qualify.tsx` directly (`App.tsx`). Confirmed live dependents (grepped repo-wide):

- `server/services/vapiSendForm.ts` (+ its test) — the Vapi "Jessica" voice-AI `sendForm` tool references this URL.
- `client/src/components/LiveChatWidget.tsx` — `ASSESSMENT_URL` points here from the chat widget's "Book Free Assessment" and "See How Much I Qualify For" CTAs.
- `client/src/pages/SmsCampaigns.tsx`, `client/src/pages/AIAssistantPrompts.tsx` — SMS/AI script references.
- `client/src/data/blogPosts.ts` — internal blog links.
- `scripts/generate-sitemap.ts` — both URLs are in the sitemap (unchanged by this PR — item C explicitly keeps them).

**Nothing on `/qualify`/`/assessment` was changed except the two items the owner explicitly authorized** (see Step 1 "fix(qualify)" commit): the `onError` failure-state fix and confirmed-success-only conversion tracking. No field, endpoint, redirect, or URL changes.

## 3. `25C` / expired-tax-credit content grep

Blog content is already remediated — `client/src/data/__tests__/blogRebateClaims.test.ts` is a pre-existing compliance guard (not added by this PR) asserting no blog post outside two named legacy/explainer posts claims live 25C or a fabricated "$20K/$22K combined" total. Ran it: **3/3 passing** on `origin/main`.

**Not covered by that guard:** `client/src/data/adCopyLibrary.ts` still contains ~35 "$20K" ad-copy variants, including two that explicitly say "Combine federal 25C tax credit with PSE&G rebates" and "federal tax credits... up to $20K total" (25C expired 12/31/2025; today is 2026-09-23). Traced every import/call site (see `step1-changes.md` "adCopyLibrary trace" for the full result): **this file is a manual copy-to-clipboard reference library only** (`AdCopyLibrary()` component, `copyAll()` → `navigator.clipboard.writeText`), rendered on the `/google-ads-campaigns` internal page. It does **not** feed the page's live Google Ads API integration — that reads from a separate, hardcoded `CAMPAIGNS` array in the same file (`GoogleAdsCampaigns.tsx:31-170`), which was also checked and contains **no 25C or $20K/$22K claims** ("$16,000 NJ Clean Heat rebate" language throughout). Net: not urgent (nothing automated pushes the stale claim to a live ad), but it is copy a human could paste into a real campaign. No content change made in this PR per your instruction (report-only, since it's a reference file, not an automation feed).

## 4. Case-study / promos figure sourcing

No supporting records found anywhere in the repo for any of the four figures (Newark $95k/$68k, Jersey City $285k/$215k, Elizabeth $425k/$340k, promos $23,500/$29,800). Treated as unverified per your instruction; items I and J applied as written — see `step1-changes.md`.

---

## Earlier "lead funnel reconciliation" session findings — verified against code

| Finding | Verified detail |
|---|---|
| **`Qualify.tsx` `onError` bug** | `client/src/pages/Qualify.tsx` — a failed lead-capture mutation showed the same "You're All Set!" success screen as a real success, with no way for the visitor to know their submission didn't reach the CRM. **Fixed** — see Step 1. |
| **Missing `VITE_ADS_LABEL_*` env vars** | `client/src/lib/conversions.ts` — only `quote_request` has a hardcoded fallback label; 9 other conversion events resolve to `null` (no Ads conversion fires) until their per-event env var is set in Netlify. Compounding finding: `Qualify.tsx` didn't call `trackConversion` at all — **fixed** in Step 1, now fires `residential_quote_request` with `form_type=assessment` on confirmed success only. Exact env var names to set: see `step1-changes.md`. |
| **Homepage chat widget auto-open** | `client/src/components/LiveChatWidget.tsx` — auto-opens 8s after mount, `sessionStorage`-gated once per session, mounted on **every non-internal route** (not homepage-only). Left unchanged per your instruction. |

## Additional findings surfaced during implementation

- **`/referral` — live Vapi SMS destination, redirect NOT applied.** The original spec asked for `/referral → /partnerships` (301), same as `/rebate-calc`. Mid-implementation, `server/services/referralSms.ts` was found to define `CUSTOMER_REFERRAL_LINK = "https://mechanicalenterprise.com/referral"` — the exact URL the Vapi `sendReferralLink` voice-AI tool texts to real customers today, locked by `server/referralSms.test.ts`. Redirecting it would likely be harmless (a 301 still lands the customer on the right page) but touches a live, tested, SMS-distributed lead-generation channel without being asked to — outside this PR's explicit scope and against the hard rule to stop and report anything that could touch a working system. **Left completely unchanged**: no redirect, no sitemap change, no code change of any kind. Flagging for your explicit go-ahead before anyone touches it. `/rebate-calc → /rebate-calculator` was applied (no such dependency found).
- **Chat widget Stripe payment links are live, not placeholders.** `LiveChatWidget.tsx`'s code comment calls them "placeholders — replace with real links." Checked all four `buy.stripe.com` URLs directly (navigated to each, read the live page): all four are real, active Stripe Checkout sessions under "Mechanical Enterprise LLC," pre-filled with `ana@rosaliagroup.com` and a saved M&T Business Debit Card via Stripe Link — i.e., genuinely wired to the business's own Stripe account, not dead/placeholder links. Per your instruction, left untouched since they're real — the stale "placeholder" comment is a documentation issue, not a functional one, and yours to correct or not.
- **`Courses.tsx` has a second undocumented purchase CTA** beyond the one in the original PR-1 scope: a subscription "Choose Your Plan" selector with "Start {plan} Plan" buttons, separate from `CourseDetail.tsx`'s "Enroll Now." Both had no `onClick` handler at all (already non-functional, just visually live) — both disabled the same way (see Step 1 item K).
- **`Courses.tsx` has fabricated-looking student testimonials** (James Wilson, Maria Garcia, Robert Chen) with no supporting records — same unverified pattern as the `Partnerships.tsx` referral testimonials (item M). Not in original scope (item K was purchase-actions only); flagging for the same treatment as item M in a follow-up, not fixed here.
