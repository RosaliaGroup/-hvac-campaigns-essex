# 0038_qbo_customer_repair — Production Inspection Report (READ-ONLY)

**Date:** 2026-07-11
**Database:** `railway` (production, Railway service `MySQL`)
**Access method:** `mysql2` over a **read-only transaction** — `SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ` → `START TRANSACTION READ ONLY` → inspection queries → `ROLLBACK`. No `INSERT`/`UPDATE`/`DELETE`/DDL issued. Credentials never printed.
**Scope:** inspect-only. No schema change, no journal write, no repair, no deployment.

---

## 1. Exact canonical 0038 objects expected (from `drizzle/0038_qbo_customer_repair.sql`)

The migration is **additive only** — `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`. No `DROP`, `RENAME`, `DELETE`, `UPDATE`/backfill, or type conversion.

| # | Object | Definition |
|---|--------|-----------|
| 1 | table `qboRepairAuditLog` | 16 columns; PK `qboRepairAuditLog_id` on `id` |
| 2 | `customers.quickbooksCustomerCheckedAt` | `timestamp` NULL |
| 3 | `opportunities.projectReference` | `varchar(64)` NULL |
| 4 | index `qboRepairAuditLog_runId_idx` | on `qboRepairAuditLog(runId)`, non-unique |
| 5 | index `qboRepairAuditLog_customerId_idx` | on `qboRepairAuditLog(customerId)`, non-unique |
| 6 | index `opportunities_projectReference_idx` | on `opportunities(projectReference)`, non-unique |

`qboRepairAuditLog` columns per the migration: `id int AI PK`, `runId varchar(64) NN`, `kind varchar(24) NN`, `actor varchar(128)`, `parserVersion varchar(32)`, `manifestHash varchar(128)`, `customerId int NN`, `quickbooksCustomerId varchar(64)`, `fieldName varchar(64) NN`, `beforeValue text`, `afterValue text`, `createdPropertyId int`, `opportunityId int`, `result varchar(24) NN`, `reason text`, `createdAt timestamp NN default now()`.

---

## 2. Exact production objects found

| Object | Found | Details observed |
|--------|-------|------------------|
| table `qboRepairAuditLog` | ✅ YES | 16 columns, PK on `id`, `createdAt` default `now()` |
| `customers.quickbooksCustomerCheckedAt` | ✅ YES | `timestamp`, `NULL` |
| `opportunities.projectReference` | ✅ YES | `varchar(64)`, `NULL` |
| `qboRepairAuditLog_runId_idx` | ✅ YES | on `(runId)`, non-unique |
| `qboRepairAuditLog_customerId_idx` | ✅ YES | on `(customerId)`, non-unique |
| `opportunities_projectReference_idx` | ✅ YES | on `(projectReference)`, non-unique |

---

## 3. Side-by-side schema comparison

| Object | Expected (migration) | Production (found) | Match |
|--------|----------------------|--------------------|-------|
| `qboRepairAuditLog` table | 16 cols, PK(id) | 16 cols, PK(id) | ✅ |
| `qboRepairAuditLog.createdAt` | `timestamp NN default now()` | `timestamp NN DEFAULT_GENERATED now()` | ✅ |
| `customers.quickbooksCustomerCheckedAt` | `timestamp` NULL | `timestamp` NULL | ✅ |
| `opportunities.projectReference` | `varchar(64)` NULL | `varchar(64)` NULL | ✅ |
| `qboRepairAuditLog_runId_idx` | non-unique (runId) | non-unique (runId) | ✅ |
| `qboRepairAuditLog_customerId_idx` | non-unique (customerId) | non-unique (customerId) | ✅ |
| `opportunities_projectReference_idx` | non-unique (projectReference) | non-unique (projectReference) | ✅ |

**Every canonical object exists in production with matching type, nullability, default, and index shape.**

### Orphaned columns from the earlier out-of-band migration (must stay untouched)

| Table.Column | Type | Nullable | Default | Present |
|--------------|------|----------|---------|---------|
| `customers.quickbooksRawDisplayName` | varchar(512) | YES | null | ✅ |
| `customers.projectReference` | varchar(120) | YES | null | ✅ |
| `customers.displayNameManuallyApproved` | tinyint | NO | 0 | ✅ |
| `properties.locationNotes` | varchar(255) | YES | null | ✅ |
| `properties.projectReference` | varchar(120) | YES | null | ✅ |

All five present, nullable/defaulted, harmless to canonical code. **Not touched.**

---

## 4. Current migration-journal rows (`__drizzle_migrations`, 24 rows; tail)

| id | when (epoch ms) | hash |
|----|-----------------|------|
| 21 | 1773452691057 | `58c703a5…` |
| 22 | 1773514303208 | `9348d974…` |
| 23 | 1783684702157 | `ed0d619a61a2c5aa…` — earlier **out-of-band** 0038 (`0038_qbo_composite_name_parsing`) |
| 24 | 1783725399284 | `77534c36086b1a58d330b228f9f3da8aacac7d9c889d412b55c2f0afffbe8fc0` — **main's canonical** `0038_qbo_customer_repair` |

**Hash provenance check:** local `drizzle/0038_qbo_customer_repair.sql` raw-byte sha256 = `77534c36…8fc0` = **exact match** to production journal row `id=24`. The journal entry was written from this identical migration file. (LF-normalized hash `618bdc29…` differs, confirming the row was recorded from the CRLF file bytes as committed — the match is against the real file.)

---

## 5. Is anything actually missing?

**No.** All six canonical objects exist, and the canonical 0038 hash is already recorded in `__drizzle_migrations` (`id=24`). Nothing from `0038_qbo_customer_repair.sql` is absent.

## 6. Is journal-only reconciliation needed?

**No.** The journal already contains the correct canonical 0038 row with a byte-identical content hash. There is no missing journal entry to add.

> ⚠️ If the previously-planned "journal reconciliation" SQL were run now, it would **INSERT a second row for 0038**, duplicating `id=24` and corrupting the journal it was meant to keep clean. This is the specific harm avoided by not proceeding.

## 7. Is no-action safer than applying SQL?

**Yes — decisively.**
- **Schema apply:** every object exists → `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` would be pure no-ops (no benefit, non-zero connection/lock risk).
- **Journal write:** would create a **duplicate** 0038 row → net harm.
- **Conclusion:** taking no action leaves production in a correct, canonical-complete state. Applying anything can only match (no-op) or degrade (duplicate journal row).

---

## 8. Additional finding — repair already ran in production

`qboRepairAuditLog` currently holds **13 rows**. The canonical repair/audit workflow has therefore **already executed** against production at some point (this row count is pre-existing, not created by this inspection). This is consistent with `id=24` being applied and reinforces that the reconciliation is historical and complete. No repair was run by this session, and none should be.

**Baseline row counts (unchanged by inspection):** `customers=23`, `properties=15`, `opportunities=26`, `qboRepairAuditLog=13`.

---

## 9. Recommendation

**No migration execution, no journal write, no deployment.** Production is already fully reconciled for main's canonical `0038_qbo_customer_repair`. The only remaining item is an **optional, separate follow-up** to clean up the five orphaned out-of-band columns (not required for correctness, not part of any deploy). The presence of both the out-of-band 0038 (`id=23`) and canonical 0038 (`id=24`) in the journal is benign for the running app but worth noting before any future `drizzle-kit migrate` is pointed at production.
