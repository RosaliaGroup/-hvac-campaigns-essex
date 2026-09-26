# Growth System — Lead Capture, Speed-to-Lead, Follow-Up, Reactivation, Reviews, B2B Outreach (Spec)
Repo location: `docs/growth-system-spec.md`
Branch: `growth-system`. Target: **80 qualified leads/month**. Builds on: Jessica/Vapi (inbound + outbound), Telnyx SMS, transactional email (Resend), the CRM lead/appointment/property tables, the autopublish and market-intel lanes, `verifiedFacts.ts`.
Owner will supply a contact list for follow-up (see §7 import). Everything else runs automatically once enabled.

## 0. Definitions and rules
- **Lead** (counts toward 80): a new contact with a phone or email AND a stated need (repair / install / assessment / commercial / bid / coverage / membership), from any channel, deduplicated by phone+email. **Qualified lead**: reached (answered or replied) and confirmed need + property in the service area. Report both.
- **Consent**: SMS/calls only to contacts with an existing business relationship or explicit opt-in; honor STOP/DNC instantly (existing Telnyx opt-out harness); calling hours 9:00–19:00 ET Mon–Sat; max 2 outbound call attempts + 3 texts per contact per campaign; no automated calls to numbers on the National DNC unless an existing-customer exemption applies (last transaction ≤ 18 months). Log every touch.
- **Fact firewall** applies to every script and message: prices, offers, warranty terms and program figures come only from `verifiedFacts.ts`.
- All customer-facing scripts are versioned in the repo and A/B testable; changes ship via PR like everything else.

## 1. Speed-to-lead (every new inbound lead, any source)
1. Form submit / missed call / chat / Ads lead form → CRM lead created with source, landing page, UTM, gclid, page_type.
2. **Within 60 seconds**: SMS from the canonical number: "Hi {first}, this is Jessica from Mechanical Enterprise — got your request about {need}. Is now a good time for a quick call, or should I text you options?" + Jessica outbound call attempt within 2 minutes during calling hours (voicemail script otherwise).
3. If answered: Jessica qualifies (need, property type, address, timing, decision maker), books the assessment/service call (existing Calendly/booking flow), sends confirmation. If commercial/bid/multifamily: books a call with the owner instead and flags `b2b`.
4. If not reached: cadence §2 starts automatically.
5. Human alert (push/SMS to owner) for: commercial, bid, portfolio, or any lead mentioning "quote from another company".

## 2. Follow-up cadence (unconverted leads)
Day 0: SMS + call. Day 1: SMS with one specific value line (warranty / membership / financing — chosen by need). Day 3: call attempt #2 + voicemail. Day 7: email with the relevant page (install price ranges, `/warranty`, `/commercial`). Day 14: SMS "still want me to hold a spot?" Day 30: moves to nurture (monthly). Any reply → Jessica or human picks up in-thread. Any booking → cadence stops. Stop on STOP/opt-out.

## 3. Quote follow-up
Every open quote/proposal older than 3 days without a decision: Day 3 SMS ("any questions on the proposal?"), Day 5 Jessica call with the financing/membership angle, Day 10 email with the warranty comparison table, Day 20 owner alert if value > `QUOTE_ALERT_THRESHOLD`. Stops on won/lost/opt-out. Lost reason captured.

## 4. Reactivation (existing CRM contacts)
Segments, each with its own script and monthly cap:
- **Past customers, no job in 12+ months**: existing-system coverage offer + maintenance plan. SMS + email, 2 touches, then annual.
- **Assessed but never booked** (from Jessica assessment records): "rebate/incentive check-in + price ranges now published" (only figures from facts).
- **Quotes lost > 6 months**: warranty + membership angle.
- **Maintenance-plan members**: renewal 45 days before expiry; coverage upsell at renewal.
- **Commercial contacts** (from Direct Install/assessment history): portfolio pricing + service contract.
Suppress anyone contacted in the last 30 days by any campaign.

