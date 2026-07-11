/**
 * QuickBooks sales-document sync orchestrator.
 *
 * Pulls QBO Estimates (60-day backfill, then incremental by an update cursor),
 * mirrors them into quickbooksSalesDocuments, resolves/auto-creates the CRM
 * contact, and creates/updates one Opportunity per document. Everything is
 * keyed on the QBO id and guarded so re-running never duplicates a document,
 * contact, or opportunity. QuickBooks stays the source of truth — we only read.
 *
 * Every run writes a quickbooksSyncLogs row (entityType "estimate").
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  quickbooksSalesDocuments,
  opportunities,
  opportunityEvents,
  customers,
  customerSyncConflicts,
  properties,
  quickbooksConnections,
  type QuickbooksConnection,
} from "../../../drizzle/schema";
import { buildDisplayName, normalizePhone, splitName } from "../../routers/customers";
import { deriveWorkCategory, extractSalesDocSignals } from "../../../shared/opportunityCategory";
import type { WorkCategory } from "../../../shared/opportunityCategory";
import { quickbooksProvider, writeSyncLog } from "./quickbooks";
import {
  buildContactFromEstimate,
  buildEstimateQuery,
  mapDocStatusToStage,
  mapEstimateToSalesDoc,
  pickContactMatch,
  shouldSkipExistingDoc,
  type ContactAddress,
  type EstimateContactInput,
  type QboEstimate,
} from "./estimates";
import {
  buildCustomerFieldUpdate,
  planCustomerConflictWrites,
  type IncomingCustomerFields,
} from "./customerMerge";
import { cancelOpenFollowups, ensureFollowupsForOpportunity } from "./followups";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const PAGE_SIZE = 100;
const PAGE_THROTTLE_MS = 150;
const MAX_PAGES = 100; // safety bound (≤ 10k docs/run)

export interface SyncResult {
  ok: boolean;
  pulled: number;
  created: number;
  updated: number;
  skipped: number;
  contactsCreated: number;
  opportunitiesCreated: number;
  followupsTriggered: number;
  durationMs: number;
  cursorAdvancedTo: string | null;
  error?: string;
}

function emptyResult(): SyncResult {
  return {
    ok: false,
    pulled: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    contactsCreated: 0,
    opportunitiesCreated: 0,
    followupsTriggered: 0,
    durationMs: 0,
    cursorAdvancedTo: null,
  };
}

export interface SyncOptions {
  /** "backfill" ignores the cursor and re-scans the window; "incremental" uses it. */
  mode?: "incremental" | "backfill";
  sinceDays?: number;
  now?: Date;
}

/** Map the QBO-derived contact fields into the customer-merge input shape. */
function incomingFromContact(contact: EstimateContactInput): IncomingCustomerFields {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    companyName: contact.companyName,
    email: contact.email,
    phone: contact.phone,
    altPhone: contact.mobile,
    notes: contact.notes,
    status: contact.active == null ? null : contact.active ? "active" : "inactive",
    billingLine1: contact.address?.line1 ?? null,
    billingLine2: contact.address?.line2 ?? null,
    billingCity: contact.address?.city ?? null,
    billingState: contact.address?.state ?? null,
    billingZip: contact.address?.zip ?? null,
  };
}

/**
 * Persist the QBO service address (ShipAddr) as a `properties` row — but only
 * when the customer has no property with the same street line yet, so repeated
 * syncs never create duplicate service locations.
 */
async function ensureServiceProperty(
  db: Db,
  customerId: number,
  addr: ContactAddress | null,
  customerType: string | null,
  extra: { locationNotes?: string | null; projectReference?: string | null } = {},
): Promise<void> {
  if (!addr || !addr.line1) return;
  const line1 = addr.line1.trim().toLowerCase();
  const dup = await db
    .select({ id: properties.id, locationNotes: properties.locationNotes, projectReference: properties.projectReference })
    .from(properties)
    .where(and(eq(properties.customerId, customerId), sql`LOWER(TRIM(${properties.addressLine1})) = ${line1}`))
    .limit(1);
  if (dup[0]) {
    // Reuse the existing service location; fill only-empty project/location detail
    // so repeated syncs never duplicate a property or clobber curated notes.
    const fill: Record<string, unknown> = {};
    if (extra.locationNotes && !dup[0].locationNotes) fill.locationNotes = extra.locationNotes;
    if (extra.projectReference && !dup[0].projectReference) fill.projectReference = extra.projectReference;
    if (Object.keys(fill).length) await db.update(properties).set(fill).where(eq(properties.id, dup[0].id));
    return;
  }
  const primary = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.customerId, customerId), eq(properties.isPrimary, true)))
    .limit(1);
  await db.insert(properties).values({
    customerId,
    label: "Service Address (QuickBooks)",
    addressLine1: addr.line1,
    addressLine2: addr.line2,
    city: addr.city,
    state: addr.state ?? "NJ",
    zip: addr.zip,
    locationNotes: extra.locationNotes ?? null,
    projectReference: extra.projectReference ?? null,
    propertyType: customerType === "commercial" ? "commercial" : "residential",
    isPrimary: !primary[0],
  });
}

