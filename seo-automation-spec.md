# SEO Automation — Nightly Draft Job & Weekly B2B Post Pipeline (Spec)
Repo location: `docs/seo-automation-spec.md`
Builds on: `docs/seo-bulk-approve-spec.md` (locks, linter, override file, PR flow), PR #117/#119/#120/#121.
Principle: **automate drafting, linting and PR creation; keep merge human.** No production write happens without a merge click. No content is generated for locked or claims-review pages.

---

## Part 1 — Nightly title/meta draft job

### Trigger
Railway cron (or the existing scheduler used by `SEO_SYNC_SCHEDULER_ENABLED`), 02:00 America/New_York, Mon–Sat. Env flag `SEO_NIGHTLY_DRAFTS_ENABLED=true` to turn on; default off.

### Selection (max 20 pages per night)
From `seoPages`, exclude anything `isLocked()` returns true for, anything in a `pr_open` batch, and anything with a draft < 14 days old. Rank remaining by:
1. Impressions ≥ 100 and position 8–20 ("Page 2 — refresh candidate") — highest priority
2. Impressions ≥ 100 and position ≤ 25 with CTR < 1%
3. Everything else by impressions desc
Skip pages with < 20 impressions in the last 90 days entirely (insufficient data — no value in drafting).

### Per page
- Run the existing Anthropic provider (`regenerateUnlockedDrafts`) with the page's top GSC queries as input.
- Lint. On BLOCK: one retry with findings fed back (already implemented). Still blocked → leave the draft with findings, do not include in the batch.
- Record `draft_generated` in audit log with `actorId = null`, `source = "nightly"`.

### Staging, not approving
- Clean drafts are tagged `nightly-candidate` (add to `SEO_PAGE_TAGS`) and appear under a new filter chip "Nightly" in SeoIntelligence.
- The job does NOT call `approveBatchToPR`. A human uses Select Drafted → Approve to PR in the morning.
- Send one summary (email to sales@ or the existing web-push alerts): "Nightly SEO drafts: 14 ready, 3 lint-blocked, 3 skipped (locked)". Link to the CRM.

### Auto-lane (Phase 2 — not in this PR; enable only after ≥ 4 human-approved batches with zero reverts)
Pages that have already had one approved+merged override may be auto-approved: nightly job calls `approveBatchToPR` with label `auto-YYYYMMDD`, the PR gets a 24-hour hold label, and a scheduled check auto-merges if Netlify is green and no one has commented. Owner can disable with `SEO_AUTO_LANE_ENABLED=false`. Anything with WARN-level findings is excluded from the auto-lane.

### Tests
- Selection never includes a locked page, a pending-batch page, or a < 20-impression page.
- Job caps at 20.
- Job never calls `approveBatchToPR` in Phase 1 (assert via spy).
- Summary counts match audit rows.

---

## Part 2 — Weekly B2B content pipeline

### Cadence and scope
One post per week, Wednesday 06:00 ET draft, human-reviewed, published only via PR merge. **B2B topics only** — the pipeline does not generate residential/rebate posts (that inventory is already oversupplied: 97 posts, ~100 clicks/quarter).

### Topic queue (`content_queue` table: id, title, target_query, audience, brief, status, source)
Seed with the audit's authority list; owner can add/reorder in a simple CRM view:
1. Multifamily HVAC replacement planning in occupied buildings
2. HVAC capital budgeting per unit for apartment owners
3. PTAC vs mini-split vs VRF for multifamily retrofits
4. What GCs need from an HVAC subcontractor (submittals, coordination, close-out)
5. HVAC service contracts for property managers: scope and pricing models
6. HVAC in NJ affordable-housing renovation (NJHMFA/DCA-funded projects)
7. Commercial HVAC lifecycle: when to repair, when to replace
8. PTAC replacement for condo associations (already drafted — use the approved PTAC package verbatim)
9. Mini-split/VRF considerations for mixed-use buildings
10. Preventive maintenance checklist for building owners
Status flow: `queued → drafted → in_review → pr_open → published → refresh_due`.

### Drafting rules (system prompt for the provider)
- 900–1,400 words, written for a building owner / GC / property manager, not a homeowner.
- Must include: a specific NJ angle (county, program, or building type), a "what to send us / what to ask bidders" section, one CTA to a B2B page (`/commercial` today; `/commercial/multifamily-hvac-contractor-nj` etc. once PR-3 lands).
- Must NOT include: case studies, project counts, customer names, dollar savings figures, rebate promises, certification claims, "#1"/superlatives, expired tax-credit references, competitor names. Run the body through an extended linter (same rules as title/meta plus: no "\$[0-9]" savings claims, no "we have completed N projects", no named clients).
- Title ≤ 60, meta ≤ 155, one H1, H2s only (no H3 walls), no FAQ block unless the topic naturally has 3+ real questions.
- Output stored as a draft in `blogPosts` source (the real source of truth `scripts/generate-blog-meta.ts` reads), status `draft`, never published directly.

### Review and publish
- Draft appears in a "Content Review" panel in the CRM with the extended-lint results. Reviewer can edit inline.
- "Approve to PR" (reuse the bulk-approve GitHub client): commits the post to `blogPosts.ts` on `pr-content-YYYYMMDD`, opens a PR whose body is the full post rendered, Netlify preview builds it.
- Human merges. Post goes live with the deploy; sitemap regenerates; `published` status; `refresh_due` set to +180 days.
- No auto-lane for content, ever, in this spec. Body content is where fabricated claims live.

### Refresh, not just new
Same pipeline handles refreshes: the job also queues the top 5 existing posts by impressions whose content mentions 25C/"federal tax credit" or is > 12 months old (the two 3,000-impression posts first). A refresh draft is a full rewrite with current program figures pulled from `shared/business.ts` constants (add a `INCENTIVES` block there: PSE&G equipment rebate, Whole Home max, Building Decarb, with `verifiedOn` dates — owner supplies numbers; the system never invents them).

### Tests
- Pipeline refuses to draft a topic tagged residential/rebate.
- Extended linter blocks savings figures, project counts, certification claims.
- Publish path is PR-only; no direct write to `blogPosts.ts` on main (spy).
- Refresh selection picks 25C-mentioning posts first.

---

## Part 3 — Prune (one-time, separate PR, needs owner sign-off per page)
Report, don't act: list every blog post and city page with < 10 impressions in 90 days, grouped by proposed treatment (consolidate into a hub / 301 to a stronger page / noindex). Owner approves the list; Claude Code implements redirects and noindex in one PR. Not automated.

---

## Out of scope
Daily posting. Auto-publishing body content. Generating residential/rebate posts. Any change to locked pages. Any invented number, project, client or certification.
