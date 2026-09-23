# PR-1 Step 2 — Regression Test Plan: what ran locally vs. what needs a deploy preview

No production deploy and no merge were made. This branch (`pr1-technical-hygiene`) has **not been pushed to origin** — opening a Netlify deploy preview requires a push, which is a visible/external action; asking separately before doing that.

## What was verified locally (this session)

| Check | Result |
|---|---|
| `npx tsc --noEmit` (whole repo) | Clean, 0 errors |
| `npx vitest run` (whole repo, 2223 tests, final run after every PR-1 change including the mid-review fixes below) | 2202 passed, 18 failed, 3 skipped — the same 18 individual tests failed on every run throughout this session, before and after each PR-1 commit; none of the 18 failing test files import or touch any file this PR changed (`server/auth.logout`, `emailService`, `heygen`, `metaAds` — live-credential-only; `rebateCalculator.sms` / `followupDispatch.optout` — documented pre-existing SMS opt-out harness gap; `formatterRender`, `leadCustomerSmsInternal`, `commercialIsolation`, `navigation` "dead link" — pre-existing, unrelated UI/nav test debt). Not fixed — out of scope for a claim-safety/SEO PR. |
| `netlify/edge-functions/inject-meta.test.ts` (new, 10 tests) | All pass — covers: real routes 200 with correct meta, sitemap-excluded-but-real pages (item C) still 200, real city pages 200, **fake city slugs (`/hvac-paterson-nj`, `/hvac-edison-nj`) now 404**, junk paths 404, real/fake blog slugs, internal/CRM routes (incl. dynamic `/leads/123`) stay 200 + internal-flagged, `/courses/:id` dynamic route stays 200 + internal-flagged, query-string/trailing-slash normalization. |
| `client/src/data/__tests__/blogRebateClaims.test.ts` | 3/3 passing — confirms no live 25C claim in blog content |
| `scripts/generate-sitemap.ts` run directly | 296 sitemap URLs (was 305), 9 correctly excluded, 305 paths written to `routes-manifest.json` |

### Mid-review fixes made after the first pass (before the numbers above)

Reviewing every diff against the spec surfaced three small inconsistencies, fixed directly:
- `netlify/edge-functions/inject-meta.ts`'s `DEFAULT_TITLE` (the crawler-facing, prerendered homepage title) still said "...#1 MWBE HVAC Contractor..." after `Home.tsx`'s client-side title was already fixed — two different homepage titles depending on whether a visitor hit the prerendered HTML or the hydrated client. Now matches.
- `ResidentialCaseStudies.tsx` and `PromosLanding.tsx` (both residential-facing) had inherited the commercial `/commercial` disclaimer's exact wording ("...NJ Direct Install / commercial HVAC project economics...") — reworded to residential-specific language.
- "Rebate Received" field labels in `CaseStudies.tsx`, `ResidentialCaseStudies.tsx`, and `PromosLanding.tsx` → "Illustrative Rebate" (see item J above).

## What still needs a deploy preview (cannot be tested from a local build)

These require the actual Netlify edge runtime, CDN headers, and DNS — a local `vite build`/`vite preview` does not execute Netlify Edge Functions or apply `netlify.toml` `[[headers]]`/`[[redirects]]`:

- `curl -I` header table: confirm `X-Robots-Tag` actually appears on every internal/noindex route and is absent on public routes
- `/rebate-calc` → `/rebate-calculator` returns a real 301 (the edge function logic is unit-tested; the actual HTTP redirect chain through Netlify's edge is not)
- `/this-page-does-not-exist`, `/hvac-paterson-nj`, `/hvac-edison-nj` return real HTTP 404 (unit-tested at the `getRouteStatus`/`injectMeta` level; not exercised through the actual CDN)
- `/courses`, `/estimating`, `/presentation-2026`, `/portal`, `/lp/fb-*`, `/lp/referral-partner` — confirm the header actually reaches the response (function-level logic is correct; header propagation through Netlify's redirect chain — see the `_redirects` vs `netlify.toml` precedence note in `step0-audit.md` — should be fine since headers are a separate subsystem, but this is exactly the kind of assumption that deserves a live curl check before you trust it)
- Sitemap/robots.txt live diff
- Residential/commercial form submissions reaching their real destination end-to-end (Netlify function + Railway API)
- Booking/SMS Netlify function curl tests
- CRM login + `/leads`, `/command-center`, `/estimating` load correctly, PWA install still works
- 30-URL public sample: 200, prerendered content, self-canonical, no `X-Robots-Tag`
- Lighthouse (mobile) before/after
- GA4 DebugView + Google Ads Tag Assistant: confirm `residential_quote_request` fires on a real `/qualify` test submission once you've set `VITE_ADS_LABEL_RESIDENTIAL_QUOTE_REQUEST`

**Recommendation:** push this branch and open a Netlify deploy preview to run the above before merging. Say the word and I'll push (still no merge, no production deploy — a deploy preview is a separate, disposable URL).