/**
 * Record field reconciliations, keeping at most ONE open conflict per
 * (customer, field) so repeated polls never pile up duplicate unresolved rows.
 * "missing" (auto-filled) rows are stored resolved for audit; "overwrite_prevented"
 * rows are stored open for human review. Returns the count of open conflicts touched.
 */
async function recordCustomerConflicts(
  db: Db,
  customerId: number,
  qbCustomerId: string | null,
  conflicts: ReturnType<typeof buildCustomerFieldUpdate>["conflicts"],
  now: Date,
): Promise<number> {
  if (!conflicts.length) return 0;
  const existing = await db
    .select({
      id: customerSyncConflicts.id,
      fieldName: customerSyncConflicts.fieldName,
      qboValue: customerSyncConflicts.qboValue,
      status: customerSyncConflicts.status,
    })
    .from(customerSyncConflicts)
    .where(eq(customerSyncConflicts.customerId, customerId));

  // Pure planning keeps at most one open conflict per (customer, field).
  const plan = planCustomerConflictWrites(existing, conflicts);
  for (const ins of plan.inserts) {
    await db.insert(customerSyncConflicts).values({
      customerId,
      quickbooksCustomerId: qbCustomerId,
      fieldName: ins.fieldName,
      conflictType: ins.conflictType,
      crmValue: ins.crmValue,
      qboValue: ins.qboValue,
      status: ins.status,
      resolution: ins.resolution,
      resolvedAt: ins.status === "resolved" ? now : null,
    });
  }
  for (const upd of plan.updates) {
    await db
      .update(customerSyncConflicts)
      .set({ qboValue: upd.qboValue, crmValue: upd.crmValue })
      .where(eq(customerSyncConflicts.id, upd.id));
  }
  return plan.openCount;
}

/**
 * Enrich an already-matched CRM customer from the QBO record: fill only empty
 * fields, log conflicts (never overwrite), attach the service address, and
 * refresh the QuickBooks link/timestamp.
 */
