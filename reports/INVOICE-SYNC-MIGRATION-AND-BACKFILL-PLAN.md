# QuickBooks Invoice Sync — Migration & Backfill Plan (NOT YET RUN)

Read-only ingestion of QuickBooks **Invoices** into `quickbooksSalesDocuments`
(docType="invoice"), reconciled to CRM customers via the QBO CustomerRef
hierarchy. Nothing in this plan has been executed against production. **Do not
run the migration, enable the sync, or run the backfill without separate
approval.**

## Root cause this addresses
Customer 360 shows **0 invoices for every customer** because the QBO sync only
queries `SELECT * FROM Estimate` — invoices were never ingested. Marco Weber's
estimates also carry CustomerRef `351` while his customer record is `354` (a QBO
sub-customer/parent split); the reconciliation below matches documents filed
under a child project back to the parent customer, so his invoices (once synced)
attach correctly — **without editing any stored ref or hard-coding Marco**.

## 1. Schema migration `0042_qbo_invoice_fields` (additive)
- `quickbooksSalesDocuments`: `+dueDate`, `+balance`, `+currency`,
  `+quickbooksParentRef`, `+voided`; status enum **extended** with
  `paid/partial/unpaid/void` (appended values — existing rows/values unchanged);
  `+` indexes on `docType` and `quickbooksParentRef`.
- `quickbooksConnections`: `+invoiceCursor`, `+invoiceLastSyncAt` (an
  **independent** cursor — the estimate `salesDocCursor` is never touched).
- Strictly additive: `ADD COLUMN` / `CREATE INDEX` / append-only enum `MODIFY`.
  No drops, renames, or data rewrites. Safe on the 26 existing estimate rows.
- ⚠️ **Numbering collision:** a concurrent "commercial-opportunities" branch also
  claims `0042/0043`. Renumber-on-merge (as done previously) before applying.

### Apply (when approved)
1. Preflight (read-only): confirm production `quickbooksSalesDocuments` lacks the
   5 new columns and the 2 new indexes; confirm `quickbooksConnections` lacks the
   invoice cursor columns; capture the `__drizzle_migrations` watermark.
2. Run the reviewed Drizzle migration (`drizzle-kit migrate`) — **not** `push`.
   Expect only `0042` (renumbered) to apply. Do **not** hand-edit the journal.
3. Verify all columns/indexes exist; existing 26 estimate rows unchanged.

## 2. Enable the sync (gated)
The invoice sync is **disabled by default** — it no-ops unless
`QBO_INVOICE_SYNC_ENABLED=true`. Flipping that flag is the deliberate approval
gate. When enabled:
- Admin procedures `quickbooks.syncInvoicesNow` (incremental) and
  `quickbooks.backfillInvoices` become live.
- (The estimate poller is unchanged; invoice sync is **not** auto-wired into the
  poller in this PR — it runs only on an explicit admin action.)

## 3. Controlled backfill (run ONCE, after review — NOT in this PR)
1. Run the advisory-lock self-test first (proves cross-instance mutual exclusion).
2. `quickbooks.backfillInvoices { sinceDays: 365 }` — bounded window, paged
   (≤100/page, ≤10k/run), advisory-locked, idempotent by QBO invoice id. It
   advances **only** `invoiceCursor`; the estimate cursor is untouched.
3. Inspect the returned `{ pulled, created, updated, skipped, matched, unmatched }`
   and the `quickbooksSyncLogs` (entityType "invoice") row.
4. Read-only verify: Marco (customer 23) now shows his invoices; invoice
   count == invoices-tab rows; `lifetimeRevenue == Σ(total−balance)` and
   `outstandingBalance == Σ(balance)` over the same non-voided collection;
   QBO CustomerRefs, estimate rows, and estimate cursor unchanged.
5. After the one-time backfill, incremental runs pick up only newer invoices via
   `invoiceCursor`.

## 4. Reconciliation model (query-side only)
- Sync-time: each invoice's CRM customer is resolved by (a) direct CustomerRef
  match, else (b) the QBO customer's `ParentRef` when it is a sub-customer/job
  (stored as `quickbooksParentRef`). No customer is **created** from an invoice
  (avoids duplicating a sub-customer). Unmatched invoices keep their refs for
  later attachment.
- Read-time (Customer 360): a document belongs to a customer when
  `customerId == X` **or** `quickbooksCustomerId == ref` **or**
  `quickbooksParentRef == ref`. One rule for estimates and invoices.

## 5. Voided / deleted handling
- **Voided:** detected from QBO `PrivateNote` ("Voided …"); stored `voided=true`,
  status `void`; **excluded** from count, revenue, and balance (carries no
  receivable). Kept in `raw` for audit.
- **Deleted:** a hard-deleted QBO invoice is invisible to a query; incremental
  sync cannot detect it. A future change-data-capture (CDC) pass can reconcile
  deletions — **out of scope here** and noted as a limitation.

## 6. QuickBooks safety (held)
No invoice is created/modified/voided/deleted in QuickBooks; only reads. No
estimate cursor change; independent invoice cursor. No duplicate sales documents
(idempotent by QBO id; estimate rows are never converted to invoices). No
customer repair — CustomerRefs are never rewritten. Raw payload lives only in the
protected `raw` field and is **not** returned by the customer endpoint (explicit
column projection).

## Rollback
- **App:** revert the PR merge / redeploy the prior revision. The invoice sync is
  flag-gated off, so an un-enabled deploy changes no behavior.
- **DB:** the additive columns/indexes are nullable and unused when the flag is
  off — **leave them in place**; no down migration in an emergency. Backfilled
  invoice rows (if the backfill was run) are additive and can remain; deleting
  them is a separate, reviewed step.
