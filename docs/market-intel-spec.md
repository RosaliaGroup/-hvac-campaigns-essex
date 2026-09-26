# Daily Market Intelligence Report — Competitors, Search Demand, Suggested Adjustments (Spec)
Repo location: `docs/market-intel-spec.md`
Branch: `market-intel`. Builds on the nightly job scheduler, GSC sync (`server/services/seo/sync.ts`), the content queue, and the review panel.
Operating mode (owner decision 2026-09-26): **act, then report.** The system implements suggestions itself, on the owner's behalf, and the daily report shows what it did with a one-click **Revert** on every item and a **Revert all from this report** button. The only items that wait for the owner are those the fact firewall cannot verify (see §4 — a price, discount, warranty term, program figure, or a new service claim), because the model is not permitted to invent business facts.

## 1. Cadence and delivery
- Runs 06:00 America/New_York daily (`SEO_INTEL_SCHEDULE`, default `0 6 * * *`). "Run now" button on the status panel.
- Delivered as: (a) a "Market Intel" tab in the CRM with the full report and accept/dismiss buttons; (b) an email/push digest to `SEO_ALERT_EMAIL` with the top 5 items and a link. Most days will be short; the job must not pad — "No material changes today" is a valid report.
- Stored in `seo_intel_reports` (id, date, sections json, itemCount, acceptedCount, dismissedCount). Items in `seo_intel_items` (reportId, kind, title, evidence json, suggestion, targetQueue, status: open|accepted|dismissed|expired, dismissReason).

## 2. Data sources (in priority order; each degrades gracefully if unavailable)
1. **Search Console** (already synced): per-page and per-query impressions/clicks/position, last 7 vs prior 7 and last 28 vs prior 28.
2. **Competitor watchlist** (`shared/competitorWatchlist.ts`, owner-editable in the CRM): name, domain, pages to watch (homepage, warranty/guarantee page, financing page, commercial page, pricing page, service-area page), and the queries they compete with us on. Seed: A.J. Perri, Gold Medal, Horizon, Hutchinson, Reiner Group, Air2Cool, Springfield Heating & AC, Echelon Services, OM HVAC, plus the top 3 domains appearing above us for each of our 20 target queries (auto-discovered, see 3c). Fetch each watched page daily via server-side fetch, store a normalized text snapshot (title, meta, H1/H2s, visible offers/prices/warranty terms, CTAs), and diff against yesterday. Respect robots.txt; one request per page per day; user-agent identifies Mechanical Enterprise; no login walls.
3. **SERP checks** (if `SEO_SERP_PROVIDER` configured — SerpAPI/DataForSEO/Ahrefs; otherwise skipped): top 10 for each of the 20 target queries, weekly (not daily — cost), diffed for new entrants, feature changes (local pack, People Also Ask), and our position.
4. **Google Trends** (public endpoint, best-effort): 90-day interest for the 20 target queries + our brand; flags rising terms.
5. **Internal signals**: CRM lead types by source and page (last 7 days), call volume by page (once PR-2 call tracking exists), form abandonment on `/invite-us-to-bid` and quote forms, and Jessica's unanswered-question log (questions callers asked that the prompt had no answer for).

## 3. Sections of the report

### 3a. Search demand — what people are asking for
- **Rising queries**: queries with ≥ 20 impressions and ≥ +40% impressions week-over-week, or new queries (first seen this week) with ≥ 10 impressions. For each: the page currently receiving them, position, and whether we have a page that answers it.
- **Unserved queries**: queries where our best page's position is > 20 or the query's intent doesn't match the page it lands on (e.g., a commercial query landing on a residential page). Suggestion → content-queue proposal or "new page" proposal (routed to the PR-3 backlog, never auto-built).
- **Decaying pages**: pages down ≥ 25% clicks over 28 days. Suggestion → refresh candidate in the content queue (refresh lane).
- **Cannibalization**: two of our pages alternating for one query. Suggestion → consolidation review item.
- **Seasonality**: 12-month pattern for the top 20 queries; flags "heating demand starts rising in ~2 weeks based on last year" so content/meta can lead it.

