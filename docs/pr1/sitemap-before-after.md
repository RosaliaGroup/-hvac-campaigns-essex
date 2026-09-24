# PR-1 Deliverable 4 — Sitemap Before / After

**Before (origin/main):** 305 URLs. Uniform `lastmod` per build date. Included `/rebate-calc`, `/courses`, `/portal`, `/estimating`, `/presentation-2026`, and all 8 `/lp/` pages.

**After (this branch):** 296 URLs (9 removed, 0 added). Same `lastmod` strategy — deliberately kept as build-date, not git-commit-date (see comment in `scripts/generate-sitemap.ts` explaining why that switch was already made and reverting it would be a regression, not a fix).

## Removed from sitemap.xml (9)

| URL | Why | Still resolves as a normal page? |
|---|---|---|
| `/lp/fb-commercial` | Paid-only (Facebook), item E | Yes — `noindex, follow` |
| `/lp/fb-residential` | Paid-only (Facebook), item E | Yes — `noindex, follow` |
| `/lp/referral-partner` | Paid-only (Facebook/recruiting), item E | Yes — `noindex, follow` |
| `/lp/rebate-guide` | Pure duplicate of `/rebate-guide`, item E | Yes — canonicalizes to `/rebate-guide` |
| `/portal` | Internal tool, not marketing content, item L | Yes — `noindex, nofollow` (already covered by CRM internal-route headers) |
| `/presentation-2026` | Internal tool, item C | Yes — `noindex, nofollow` |
| `/courses` | Internal tool, item K | Yes — `noindex, nofollow`, purchase actions disabled |
| `/estimating` | Internal tool, item L | Yes — `noindex, nofollow` |
| `/rebate-calc` | Pure content duplicate of `/rebate-calculator` (same component), item D | 301s to `/rebate-calculator` |

## Explicitly kept (per your instructions, unchanged)

- `/qualify`, `/assessment`, `/promos` — item C
- The other 4 `/lp/`: `commercial-vrv`, `emergency-hvac`, `heat-pump-rebates`, `maintenance-offer`
- `/referral` — **deliberately not touched at all** (sitemap presence, redirect, everything) — see the open question in `step0-audit.md` about its live Vapi SMS dependency.

## Verification

`scripts/generate-sitemap.ts` output:
```
[sitemap] Generated 296 URLs → client/public/sitemap.xml (9 excluded from sitemap, still in routes-manifest.json)
  Static routes: 141
  Blog posts: 97
  Direct install: 58
[routes-manifest] Wrote 305 paths → netlify/edge-functions/routes-manifest.json
```
`routes-manifest.json` (305 — same count as the old sitemap) is the broader "every real, resolvable public path" list `inject-meta.ts` uses for its 404 check, so none of the 9 pages above became unreachable — only less visible to search engines.
