# July 2026 search-visibility collapse — investigation

Read-only investigation, 2026-09-30. Data: GSC Search Analytics (daily, page+date, through 2026-09-29), the `seoPages` cache, the Netlify deploy API, git history, the URL Inspection API, and live fetches. Nothing was changed on the site or in prod.

## Bottom line

1. **One event, not a slow decay.** Sitewide impressions fell from ~650/day to under 100/day on **2026-07-02 → 07-05**. 21 of the 27 pages that lost ≥75% of their peak have their cliff between **06-29 and 07-08**.
2. **It hit the templated city pages and a subset of blog posts, not the homepage or the top blog post.** City pages −91%, blog posts −61%, homepage flat.
3. **No deploy, robots, canonical, prerender or redirect change explains it.** Production had **no deploy from 06-22 13:10Z to 07-06 05:11Z**; the cliff is inside that gap.
4. **It coincides with Google's June 2026 spam update (06-24 → 06-26)**, which targets doorway pages and scaled content, with early reports of templated location pages dropping within 24–48 hours.
5. **Google's own index state for the 15 flagged pages is not one story:** 12 are "Page with redirect" (Google last crawled them 06-29 → 07-05 and hasn't been back), 2 are "Crawled – currently not indexed", 1 is indexed. The 12 "redirect" pages return a plain 200 today, and the repo shows no redirect for 11 of them at that time. **That is unexplained.**

Correlation, not proof. Two hypotheses fit and they are not exclusive (see "What this does and doesn't show").

## 1. Timing vs deploy history

Sitewide GSC impressions by week (week starting):

| Week | Impressions | Clicks | | Week | Impressions | Clicks |
|---|---|---|---|---|---|---|
| 05-04 | 2,722 | 22 | | 07-13 | 2,133 | 22 |
| 05-18 | 2,591 | 13 | | 07-27 | 1,936 | 24 |
| 06-01 | 2,591 | 17 | | 08-10 | 1,834 | 12 |
| 06-08 | 4,795 | 36 | | 08-17 | 1,232 | 10 |
| 06-15 | 5,412 | 21 | | 08-24 | 988 | 14 |
| 06-22 | 5,619 | 38 | | 09-07 | 823 | 10 |
| 06-29 | 1,653 | 13 | | 09-14 | 688 | 9 |
| 07-06 | 650 | 11 | | 09-21 | 734 | 15 |

Daily, 06-28 → 07-05: 656, 652, **90**, 627, **148**, 59, 26, 51. The 06-30 value is a one-day dip; the sustained collapse starts 07-02. The partial recovery from 07-12 (127 → 361/day) came from other pages, not the collapsed ones.

Two things to keep apart: impressions **doubled from 06-08** (after the May core update finished 06-02) and were lost again by 07-05; and there is a **second, slower decline** from ~2,100/week (mid-July) to ~700/week (September), roughly 60–70% below the May baseline.

**Netlify production deploys around the cliff** (Netlify API):

| Deploy (UTC) | Commit | What |
|---|---|---|
| 06-17 15:32 | `ed95ab1` | proxy `/api/*` to Railway in `_redirects` |
| 06-22 13:10 | `43de983` | move five blog 301s into the `inject-meta` edge function |
| *(no deploys for 14 days)* | | |
| 07-06 05:11 | `36bc42d` | retire TextBelt (CRM/SMS work; first of ~150 deploys through 07-17, none SEO-relevant until 07-14) |

- The last pre-cliff change (06-22) redirected only five specific `/blog/*` URLs, and none of the flagged pages except `warehouse-hvac-nj`. Impressions **rose** after it (the week of 06-22 was the peak).
- `netlify.toml`, `robots.txt`, canonical tags and the prerender/edge path did not change between 06-17 and 07-06.
- Netlify's site settings expose no dated history. Current config: `pretty_urls: true`, `force_ssl: true`, apex as primary, managed DNS. A settings change inside the gap cannot be ruled out from the API.
- A status aggregator reports a 24-minute Netlify edge-function incident (module loading) on 07-01, 17:53–18:18. Weak evidence: a different symptom (errors, not redirects), very short, and not verified against Netlify's own page.
- The Internet Archive has no captures of the affected URLs in the window.

## 2. Which pages: by template

Grouped by URL pattern. June = daily average 06-01 → 06-30; post = 07-15 → 09-29. "Eligible" = ≥5 impressions/day in June; "collapsed" = kept ≤20% of that.

