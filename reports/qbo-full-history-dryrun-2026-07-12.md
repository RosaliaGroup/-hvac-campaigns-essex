# QBO Full-History Estimate Coverage — Dry-Run Report

Date: 2026-07-12
Branch: `feature-qbo-full-history-sync`
Mode: **dry-run / preview only — zero database writes**

## Execution status (read this first)

The full-history dry-run entry point (`previewSalesDocuments`) is implemented,
typechecked, and tested to make **zero** database writes. However, the live
143-row run against production **was not executed from this environment**,
because:

- there is **no production `DATABASE_URL`** available locally (confirmed unset);
- there are **no QuickBooks OAuth tokens** available locally (they live encrypted
  in the production `quickbooksConnections` table);
- the new code is **not deployed** (deploy is explicitly disallowed), so it
  cannot run inside the deployed backend either.

Extracting production secrets or deploying to run this would violate the task
constraints. Therefore this report contains:

1. the **planner's concrete output** for the three PDC examples (2140/2141/2160),
   computed deterministically by the test suite;
2. the **totals framed on the accepted audit** (143 total / 113 missing with the
   verified status breakdown) — the identity/property-dependent splits of the
   113 are marked "resolved by live run";
3. the **exact command** an authorized operator runs to produce the full 143-row
   report with zero writes.

No production records were read or written by this document.

## How to run the live dry-run (zero writes)

On the deployed backend (after this branch is deployed) or locally with the
production `DATABASE_URL` + a connected QBO realm, call:

```ts
import { previewSalesDocuments } from "server/integrations/accounting/salesDocSync";
const preview = await previewSalesDocuments(); // reads only; databaseWrites === 0
// preview.rows  → one EstimatePlanRow per QBO estimate (all 143)
// preview.totals → CoverageTotals (categorized counts; databaseWrites === 0)
```

`previewSalesDocuments`:
- issues the **WHERE-less** full-history query (all statuses, all ages, no
  TxnDate bound, cursor-independent);
- resolves parent/sub-customer identity per estimate;
- reads existing sales-docs and customers only;
- **never** advances the cursor, takes the write lock, or inserts/updates;
- returns `databaseWrites: 0` and `cursorUnchanged: true` by construction.

## Report columns (per estimate)

Each `EstimatePlanRow` carries: `qboEstimateId`, `docNumber`, `status`,
`txnDate`, `lastUpdatedTime`, `qboCustomerRef`, `parentResolution`,
`resolvedCrmCustomerId`, `salesDocAction`, `opportunityAction`,
`propertyAction`, `duplicateResult`, `confidence`, `manualReviewReason`,
`jobAction` (always `none`), `coverageCategory`, `customerCreationProposed`,
`dbWrites` (always `0`).

## PDC LLC — proposed outcomes (CRM customer id 9)

Computed by the planner (see `fullHistoryQuery.test.ts` / `salesDocFullHistory.test.ts`):

| Estimate | PN | Status | Parent resolution | Resolved CRM customer | SalesDoc | Opportunity | Property | Customer creation | Job | Category |
|---|---|---|---|---|---|---|---|---|---|---|
| 2140 | PN#132 | rejected | sub → parent 9000 (PDC LLC) | **9** | create | create | none | **no** | none | missing_safe_import |
| 2141 | PN#135 | closed/converted | sub → parent 9000 (PDC LLC) | **9** | create | create | none | **no** | none | missing_safe_import |
| 2160 | York Ave | accepted | sub → parent 9000 (PDC LLC) | **9** | none (already mirrored) | reuse/none | create (verified ShipAddr) | **no** | none | already_linked |

Guarantees asserted by tests for these three:
- all resolve under **one** PDC LLC customer (id 9) — `Set(resolvedCrmCustomerId) === {9}`;
- **no** duplicate PDC customer, **no** customer creation, **no** merge;
- **no** Job creation (`jobAction === "none"` for all);
- separate Opportunities per estimate/project;
- Property created only from a verified service location (2160's York Ave ShipAddr);
- `databaseWrites === 0`.

## Totals (framed on the accepted audit)

| Bucket | Count | Source |
|---|---|---|
| Total QBO estimates | 143 | accepted audit |
| Already linked | 30 | 143 − 113 |
| Missing (to import) | 113 | accepted audit |
| — Rejected | 58 | accepted audit |
| — Converted | 43 | accepted audit |
| — Accepted | 6 | accepted audit |
| — Closed | 3 | accepted audit |
| — Pending | 3 | accepted audit |
| Missing & safe to import | resolved by live run | planner: confident identity (QBO/parent linkage, email, phone) + verified/no property |
| Missing but identity ambiguous | resolved by live run | planner: name-only match / unresolved parent |
| Missing but property ambiguous | resolved by live run | planner: composite-only service location |
| Duplicate / no-op | resolved by live run | planner: existing doc, unchanged |
| Manual review | resolved by live run | planner: any row with `manualReviewReason` |
| **Customer creations proposed** | **0 expected for PDC**; total resolved by live run | never from project/composite/address |
| **Job creations proposed** | **0** | full-history mode never creates Jobs |
| **Database writes** | **0** | dry-run guarantee |

The four identity/property-dependent splits of the 113 cannot be enumerated
without the actual estimate + QBO customer records; the live `previewSalesDocuments`
run fills them in deterministically. What is guaranteed regardless of the data:
**Job creations = 0** and **database writes = 0**.

## Cursor-safety assessment

- Full-history mode sets `cursor = null` and issues a WHERE-less query, so it is
  independent of the current forward cursor (`2026-07-10T17:53Z`).
- Full-history mode **does not write `salesDocCursor`** — it only updates
  `salesDocLastSyncAt`/`lastSyncAt`. A full-history pass (even a partial one) can
  never advance or regress the incremental cursor. (Tested.)
- The dry-run writes nothing at all. (Tested: `databaseWrites === 0`,
  `cursorUnchanged === true`, no captured inserts/updates.)
- Normal incremental/backfill cursor behavior is unchanged. (Tested.)
