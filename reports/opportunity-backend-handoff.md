# Opportunity Center — Backend Handoff (Session 2)

Branch `feature/opportunity-backend` @ `af0dc5f` (off `origin/main` `da17f3b`).
**Not merged, not deployed.** Production migration is manual-only (see
`drizzle/README.md`). QuickBooks stays the source of truth; nothing here pushes to
QBO or overwrites manually-entered customer/property/appointment/estimate/job data.

---

## 1. What already existed (reused, not rebuilt)

The Opportunity Center backend was already substantial. Reused as-is:

- `opportunities` table: `stage` (new/proposal_sent/pending/won/lost), `amount`
  (editable CRM value) + `probability` + `amountOverridden`/`stageOverridden`,
  `assignedToId` (owner), `nextAction`/`nextActionDueAt`, `closeReason`/`lossReason`,
  `closedAt`, `workCategory`, `quickbooksSalesDocumentId`, `projectReference`.
- `opportunityEvents` — append-only activity/audit timeline.
- `opportunityTasks` — follow-up tasks (call/email/text, 3-day close loop, SMS-gated).
- Router procedures: `list` (search/filter/sort/paginate + totals), `overview`
  (KPIs), `stats`, `salespeople`, `get` (detail + timeline + tasks + appts + docs +
  jobs), `updateValue`, `setStage`, `markWon`, `markLost`, `convertToJob`,
  `assignSalesperson`, `followUpLater`, `createTask`/`completeTask`/`snoozeTask`,
  `customerConflicts`/`resolveCustomerConflict`.
- Linkage already modeled: estimate/invoice via `quickbooksSalesDocuments.opportunityId`
  + `opportunities.quickbooksSalesDocumentId`; job via `jobs.opportunityId`.

## 2. What this change adds (the gaps)

### Schema — migration `0057_opportunity_board_fields` (additive, reversible)
| Table | Column | Type | Notes |
|---|---|---|---|
| opportunities | `priority` | enum(low,medium,high,urgent) NULL | sales urgency; sync never sets it |
| opportunities | `expectedCloseAt` | timestamp NULL | forecast close date (≠ `closedAt`) |
| opportunities | `sortOrder` | int NOT NULL default 0 | intra-stage board rank |
| opportunities | `propertyId` | int NULL | app-enforced link to a customer property |
| opportunityEvents | `actorId` | int NULL | who did it (null = system/sync/pre-0057) |
| opportunities | index | `(stage, sortOrder)` | board column reads |

### API — new / changed tRPC procedures (`opportunities.*`)
All `protectedProcedure` (auth required; viewers read-only; `ctx.user.id` = actor).

- **`create`** `{ customerId, title, stage?, opportunityValue?, probability?, priority?, assignedToId?, expectedCloseAt?, nextAction?, nextActionDueAt?, propertyId? }` → `{ ok, id }`
  - `source="manual"`. Validates customer exists (`NOT_FOUND`) and that `propertyId`
    belongs to that customer (`BAD_REQUEST`). Appends to bottom of the stage column.
    Writes a `created` audit event. Never touches QBO / customer / property rows.
- **`update`** `{ id, title?, priority?, expectedCloseAt?, nextAction?, nextActionDueAt?, propertyId? }` → `{ ok, changed[] }`
  - Partial (only provided keys). `propertyId` re-validated. Audit `updated` event.
  - Value/probability still go through `updateValue`; owner via `assignSalesperson`.
- **`reorder`** `{ stage, orderedIds[] }` → `{ ok, updated }`
  - Transactional dense 0..N-1 renumber of ONE column; writes only changed rows.
  - `CONFLICT` (writes nothing) if the column changed since load; `BAD_REQUEST` on
    duplicate ids. No audit event (cosmetic, not a material change).
- **`setStage`** `{ id, stage, expectedStage?, toSortOrder? }` → `{ ok, moved }`  *(hardened; back-compatible)*
  - Now transactional + audited (actor + from/to). `expectedStage` = optimistic
    concurrency → `CONFLICT` if the card already moved. `toSortOrder` places the
    card in the destination column (default: append). Same-column move = no-op
    (use `reorder`).
- **`markWon`** / **`markLost`** — hardened into the same transactional path; idempotent; audited.
- **`list`** — added `priority` filter and `priority` / `expectedCloseAt` / `sortOrder`
  sort keys; each item now carries `priority`, `expectedCloseAt`, `sortOrder`, `propertyId`.

Concurrency/audit pattern mirrors `jobs.completeJob` (commit-or-rollback) and
`rescheduleAppointment.persistReschedule` (guarded `WHERE` → `affectedRows===0` →
`CONFLICT`). Follow-up cancellation runs OUTSIDE the transaction (downstream effect).

