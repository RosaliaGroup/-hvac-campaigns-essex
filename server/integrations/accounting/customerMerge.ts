/**
 * QuickBooks → CRM customer field reconciliation (pure, unit-tested).
 *
 * The single rule, applied field-by-field:
 *   - QBO value empty            → do nothing.
 *   - CRM value empty            → FILL from QBO (conflictType "missing", auto-applied).
 *   - both present and EQUAL     → do nothing.
 *   - both present and DIFFERENT → KEEP CRM, log "overwrite_prevented" for review.
 *
 * We never silently overwrite existing CRM data. No I/O here — the caller
 * applies `patch` and persists `conflicts`.
 */

export type CustomerMergeField =
  | "firstName"
  | "lastName"
  | "companyName"
  | "email"
  | "phone"
  | "altPhone"
  | "notes"
  | "status"
  | "billingLine1"
  | "billingLine2"
  | "billingCity"
  | "billingState"
  | "billingZip";

export type CustomerStatus = "active" | "inactive" | "archived";

/** Existing CRM columns that participate in the merge. */
export interface MergeableCustomer {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  notes: string | null;
  status: CustomerStatus;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
}

/** Incoming values derived from the QBO customer (status derived from Active). */
export interface IncomingCustomerFields {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  notes: string | null;
  status: "active" | "inactive" | null;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
}

export interface FieldConflict {
  fieldName: CustomerMergeField;
  conflictType: "missing" | "overwrite_prevented";
  crmValue: string | null;
  qboValue: string | null;
}

export interface CustomerFieldUpdate {
  /** Empty-only fills to apply to the existing customer. */
  patch: Partial<Pick<MergeableCustomer, CustomerMergeField>>;
  /** All reconciliations worth recording (missing = applied, overwrite_prevented = kept). */
  conflicts: FieldConflict[];
}

const MERGE_FIELDS: CustomerMergeField[] = [
  "firstName",
  "lastName",
  "companyName",
  "email",
  "phone",
  "altPhone",
  "notes",
  "status",
  "billingLine1",
  "billingLine2",
  "billingCity",
  "billingState",
  "billingZip",
];

function isEmpty(v: string | null | undefined): boolean {
  return v == null || v.trim() === "";
}

function basicPhoneDigits(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/[^0-9]/g, "");
  return d.length >= 7 ? d.slice(-10) : null;
}

/**
 * Compute the empty-only patch and the conflict log for one customer.
 * `normalizePhone` is injectable so the caller can reuse the app's real one.
 */
export function buildCustomerFieldUpdate(
  existing: MergeableCustomer,
  incoming: IncomingCustomerFields,
  opts: { normalizePhone?: (v: string | null | undefined) => string | null } = {},
): CustomerFieldUpdate {
  const normalizePhone = opts.normalizePhone ?? basicPhoneDigits;
  const patch: Partial<Pick<MergeableCustomer, CustomerMergeField>> = {};
  const conflicts: FieldConflict[] = [];

  for (const field of MERGE_FIELDS) {
    const inc = incoming[field] as string | null;
    if (isEmpty(inc)) continue;
    const cur = existing[field] as string | null;

    if (isEmpty(cur)) {
      // status is never empty, so this branch never fills status.
      (patch as Record<string, string>)[field] = inc!.trim();
      conflicts.push({ fieldName: field, conflictType: "missing", crmValue: cur ?? null, qboValue: inc });
      continue;
    }

    if (!valuesEqual(field, cur, inc, normalizePhone)) {
      conflicts.push({ fieldName: field, conflictType: "overwrite_prevented", crmValue: cur, qboValue: inc });
    }
  }

  return { patch, conflicts };
}

function valuesEqual(
  field: CustomerMergeField,
  a: string | null,
  b: string | null,
  normalizePhone: (v: string | null | undefined) => string | null,
): boolean {
  if (field === "email") return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  if (field === "phone" || field === "altPhone") return normalizePhone(a) === normalizePhone(b);
  return (a ?? "").trim() === (b ?? "").trim();
}

/** Convenience: does this update carry any conflict needing human review? */
export function hasReviewableConflict(update: CustomerFieldUpdate): boolean {
  return update.conflicts.some(c => c.conflictType === "overwrite_prevented");
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict-write planning (pure) — keeps at most ONE open conflict per
// (customer, field) so re-running enrichment every sync never piles up
// duplicate unresolved rows. The DB layer just applies this plan.
// ─────────────────────────────────────────────────────────────────────────────

/** An already-stored conflict row (only the fields the planner needs). */
export interface ExistingConflictRow {
  id: number;
  fieldName: string;
  qboValue: string | null;
  status: string;
}

export interface PlannedConflictInsert {
  fieldName: string;
  conflictType: "missing" | "overwrite_prevented";
  crmValue: string | null;
  qboValue: string | null;
  status: "open" | "resolved";
  resolution: "use_qbo" | null;
}

export interface PlannedConflictUpdate {
  id: number;
  crmValue: string | null;
  qboValue: string | null;
}

export interface ConflictWritePlan {
  inserts: PlannedConflictInsert[];
  updates: PlannedConflictUpdate[];
  /** Number of open conflicts that exist for this customer after applying the plan. */
  openCount: number;
}

const nz = (v: string | null | undefined): string => v ?? "";

/**
 * Decide what conflict rows to insert/update for one customer, given the rows
 * already stored and the freshly detected conflicts. Rules:
 *  - "missing" (auto-filled): recorded once, resolved; skipped if an identical
 *    (field, qboValue) row already exists.
 *  - "overwrite_prevented": at most ONE open row per (customer, field). If an
 *    open row exists, refresh its values (only when they changed) instead of
 *    inserting a duplicate; otherwise insert one open row.
 */
export function planCustomerConflictWrites(
  existing: ExistingConflictRow[],
  incoming: FieldConflict[],
): ConflictWritePlan {
  const inserts: PlannedConflictInsert[] = [];
  const updates: PlannedConflictUpdate[] = [];
  // Fields that already have (or will have) an open row — prevents double-insert.
  const openFields = new Set(existing.filter(r => r.status === "open").map(r => r.fieldName));

  for (const c of incoming) {
    if (c.conflictType === "missing") {
      const dup = existing.find(r => r.fieldName === c.fieldName && nz(r.qboValue) === nz(c.qboValue));
      if (dup) continue;
      inserts.push({
        fieldName: c.fieldName,
        conflictType: "missing",
        crmValue: c.crmValue,
        qboValue: c.qboValue,
        status: "resolved",
        resolution: "use_qbo",
      });
      continue;
    }
    // overwrite_prevented
    const openRow = existing.find(r => r.fieldName === c.fieldName && r.status === "open");
    if (openRow) {
      if (nz(openRow.qboValue) !== nz(c.qboValue)) {
        updates.push({ id: openRow.id, crmValue: c.crmValue, qboValue: c.qboValue });
      }
      continue; // already one open row for this field — no duplicate
    }
    if (openFields.has(c.fieldName)) continue; // planned earlier this batch
    inserts.push({
      fieldName: c.fieldName,
      conflictType: "overwrite_prevented",
      crmValue: c.crmValue,
      qboValue: c.qboValue,
      status: "open",
      resolution: null,
    });
    openFields.add(c.fieldName);
  }

  return { inserts, updates, openCount: openFields.size };
}
