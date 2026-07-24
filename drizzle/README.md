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

- **Repository journal head:** `0056_job_lifecycle` (`drizzle/meta/_journal.json`).
- **Production `__drizzle_migrations` recorded head:** `0054`
  (55 tracker rows = migrations `0000`–`0054`; drizzle's row `id` is 1-based, so
  the highest `id` 55 corresponds to tag `0054`).
- **`0055` and `0056` are already physically applied to production**
  (verified: table `smsConversationLinks` and column `jobs.lifecycleState` exist),
  but were **applied manually and are NOT recorded** in `__drizzle_migrations`.
- **No tool may attempt to apply `0055` or `0056` again.** A fresh
  `drizzle-kit migrate` would read the tracker, believe `0055`/`0056` are
  unapplied, and re-run their `CREATE TABLE` → failure / partial application / damage.
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