| Template | Pages w/ data | June imp/day | Post imp/day | Change | Eligible | Collapsed |
|---|---|---|---|---|---|---|
| City pages `/hvac-{town}-nj` | 90 | 242 | 21 | **−91%** | 12 | **10** |
| Blog posts `/blog/*` | 113 | 352 | 138 | −61% | 12 | 7 |
| Homepage `/` | 1 | 25 | 26 | −4% | 1 | 0 |
| Other service/positioning | 109 | 50 | 20 | −60% | 2 | 0 |
| Commercial | 8 | 4 | 1 | n/m | 0 | 0 |
| `/blog` hub | 1 | 4 | 0 | n/m | 0 | 0 |

Read with care. "Other service" and commercial are too low-volume to conclude anything (2 and 0 eligible pages), and the `/blog` hub was only ~4/day, so its "−100%" is not meaningful. The clear signals are city pages (10 of 12 collapsed), a blog-post subset (7 of 12), and a **homepage that did not move**. The strongest blog post (`pseg-heat-pump-rebates-explained`, 62/day in June) kept 35/day; `central-ac-replacement-nj-cost` went *up*. The collapsed posts include `heat-pump-vs-gas-furnace-nj-2026`, `nj-heat-pump-rebates-2026`, `heat-pump-installation-nj-guide`, `nj-clean-heat-program-2026` and `warehouse-hvac-nj`.

Cliff date (first day the 7-day average fell to ≤25% of its peak) for the 27 pages with ≥5 imp/day in June: 21 between 06-29 and 07-08 (07-05 alone: 7), 3 earlier (06-13, 06-23 ×2), 3 later (07-22, 08-23, 08-29).

## 3. Google updates

From Google's Search Status Dashboard summary plus independent write-ups (verify on status.search.google.com before quoting externally):

| Update | Dates | Relation to the cliff |
|---|---|---|
| March 2026 core | 03-27 → 04-08 | far before |
| May 2026 core | 05-21 → 06-02 | ended 6 days before impressions *rose* (06-08) |
| **June 2026 spam** | **06-24 → 06-26** | **starts 8–9 days before the sustained drop; cliffs cluster 3–12 days after it began** |
| August 2026 spam | 08-18 → 08-21 | falls between weeks of 1,834 → 1,232 → 988 impressions (−33%, −20%) |
| September 2026 spam | starts 09-24 | too recent to read |

The June update was described as an improvement to Google's automated spam detection, applying globally, with doorway pages and scaled-content abuse the recurring targets, and early reports of templated location-page networks slipping within 24–48 hours. No core update was announced for June or July.

## 4. Google's index state for the flagged pages (URL Inspection API, 2026-09-30)

| Page | Group | Google coverage state | Last crawl |
|---|---|---|---|
| `/blog/nj-heat-pump-rebates-2026` | flagged | Page with redirect | 2026-07-03 |
| `/blog/heat-pump-vs-gas-furnace-nj-2026` | flagged | Page with redirect | 2026-07-05 |
| `/hvac-linden-nj` | flagged | Page with redirect | 2026-07-04 |
| `/blog/heat-pump-installation-nj-guide` | flagged | Page with redirect | 2026-07-05 |
| `/blog/hvac-contractor-newark-nj` | flagged | Page with redirect | 2026-07-05 |
| `/blog/nj-clean-heat-program-2026` | flagged | Page with redirect | 2026-07-02 |
| `/blog` | flagged | Page with redirect | 2026-07-03 |
| `/hvac-north-bergen-nj` | flagged | Page with redirect | 2026-07-03 |
| `/hvac-woodbridge-nj` | flagged | Crawled - currently not indexed | 2026-06-20 |
| `/hvac-millburn-nj` | flagged | Page with redirect | 2026-07-04 |
| `/hvac-rahway-nj` | flagged | Submitted and indexed | 2026-06-05 |
| `/hvac-jersey-city-nj` | flagged | Page with redirect | 2026-07-02 |
| `/hvac-ridgefield-nj` | flagged | Page with redirect | 2026-06-29 |
| `/hvac-teaneck-nj` | flagged | Crawled - currently not indexed | 2026-06-08 |
| `/blog/warehouse-hvac-nj` | flagged | Page with redirect | 2026-07-03 |
| `/` | control | Submitted and indexed | 2026-09-20 |
| `/blog/pseg-heat-pump-rebates-explained` | control | Submitted and indexed | 2026-08-24 |
| `/blog/central-ac-replacement-nj-cost` | control | Submitted and indexed | 2026-07-07 |

- **12 of 15 flagged pages: "Page with redirect"**, last crawled **06-29 → 07-05**, i.e. exactly at the cliff, and **not re-crawled in ~3 months**. All are robots.txt-allowed and fetched successfully at last crawl. Today every one returns a plain 200 to both a normal and a Googlebot user agent.
- **2 pages "Crawled – currently not indexed"** (`hvac-woodbridge-nj`, `hvac-teaneck-nj`): Google crawled them (06-20, 06-08), fetched fine, and chose not to index. That is a quality-style exclusion, not a technical one.
- **1 page indexed** (`hvac-rahway-nj`, last crawled 06-05) but at ~11 impressions: demoted, not removed.
- **Controls** (`/`, `pseg-heat-pump-rebates-explained`, `central-ac-replacement-nj-cost`): indexed and recently crawled (09-20, 08-24, 07-07).

