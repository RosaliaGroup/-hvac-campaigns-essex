# Production Schema Divergence — QBO reconciliation

This branch reconciled our QBO composite-name work onto main's canonical
implementation (main's `qboRepairCore` + `enrichmentGate` + migration
`0038_qbo_customer_repair`). During our earlier standalone work, a **different**
migration (our `0038_qbo_composite_name_parsing`) was applied to the **production**
database out-of-band. That code has now been dropped in favour of main's, leaving
a schema divergence documented below. A read-only production inspection on
2026-07-11 (§5) verified that main's canonical `0038_qbo_customer_repair` is
**already applied and journaled** in production — so the only residual divergence
is the five orphaned additive columns from the out-of-band migration, which are
harmless and deferred to a separate cleanup task. No migration is required before
deployment.

## 1. Columns currently present in production (from our out-of-band 0038)

Applied directly to production earlier; **not** part of main's schema:

| Table | Column | Type | Status now |
|-------|--------|------|-----------|
| `customers` | `quickbooksRawDisplayName` | varchar(512) | **orphaned** — no longer in `schema.ts`, unused by canonical code |
| `customers` | `projectReference` | varchar(120) | **orphaned** — superseded by `opportunities.projectReference` |
| `customers` | `displayNameManuallyApproved` | tinyint NOT NULL default 0 | **orphaned** — canonical design uses the enrichment gate, not a per-row lock |
| `properties` | `locationNotes` | varchar(255) | **orphaned** — no canonical equivalent |
| `properties` | `projectReference` | varchar(120) | **orphaned** — superseded by `opportunities.projectReference` |

These five columns are **nullable / defaulted**, so leaving them in place is
**harmless** to the canonical application (it never selects or writes them).

## 2. Columns/objects expected by main's canonical implementation (migration `0038_qbo_customer_repair`)

