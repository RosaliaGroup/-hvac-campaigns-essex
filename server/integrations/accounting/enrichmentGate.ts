/**
 * enrichmentGate.ts — feature gate for automatic customer-IDENTITY writes in the
 * QuickBooks sales-document sync path.
 *
 * Background: the live sync (`enrichExistingCustomer` in salesDocSync.ts) used to
 * fill empty CRM fields from QuickBooks AND rebuild the customer displayName from
 * the structured name fields on every re-sync. That silently mutated customer
 * identity (displayName/firstName/lastName/companyName) outside the reviewed
 * repair workflow. This gate makes identity writes opt-in.
 *
 * Flag `QBO_CUSTOMER_NAME_ENRICH` (default OFF, unless exactly "true"):
 *   - OFF: the sync NEVER writes firstName/lastName/companyName/displayName and
 *     never writes the legacy quickbooksRawDisplayName column. Everything else
 *     (email/phone/altPhone/notes/billing fill-empty, QBO id/status/timestamps,
 *     conflict logging, service-property attachment) continues unchanged.
 *   - ON: legacy behavior — keep the name fills and rebuild displayName from the
 *     STRUCTURED fields (never from a composite QBO DisplayName).
 *
 * All customer identity REPAIRS are routed through the reviewed manifest workflow
 * (qboRepairCore / repair-qbo-composite-customers.ts), not through this path.
 *
 * The two exported functions are pure so the gating decision is unit-testable
 * without a database.
 */
import {
  buildCustomerFieldUpdate,
  type FieldConflict,
  type IncomingCustomerFields,
  type MergeableCustomer,
} from "./customerMerge";

/** Environment variable that opts the sync into automatic customer-name writes. */
export const CUSTOMER_NAME_ENRICH_FLAG = "QBO_CUSTOMER_NAME_ENRICH";

/** Identity fields the sync must not auto-write while the gate is off. */
export const IDENTITY_NAME_FIELDS = ["firstName", "lastName", "companyName"] as const;

/**
 * Read the flag at CALL TIME (not module load) so behavior tracks the current
 * environment and stays test-controllable. Default OFF: only the exact string
 * "true" enables it.
 */
export function isCustomerNameEnrichEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[CUSTOMER_NAME_ENRICH_FLAG] === "true";
}

type DisplayNameInput = {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

interface GateInput {
  /** Empty-only fill patch from buildCustomerFieldUpdate. */
  patch: Partial<Record<string, string | null>>;
  existing: Pick<MergeableCustomer, "firstName" | "lastName" | "companyName" | "email" | "phone">;
  nameEnrichEnabled: boolean;
  buildDisplayName: (input: DisplayNameInput) => string;
}

interface GateResult {
  /** Fields safe to write to the customer row given the flag state. */
  setValues: Record<string, unknown>;
  /** Identity fields withheld because the gate is off (for observability/tests). */
  suppressedFields: string[];
  /** Whether displayName was rebuilt (only possible when the gate is on). */
  displayNameRebuilt: boolean;
}

/**
 * Decide which of the fill-empty patch fields actually get written, applying the
 * identity gate. Pure: no I/O.
 */
export function gateIdentityWrites(input: GateInput): GateResult {
  const setValues: Record<string, unknown> = { ...input.patch };

  // The legacy raw-name column is never written from the sync path in either
  // flag state; strip it defensively in case a caller ever adds it to the patch.
  delete (setValues as Record<string, unknown>).quickbooksRawDisplayName;

  if (!input.nameEnrichEnabled) {
    const suppressed: string[] = [];
    for (const field of IDENTITY_NAME_FIELDS) {
      if (field in setValues) {
        delete setValues[field];
        suppressed.push(field);
      }
    }
    // No displayName rebuild while the gate is off.
    return { setValues, suppressedFields: suppressed, displayNameRebuilt: false };
  }

  // Gate ON — legacy behavior: rebuild displayName from STRUCTURED fields only
  // (never from a composite QBO DisplayName) when a name field was filled.
  const p = input.patch;
  if (p.firstName != null || p.lastName != null || p.companyName != null) {
    setValues.displayName = input.buildDisplayName({
      companyName: p.companyName ?? input.existing.companyName,
      firstName: p.firstName ?? input.existing.firstName,
      lastName: p.lastName ?? input.existing.lastName,
      email: p.email ?? input.existing.email,
      phone: p.phone ?? input.existing.phone,
    });
    return { setValues, suppressedFields: [], displayNameRebuilt: true };
  }
  return { setValues, suppressedFields: [], displayNameRebuilt: false };
}

interface PlanInput {
  existing: MergeableCustomer & { quickbooksCustomerId: string | null };
  incoming: IncomingCustomerFields;
  quickbooksUpdatedAt: Date | null;
  qbCustomerId: string | null;
  matchedByQbId: boolean;
  now: Date;
  nameEnrichEnabled: boolean;
  buildDisplayName: (input: DisplayNameInput) => string;
  normalizePhone: (value: string | null | undefined) => string | null;
}

export interface EnrichmentPlan {
  /** The complete field set to write to the customer row (may be empty). */
  setValues: Record<string, unknown>;
  /** Conflicts to record — computed identically regardless of the gate. */
  conflicts: FieldConflict[];
  /** Identity fields withheld by the gate (empty when the gate is on). */
  suppressedNameFields: string[];
}

/**
 * Compute the full set of writes for a sync-path customer enrichment, pure and
 * DB-free. Combines the fill-empty merge, the identity gate, and the QBO
 * id/status/timestamp bookkeeping. The caller performs the actual I/O
 * (conflict logging, customer update, service-property attachment).
 *
 * Note: conflicts are computed from the raw fill-empty merge and are returned
 * UNCHANGED by the gate — conflict logging continues even when name writes are
 * suppressed, so pending name differences remain visible for reviewed repair.
 */
export function planCustomerEnrichment(input: PlanInput): EnrichmentPlan {
  const { patch, conflicts } = buildCustomerFieldUpdate(input.existing, input.incoming, {
    normalizePhone: input.normalizePhone,
  });

  const { setValues, suppressedFields } = gateIdentityWrites({
    patch,
    existing: input.existing,
    nameEnrichEnabled: input.nameEnrichEnabled,
    buildDisplayName: input.buildDisplayName,
  });

  if (input.qbCustomerId && !input.matchedByQbId && !input.existing.quickbooksCustomerId) {
    setValues.quickbooksCustomerId = input.qbCustomerId;
    setValues.quickbooksSyncStatus = "synced";
    setValues.quickbooksSyncedAt = input.now;
  }
  if (input.quickbooksUpdatedAt) {
    setValues.quickbooksCustomerUpdatedAt = input.quickbooksUpdatedAt;
  }

  return { setValues, conflicts, suppressedNameFields: suppressedFields };
}