## 3. Sample API responses (shapes)

`opportunities.list` item (new fields **bolded** conceptually — `priority`,
`expectedCloseAt`, `sortOrder`, `propertyId`):
```jsonc
{
  "items": [{
    "id": 128, "stage": "proposal_sent", "amount": 8400, "probability": 30,
    "effectiveProbability": 30, "weightedValue": 2520,
    "amountOverridden": true, "stageOverridden": true,
    "quickbooksAmount": 8400, "valueDiffersFromQuickbooks": false,
    "workCategory": "commercial",
    "priority": "high", "expectedCloseAt": "2026-08-15T00:00:00.000Z",
    "sortOrder": 2, "propertyId": 57,
    "docTypeLabel": "Estimate", "title": "Rooftop RTU replacement",
    "nextAction": "Follow up (3d)", "nextActionDueAt": "2026-07-27T...",
    "assignedToId": 5, "customerId": 42, "customerName": "Acme LLC",
    "docId": 900, "docNumber": "1042", "docStatus": "pending",
    "daysPending": 4, "agingBucket": "4-7", "createdAt": "2026-07-20T..."
  }],
  "total": 37,
  "totals": { "count": 37, "totalValue": 214300, "weightedValue": 68120, "quickbooksTotal": 219000 }
}
```
- `create` → `{ "ok": true, "id": 129 }`
- `update` → `{ "ok": true, "changed": ["priority", "expectedCloseAt"] }`
- `reorder` → `{ "ok": true, "updated": 3 }`
- `setStage` → `{ "ok": true, "moved": true }`  (no-op same column → `moved: false`)
- Stale move/reorder → tRPC error `{ "code": "CONFLICT", "message": "That opportunity was just updated somewhere else. Refresh and try again." }` → client should refetch the board.

## 4. Migration safety analysis

- **Fully additive.** 4 nullable/defaulted columns + 1 nullable column + 1 index.
  No `DROP`, no rename, no type-narrowing, no `NOT NULL`-without-default
  (`sortOrder` has default 0). Backward compatible: old code ignores new columns;
  the QBO sync's `INSERT` still works unchanged.
- **No backfill / no data rewrite.** Existing rows get `sortOrder=0` (they sort
  together, then fall back to the `createdAt` tiebreak) and `NULL` for the rest.
- **Reversible** via `drizzle/0057_opportunity_board_fields.down.sql`.
- **Production is manual-only & hand-reconciled.** Prod `__drizzle_migrations`
  recorded head is `0054`; `0055`/`0056` are physically applied but unrecorded.
  Do **not** run `drizzle-kit migrate` / `db:push` against prod. Apply the `.sql`
  by hand per the runbook, then reconcile the tracker for `0055`, `0056`, `0057`.
- This session did **not** run any migration against any database.

## 5. Rollback instructions

- **Code:** `git revert af0dc5f` (or drop the branch — it is unmerged/local).
- **Schema (if 0057 was applied to a DB):** run
  `drizzle/0057_opportunity_board_fields.down.sql` (drops the index first, then the
  5 columns). Safe because the columns are new in 0057 and hold no pre-existing data.
  Take/verify a backup first per `drizzle/README.md`.
- **Tracker:** if a `__drizzle_migrations` row was inserted for `0057`, delete that
  one row after the down-migration.

## 6. Assumptions the UI session must know

1. **No new stage-change surface.** `setStage`/`markWon`/`markLost` keep their old
   required inputs — existing calls work unchanged. New optional params
   (`expectedStage`, `toSortOrder`) are opt-in.
2. **Drag-between-columns = two concerns.** Cross-stage drag → `setStage` (with
   optional `toSortOrder`); reordering within a column → `reorder(stage, orderedIds)`.
   Send `expectedStage` on cross-stage drags to get optimistic-concurrency safety.
3. **CONFLICT means refetch.** Any `CONFLICT` from `setStage`/`reorder` means the
   board is stale; reload the board and let the user retry. No partial write happened.
4. **`amount` IS the expected/forecast value** (weighted by `probability`). No
   separate "expected value" field was added — that would duplicate `amount`.
5. **`priority` is nullable** (unset). Treat `null` as "medium" in the UI if you
   want a default bucket; the backend does not assume one.
6. **`propertyId` links, never creates.** It must be one of the customer's existing
   properties; the backend rejects a foreign property and never creates one.
7. **Manual opportunities have no QBO doc** (`quickbooksSalesDocumentId` null,
   `source="manual"`); `quickbooksAmount`/`daysPending`/doc fields are null for them.
8. **Board ordering:** query a single column with `stage=<x>`, `sortBy="sortOrder"`,
   `sortDir="asc"`. `sortOrder` is only meaningful relative to same-stage cards.
