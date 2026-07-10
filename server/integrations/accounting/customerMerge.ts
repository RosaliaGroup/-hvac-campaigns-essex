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
