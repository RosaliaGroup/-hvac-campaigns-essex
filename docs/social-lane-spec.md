# Social Lane — Automated Posting on Facebook, Instagram, Google Business Profile (Spec)
Repo location: `docs/social-lane-spec.md`
Branch: `social-lane`. Reuses: `server/services/socialPublisher.ts` (publish path, idempotency, retry), `integrations/facebook`, `integrations/google-business`, the GBP sync, HeyGen router, the autopublish hold/veto/revert machinery, `verifiedFacts.ts`, the content lane's published posts, the review engine (growth-system §5), and the daily report.
Mode: **act, then report** — posts publish on schedule after a hold; every post has a Delete/Revert in the daily report. Nextdoor stays a manual queue (no API).

## 0. Pre-flight (Claude Code reports before building)
1. Are the Facebook Page token, Instagram business account link, and GBP posting credentials present and valid on production? (Check presence only; mask values.) GBP local-post API access must be verified — Google has restricted parts of the Business Profile API; if posting isn't available, GBP falls back to the manual queue like Nextdoor.
2. What does `socialPosts` currently hold (any historical posts, statuses)?
3. How the existing approval gate is enforced, so it can be replaced by the hold-and-veto gate without weakening idempotency.

## 1. Cadence (defaults; `SOCIAL_POSTS_PER_WEEK`, hard max 7)
- Facebook: 3/week. Instagram: 3/week (same content, image-first). GBP: 2/week (Google recommends weekly; GBP posts expire after 7 days). Nextdoor: 1/week queued for manual.
- Post times from GBP/Meta insights (best-performing hours); default Tue/Thu/Sat 10:00 ET.
- Hold: `SOCIAL_HOLD_HOURS` default 12 (shorter than site content — posts are low-blast-radius and deletable). Veto link in the digest.

## 2. Content sources (rotation, never two of the same type in a row)
1. **Offer/education** — from `verifiedFacts` only: 10-year parts & labor coverage, existing-system coverage, membership, price ranges (once set), portfolio pricing for property managers, maintenance plan. One claim per post; the linter (same rules as site content) blocks anything not in the facts file.
2. **Blog amplification** — every post published by the content lane gets a social post within 24h (summary + link with UTM `social_{platform}`), and a re-share after 30 days if it earned impressions.
3. **Job photos** — before/after from the CRM's job-photo table, **only** where the job record has `photoConsent=true` and the address/customer are not identifiable; captions generated from the job type, never the customer. Owner can toggle `SOCIAL_JOB_PHOTOS_ENABLED`.
4. **Reviews** — 4–5 star reviews from the GBP sync, quoted with first name only, with the review link. Skipped if the review is < 20 words or mentions a person by full name.
5. **Seasonal/service reminders** — from a small owner-editable calendar (filter changes, pre-winter tune-up, heat-pump defrost explainer). Facts-only.
6. **Video** — one HeyGen short/month on a topic from the content queue (script generated, fact-checked, rendered, posted); `SOCIAL_VIDEO_ENABLED` default false until the owner approves an avatar/voice.
7. **B2B** — one LinkedIn-style post/week (property managers, GCs, PTAC/portfolio topics). LinkedIn has no company-page posting API for this use → queued for manual like Nextdoor, with copy ready to paste.

## 3. Generation and guardrails
- Model drafts caption (platform-specific length), hashtags (≤ 5, from an allow-list), CTA, and selects/creates the image: job photo (consented), a branded template card (SVG → PNG via existing tooling: headline + one fact + logo), or a blog hero. No stock-photo APIs; no AI-generated "photos of our work".
- Linter + critic pass as in the autopublish addendum. Blocks: superlatives, expired credits, competitor names, prices not in facts, provider names, "free"/"included" for coverage, phone numbers other than canonical, any customer full name or address.
- Duplicate check against the last 60 days of posts (similarity > 0.8 → regenerate).
- Every post carries a UTM'd link so the daily report can attribute clicks and leads (GA4 + CRM source).

## 4. Engagement (comments/DMs)
- Comments on our posts and page DMs are pulled via the Meta API into the existing conversation CRM (`conversationCrm.ts`). Auto-reply **only** for two cases: a thank-you on positive comments (templated, no claims) and an "I'll DM you" on service questions, which creates a lead and hands to Jessica/SMS via the speed-to-lead flow. Everything else routes to a human within the CRM inbox. `SOCIAL_AUTOREPLY_ENABLED` default true for the two cases above only.
- Negative comments never get an automated reply; they alert the owner.

## 5. Ads hand-off (uses existing metaAds router)
- Any organic post that beats the page's 30-day median engagement by 2× is flagged "boost candidate" in the report; boosting is executed automatically only if `SOCIAL_BOOST_ENABLED=true` and within `SOCIAL_BOOST_DAILY_CAP` (default $10/day), targeting the service counties, objective = leads or traffic to the UTM'd page. Report shows spend and leads.

## 6. Reporting (added to the daily digest)
Posts published (with links and Delete), reach/engagement per post, clicks and leads attributed, boost spend, queued manual items (Nextdoor/LinkedIn copy ready), items vetoed. Weekly: best/worst post types, recommended cadence change (executed if within caps).

## 7. Circuit breakers and kill switches
- Pause on: API auth failure (token expired → owner alert with re-auth link), 2 vetoes in 7 days, any comment flagged as a complaint about a post's claim, Meta policy warning. `SOCIAL_LANE_ENABLED=false` stops everything; scheduled posts stay drafted.
- Revert = delete the platform post via API (Facebook/IG/GBP support delete) and mark the row `reverted`; manual-queue items are just removed.

## 8. Tests
- Publisher idempotency preserved (existing tests pass unchanged).
- A post with a non-facts price, a customer full name, or a competitor name never reaches `publish`.
- Job-photo posts require `photoConsent=true` (fixture).
- Hold/veto/revert round-trip; delete called on revert.
- Cadence caps and rotation rule enforced.

## 9. Owner inputs
Confirm platform credentials (or re-auth via the existing Meta OAuth flow in AI VA Settings); hashtag allow-list; seasonal calendar entries; whether job photos may be used (`photoConsent` field must exist on jobs — add if missing, default false); HeyGen avatar/voice choice for video; boost budget if any.
