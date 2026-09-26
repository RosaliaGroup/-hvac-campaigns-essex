# SEO Automation — Addendum A: Autonomous Publish Lane
Repo location: `docs/seo-automation-addendum-autopublish.md`
Extends `docs/seo-automation-spec.md`. Owner decision (Sept 26, 2026): title/meta drafts AND new blog posts may be generated and published without a per-item human click. The guardrails below are the conditions of that autonomy; every one is enforced in code, not by convention.

## A1. Two lanes, both automated
| Lane | What | Cadence | Publish path |
|---|---|---|---|
| Meta lane | Title + meta for unlocked pages | Nightly, ≤ 20 pages | `pr-seo-meta-YYYYMMDD` → auto-merge after hold |
| Content lane | New B2B blog posts + refreshes of existing posts | `SEO_CONTENT_POSTS_PER_WEEK` (default **2**, hard max **5**; daily = 5) | `pr-content-YYYYMMDD` → auto-merge after hold |

Nothing else auto-publishes: no body edits to service/city/commercial pages, no schema, no internal-link rewrites, nothing on a locked page.

## A2. Hold-and-veto instead of approve
- Every auto PR is opened with a `hold-until` timestamp = now + `SEO_AUTOPUBLISH_HOLD_HOURS` (default **24**; minimum 6).
- A notification goes out immediately (existing web-push + email to `SEO_ALERT_EMAIL`): title, one-line summary, preview URL, a **Veto** link (signed URL → closes the PR, logs `vetoed`) and an **Edit** link (opens the draft in the CRM; editing resets the hold).
- When the hold expires: if Netlify preview is green, no veto, no open review comment → merge. Otherwise → leave open, notify again.
- Manual override: an admin can click **Publish now** in the CRM to skip the hold for one item.

## A3. Fact firewall (the important part)
The model is never the source of any number, name, program, date or credential. It may only use facts from `shared/verifiedFacts.ts`, which the owner maintains:
```ts
export const VERIFIED_FACTS = {
  business: { legalName, phone, address, serviceCounties, yearsInBusiness: 20, founded: 2006 },
  incentives: [ { program: "PSE&G equipment rebate", amountText: "...", verifiedOn: "2026-09-26", source: "url" }, ... ],
  services: ["VRF/VRV", "heat pumps", "PTAC", "mini-split", "RTU", "boilers", ...],   // only what is actually sold
  certifications: [],   // stays empty until documentation is provided
  projects: [],         // stays empty until verified projects exist
};
```
- The drafting prompt receives this object and is instructed that anything not in it is out of bounds.
- The **extended linter** blocks on: any `$` figure not present in `incentives[].amountText`; any year/"since"/"N+ years" not matching `business`; any service not in `services`; any certification word (list stays empty → all block); any proper noun that looks like a client or project name; superlatives; competitor names; expired-credit terms; phone mismatch; "limited time" without a date.
- A **second-model critic pass** (separate prompt: "list every factual claim in this post and whether it is supported by VERIFIED_FACTS") must return zero unsupported claims. Any unsupported claim → post is not published, goes to the review panel with the critic's list.
- Blocked drafts are never auto-published, never retried more than once per day, and count against that day's quota.

## A4. Quality gates (auto-reject, no human needed)
- Duplicate-topic check: cosine similarity vs existing post titles/H1s > 0.85 → reject (we have 97 posts; the model will try to write "NJ heat pump rebates" again).
- Word count 900–1,400; exactly one H1; ≤ 6 H2s; no H3 walls; no FAQ unless ≥ 3 real questions.
- Reading level: Flesch 50–65 (owner/manager audience, not consumer).
- Must link to at least one B2B page and at most three internal pages; every link resolves 200 on the preview.
- Meta ≤ 155, title ≤ 60, both pass the title/meta linter.
- Topic must come from the `content_queue` (owner-seeded B2B list); the model may propose new topics into the queue with status `proposed`, but cannot self-select them.

## A5. Rate limits and circuit breakers
- Global cap: `SEO_CONTENT_POSTS_PER_WEEK` (default 2, max 5). Meta lane cap 20/night.
- Auto-pause the content lane (and notify) if any of: a veto in the last 7 days; a revert in the last 14 days; GSC sync shows site-wide clicks down > 25% week-over-week; Netlify preview fails twice in a row; the critic pass blocks 3 consecutive drafts.
- Resume requires an admin click ("Resume auto-publish") with a note, logged.
- `SEO_AUTOPUBLISH_ENABLED=false` kills both lanes immediately; open PRs stay open.

## A6. Rollback
- Every merged auto PR is a batch row; **Revert** opens a reverting PR and auto-merges it with no hold (rollback is always faster than publish).
- A post can be un-published from the CRM (sets `noindex` + removes from sitemap immediately via the overrides file, revert PR follows).

## A7. Reporting (so you can see whether it's working)
Weekly email: posts published, posts vetoed/blocked and why, impressions/clicks for auto-published pages vs the rest (from the GSC sync), any circuit-breaker events. After 8 weeks, if auto-published content is not earning impressions, the cadence should drop, not rise.

## A8. Defaults on first enable
`SEO_AUTOPUBLISH_ENABLED=true`, `SEO_CONTENT_POSTS_PER_WEEK=2`, `SEO_AUTOPUBLISH_HOLD_HOURS=24`, meta lane on. Raise the cadence only after the first 8 posts have shipped without a veto or a critic block.

## Out of scope / never automated
Residential rebate posts (oversupplied), city pages, service pages, `/commercial`, `/promos`, case studies, certifications, anything the fact firewall can't verify. Daily cadence is available (`=5`) but is not the default, for the reasons on record.