### 3b. Competitors — what changed
- Page diffs: any change to a watched page's title/meta/H1/offer/price/warranty/CTA text, with before/after. Classify: `new_offer`, `price_change`, `warranty_change`, `new_page`, `service_area_change`, `messaging_change`, `cosmetic` (cosmetic is logged, not reported).
- New pages discovered via the competitor's sitemap (if public) matching our target topics.
- SERP movement (weekly): who entered/left the top 10 on each target query; who appears above us.
- Suggestion types: "match" (they added X we don't have → propose facts-file/positioning item for owner decision), "counter" (their claim has a weakness — e.g., 1-year labor vs our 10-year → propose a content topic or meta emphasis), "watch" (no action yet).

### 3c. Positioning check — are we still differentiated
- For each of our differentiators (10-yr parts & labor, existing-system coverage, membership, published price ranges, portfolio per-unit pricing, monitoring): does any watched competitor now claim the same? If yes → flag with evidence and suggest the next differentiator from the backlog.
- Our own claims audit: any live page whose text no longer matches `verifiedFacts.ts` (price range `asOf` > 180 days, a discount percentage that changed, a program figure updated in the facts file but not on a page) → suggestion to the meta lane or refresh lane.

### 3d. Adjustments made (max 10/day, ranked; each shows what / why / evidence / how to revert)
The job executes each item through the existing gated lanes, so every change is a PR with a preview, a hold, and a revert path:
- **Title/meta change** → approved into the meta lane immediately (label `intel-YYYYMMDD`), hold per `SEO_AUTOPUBLISH_HOLD_HOURS`, auto-merge. Report line: old → new, query evidence, **Revert**.
- **New post** → drafted, fact-checked (critic pass), published through the content lane with its hold. Counts against `SEO_CONTENT_POSTS_PER_WEEK`. **Revert** = unpublish (noindex + sitemap removal immediately, reverting PR follows).
- **Refresh of an existing post** → same path; the previous version is kept and Revert restores it verbatim.
- **Internal link additions** (e.g., pointing a rising query's landing page to the right service page) → committed with the meta batch. Revert removes them.
- **New site page** (a query cluster we have no page for) → drafted from the PR-3 page templates, opened as a PR with a **48-hour** hold (longer than posts; pages are structural), auto-merged if green and not vetoed. Report line shows the preview URL. Revert = 301 to the nearest parent page + removal PR.
- **Jessica prompt gap** → a two-line answer is added to a `pendingPromptAdditions` list and included in the report; the Vapi prompt itself is updated automatically only if `SEO_INTEL_UPDATE_VAPI=true` (default **false**, because a wrong phone answer is heard live before anyone reads a report). Revert removes the lines.
- **Ads keyword suggestions** → written to the report only until Ads API write access exists; then added as paused keywords the owner can enable.
- **Pricing / offer / warranty term / program figure / new service claim** → **owner decision item**. The system may draft the copy and stage the page change behind a feature flag, but nothing publishes until the facts-file value exists. The report shows "Ready — needs your number" with a one-field form that, when filled, releases the change through the normal lane.

Every executed item is a `seo_intel_items` row with `executedBatchId` / `executedPrId`, so Revert is one click and **Revert all from this report** reverts every batch the report created, in reverse order.

Dismiss/Revert requires a one-word reason (`wrong`, `not_now`, `off_brand`, `already_done`); `wrong` or `off_brand` feed a suppression list (90 days) and count toward the circuit breaker.

## 4. Guardrails
- All writes go through the existing lanes (meta lane, content lane, page-PR lane). The intel job has no direct write path to production, the overrides file, `blogPosts.ts`, the facts file, or the Vapi prompt — it can only call `approveBatchToPR`/`publishPost`/`openPagePR`, which carry the hold, preview, veto and revert machinery. Import-graph test enforces this.
- The fact firewall applies to everything it produces. Anything requiring a business fact not in `verifiedFacts.ts` becomes an owner decision item, never a publish.
- Warm-up: the intel job may only execute automatically once the underlying lane is warmed up (meta lane after 2 manual batches, content lane after 8 manual posts). Before that, it stages and the report says "staged — approve to run".
- Daily execution caps: 10 items total; ≤ 20 meta changes; ≤ 1 new post (within the weekly cap); ≤ 1 new page; ≤ 3 refreshes.
- Circuit breaker (shared with autopublish): 2 reverts in 7 days, or 1 `wrong`/`off_brand`, pauses execution — the report keeps coming, marked "paused: suggestions only", until the owner resumes.
- Competitor content is evidence, never source: the model may quote a competitor's offer in the report; drafting prompts are never fed competitor text.
- Cost caps: ≤ 60 competitor pages/day, SERP checks weekly, model calls logged with token budget.
- If GSC sync failed in the last 24h, the job executes nothing and reports why.
- Competitor content is evidence, never source: the model may quote a competitor's offer in the report; drafting prompts may not be fed competitor text (prevents paraphrase-copying).
- Cost caps: ≤ 60 competitor pages/day, SERP checks weekly, one model call for the summary per day (`SEO_INTEL_MODEL`), token budget logged.
- Anything that would change a customer-facing claim is an owner decision item; the report may not route it to an automated lane.
- Circuit breaker: if GSC sync failed in the last 24h, the report says so and skips 3a rather than reporting on stale data.

## 5. Report format (the daily email)
Subject: `Market intel — YYYY-MM-DD — N suggestions (K high)`
1. One-paragraph summary (model-written from the structured items, no new facts).
2. "Done today" — each executed change, one line, with **Revert** (signed link, same scheme as veto links) and a preview/live link. Then "Needs your number" items with a one-field form link. Then "Revert all from this report".
3. "Changed since yesterday": competitor diffs, 1 line each.
4. Numbers: clicks/impressions 7d vs prior, top 3 rising queries, leads by source.
Full report in the CRM tab.

## 6. Weekly roll-up (Mondays)
Same job, larger window: 28-day trends, SERP movement, differentiation status, accepted vs dismissed suggestions and what shipped, and a "what to decide this week" list for the owner.

## 7. Tests
- The intel module's only write paths are the three lane entry points (import-graph assertion); no direct access to overrides/blogPosts/facts/Vapi.
- Revert restores the exact prior title/meta/post body (fixture round-trip).
- "Revert all" reverts in reverse order and leaves the site byte-identical to the pre-report state (fixture).
- An owner-decision item never publishes while its facts value is null.
- Execution is skipped (staged only) while a lane is not warmed up.
- Rising/unserved/decay classifiers on fixture GSC data.
- Competitor diff classifier: cosmetic vs material on fixture snapshots.
- Suppression: a dismissed-as-wrong item is not re-suggested within 90 days.
- Report with zero material items renders "No material changes today" and sends no email unless `SEO_INTEL_ALWAYS_EMAIL=true`.

## 8. Owner inputs
Competitor watchlist confirmation (seed list above; add/remove in CRM); `SEO_ALERT_EMAIL`; optional `SEO_SERP_PROVIDER` key (without it, SERP section is skipped and the report relies on GSC — still useful); the 20 target queries (seed from the audit: commercial HVAC contractor NJ, multifamily HVAC contractor NJ, HVAC subcontractor NJ, mechanical contractor NJ, MWBE HVAC contractor NJ, property management HVAC contractor NJ, HVAC maintenance contracts NJ, PTAC replacement NJ, heat pump installation NJ, central AC replacement cost NJ, mini split installation NJ, HVAC warranty NJ, HVAC financing NJ, commercial HVAC Newark NJ, HVAC contractor Newark NJ, HVAC Essex County, emergency HVAC repair NJ, PSE&G heat pump rebate, NJ HVAC rebates 2026, on-bill repayment HVAC NJ).
