# Independent development and full-system disaster recovery

> **Purpose**: continue coding, validating, building and reviewing Mechanical Enterprise while Railway is down. This is NOT a live failover of customer data until the external production standby and a tested offsite MySQL restore are available.

## Start building without Railway (now, no new provider required)

1. Open [the GitHub repository](https://github.com/RosaliaGroup/-hvac-campaigns-essex), switch to the `backup/independent-build-workspace` branch, then choose **Code → Codespaces → Create codespace on this branch**. GitHub Codespaces availability/billing are subject to the user's GitHub account.
2. The `.devcontainer` provisions a separate Node 22 development container and its own disposable MySQL 8.4 database with **dummy-only** credentials. It will not connect to Railway, share production data or use live integrations.
3. In the Codespaces terminal run `pnpm check` and `pnpm build` to verify both app frontend/backend. For the local web UI, run `pnpm dev` and view forwarded port 3000 privately.
4. **Database caveat**: a new local MySQL container begins EMPTY. Do not run migrations against production or blindly replay hand-applied production migrations. For locally disposable databases only, use the app's approved development schema initialization procedure after reviewing `drizzle/README.md`; otherwise UI pages relying on tables will not work.
5. GitHub Actions runs an independent build on feature/backup branches and PRs. Use **Actions → Independent development build (no Railway) → Run workflow** for an on-demand compilation and downloadable build artifact. This workflow performs TypeScript checks, selected outbound safety tests, and full frontend/backend build without any Railway deployment or customer data.
6. Keep the environment PRIVATE. Do not add real customer records, production DB dumps or secrets to Codespaces, branch files, Actions artifacts or logs.

## Current state, verified October 21

- Code: GitHub repository `RosaliaGroup/-hvac-campaigns-essex`, branch main.
- Website: Netlify static site with `netlify.toml`; its `/api/*` proxies depend on Railway.
- Backend/CRM: Railway Node/Express production service `6a517729-6912-44e0-8407-7e5efab38c29`.
- Database: Railway MySQL service `112438c9-ec12-4c8b-b277-edaf0816cbf0`, on `mysql-volume`.
- A source repo, artifact build and local dev MySQL **are not an offsite copy of current customer data**. Railway volume snapshots alone are not independent offsite backups.

## Full operational backup (still to provision and validate)

1. **External application host**: create an independent Render or equivalent account and deploy the same GitHub commit as a private standby service. Set `STANDBY_DISABLE_AUTOMATION=true` on the standby and isolate all webhook write side effects. The standby must use the same application stack, not an unrelated static website.
2. **External MySQL copy**: provision compatible MySQL outside Railway with encryption, access control and regular verified offsite snapshots or replicated backups. Never point the standby at Railway MySQL and call it a backup. Validate schema compatibility with the manually reconciled Drizzle migration state.
3. **Offsite backup job**: schedule encrypted logical backups or managed MySQL snapshots while Railway is healthy. Ensure offsite retention and a tested restore into an isolated scratch MySQL instance. Record the timestamp of the most recent verified restorable copy and the actual recovery point.
4. **Secrets**: add connection/OAuth/crypto credentials only to the secondary provider's encrypted secret store using least privilege. Keep production secret values out of repository, Actions build output and all static assets. Do not copy production tokens into untrusted Codespaces.
5. **One writer only**: no automated Gmail/SMS/calls, Google Ads, social, SEO, billing or booking actions from the standby unless formally promoted and primary stopped. Use a persistent leader/lease for outgoing jobs; check Gmail hourly cap/opt-outs across both before promotion. A 'no server ping' alone must NOT auto-enable secondary messaging.
6. **Switch-over test**: in a controlled test verify login, contacts, notes, opportunities, customers, job photos/files, estimates, calendar and Gmail thread *read-only*. Test backup/restore integrity first; then cut traffic over safely with an explicit owner approval. Document DNS, callbacks, restore and rollback procedures.
7. **Data divergence**: during a true Railway outage, route new inquiries to the verified alternative service and use queue/idempotency identifiers; after recovery merge without duplicating customer records or sends. This is NOT solved by merely editing Netlify redirects.

### Acceptance checklist

- [ ] Independent Codespace opens, installs dependencies, can typecheck/build.
- [ ] GitHub Actions independently reports SUCCESS and produces the built app artifact.
- [ ] Dedicated secondary host deployed, protected and healthy.
- [ ] Offsite encrypted MySQL backup succeeds and restores into a scratch DB.
- [ ] CRM paths work against restored isolated data.
- [ ] Domain/API failover tested.
- [ ] Outbound jobs on standby remain disabled unless expressly promoted.
- [ ] Recovery test documents last verified data restore point and downtime.

**Do not claim complete full-system backup or automatic failover until the above gates are verified.**