**Not yet present in production** (main's 0038 was never applied there):

| Object | Purpose |
|--------|---------|
| table `qboRepairAuditLog` (+ 2 indexes) | audit log for the canonical repair/enrichment |
| `customers.quickbooksCustomerCheckedAt` (timestamp) | "last QBO check" marker |
| `opportunities.projectReference` varchar(64) (+ index) | canonical home for a parsed project code |

The canonical code (`qboRepairCore`, `qboCustomerRefresh`, and the ported
live-sync project-reference handling) **references these**. A read-only
production inspection on 2026-07-11 (see §5) **confirmed all of them already
exist** in production, so no migration is required before deploying this branch.

## 3. Reconciliation status — VERIFIED (2026-07-11)

- **Canonical `0038_qbo_customer_repair` is already applied to production.** The
  production schema contains **all** expected canonical objects: table
  `qboRepairAuditLog` (+ its two indexes), `customers.quickbooksCustomerCheckedAt`,
  and `opportunities.projectReference` (+ its index) — each with matching type,
  nullability, default, and index shape.
- **The `__drizzle_migrations` journal already contains the canonical 0038 entry**
  (`id=24`) with a **byte-identical hash**
  (`77534c36086b1a58d330b228f9f3da8aacac7d9c889d412b55c2f0afffbe8fc0`), matching
  the raw bytes of `drizzle/0038_qbo_customer_repair.sql` exactly.
- **No migration execution is required before deployment.** Deployment is **not**
  blocked by migration 0038.
- **Do NOT reapply the migration or insert another journal entry.** Every
  canonical object already exists, so a re-apply is a no-op at best; inserting a
  second 0038 journal row would **duplicate `id=24` and corrupt the journal**.
  Both would be incorrect.
- **Equivalent mappings:** raw display name → `customerSyncConflicts.qboValue`
  (review row); review flag → `customers.hasQboConflicts`; project reference →
  `opportunities.projectReference`.
- **Remaining divergence is limited to the five orphaned additive columns** from
  the earlier out-of-band migration (§1). They are currently **harmless**
  (nullable/defaulted, never selected or written by canonical code) and are
  **intentionally left in place**. Any cleanup will be handled as a **separate
  future schema-cleanup task** and is **not required** for application correctness
  or deployment.

## 4. Historical note

Production customers **11, 12, 14, 15, 23** were previously repaired by our
now-removed tooling (clean names written; the five out-of-band columns populated
for those rows). Those clean CRM names remain valid. Customers **7, 8, 9, 10**
were intentionally left for manual review. Main's canonical repair workflow
(`qboRepairCore`) supersedes the removed tooling going forward.

## 5. Production inspection (2026-07-11)

A read-only inspection of the production `railway` database confirmed the state
recorded above. Full evidence: `reports/0038-production-inspection.md`.

**Inspection summary:**

- Read-only inspection (`START TRANSACTION READ ONLY` → queries → `ROLLBACK`)
- Zero SQL writes
- Zero journal writes
- Zero data changes
- Zero schema changes

**Result:** canonical `0038_qbo_customer_repair` is already applied and journaled
in production; no migration execution is required; deployment is **not** blocked
by migration 0038.

## 6. Migration journal row `id=25` — Jobs-module `0039` (VERIFIED 2026-07-12)

During post-deployment verification of app commit `d96b1a2` (PR #10), the
production `__drizzle_migrations` journal was found to contain an extra row
beyond canonical `0038`. A read-only investigation confirmed it is **legitimate**,
not corruption and not a duplicate:

| Field | Value |
|-------|-------|
| `id` | `25` |
| `hash` | `ad27c491f61923142c38da07bd38ff715152333318f0a44353292c85a0b2965e` |
| `created_at` | `1783822047420` (**2026-07-12T02:07:27Z**) |

- **Byte-exact match** to `drizzle/0039_opportunity_to_job.sql` (raw-byte sha256
  equals the journal hash).
- **Source branch:** `feature-jobs-module` (also on `origin/feature-opportunity-to-job`);
  **not** in `origin/main` — an unmerged feature migration.
- **Applied out-of-band** by an operator at **2026-07-12T02:07:27Z** (≈1 hour
  before the `d96b1a2` deploy; Railway deploys run only `pnpm build` +
  `node dist/index.js` and execute no migrations).
- **Schema added (only):**
  - `jobs.opportunityId` — nullable `int`
  - index `jobs_opportunityId_idx` on `jobs(opportunityId)`
  - (the `jobs` table itself predates this — created in `0030`, already in main.)
- **Migration `0040_jobs_module_child_tables` has NOT been applied** — its child
  tables (`jobAttachments`, `jobLaborEntries`, `jobNotes`, `jobPartsItems`,
  `jobStatusHistory`) are absent (0/5) and it is not journaled. Journal and
  schema agree.

**Assessment:** production is a **safe schema superset of `main`** — one additive
nullable column + index that the current app (`main`/`d96b1a2`) does not
reference. This is the same benign pattern as the orphaned columns in §1.

- **No schema or journal repair is needed.**
- **Do NOT reapply or manually re-journal migration `0039`** — it is already
  applied and correctly journaled (`id=25`).
- **When the Jobs module is eventually released:** preserve the existing matching
  journal row (`id=25`, hash `ad27c491…`). Because the branch's `_journal.json`
  lists `0039` with that same hash, `drizzle-kit` will treat `0039` as already
  applied and proceed to `0040` normally. Do not force-apply `0039`.
- **This does NOT block the current QBO release** (`d96b1a2`).

## 7. Post-deployment automatic QBO poller verification (2026-07-12)

After the `d96b1a2` deployment, the application's automatic QBO sales-document
poller (180s interval) was observed read-only via Railway logs:

- **5 cycles observed**
- **5 successful** (`ok=true`), **0 failed** (`ok=false`)
- Advisory lock **acquired and released successfully** every cycle (5 acquire, 5
  release, 0 busy/denied)
- `pulled=0`, `created=0`, `updated=0`
- **No duplicate, parser, or conflict errors** (the only log rejections were
  unauthenticated `[SMSWebhook]` probes, unrelated to QBO)
- Customer / property / opportunity / audit row counts **unchanged**
  (`customers=23`, `properties=15`, `opportunities=26`, `qboRepairAuditLog=13`)

**Result:** the production QBO integration and advisory-lock hardening are
operating cleanly post-deployment; no data was created or modified.
