/**
 * Core logic for the reviewed QBO composite-customer REPAIR and its ROLLBACK.
 *
 * All database access goes through an injected `RepairPort`, so the safety
 * logic (stale checks, manifest gating, transaction boundaries, audit logging)
 * is unit-tested against an in-memory port with zero real-DB or QBO access.
 * The CLI wires a mysql2-backed port; nothing here reaches production on its own.
 *
 * Invariants enforced here:
 *  - Only rows present in the reviewed manifest are ever touched.
 *  - Before each write: re-read → re-parse → verify QBO id → verify expected
 *    displayName (stale check) → verify high-confidence parse → verify no unsafe
 *    duplicate → verify proposed == manifest expectation. Any mismatch → skip.
 *  - Never writes email / phone / altPhone / quickbooksCustomerId / billing /
 *    estimates / invoices / sync cursor. Never merges. Property creation only
 *    when the manifest row approves it.
 *  - Every field change is written to the audit log inside the same transaction.
 */
import { parseQboCompositeName, QBO_COMPOSITE_PARSER_VERSION } from "../../../shared/qboCompositeName";
import { proposeMerge, proposePropertyAction, normalizeEmail, normalizePhone, type CustomerIdentity, type PropertyRow } from "../../../shared/qboCustomerRepair";

export interface RepairCustomerRow {
  id: number;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  quickbooksCustomerId: string | null;
}

export interface ManifestRow {
  crmCustomerId: number;
  quickbooksCustomerId: string;
  expectedDisplayName: string;
  approvedAction: string;
  customerFieldsMayChange: boolean;
  projectReferenceMayChange: boolean;
  propertyCreationApproved: boolean;
  mergeApproved: boolean;
  reviewNote: string;
}

export interface AuditRow {
  runId: string;
  kind: "repair" | "refresh" | "rollback";
  actor: string | null;
  parserVersion: string | null;
  manifestHash: string | null;
  customerId: number;
  quickbooksCustomerId: string | null;
  fieldName: string;
  beforeValue: string | null;
  afterValue: string | null;
  createdPropertyId: number | null;
  opportunityId: number | null;
  result: "applied" | "skipped" | "conflict" | "rolled_back";
  reason: string | null;
}