## What this does and doesn't show

**Fits H1, quality/spam demotion of templated pages.** The timing (cliff 3–12 days after the June spam update began), the template split (city pages hardest, homepage untouched), the "crawled – not indexed" pages, the demoted-but-indexed page, and Google not re-crawling for three months (a crawl-priority signal) all fit.

**Fits H2, Google was served a redirect at crawl time on 07-02 → 07-05 and dropped the pages.** It explains "Page with redirect" and the last-crawl dates clustering at the cliff. It does **not** explain what redirected: the repo had no redirect for 11 of those URLs, there was no deploy, and nothing redirects them now. An out-of-band change (domain, DNS or CDN setting, or a transient platform fault) is possible but **not evidenced**.

They are not exclusive: a demotion could have started first and a bad crawl could then have parked the pages. What separates them is cheap to test, below.

Limits: GSC data ends 09-29 and lags ~2 days, so nothing here says anything about the 09-30 title changes. The 90-day windows in `seoPages` blur exact dates, so every date above comes from daily page+date rows. Template groups are URL-pattern based. Update dates are from public sources, not from our own access to Google.

## Suggested next steps (nothing done yet)

1. **Test H2 directly.** In URL Inspection, request indexing for 4 of the 12 "Page with redirect" pages (e.g. `hvac-linden-nj`, `hvac-millburn-nj`, `hvac-north-bergen-nj`, `nj-heat-pump-rebates-2026`) and leave the other 8 alone as controls. If impressions come back on the 4 within ~1–2 weeks, it was a crawl-time fault. If not, the weight moves to H1.
2. **Don't rewrite the 15 pages yet.** Content changes now would muddy that test.
3. **Add a crawl-time monitor:** a daily Googlebot-UA fetch of ~20 key URLs that alerts on any non-200 or unexpected redirect, so a repeat is caught in a day, not a quarter.
4. **Review the templated city pages for doorway/scaled-content risk** (near-identical body with the town name swapped), whatever step 1 shows. That is the risk H1 points at, and 90 such pages exist.
5. **Look for out-of-band changes** around 06-30 → 07-05: Netlify domain/DNS audit log, Cloudflare or registrar changes, Search Console property or sitemap changes. The Netlify API doesn't expose these.

## Re-indexing test: design and status (added 2026-09-30)

Approved: request re-indexing for a subset of the "Page with redirect" pages, leave the rest as controls, read after 14 days, hold all rewrites of the 15 flagged pages until then. Config lives in `shared/seoExperiment.ts`; the readout is in `server/services/seo/intel/experiment.ts`.

**Groups (4 treatment, 4 control), stratified by template and volume:**

| Group | Pages |
|---|---|
| Treatment (request indexing) | `/hvac-linden-nj`, `/hvac-millburn-nj`, `/blog/nj-heat-pump-rebates-2026`, `/blog/warehouse-hvac-nj` |
| Control (leave alone) | `/hvac-north-bergen-nj`, `/hvac-jersey-city-nj`, `/hvac-ridgefield-nj`, `/blog` |

**Excluded from both groups, on purpose (4 of the 12):**
- `/blog/hvac-contractor-newark-nj`: a genuine 301 since 2026-09-08, so Google is right about it.
- `heat-pump-vs-gas-furnace-nj-2026`, `heat-pump-installation-nj-guide`, `nj-clean-heat-program-2026`: their titles/metas were changed by the 2026-09-30 batches (#143, #149, #150), which would confound the read.

**Not done yet:** the request itself. Google's URL Inspection API is read-only and there is no supported API to request indexing (the Indexing API is only for job-posting and livestream pages). "Request indexing" is a button in the Search Console UI; the inspection links in the report open each page there. `startedAt` in `shared/seoExperiment.ts` stays `null` until it has been done; set it to that date and the readout runs at +16 days (14 days plus GSC's ~2-day lag).

**Hold:** all 15 flagged pages are locked against title/meta/content rewrites until 2026-10-22, through the existing lock gate (nightly meta job, bulk approve) and market-intel's refresh queueing.

**Readout:** per page, whether Google re-crawled it since the request, whether it is indexed again, and impressions in the 14 days before vs after. The conclusion is a labeled heuristic (crawl-fault / quality-demotion / inconclusive); the raw numbers are always shown.
