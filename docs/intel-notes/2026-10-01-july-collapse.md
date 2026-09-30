---
publish: 2026-10-01
title: July 2026 collapse — what the evidence says
---
Sitewide impressions fell from ~650/day to under 100/day on 07-02 to 07-05. 21 of the 27 pages that lost 75% or more of their peak have their cliff between 06-29 and 07-08. Full write-up: docs/pr1/july-collapse.md.

WHO WAS HIT
- City pages: -91% (10 of 12 high-volume pages collapsed). Blog posts: -61% (7 of 12). Homepage: flat. Service and commercial pages are too low-volume to read.

WHAT IT DOES NOT MATCH
- No deploy: production had none from 06-22 13:10Z to 07-06 05:11Z, and the cliff sits inside that gap.
- No robots, canonical or prerender change in the repo. Impressions rose after the last pre-cliff change (06-22).

WHAT IT DOES MATCH
- Google's June 2026 spam update, 06-24 to 06-26, which targets doorway pages and scaled content. Cliffs cluster 3 to 12 days after it began. May core update: not near.

GOOGLE'S OWN INDEX STATE (15 flagged pages)
- 12 show "Page with redirect", last crawled 06-29 to 07-05 and not re-crawled since. They return a plain 200 today, and the repo shows no redirect for 11 of them at the time. Unexplained.
- 2 are "Crawled, currently not indexed" (a quality-style exclusion). 1 is indexed but demoted.

TWO HYPOTHESES (not exclusive)
- H1: quality/spam demotion of templated pages. H2: Google was served a redirect at crawl time and parked the pages.

NEXT STEP TO SEPARATE THEM
- Request indexing for 4 of the 12 "Page with redirect" pages; leave the other 8 as controls. If impressions return on the 4 within 1 to 2 weeks, it was a crawl-time fault. Do not rewrite the pages before that test.
