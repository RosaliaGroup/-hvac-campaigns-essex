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
