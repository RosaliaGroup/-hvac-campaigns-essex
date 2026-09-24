# PR-1 Step 2 — Results (PR #114, deploy-preview-114)

Preview URL: **https://deploy-preview-114--strong-pothos-11fbc0.netlify.app**

## 1. CRM entry routes — `/m/` and route-registry audit

**`/m/` correctly returns a real HTTP 404** (confirmed live). It was never a real route: a repo-wide grep for the literal string `"/m"` across every `.ts`/`.tsx`/`.toml` file returns zero matches — no `<Route>`, no `isInternalRoute` prefix, no link, no redirect target, anywhere, ever (checked `git log -S` history too). It only ever appeared as an illustrative example path in the original PR-1 handoff spec's internal-route list, not as anything real in this app. **Not a regression.**

**But the same check found a real one:** `/team-login`, `/accept-invite`, and `/reset-password` — the CRM's actual pre-authentication entry points — were **also returning HTTP 404** on the first preview build. This would have locked every staff member out of the CRM entirely.

Root cause: `scripts/generate-sitemap.ts`'s old `SKIP_PATHS` filter excluded these three from `publicRoutes` — correct for keeping auth pages out of the *search-engine* sitemap, but that same filtered list also fed `routes-manifest.json`, the list `inject-meta.ts` uses to decide 404 vs 200. The filter conflated "don't index this" with "this route doesn't exist."

**Fixed and pushed** (commit `4112b00`, already on `pr1-hotfix-build`): `routes-manifest.json` now includes all three; they're still excluded from `sitemap.xml` (moved to the existing `SITEMAP_EXCLUDE` set). Added a locking test (`netlify/tests/inject-meta.test.ts`).

**Re-verified live after the fix landed:**

| Route | Result |
|---|---|
| `/team-login` | 200 — real "Team Dashboard Access" / "Team Login" page with email/password fields, Sign In button, Forgot password link |
| `/accept-invite` | 200 — real page, correctly shows "No invite token found" (expected, since I didn't navigate with a real invite link) |
| `/reset-password` | 200 — real page, correctly shows "No reset token found" (expected, same reason) |
| `/m/` | 404 — correct, never a real route |
| `/leads` | 200 — real page (not a 404) |
| `/admin` | 200 — real page (not a 404) |

`pnpm build` now prerenders 308/308 routes (was 305 before this fix — the three auth pages are now statically prerendered too, a bonus: they no longer depend on client JS hydration to render).

## 2. Interactive Step-2 checks on the preview

| Check | Result |
|---|---|
| **Residential form** (`/residential`) | Loads correctly — a Google Forms embed ("Residential HVAC Service Request Form") with ZIP, Name, Email, Phone, Project Description, Project Type fields. Confirmed fields accept input (filled each one with clearly-marked test data: "PR1 QA TEST - please ignore", `pr1-qa-test@example.com`, `555-555-0100`). **Did not complete the final submit** — the browser tool's own safety classifier blocked the batched fill-and-submit action, and this form is a third-party Google Forms embed unrelated to any PR-1 code change (PR-1 never touched the residential/commercial form mechanism), so a full submission mainly tests Google's infrastructure, not this PR. No console errors on the page. |
| **Commercial form** (`/commercial`) | Same result — loads correctly as a Google Forms embed ("Commercial HVAC Service Inquiry Form"). Also visually confirmed the item I fix live on this page: the case-studies disclaimer reads exactly "Illustrative scenarios based on typical NJ Direct Install / commercial HVAC project economics. Actual incentives, project costs, financing and savings vary by building, utility program and equipment." |
| **CRM login** (`/team-login`) | Page now loads correctly (see above) — a real login form. I do not have staff credentials, so I could not complete an actual authenticated login; verified the page itself renders and is reachable, which is what the 404 bug had broken. |
| **`/courses` buttons inert** | Confirmed live on `/courses/1` (EPA 608 Type I Certification detail page): no "Enroll Now" button, no Stripe reassurance text. Shows exactly "Coming Soon — Contact Us" / "Online enrollment isn't open yet. Call (862) 423-9396 for availability." matching the PR-1 item K fix. |
| **One function test** (`netlify/functions/sendCallRecap`) | `POST /.netlify/functions/sendCallRecap` with a clearly-marked test payload → the function is live and validates correctly, but returned `502 {"error":"Recap service unavailable"}` when forwarding to the backend. This function isn't touched by PR-1; the 502 is consistent with `MECHANICAL_API_URL` not being configured to point at a reachable backend from a deploy-preview context (expected/pre-existing for previews, not a PR-1 regression) — flagging for awareness, not fixing here. |

## 3. G-XXXXXXXXXX and uniform sitemap lastmod

**G-XXXXXXXXXX — found, not a live bug, fixed anyway on `pr1-followup`.** It's present in `client/index.html`'s source, but only inside a code comment giving an example GA4 ID format — never executed. Confirmed via `window.dataLayer` on the live preview: the only `gtag('config', ...)` calls that actually fire are `AW-17768263516` and `G-X4KZPDRTEC` (both real). Fixed on branch `pr1-followup` (commit `f734797`, not added to #114 per your instruction): reworded the comment to drop the literal string, and — since I was already touching this code — hardened the runtime guard itself, which had a related latent bug: it only checked `indexOf('G-') === 0`, so if anyone ever literally pasted the example placeholder into Netlify's env var, it would have been treated as valid and fired `gtag` against a fake property. New guard requires a real-looking format and explicitly excludes the all-X placeholder pattern.

**Uniform sitemap lastmod — not a bug, a deliberate decision; flagging for your call rather than silently changing it.** Every URL in `sitemap.xml` gets the same `lastmod` (today's build date) by design — this isn't an oversight, it's documented in detail in `scripts/generate-sitemap.ts`'s own comment block, decided during Step 1 of this PR. The *previous* behavior (before this PR) used each page's git-commit date, which meant static pages could show a `lastmod` months stale even though the page itself changes on every deploy (nav, footer, tracking, schema). Per that same comment's reasoning: a stale `lastmod` is itself a bad signal to Google (tells it "nothing changed here, don't bother re-crawling"), and every URL in the sitemap genuinely is regenerated on every build, so build-date is arguably the more honest value. I did **not** revert this on `pr1-followup` — doing so would undo a considered improvement made earlier in this same PR to satisfy a re-reading of the original ask, not fix an actual defect. If you still want per-page differentiation (e.g., real content-change dates once blog posts get an `updated_at` field — the comment already notes this as the natural next step), let me know and I'll build that properly rather than reverting to the worse git-commit-date behavior.

## Branch/PR summary

- **`pr1-hotfix-build` (#114):** build fix (`2d3ad1f`) + critical auth-route 404 fix (`4112b00`). Both pushed. Not merged — waiting for your review.
- **`pr1-followup`:** G-XXXXXXXXXX comment + guard hardening (`f734797`). Pushed, no PR opened yet (didn't have GitHub auth in this session — say the word and I'll open one, or you can from `https://github.com/RosaliaGroup/-hvac-campaigns-essex/pull/new/pr1-followup`).
- **Uniform lastmod:** intentionally left alone, your call on whether it needs anything further.

All local verification for both branches: `tsc --noEmit` clean, `pnpm build` succeeds, full test suite passes except the same 18 pre-existing, unrelated failures verified earlier in this PR (live-credential tests + documented SMS opt-out harness debt + one dashboard nav test).
