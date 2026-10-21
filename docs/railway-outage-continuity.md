# Mechanical Enterprise — Railway outage continuity (standby plan)

## What exists today (verified October 21, 2026)

- Backend: Node/Express server and CRM in Railway, project `e3014706-5ad9-4a60-b09e-a5a6d3ce7459`, production service `6a517729-6912-44e0-8407-7e5efab38c29`.
- Database: Railway MySQL service `112438c9-ec12-4c8b-b277-edaf0816cbf0`, with persistent volume `mysql-volume`. This is a **single-provider dependency**. A static website mirror cannot make the CRM operational if Railway MySQL is down.
- Existing Netlify configuration publishes `dist/public` and proxies `/api/*` to the Railway service. **The proxy fails whenever Railway fails**.
- This change adds independent static `/continuity.html` and `/continuity-received.html` files with Netlify Forms; the form itself makes **no calls to the Railway API**.
- **Not yet live solely by merging**: confirm an actual Netlify site is linked to this repository, deploy succeeded, Forms detection is ON, and a controlled submission appears in the Netlify Forms UI.

## Deploy and validate the independent emergency intake

1. Confirm the canonical site is deployed through Netlify. In its Netlify dashboard, open **Forms** and enable **Form detection** before deploying these files.
2. Deploy the site from the connected repository with `pnpm build`, publish directory `dist/public`. Do not substitute a Railway build and do not change the main customer domain until the backup has passed acceptance.
3. Open `https://<actual-netlify-domain>/continuity.html` on the Netlify-hosted origin itself, not the Railway URL. Confirm the page loads when Railway API is unreachable.
4. Submit a controlled, clearly identified test request (do not enter real customer information). Verify the request appears in Netlify > Forms > `mechanical-continuity-request`, then delete the test entry according to the site's data policy.
5. Enable Netlify submission notifications for the responsible Mechanical Enterprise operations mailbox, if supported. Verify delivery; email notification is supplementary to Netlify's retained submission list.
6. Keep this page unlisted/noindex until the test passes. For an actual Railway outage, communicate its **verified Netlify URL** via existing customer channels and monitor Netlify submissions. **Do not automatically convert submissions into marketing opt-ins.**
7. When Railway returns, export Netlify form submissions using Netlify's approved tooling, reconcile against CRM by exact email/phone and timestamp, import exactly once, and check duplicates before deleting the emergency intake data.

## Full CRM continuity (REQUIRES separate infrastructure)

A fully functional backup is **not** delivered by the static emergency form. Before claiming CRM failover, provision and test all of:

1. A second Node/Express host outside Railway (for example Render, subject to connected account and payment approval), pinned to a verified release built from the same GitHub repository. It must offer a private authentication configuration, same session/encryption keys, and supported callback/allowed-origin configuration.
2. A **separately hosted MySQL standby** or encrypted, versioned, regularly tested offsite MySQL backup. Existing production MySQL lives in Railway, so pointing the second application host at the Railway DB does *not* survive a Railway outage. Do not improvise MySQL-to-PostgreSQL migration; the app currently uses `drizzle-orm/mysql2`.
3. Tested restore point/time objectives with proper binary-log handling or point-in-time restore. Set conservative RPO/RTO only after a real controlled restore, not as promises.
4. **One-writer promotion**: standby web app starts with all outbound workers and side effects disabled (Gmail prospecting/follow-ups, SMS/Telnyx, social posting, SEO/GBP sync, QuickBooks jobs, Stripe processing, Vapi, VAPID notifications, scheduled emails). Do not enable on standby merely because an HTTP health check fails; require verified failover and single-writer ownership.
5. One authoritative contact suppression list and Gmail Sent reconciliation, including opt-outs and bounced addresses. On promotion, confirm primary has stopped and restart only a single sender after current-hour Gmail Send count and all eligibility checks succeed.
6. Restore/verify integrations without reissuing payments, messages, invoices, bookings, or webhooks. Implement deduplicating idempotency keys and safe replay queues before automating automatic traffic cutover.
7. Independently controlled DNS and/or load balancer for failover. DNS switch alone is insufficient without reachable database and fully validated alternate backend.
8. Document access recovery for admins and restore test cadence. Never put OAuth refresh tokens, DB dumps, encryption keys, or customer files into GitHub, public CI artifacts, or static Netlify assets.

## Outage-mode decision tree

- If **only Railway API** is down but Netlify is up: keep static content online; use verified Netlify `/continuity.html` to receive essential inquiries; CRM stays unavailable.
- If **Railway database** is down: do not switch a secondary server to the Railway DB; use verified offsite MySQL restore or independently replicated MySQL, and keep all writes paused until integrity and ownership are confirmed.
- If **Railway returns**: reconcile emergency submissions, verify CRM data, and only then restore normal automated integrations. Never have two scheduled Mechanical email senders.
- If **Netlify itself** is down, the emergency form is unavailable; customers must use the published phone/email while independent alternative hosting is restored.

## Acceptance gates

- [ ] Netlify origin independently reachable
- [ ] Netlify Forms enabled and test submission retained
- [ ] Ops notification tested
- [ ] Main public domain routing documented
- [ ] Offsite MySQL backup/restore tested on non-production DB
- [ ] Secondary application host deployed and secured
- [ ] All outbound schedulers OFF on secondary by default
- [ ] One-writer switchover and rollback procedure tested
- [ ] No duplicate Gmail/SMS/financial jobs in controlled failover test

**Do not label the full CRM backup "ready" until every gate above is validated.**