async function enrichExistingCustomer(
  db: Db,
  customerId: number,
  contact: EstimateContactInput,
  qbCustomerId: string | null,
  matchedByQbId: boolean,
  now: Date,
): Promise<void> {
  const [existing] = await db
    .select({
      id: customers.id,
      type: customers.type,
      firstName: customers.firstName,
      lastName: customers.lastName,
      companyName: customers.companyName,
      email: customers.email,
      phone: customers.phone,
      altPhone: customers.altPhone,
      notes: customers.notes,
      status: customers.status,
      billingLine1: customers.billingLine1,
      billingLine2: customers.billingLine2,
      billingCity: customers.billingCity,
      billingState: customers.billingState,
      billingZip: customers.billingZip,
      quickbooksCustomerId: customers.quickbooksCustomerId,
      quickbooksCustomerUpdatedAt: customers.quickbooksCustomerUpdatedAt,
      quickbooksRawDisplayName: customers.quickbooksRawDisplayName,
      projectReference: customers.projectReference,
      displayNameManuallyApproved: customers.displayNameManuallyApproved,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!existing) return;

  // Freshness guard: skip re-enriching when the QBO customer has not changed
  // since our last enrichment. Keeps every-sync enrichment idempotent and avoids
  // re-evaluating conflicts on unchanged records. (Existing customers predating
  // this feature have a null timestamp, so they enrich once on the next sync.)
  if (
    existing.quickbooksCustomerUpdatedAt &&
    contact.quickbooksUpdatedAt &&
    existing.quickbooksCustomerUpdatedAt.getTime() >= contact.quickbooksUpdatedAt.getTime()
  ) {
    return;
  }

  const { patch, conflicts } = buildCustomerFieldUpdate(existing, incomingFromContact(contact), { normalizePhone });
  const setValues: Record<string, unknown> = { ...patch };

  // Recompute the display name only when a name field was filled AND the name has
  // not been manually approved/corrected. This is what stops a later QBO sync from
  // ever restoring a bad composite name over a human-verified one.
  if (
    !existing.displayNameManuallyApproved &&
    (patch.firstName != null || patch.lastName != null || patch.companyName != null)
  ) {
    setValues.displayName = buildDisplayName({
      companyName: patch.companyName ?? existing.companyName,
      firstName: patch.firstName ?? existing.firstName,
      lastName: patch.lastName ?? existing.lastName,
      email: patch.email ?? existing.email,
      phone: patch.phone ?? existing.phone,
    });
  }
  // Audit: preserve the raw QBO name and the parsed project reference (fill-empty only).
  if (contact.rawDisplayName && !existing.quickbooksRawDisplayName) {
    setValues.quickbooksRawDisplayName = contact.rawDisplayName;
  }
  if (contact.projectReference && !existing.projectReference) {
    setValues.projectReference = contact.projectReference;
  }
  if (qbCustomerId && !matchedByQbId && !existing.quickbooksCustomerId) {
    setValues.quickbooksCustomerId = qbCustomerId;
    setValues.quickbooksSyncStatus = "synced";
    setValues.quickbooksSyncedAt = now;
  }
  if (contact.quickbooksUpdatedAt) setValues.quickbooksCustomerUpdatedAt = contact.quickbooksUpdatedAt;

  const openCount = await recordCustomerConflicts(db, customerId, qbCustomerId, conflicts, now);
  if (openCount > 0) setValues.hasQboConflicts = true;

  if (Object.keys(setValues).length) {
    await db.update(customers).set(setValues).where(eq(customers.id, customerId));
  }
  await ensureServiceProperty(db, customerId, contact.serviceAddress, existing.type, {
    locationNotes: contact.locationNotes,
    projectReference: contact.projectReference,
  });
}

/**
 * Enrich an already-linked customer from QuickBooks on a normal re-sync: fetch
 * the QBO customer, fill only-empty CRM fields, attach billing/service
 * addresses, and log conflicts (never overwrite). Idempotent via the freshness
 * guard + one-open-conflict-per-field dedupe in enrichExistingCustomer.
 */
async function enrichLinkedCustomer(db: Db, customerId: number, estimate: QboEstimate, now: Date): Promise<void> {
  const qbCustomerId = estimate.CustomerRef?.value ?? null;
  if (!qbCustomerId) return;
  const qboCustomer = await quickbooksProvider.fetchQboCustomer(qbCustomerId);
  const contact = buildContactFromEstimate(estimate, qboCustomer);
  await enrichExistingCustomer(db, customerId, contact, qbCustomerId, false, now);
}

/**
 * Resolve an existing CRM contact for this estimate, or auto-create one.
 * Dedup priority: quickbooksCustomerId → email → phone → name. Whenever an
 * existing contact is matched, its empty fields are filled from QuickBooks and
 * any conflicting values are logged (never overwritten).
 */
async function resolveOrCreateContact(
  db: Db,
  estimate: QboEstimate,
  now: Date,
): Promise<{ customerId: number; created: boolean; displayName: string }> {
  const qbCustomerId = estimate.CustomerRef?.value ?? null;

  // Fetch the full QBO customer (best effort) up front — needed to enrich.
  const qboCustomer = qbCustomerId ? await quickbooksProvider.fetchQboCustomer(qbCustomerId) : null;
  const contact = buildContactFromEstimate(estimate, qboCustomer);

  // 1) Already linked by QuickBooks customer id — the strongest key.
  if (qbCustomerId) {
    const linked = await db
      .select({ id: customers.id, displayName: customers.displayName })
      .from(customers)
      .where(eq(customers.quickbooksCustomerId, qbCustomerId))
      .limit(1);
    if (linked[0]) {
      await enrichExistingCustomer(db, linked[0].id, contact, qbCustomerId, true, now);
      const dn = (await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, linked[0].id)).limit(1))[0];
      return { customerId: linked[0].id, created: false, displayName: dn?.displayName ?? linked[0].displayName };
    }
  }

  // 2/3/4) Match existing local customers by email / phone / name.
  const emailKey = contact.email?.trim().toLowerCase() || null;
  const phoneKey = normalizePhone(contact.phone);
  const nameKey = (contact.companyName?.trim() || contact.displayName?.trim() || "").toLowerCase() || null;
  const orParts = [];
  if (emailKey) orParts.push(sql`LOWER(${customers.email}) = ${emailKey}`);
  if (phoneKey) orParts.push(sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${phoneKey}`);
  if (nameKey) {
    orParts.push(sql`LOWER(${customers.companyName}) = ${nameKey}`);
    orParts.push(sql`LOWER(${customers.displayName}) = ${nameKey}`);
  }
  if (orParts.length) {
    const candidates = await db
      .select({
        id: customers.id,
        email: customers.email,
        phone: customers.phone,
        displayName: customers.displayName,
        companyName: customers.companyName,
        quickbooksCustomerId: customers.quickbooksCustomerId,
      })
      .from(customers)
      .where(sql`(${sql.join(orParts, sql` OR `)})`)
      .limit(25);
    const match = pickContactMatch(
      { email: contact.email, phone: contact.phone, displayName: contact.displayName, companyName: contact.companyName },
      candidates,
      normalizePhone,
    );
    if (match) {
      await enrichExistingCustomer(db, match.id, contact, qbCustomerId, false, now);
      const dn = (await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, match.id)).limit(1))[0];
      return { customerId: match.id, created: false, displayName: dn?.displayName ?? "QuickBooks Customer" };
    }
  }

  // 5) No match — auto-create the contact from the QuickBooks record.
  const name = contact.firstName || contact.lastName ? { firstName: contact.firstName, lastName: contact.lastName } : splitName(contact.displayName);
  const displayName = buildDisplayName({
    companyName: contact.companyName,
    firstName: name.firstName,
    lastName: name.lastName,
    email: contact.email,
    phone: contact.phone,
  });
  const [inserted] = await db.insert(customers).values({
    type: contact.companyName ? "commercial" : "residential",
    firstName: name.firstName,
    lastName: name.lastName,
    companyName: contact.companyName,
    displayName,
    email: contact.email,
    phone: contact.phone,
    altPhone: contact.mobile,
    status: contact.active === false ? "inactive" : "active",
    source: "quickbooks",
    notes: contact.notes ?? "Created automatically from QuickBooks sales document.",
    billingLine1: contact.address?.line1 ?? null,
    billingLine2: contact.address?.line2 ?? null,
    billingCity: contact.address?.city ?? null,
    billingState: contact.address?.state ?? null,
    billingZip: contact.address?.zip ?? null,
    // Audit + temporary project storage (no Projects module yet).
    quickbooksRawDisplayName: contact.rawDisplayName,
    projectReference: contact.projectReference,
    quickbooksCustomerId: qbCustomerId,
    quickbooksSyncStatus: qbCustomerId ? "synced" : "not_synced",
    quickbooksSyncedAt: qbCustomerId ? now : null,
    quickbooksCustomerUpdatedAt: contact.quickbooksUpdatedAt,
  });
  const customerId = Number((inserted as { insertId?: number }).insertId);
  await ensureServiceProperty(db, customerId, contact.serviceAddress, contact.companyName ? "commercial" : "residential", {
    locationNotes: contact.locationNotes,
    projectReference: contact.projectReference,
  });
  return { customerId, created: true, displayName };
}

/**
 * Create or update the opportunity backing a sales document.
 *
 * Respects CRM overrides: once a human has edited the Opportunity Value
 * (`amountOverridden`) or moved the stage (`stageOverridden`), sync leaves that
 * field alone — QuickBooks still owns the document, but the CRM owns the deal.
 * `workCategory` is always refreshed (it is derived, not user-owned).
 */
async function upsertOpportunity(
  db: Db,
  args: {
    existingOpportunityId: number | null;
    customerId: number;
    displayName: string;
    projectReference?: string | null;
    docNumber: string | null;
    totalAmount: string;
    status: (typeof quickbooksSalesDocuments.status.enumValues)[number];
    sentAt: Date | null;
    workCategory: WorkCategory | null;
    now: Date;
  },
): Promise<{ id: number; created: boolean; stageChanged: boolean }> {
  const stage = mapDocStatusToStage(args.status, args.sentAt);
  const isClosed = stage === "won" || stage === "lost";

  if (args.existingOpportunityId) {
    const prev = (
      await db
        .select({
          stage: opportunities.stage,
          closedAt: opportunities.closedAt,
          amountOverridden: opportunities.amountOverridden,
          stageOverridden: opportunities.stageOverridden,
        })
        .from(opportunities)
        .where(eq(opportunities.id, args.existingOpportunityId))
        .limit(1)
    )[0];
    const setValues: Record<string, unknown> = {
      customerId: args.customerId,
      workCategory: args.workCategory,
    };
    // QuickBooks Amount stays read-only; it only seeds the CRM value until overridden.
    if (!prev?.amountOverridden) setValues.amount = args.totalAmount;
    let stageChanged = false;
    if (!prev?.stageOverridden) {
      stageChanged = !prev || prev.stage !== stage;
      setValues.stage = stage;
      setValues.closedAt = isClosed ? prev?.closedAt ?? args.now : null;
    }
    await db.update(opportunities).set(setValues).where(eq(opportunities.id, args.existingOpportunityId));
    if (stageChanged) {
      await db.insert(opportunityEvents).values({
        opportunityId: args.existingOpportunityId,
        type: "status_changed",
        message: `Stage → ${stage} (from QuickBooks).`,
      });
    }
    return { id: args.existingOpportunityId, created: false, stageChanged };
  }

  // Keep the project code visible on the deal until a Projects module exists.
  const titlePrefix = args.projectReference ? `${args.projectReference} · ` : "";
  const title = `${titlePrefix}${args.displayName} — Estimate${args.docNumber ? ` ${args.docNumber}` : ""}`;
  const [inserted] = await db.insert(opportunities).values({
    customerId: args.customerId,
    title,
    source: "quickbooks",
    stage,
    amount: args.totalAmount,
    workCategory: args.workCategory,
    closedAt: isClosed ? args.now : null,
  });
  const id = Number((inserted as { insertId?: number }).insertId);
  await db.insert(opportunityEvents).values({
    opportunityId: id,
    type: "created",
    message: "Opportunity created from QuickBooks sales document.",
  });
  return { id, created: true, stageChanged: true };
}

/** Process one estimate end-to-end. Mutates `result` counters. */
async function processEstimate(db: Db, conn: QuickbooksConnection, estimate: QboEstimate, now: Date, result: SyncResult): Promise<void> {
  const mapped = mapEstimateToSalesDoc(estimate, conn.realmId, now);
  result.pulled++;

  const existing = (
    await db.select().from(quickbooksSalesDocuments).where(eq(quickbooksSalesDocuments.quickbooksId, mapped.quickbooksId)).limit(1)
  )[0];

  // Resolve/auto-create AND enrich the contact on EVERY sync — not only first
  // import. Runs before the doc-skip guard so an already-linked customer still
  // gets empty fields filled, billing/service addresses attached, and conflicts
  // logged even when the estimate itself is unchanged. Enrichment is idempotent
  // (fill-empty + one-open-conflict-per-field dedupe + a QBO-freshness guard).
  let customerId = existing?.customerId ?? null;
  if (customerId == null) {
    const c = await resolveOrCreateContact(db, estimate, now);
    customerId = c.customerId;
    if (c.created) result.contactsCreated++;
  } else {
    await enrichLinkedCustomer(db, customerId, estimate, now);
  }

  // Doc idempotency: skip re-writing an unchanged sales-doc/opportunity. The
  // customer was already enriched above, so skipping here is safe.
  if (existing && shouldSkipExistingDoc(existing, mapped)) {
    result.skipped++;
    return;
  }

  // Load the customer for the title + work-category classification.
  const cust = (
    await db
      .select({
        type: customers.type,
        companyName: customers.companyName,
        displayName: customers.displayName,
        projectReference: customers.projectReference,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
  )[0];
  const displayName = cust?.displayName ?? "QuickBooks Customer";

  // Persist the derived Residential/Commercial/Change-Order category.
  const signals = extractSalesDocSignals(estimate);
  const workCategory = deriveWorkCategory(
    { docType: "estimate", docNumber: mapped.docNumber ?? null, text: signals.text, linkedToExistingJob: signals.linkedToExistingJob },
    { type: cust?.type ?? null, companyName: cust?.companyName ?? null, displayName: cust?.displayName ?? null },
  );

  const opp = await upsertOpportunity(db, {
    existingOpportunityId: existing?.opportunityId ?? null,
    customerId,
    displayName,
    projectReference: cust?.projectReference ?? null,
    docNumber: mapped.docNumber ?? null,
    totalAmount: mapped.totalAmount as string,
    status: mapped.status ?? "pending",
    sentAt: mapped.sentAt ?? null,
    workCategory,
    now,
  });
  if (opp.created) result.opportunitiesCreated++;

  // Upsert the sales-document row (unique on quickbooksId).
  let docId: number;
  if (existing) {
    await db
      .update(quickbooksSalesDocuments)
      .set({ ...mapped, customerId, opportunityId: opp.id })
      .where(eq(quickbooksSalesDocuments.id, existing.id));
    docId = existing.id;
    result.updated++;
  } else {
    const [insDoc] = await db.insert(quickbooksSalesDocuments).values({ ...mapped, customerId, opportunityId: opp.id });
    docId = Number((insDoc as { insertId?: number }).insertId);
    result.created++;
    await db.insert(opportunityEvents).values({
      opportunityId: opp.id,
      type: "doc_synced",
      message: `Synced estimate ${mapped.docNumber ?? mapped.quickbooksId} ($${mapped.totalAmount}).`,
      metadata: { quickbooksId: mapped.quickbooksId, status: mapped.status },
    });
  }

  // Point the opportunity at its primary sales document (first one wins) so the
  // dashboard can join one-to-one without row multiplication.
  await db
    .update(opportunities)
    .set({ quickbooksSalesDocumentId: docId })
    .where(and(eq(opportunities.id, opp.id), sql`${opportunities.quickbooksSalesDocumentId} IS NULL`));

  // Follow-up loop: open it for Sent/Pending docs; cancel it once the deal closes.
  if (mapped.status === "pending") {
    const n = await ensureFollowupsForOpportunity({
      db,
      opportunityId: opp.id,
      customerId,
      doc: {
        docNumber: mapped.docNumber ?? null,
        amount: mapped.totalAmount as string,
        documentLink: mapped.documentLink ?? null,
        customerName: displayName,
      },
      now,
    });
    result.followupsTriggered += n;
  } else if (mapped.status === "accepted" || mapped.status === "closed" || mapped.status === "rejected" || mapped.status === "expired") {
    await cancelOpenFollowups(opp.id, `document ${mapped.status}`, db);
  }
}

/**
 * Run a full sync. Returns per-run counters and writes a sync-log row.
 * The cursor advances only after the whole run succeeds.
 */
export async function syncSalesDocuments(opts: SyncOptions = {}): Promise<SyncResult> {
  const result = emptyResult();
  const started = Date.now();
  const now = opts.now ?? new Date();
  const sinceDays = opts.sinceDays ?? 60;

  const db = await getDb();
  if (!db) {
    result.error = "Database unavailable";
    return result;
  }
  const conn = await quickbooksProvider.getConnection();
  if (!conn || conn.status !== "connected") {
    result.error = "QuickBooks is not connected";
    return result;
  }

  const cursor = opts.mode === "backfill" ? null : conn.salesDocCursor ?? null;
  let maxSeen: Date | null = cursor;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = buildEstimateQuery({ cursor, sinceDays, startPosition: page * PAGE_SIZE + 1, pageSize: PAGE_SIZE, now });
      const estimates = await quickbooksProvider.fetchEstimates(query);
      for (const e of estimates) {
        await processEstimate(db, conn, e, now, result);
        const u = e.MetaData?.LastUpdatedTime ? new Date(e.MetaData.LastUpdatedTime) : null;
        if (u && !Number.isNaN(u.getTime()) && (!maxSeen || u.getTime() > maxSeen.getTime())) maxSeen = u;
      }
      if (estimates.length < PAGE_SIZE) break;
      await new Promise(r => setTimeout(r, PAGE_THROTTLE_MS));
    }

    // Advance the cursor only on a clean run.
    await db
      .update(quickbooksConnections)
      .set({ salesDocCursor: maxSeen, salesDocLastSyncAt: now, lastSyncAt: now })
      .where(eq(quickbooksConnections.realmId, conn.realmId));
    result.ok = true;
    result.cursorAdvancedTo = maxSeen ? maxSeen.toISOString() : null;
  } catch (e) {
    result.error = (e as Error).message;
  }

  result.durationMs = Date.now() - started;
  await writeSyncLog({
    entityType: "estimate",
    direction: "pull",
    realmId: conn.realmId,
    success: result.ok,
    durationMs: result.durationMs,
    errorMessage: result.ok
      ? `pulled=${result.pulled} created=${result.created} updated=${result.updated} skipped=${result.skipped} contacts+=${result.contactsCreated} opps+=${result.opportunitiesCreated}`
      : (result.error ?? "unknown error").slice(0, 1000),
  });
  console.log(JSON.stringify({ tag: "[QboSalesDocSync]", ...result }));
  return result;
}
