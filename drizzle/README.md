# Database Migrations — Production Safety Policy

> **READ THIS BEFORE TOUCHING THE DATABASE.** This repo auto-deploys `main` to
> Railway **production** on every push. Production migrations are **manual-only**
> and gated on explicit owner approval. Nothing in deploy, `build`, or server
> `start` runs a migration — only the local `db:push` script does, and it must
> **never** point at production.

Tooling: `drizzle-orm@^0.44.5`, `drizzle-kit@^0.31.4`. Config: `drizzle.config.ts`
(`schema: ./drizzle/schema.ts`, `out: ./drizzle`, dialect mysql).

## Production rules

- **Explicit owner approval is required** for every production schema/data change.
  A GitHub "Approved" review is not sufficient and is not a gate.
- **Create and verify a fresh logical backup before any production schema write.**
  (e.g. `mysqldump` of the `railway` database, or a managed snapshot.) Verify it
  completed, is non-empty, and is restorable. **An unverified backup is not a
  rollback plan.**
- **For destructive or high-risk changes, restore that backup into a scratch
  database and confirm integrity BEFORE executing anything against production.**
- **Never run `db:push` (or any `drizzle-kit migrate` / `drizzle-kit push`)
  against production.** `db:push` = `drizzle-kit generate && drizzle-kit migrate`
  and is for local/disposable databases only.
- **Diff the live production schema before assuming the journal reflects reality**
  (see "Current exceptional state"). Production is hand-reconciled; the journal is
  not an authoritative record of what is physically applied.
- **Apply migrations manually using the approved runbook** — apply the new
  `drizzle/00NN_*.sql` by hand against production; do not invoke the tool to migrate.
- **Run post-migration schema and application validation** (below).
- **Reconcile the migration tracker after validation** (see "Tracker reconciliation").
- **Test the rollback / restore procedure before any destructive change.**

### Approved manual procedure (summary)

1. Owner approval of the specific `.sql`. No approval → stop.
2. Fresh backup of the prod `railway` DB; **verify** it (restore-check into a scratch DB).
3. Review the exact SQL; confirm additive where possible; confirm a rollback exists for any destructive step.
4. Apply `drizzle/00NN_*.sql` **by hand** against production. Do NOT run `drizzle-kit migrate` / `db:push`.
5. Validate (schema + application).
6. Reconcile the tracker (below), then record what/when/who + backup location.

## Destructive-change rule

No `DROP` (column/table), type-narrowing `ALTER`, rename, or `NOT NULL` addition
without a safe default may ship without **all** of:

1. a **verified** backup,
2. a **written and tested** `*.down.sql` or a full restore plan,
3. **owner approval of the exact destructive step**,
4. defined **post-change validation criteria**.

## Post-migration validation (required)

- New/changed tables, columns, indexes, enum values, and constraints exist with
  the expected type, nullability, default, and index shape.
- The application's touched surface passes a smoke test (a read **and** the
  specific write path).
- No error spike in Railway logs after the next deploy.
- Affected-table row counts are as expected (no unintended deletes/rewrites).

## Current exceptional state (⚠️ read before planning any migration)

- **Repository journal head:** `0069_notifications` (`drizzle/meta/_journal.json`),
  66 entries. (Was `0061` when this section was first written; `0063`–`0069` have
  landed since — see the 2026-08-15 log below.)
