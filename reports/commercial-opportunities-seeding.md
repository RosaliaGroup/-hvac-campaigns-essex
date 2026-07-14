# Commercial Opportunities — Seeding & Deployment Note

**Status:** Phase 1 (development). Lazy/runtime seeding is in use. Read this before deploying.

## What the migrations do

Migrations `0042_commercial_opportunities_core.sql` and
`0043_commercial_opportunities_children.sql` are **schema-only and additive**:

- `0042` creates `opportunityStages` and adds nullable/defaulted commercial columns
  to the existing `opportunities` table (plus indexes). The only non-null column,
  `recordType`, carries a `DEFAULT 'qbo_residential'`, so existing rows are
  unaffected and the legacy QBO 5-stage `stage` enum and QBO sync are untouched.
- `0043` creates the 7 child tables (project categories, members, checklist
  templates + items, checklist items, comments, documents).

**Neither migration seeds any data.** No stages, no checklist templates.

## How seeding currently happens (runtime / lazy)

The **first relevant commercial request** performs an **idempotent** seed:

- `opportunities.commercial.stages.list` / `create` / `transitionStage`
  → `ensureStagesSeeded()` inserts the 16 default pipeline stages **only if the
  table is empty** (source of truth: `COMMERCIAL_STAGE_SEEDS` in
  `shared/commercialPipeline.ts`).
- `opportunities.commercial.create` / `checklist.*`
  → `ensureQaTemplateSeeded()` inserts the default Commercial QA checklist template
  + items **only if absent**.

Both are safe to run repeatedly and never duplicate rows. See the block comment
above the seed section in `server/routers/commercialOpportunities.ts`.

## Deployment requirements

1. Run migrations `0042` and `0043` (additive, reversible — no backfill).
2. **Verify the application DB user has INSERT permission** on:
   `opportunityStages`, `opportunityChecklistTemplates`,
   `opportunityChecklistTemplateItems`. If it does not, the first commercial
   request will error at seed time.
3. Do **not** hand-seed production as part of this phase.

## Pre-deployment gate (run in a controlled STAGING environment — not production)

Before any production rollout, exercise the seed path once in staging and prove it
is correct and idempotent:

1. Call the seed initializer (issue the first commercial request, e.g.
   `opportunities.commercial.stages.list` then `create`).
2. Verify **exactly 16 active default commercial stages** exist
   (`opportunityStages`, `isActive = 1`, keys matching `COMMERCIAL_STAGE_SEEDS`).
3. Verify **exactly one Commercial QA checklist template** exists
   (`opportunityChecklistTemplates`), with its expected item set.
4. Call the initializer a **second time**.
5. Verify the counts are **unchanged** — still 16 stages, still 1 template.
6. Verify **no duplicate stage keys** and **no duplicate template items**.
7. Confirm the application DB user has the required **INSERT + SELECT**
   permissions on all seed tables.

Only after this staging gate passes should production be scheduled. **No
production seeding is performed as part of Phase 1.**

## Future direction

This lazy seed is a Phase 1 convenience. Once the pipeline configuration
stabilizes it may be replaced by an **explicit seed command** or a
**data-migration seeding strategy**, at which point the runtime guard can be
removed. Admin stage configuration (add/rename/reorder/deactivate) already
writes to `opportunityStages` directly and is independent of the initial seed.