## 5. Review engine
- Trigger: job marked complete in CRM (or appointment status = completed).
- T+2h SMS: "How did we do? Reply 1–5." Reply 4–5 → direct Google review link (GBP short link) + thank-you. Reply 1–3 → route to owner immediately, no public link, follow-up call within 24h. No reply → one reminder at T+3 days.
- Never incentivize reviews; never gate (the 1–5 step is service recovery, not gating — all customers get the same first message; the link is offered to everyone in the reminder). Owner decides whether the reminder includes the link for all scores (recommended: yes, to stay clearly within Google's policy).
- Weekly: reviews count, average, response drafts for new reviews (owner approves; auto-post only if `REVIEWS_AUTOREPLY=true`).

## 6. B2B outbound
- **Lists**: property-management companies, multifamily owners, GCs and developers active in Essex/Hudson/Union/Bergen — built from public sources (county permit filings, NJ DCA registered multifamily, GC license lists, LinkedIn company pages) into a `b2b_targets` table with company, role, contact, source, and a `do_not_contact` flag. Owner can import additional lists (§7).
- **Sequence** (email primary, phone secondary): Day 0 intro (one specific hook from `verifiedFacts` — e.g., portfolio per-unit pricing, 10-year parts & labor on commercial equipment, M/WBE line only once certifications are verified). Day 4 case for property managers (predictable opex). Day 9 Jessica call. Day 16 "Invite us to bid" for GCs / "portfolio pricing" for PMs with the form link. Day 30 last touch. Replies → owner within 15 minutes.
- Landing: PR-3 pages once live; `/commercial` until then. Form types already exist (`bid_invitation`, `portfolio_pricing_request`, `proposal_request`).
- Cap: 40 new companies/week; deliverability guardrails (dedicated sending domain, warm-up, bounce/complaint stops).

## 7. Contact list import (owner-supplied)
CRM → Contacts → Import CSV: columns `name, phone, email, company, address, type (residential|commercial|pm|gc), last_job_date, notes, consent (customer|opt_in|unknown)`. Rules: `unknown` consent → email only, no SMS/calls; duplicates merged on phone/email; imported contacts enter the matching §4/§6 segment after a 24-hour review window during which the owner can remove rows. Import is logged; a bad import can be rolled back as a batch.

## 8. Paid acquisition (ready when budget is set)
- Google Local Services Ads: application checklist (license, insurance, background check), category setup, budget slider; leads flow into §1 via the LSA lead API/email parse.
- Google Search: campaigns per lane (install + warranty, emergency, commercial/bid, PTAC per the approved package), conversion actions from PR-2 (`form_submit` by type, qualified call ≥ 60s, `bid_invitation_submit`), negative lists, and the market-intel job's keyword suggestions added as paused keywords.
- Budget and bid changes are owner decisions (report shows "recommended: raise X" with one-click apply once `ADS_AUTOAPPLY=true`).

## 9. Jessica upgrades (Vapi prompts, versioned in repo)
- Inbound: answers on warranty tiers, membership, existing-system coverage, price ranges, commercial/portfolio, bid invitations — all from `verifiedFacts`; books the right appointment type; captures source ("how did you hear about us").
- Outbound: scripts for each cadence step and segment; voicemail variants; transfer-to-human triggers (angry, legal, > $X quote, commercial decision maker on the line).
- Every call summarized to the CRM (existing recap flow) with outcome and next action; unanswered questions logged for the intel report (§3d of market-intel).

## 10. Reporting — the daily/weekly lead scoreboard (added to the market-intel report)
- Leads MTD vs 80 target, run-rate, by source and lead type; qualified rate; booked rate; speed-to-lead median; cadence response rates; reviews this week; B2B replies/meetings; quotes open/won/lost and reasons.
- "Gap plan": if run-rate < target, the report says which lever to pull (more LSA budget, a reactivation segment not yet run, a cadence with low response → script A/B), and executes the ones that are automatable (script A/B, segment scheduling) under the same act-then-report-with-revert rules.

## 11. Guardrails and tests
- Consent/DNC/STOP enforcement tested with fixtures; no SMS/call to `consent=unknown`.
- Per-contact caps and quiet hours enforced server-side.
- Fact firewall applied to every rendered message (snapshot tests on all templates).
- Circuit breakers: complaint rate > 0.3% or bounce > 5% pauses the channel; a review-engine complaint pauses reviews; owner resumes.
- Kill switches: `GROWTH_OUTBOUND_ENABLED`, `GROWTH_SMS_ENABLED`, `GROWTH_CALLS_ENABLED`, `GROWTH_B2B_ENABLED`, `REVIEWS_ENABLED`.

## 12. Owner inputs
Lead definition confirmed (§0 default used otherwise); calling hours; GBP review link; `QUOTE_ALERT_THRESHOLD`; media budget (for §8); the contact CSV (§7); sending domain for B2B email; any segments or scripts to exclude.

## 13. Rollout order
1. Speed-to-lead + cadence (§1–2) — largest immediate lift, uses existing Jessica/SMS.
2. Review engine (§5).
3. Reactivation on the imported list (§4, §7).
4. Quote follow-up (§3).
5. B2B lists + sequence (§6), landing on PR-3 pages.
6. Paid (§8) once budget and PR-2 tracking exist.
7. Scoreboard + gap plan (§10) from day one, growing as channels come online.
