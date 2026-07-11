# Production Schema Divergence — QBO reconciliation

This branch reconciled our QBO composite-name work onto main's canonical
implementation (main's `qboRepairCore` + `enrichmentGate` + migration
`0038_qbo_customer_repair`). During our earlier standalone work, a **different**
migration (our `0038_qbo_composite_name_parsing`) was applied to the **production**
database out-of-band. That code has now been dropped in favour of main's, leaving
a schema divergence that must be reconciled before/at deployment.

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
live-sync project-reference handling) **references these**, so they must exist in
production before this branch is deployed.

## 3. Reconciliation status

- **Unused / to clean up later:** the five out-of-band columns in §1. They are
  safe to leave (nullable), and dropping them is **not** required for application
  correctness. Track as a separate follow-up cleanup migration; do **not** drop
  them as part of this deployment.
- **Equivalent mappings:** raw display name → `customerSyncConflicts.qboValue`
  (review row); review flag → `customers.hasQboConflicts`; project reference →
  `opportunities.projectReference`.
- **Required before deploy (BLOCKER):** apply main's `0038_qbo_customer_repair`
  to production so `qboRepairAuditLog`, `customers.quickbooksCustomerCheckedAt`,
  and `opportunities.projectReference` exist. Because the production
  `__drizzle_migrations` journal is already stale (our 0038 was applied
  out-of-band), this must be done **deliberately and manually** — do **not** run
  `drizzle-kit migrate` / `db:push` blind against production.

## 4. Historical note

Production customers **11, 12, 14, 15, 23** were previously repaired by our
now-removed tooling (clean names written; the five out-of-band columns populated
for those rows). Those clean CRM names remain valid. Customers **7, 8, 9, 10**
were intentionally left for manual review. Main's canonical repair workflow
(`qboRepairCore`) supersedes the removed tooling going forward.