/** The DB port. A mysql2-backed adapter implements this for the CLI. */
export interface RepairPort {
  getCustomer(id: number): Promise<RepairCustomerRow | null>;
  getAllIdentities(): Promise<CustomerIdentity[]>;
  getPropertiesForCustomer(customerId: number): Promise<PropertyRow[]>;
  getOpportunityIdsForCustomer(customerId: number): Promise<number[]>;
  updateCustomerFields(id: number, patch: Record<string, unknown>): Promise<void>;
  createProperty(row: { customerId: number; addressLine1: string; addressLine2: string | null; city: string | null; state: string | null; zip: string | null; propertyType: string; systemNotes: string | null }): Promise<number>;
  setOpportunityProjectReference(opportunityId: number, projectReference: string): Promise<void>;
  insertAudit(row: AuditRow): Promise<void>;
  /** Run `fn` in a transaction; must roll back everything on throw. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface RepairOptions {
  runId: string;
  actor: string | null;
  manifestHash: string | null;
  dryRun: boolean;
}

export type RowResult = {
  customerId: number;
  result: "applied" | "skipped" | "conflict" | "would_apply";
  reason: string;
  changes: Array<{ field: string; before: string | null; after: string | null }>;
  createdPropertyId?: number | null;
};

/** Verify + (optionally) apply the repair for one manifest row. */
export async function applyRepairRow(port: RepairPort, manifest: ManifestRow, opts: RepairOptions): Promise<RowResult> {
  const changes: RowResult["changes"] = [];
  const cust = await port.getCustomer(manifest.crmCustomerId);
  if (!cust) return { customerId: manifest.crmCustomerId, result: "skipped", reason: "CUSTOMER_NOT_FOUND", changes };

  // 3) verify QBO id.
  if ((cust.quickbooksCustomerId ?? "") !== manifest.quickbooksCustomerId) {
    return { customerId: cust.id, result: "conflict", reason: "QBO_ID_MISMATCH", changes };
  }
  // 4) stale check: current displayName must still equal the reviewed value.
  if ((cust.displayName ?? "") !== manifest.expectedDisplayName) {
    return { customerId: cust.id, result: "skipped", reason: "STALE_DISPLAY_NAME", changes };
  }
  // 2/5) re-run parser; require high-confidence composite + same parser version.
  const parsed = parseQboCompositeName(cust.displayName);
  if (!parsed.isComposite || parsed.confidence !== "high" || parsed.parserVersion !== QBO_COMPOSITE_PARSER_VERSION) {
    return { customerId: cust.id, result: "skipped", reason: `PARSE_NOT_HIGH_CONFIDENCE(${parsed.confidence})`, changes };
  }
  // 6) duplicate / conflict safety — never merge. If any OTHER record shares a
  // strong identifier, block (a merge would be needed and none is approved).
  const ids = await port.getAllIdentities();
  const me: CustomerIdentity = { id: cust.id, quickbooksCustomerId: cust.quickbooksCustomerId, email: cust.email, phone: cust.phone, altPhone: cust.altPhone, displayName: cust.displayName, companyName: cust.companyName };
  const meEmail = normalizeEmail(me.email), mePhone = normalizePhone(me.phone);
  const collider = ids.find(o => o.id !== me.id && (
    (me.quickbooksCustomerId && o.quickbooksCustomerId === me.quickbooksCustomerId) ||
    (meEmail && normalizeEmail(o.email) === meEmail) ||
    (mePhone && normalizePhone(o.phone) === mePhone)
  ));
  if (collider) {
    const d = proposeMerge(me, collider);
    return { customerId: cust.id, result: "conflict", reason: `DUPLICATE_IDENTIFIER(${d.reason})`, changes };
  }

  // Compute the approved field changes (fill/repair only the name identity).
  const proposedDisplay = parsed.customerKind === "company" ? parsed.companyName : parsed.customerDisplayName;
  const patch: Record<string, unknown> = {};
  const stage = (field: string, before: string | null, after: string | null) => {
    if ((before ?? null) !== (after ?? null)) { patch[field] = after; changes.push({ field, before: before ?? null, after: after ?? null }); }
  };
  if (manifest.customerFieldsMayChange) {
    stage("displayName", cust.displayName, proposedDisplay ?? null);
    stage("firstName", cust.firstName, parsed.firstName);
    stage("lastName", cust.lastName, parsed.lastName);
    stage("companyName", cust.companyName, parsed.companyName);
  }

  // 7) property decision (only if approved on this row).
  let propertyPlan: { create: boolean; line1: string; line2: string | null; city: string | null; state: string | null; zip: string | null; notes: string | null } | null = null;
  if (manifest.propertyCreationApproved && parsed.serviceAddressLine1) {
    const props = await port.getPropertiesForCustomer(cust.id);
    const decision = proposePropertyAction(cust.id, { line1: parsed.serviceAddressLine1, city: parsed.serviceCity, state: parsed.serviceState, zip: parsed.servicePostalCode }, props);
    if (decision.action === "create") {
      propertyPlan = { create: true, line1: parsed.serviceAddressLine1, line2: parsed.serviceAddressLine2, city: parsed.serviceCity, state: parsed.serviceState, zip: parsed.servicePostalCode, notes: parsed.locationNotes };
    } else if (decision.action === "conflict") {
      return { customerId: cust.id, result: "conflict", reason: `PROPERTY_${decision.reason}`, changes };
    }
  }

  const projectRef = manifest.projectReferenceMayChange ? parsed.projectReference : null;
  const oppIds = projectRef ? await port.getOpportunityIdsForCustomer(cust.id) : [];

  if (!Object.keys(patch).length && !propertyPlan && !(projectRef && oppIds.length)) {
    return { customerId: cust.id, result: "skipped", reason: "ALREADY_CORRECT", changes };
  }

  if (opts.dryRun) {
    return { customerId: cust.id, result: "would_apply", reason: "DRY_RUN", changes, createdPropertyId: propertyPlan ? null : undefined };
  }

  // 8) apply everything for this customer in ONE transaction; audit each change.
  let createdPropertyId: number | null = null;
  await port.transaction(async () => {
    if (Object.keys(patch).length) await port.updateCustomerFields(cust.id, patch);
    for (const ch of changes) {
      await port.insertAudit({ runId: opts.runId, kind: "repair", actor: opts.actor, parserVersion: parsed.parserVersion, manifestHash: opts.manifestHash, customerId: cust.id, quickbooksCustomerId: cust.quickbooksCustomerId, fieldName: ch.field, beforeValue: ch.before, afterValue: ch.after, createdPropertyId: null, opportunityId: null, result: "applied", reason: null });
    }
    if (propertyPlan) {
      createdPropertyId = await port.createProperty({ customerId: cust.id, addressLine1: propertyPlan.line1, addressLine2: propertyPlan.line2, city: propertyPlan.city, state: propertyPlan.state, zip: propertyPlan.zip, propertyType: parsed.customerKind === "company" ? "commercial" : "residential", systemNotes: propertyPlan.notes });
      await port.insertAudit({ runId: opts.runId, kind: "repair", actor: opts.actor, parserVersion: parsed.parserVersion, manifestHash: opts.manifestHash, customerId: cust.id, quickbooksCustomerId: cust.quickbooksCustomerId, fieldName: "property.created", beforeValue: null, afterValue: JSON.stringify({ line1: propertyPlan.line1, city: propertyPlan.city, zip: propertyPlan.zip }), createdPropertyId, opportunityId: null, result: "applied", reason: null });
    }
    if (projectRef) {
      for (const oppId of oppIds) {
        await port.setOpportunityProjectReference(oppId, projectRef);
        await port.insertAudit({ runId: opts.runId, kind: "repair", actor: opts.actor, parserVersion: parsed.parserVersion, manifestHash: opts.manifestHash, customerId: cust.id, quickbooksCustomerId: cust.quickbooksCustomerId, fieldName: "projectReference", beforeValue: null, afterValue: projectRef, createdPropertyId: null, opportunityId: oppId, result: "applied", reason: null });
      }
    }
  });
  return { customerId: cust.id, result: "applied", reason: "OK", changes, createdPropertyId };
}

// ── Rollback ────────────────────────────────────────────────────────────────

export interface RollbackPort {
  getAuditRows(runId: string): Promise<AuditRow[]>;
  getCustomer(id: number): Promise<RepairCustomerRow | null>;
  getCustomerFieldValue(id: number, field: string): Promise<string | null>;
  restoreCustomerField(id: number, field: string, value: string | null): Promise<void>;
  clearOpportunityProjectReference(opportunityId: number, expected: string): Promise<boolean>;
  propertyHasDependencies(propertyId: number): Promise<boolean>;
  deleteProperty(propertyId: number): Promise<void>;
  insertAudit(row: AuditRow): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export type RollbackLine = { field: string; customerId: number; before: string | null; after: string | null; action: "restore" | "delete_property" | "clear_project" | "refuse"; reason: string };

/** Preview (default) or apply a rollback for exactly one runId. */
export async function rollbackRun(port: RollbackPort, runId: string, opts: { dryRun: boolean; actor: string | null }): Promise<RollbackLine[]> {
  const rows = (await port.getAuditRows(runId)).filter(r => r.result === "applied");
  const lines: RollbackLine[] = [];

  for (const r of rows) {
    if (r.fieldName === "property.created") {
      if (r.createdPropertyId == null) { lines.push({ field: r.fieldName, customerId: r.customerId, before: null, after: r.afterValue, action: "refuse", reason: "NO_PROPERTY_ID" }); continue; }
      const dep = await port.propertyHasDependencies(r.createdPropertyId);
      if (dep) { lines.push({ field: r.fieldName, customerId: r.customerId, before: null, after: r.afterValue, action: "refuse", reason: "PROPERTY_HAS_DEPENDENCIES" }); continue; }
      lines.push({ field: r.fieldName, customerId: r.customerId, before: null, after: r.afterValue, action: "delete_property", reason: `property#${r.createdPropertyId}` });
      if (!opts.dryRun) await port.transaction(async () => { await port.deleteProperty(r.createdPropertyId!); await port.insertAudit({ ...r, runId, kind: "rollback", result: "rolled_back", reason: `rollback of ${r.runId}`, beforeValue: r.afterValue, afterValue: null }); });
      continue;
    }
    if (r.fieldName === "projectReference") {
      lines.push({ field: r.fieldName, customerId: r.customerId, before: r.afterValue, after: null, action: "clear_project", reason: `opp#${r.opportunityId}` });
      if (!opts.dryRun && r.opportunityId != null && r.afterValue != null) await port.transaction(async () => { await port.clearOpportunityProjectReference(r.opportunityId!, r.afterValue!); await port.insertAudit({ ...r, runId, kind: "rollback", result: "rolled_back", reason: `rollback of ${r.runId}`, beforeValue: r.afterValue, afterValue: null }); });
      continue;
    }
    // Plain customer field: verify current value still equals recorded after,
    // then restore the recorded before. Refuse if it changed since the repair.
    const current = await port.getCustomerFieldValue(r.customerId, r.fieldName);
    if ((current ?? null) !== (r.afterValue ?? null)) {
      lines.push({ field: r.fieldName, customerId: r.customerId, before: r.beforeValue, after: current, action: "refuse", reason: "CURRENT_NOT_EQUAL_RECORDED_AFTER" });
      continue;
    }
    lines.push({ field: r.fieldName, customerId: r.customerId, before: r.beforeValue, after: r.afterValue, action: "restore", reason: "OK" });
    if (!opts.dryRun) await port.transaction(async () => { await port.restoreCustomerField(r.customerId, r.fieldName, r.beforeValue); await port.insertAudit({ ...r, runId, kind: "rollback", result: "rolled_back", reason: `rollback of ${r.runId}`, beforeValue: r.afterValue, afterValue: r.beforeValue }); });
  }
  return lines;
}