- **Production `__drizzle_migrations` recorded head:** `0054`
  (56 tracker rows as of 2026-08-16; drizzle's row `id` is 1-based). The tracker has
  **not** advanced since — every migration from `0055` on is hand-applied and unrecorded.
- **`0055`, `0056`, `0060`, and `0061` are already physically applied to production**
  (verified: `smsConversationLinks`, `jobs.lifecycleState`, the estimate tables
  `estimates`/`estimateOptions`/`estimateLineItems`, and `estimates.estimateNumber`
  being NULLable all exist), but were **applied manually and are NOT recorded** in
  `__drizzle_migrations`.
- **`0057`–`0059` are permanent numbering gaps — they will never exist.** `0060`
  claimed its number to dodge in-flight branches (`0057` = PR #71
  `feature/dispatch-assign-m2`; `0058`–`0059` were reserved for opportunity work)
  that never merged those numbers. Do **not** "backfill" them — the sequence is
  intentionally non-contiguous. `drizzle-kit generate` numbers the next migration
  off the journal's **max idx** (`0061` → next `0062`), so the gaps are skipped
  automatically; never pre-allocate a number, let the merge assign it.
- **`0060`/`0061` journal + snapshot reconciliation (this change):** both
  `0060_tiered_estimates.sql` (estimate tables) and `0061_estimate_number_nullable.sql`
  (`estimateNumber` → NULLable) were committed hand-authored with **no** `_journal.json`
  entries and **no** meta snapshots, leaving `meta/0056_snapshot.json` as the latest.
  Consequence: `drizzle-kit generate` re-emitted the estimate tables + the column
  change as spurious DDL and mis-numbered the next migration `0057`. Fixed by adding
  the `0060` and `0061` journal entries (`when` = each migration's authoring commit)
  and regenerated `meta/0060_snapshot.json` + `meta/0061_snapshot.json` (schema
  metadata only — **no production DB touch**). Verified offline: the regenerated
  `0061` delta is byte-identical to `0061_estimate_number_nullable.sql`,
  `drizzle-kit generate` reports "No schema changes", and the next migration numbers
  `0062`.
- **`0062` is a PERMANENT GAP — never reuse the number.** The Opportunity Center P1
  foundation was first hand-applied to production **as `0062`** during an interrupted
  deploy (2026-07-31), then that branch was **superseded by `0064`** before any
  `0062_*.sql` merged (`0063` = `appointment_assignment_events` / Dispatch M2 shipped
  first; `0064` = `0064_opportunity_center_p1`, the merged P1). Consequences that live
  on in production and are **not** captured by any committed migration or `schema.ts`:
  - Production retains **two `0062` columns** that `0064` does not use and no app code
    reads (verified zero references on `origin/main` — both DB-only):
    - `opportunities.priorityScore` (`tinyint unsigned`) — **intentionally retained.**
      The commercial-bid workflow scores priority `10/7/5/3/1` plus two strategic flags,
      which `0064`'s `priority enum('low','medium','high','urgent')` cannot hold. **Do
      not drop it.**
    - `opportunities.expectedCloseDate` (`timestamp`) — retained **pending a spec
      decision.** The commercial-bid work may repurpose it as a bid-submission deadline
      distinct from `0064`'s `expectedCloseAt` (`date`). Decide when specifying; **do
      not drop it yet.**
  - The two orphan **indexes** from the `0062` apply
    (`opportunities_propertyId_idx`, `opportunities_assignedTechnicianId_idx`) were
    **dropped from production 2026-08-01**, realigning prod's index set with `0064`.
    The `propertyId` / `assignedTechnicianId` **columns** are legitimate (both `0062`
    and `0064` add them) and were kept.
### Hand-applied 2026-08-15 → 16 (commercial card + alerts)

All four applied manually against prod `railway` (MySQL 9.4.0) by the owner, each
after a verified `mysqldump`. **None are recorded in `__drizzle_migrations`** — see
the checksum caveat under "Tracker reconciliation"; they join the unrecorded set
rather than getting a single guessed-hash row, which would make the tracker *less*
trustworthy than a consistently-behind one.

| Migration | What | Backup | Validation at apply |
|---|---|---|---|
| `0067_checklist_board_status` | `opportunityChecklistItems.boardStatus` enum + backfill + index | `/tmp/railway-pre0067.sql` (3.8M) | 32 items, 31 todo / 0 doing / 1 done, **0 mismatched** |
| `0068_checklist_groups` | `opportunityChecklistGroups` table, `groupId`, template `groupName`, backfill, index | `/tmp/railway-pre0068.sql` (3.8M) | 32 items, **0 orphaned**, 3 groups |
| *(data only, no migration)* | Seeded 3 card segments — QA CHECKLIST / TYPE OF PROJECT / EVALUACIÓN COMERCIAL — into the template **and** existing opportunities. `NOT EXISTS`-guarded, re-runnable. | `/tmp/railway-pre-segments.sql` (3.8M) | 16 / 10 / 7 items per opportunity; template matches |
| `0069_notifications` | `notifications` table + inbox index. Purely additive, no backfill. | `/tmp/railway-pre0069.sql` (3.8M) | table exists, 0 rows (nothing writes until deploy) |

`0070_opportunity_archive` (archive columns on `opportunities`) follows the same pattern —
additive, three nullable columns plus an index, no backfill, tested `.down.sql`.

State confirmed 2026-08-16: **56 tracker rows** (unchanged), **132 checklist items**,
**12 checklist groups** across 4 commercial opportunities (3 segments each — the
template instantiates correctly on new bids), **0 notification rows**.

`boardStatus` (0067) is now **vestigial**: the To do / In progress / Done board it was
built for was replaced by the grouped card checklists in the same session. It is kept
in lockstep with `isComplete` by `checklist.setComplete`, costs nothing, and dropping it
would mean another production migration. Retire it with the next unrelated change to
that table rather than on its own.

⚠️ The backups above live in the **container's `/tmp`**, which does not survive a
service restart. They were adequate at apply time; they are not durable archives. Move
future backups off the container or use a managed snapshot.

- **No tool may attempt to apply `0055`, `0056`, `0060`, or `0061` again.** A fresh
  `drizzle-kit migrate` would read the tracker, believe they are unapplied, and
  re-run their DDL → failure / partial application / damage.
- **The same applies to `0063`–`0069`.** Everything from `0055` onward is physically
  applied but unrecorded, so a fresh `drizzle-kit migrate` would try to re-run all of it.
- **Production must be treated as hand-reconciled.**
- **Live schema inspection is mandatory before planning any future migration.**

## Tracker reconciliation

After a manual apply, insert exactly one `__drizzle_migrations` row per applied
migration so the tracker matches the journal; do not duplicate existing `id`s.

**Checksum caveat — do not guess the hash format.** Do **not** prescribe a
specific checksum/hash value here until the exact format the **installed**
`drizzle-kit@^0.31.4` / `drizzle-orm@^0.44.5` mysql migrator expects is verified
from the actual dependency source. (Observation only, not a spec: current prod
rows carry a 64-hex-char `hash` and a millisecond-epoch `created_at`.) Verify the
authoritative format before inserting, from:

- the migrator that reads/writes the table:
  `node_modules/drizzle-orm/mysql-core/dialect.js` and
  `node_modules/drizzle-orm/mysql-core/session.js` (search for `__drizzle_migrations`), and
- how the journal hash is generated:
  `node_modules/drizzle-kit` (search for `getMigrationHash` / how `.sql` files are hashed).

Once confirmed, record the exact command/source and hash derivation here so the
next person does not have to re-derive it.

## Rollback / restore (from the verified backup)

- **Prefer a forward reversing migration** when additive/cleanly reversible: apply
  the paired `*.down.sql` (e.g. `0056_job_lifecycle.down.sql`) by hand, then remove
  the corresponding `__drizzle_migrations` row.
- **If data was lost or the change is not cleanly reversible, restore the verified
  backup** into a scratch database, confirm integrity, then cut production over.
  Restoring an unverified backup is not a rollback plan.
- After any rollback, re-run validation and reconcile the tracker to the restored state.

## Who owns approval

The **owner** is the sole approver for any production schema/data change or
destructive step. See also the auto-deploy coupling: pushing `main` deploys prod.
