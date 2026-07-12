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
import { getDb, createDedicatedConnection } from "../../db";
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
import { isCustomerNameEnrichEnabled, planCustomerEnrichment } from "./enrichmentGate";
import { cancelOpenFollowups, ensureFollowupsForOpportunity } from "./followups";
import { SyncLock } from "./syncLock";
import { withDbLock, type DbLockLogEntry, type LockConnection } from "./dbSyncLock";

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
  /** Test seam: override the dedicated-connection factory for the advisory lock. */
  lockConnectionFactory?: () => Promise<LockConnection>;
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
export async function ensureServiceProperty(
  db: Db,
  customerId: number,
  addr: ContactAddress | null,
  customerType: string | null,
): Promise<void> {
  if (!addr || !addr.line1) return;
  const line1 = addr.line1.trim().toLowerCase();
  const dup = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.customerId, customerId), sql`LOWER(TRIM(${properties.addressLine1})) = ${line1}`))
    .limit(1);
  if (dup[0]) return;
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
export async function enrichExistingCustomer(
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

  // Identity writes (firstName/lastName/companyName/displayName) are gated behind
  // QBO_CUSTOMER_NAME_ENRICH (default OFF) so the sync never silently mutates a
  // customer's name outside the reviewed repair workflow. Every non-identity
  // behavior below — non-name fill-empty, QBO id/status/timestamps, conflict
  // logging, service-property attachment — runs regardless of the flag.
  const { setValues, conflicts } = planCustomerEnrichment({
    existing,
    incoming: incomingFromContact(contact),
    quickbooksUpdatedAt: contact.quickbooksUpdatedAt ?? null,
    qbCustomerId,
    matchedByQbId,
    now,
    nameEnrichEnabled: isCustomerNameEnrichEnabled(),
    buildDisplayName,
    normalizePhone,
  });

  const openCount = await recordCustomerConflicts(db, customerId, qbCustomerId, conflicts, now);
  if (openCount > 0) setValues.hasQboConflicts = true;

  if (Object.keys(setValues).length) {
    await db.update(customers).set(setValues).where(eq(customers.id, customerId));
  }
  await ensureServiceProperty(db, customerId, contact.serviceAddress, existing.type);
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
export async function resolveOrCreateContact(
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
  // Company vs structured-person vs confident-single-name vs unknown-identity.
  // We NEVER split a company name or a low-confidence composite into person
  // fields, and NEVER store the raw composite as the CRM name.
  let firstName: string | null;
  let lastName: string | null;
  let type: "residential" | "commercial";
  if (contact.isCompany) {
    // Company: companyName only; person fields stay NULL; commercial.
    firstName = null;
    lastName = null;
    type = "commercial";
  } else if (contact.firstName || contact.lastName) {
    // Structured / confidently-parsed person name.
    firstName = contact.firstName;
    lastName = contact.lastName;
    type = "residential";
  } else if (contact.nameConfident && contact.displayName) {
    // Confident single-string person name — safe to split.
    const s = splitName(contact.displayName);
    firstName = s.firstName;
    lastName = s.lastName;
    type = "residential";
  } else {
    // Low-confidence composite / unknown identity: do NOT invent person fields
    // and do NOT use the composite. buildDisplayName falls back to email/phone.
    firstName = null;
    lastName = null;
    type = "residential";
  }
  // When the real name could not be determined, flag for human review instead of
  // guessing. The raw composite is preserved in the conflict row's qboValue.
  const nameNeedsReview = !contact.isCompany && !contact.nameConfident;

  const displayName = buildDisplayName({
    companyName: contact.companyName,
    firstName,
    lastName,
    email: contact.email,
    phone: contact.phone,
  });
  const [inserted] = await db.insert(customers).values({
    type,
    firstName,
    lastName,
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
    quickbooksCustomerId: qbCustomerId,
    quickbooksSyncStatus: qbCustomerId ? "synced" : "not_synced",
    quickbooksSyncedAt: qbCustomerId ? now : null,
    quickbooksCustomerUpdatedAt: contact.quickbooksUpdatedAt,
    hasQboConflicts: nameNeedsReview,
  });
  const customerId = Number((inserted as { insertId?: number }).insertId);
  if (nameNeedsReview) {
    // Surface the withheld raw name for a human to resolve (never auto-applied).
    await db.insert(customerSyncConflicts).values({
      customerId,
      quickbooksCustomerId: qbCustomerId,
      fieldName: "displayName",
      conflictType: "overwrite_prevented",
      crmValue: displayName,
      qboValue: contact.rawDisplayName,
      status: "open",
    });
  }
  await ensureServiceProperty(db, customerId, contact.serviceAddress, type);
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

  const title = `${args.displayName} — Estimate${args.docNumber ? ` ${args.docNumber}` : ""}`;
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
async function processEstimate(db: Db, conn: QuickbooksConnection, estimate: QboEstimate, now: Date, result: SyncResult, assertLockHeld?: () => void): Promise<void> {
  const mapped = mapEstimateToSalesDoc(estimate, conn.realmId, now);
  result.pulled++;

  // Identity is the composite (realmId, docType, quickbooksId) — an estimate and
  // an invoice may share a QBO id, so match on all three, not quickbooksId alone.
  const existing = (
    await db
      .select()
      .from(quickbooksSalesDocuments)
      .where(
        and(
          eq(quickbooksSalesDocuments.realmId, conn.realmId),
          eq(quickbooksSalesDocuments.docType, "estimate"),
          eq(quickbooksSalesDocuments.quickbooksId, mapped.quickbooksId),
        ),
      )
      .limit(1)
  )[0];

  // Resolve/auto-create AND enrich the contact on EVERY sync — not only first
  // import. Runs before the doc-skip guard so an already-linked customer still
  // gets empty fields filled, billing/service addresses attached, and conflicts
  // logged even when the estimate itself is unchanged. Enrichment is idempotent
  // (fill-empty + one-open-conflict-per-field dedupe + a QBO-freshness guard).
  let customerId = existing?.customerId ?? null;
  // Immediately before any CRM write begins: if the advisory-lock connection was
  // lost, MySQL already auto-released the lock — abort now so we make no writes
  // that another instance could be making concurrently.
  assertLockHeld?.();
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
      .select({ type: customers.type, companyName: customers.companyName, displayName: customers.displayName })
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
/**
 * Concurrency guard for sales-doc syncs — two layers:
 *
 *   1. In-process SyncLock — a FAST LOCAL optimization only. It cheaply skips a
 *      second sync inside the SAME Node process without opening a DB connection.
 *   2. MySQL advisory lock (`GET_LOCK`) on a dedicated connection — the
 *      AUTHORITATIVE cross-instance guard. An in-memory lock can't stop two
 *      Railway instances (rolling deploy / >1 replica) or a post-restart process
 *      from running concurrent backfills; the DB lock can, and MySQL auto-frees
 *      it if the holder's connection dies.
 *
 * No QBO calls run until the advisory lock is held. Any refusal (busy) or lock
 * DB error (GET_LOCK NULL) is recorded as a failed sync-log; the run never
 * proceeds. Both locks always release in `finally`.
 */
const salesDocSyncLock = new SyncLock();
const SALESDOC_LOCK_NAME = "qbo_salesdoc_backfill";

/** Production factory: a fresh dedicated connection for the advisory lock. */
const lockConnectionFactory = () =>
  createDedicatedConnection() as unknown as Promise<LockConnection>;

function logDbLock(entry: DbLockLogEntry): void {
  // Request id + timing + outcome only — never credentials or SQL values.
  console.log(JSON.stringify({ tag: "[QboSyncLock]", ...entry }));
}

async function recordRefusal(result: SyncResult, message: string, outcome: string): Promise<SyncResult> {
  result.error = message;
  await writeSyncLog({ entityType: "estimate", direction: "pull", success: false, errorMessage: message });
  console.log(JSON.stringify({ tag: "[QboSalesDocSync]", ...result, lockOutcome: outcome }));
  return result;
}

export async function syncSalesDocuments(opts: SyncOptions = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const mode = opts.mode ?? "incremental";
  const owner = `${mode}-${now.getTime()}`;
  const requestId = owner;

  // Layer 1: fast in-process pre-check (local optimization only).
  if (!salesDocSyncLock.tryAcquire(owner)) {
    return recordRefusal(
      emptyResult(),
      "another QuickBooks sync is already running in this process; skipped to avoid concurrent backfills",
      "in_process_busy",
    );
  }

  try {
    // Layer 2: authoritative cross-instance advisory lock. QBO calls happen
    // ONLY inside `run`, i.e. strictly after the lock is acquired.
    const connect = opts.lockConnectionFactory ?? lockConnectionFactory;
    return await withDbLock(
      connect,
      SALESDOC_LOCK_NAME,
      handle => runSalesDocSync(opts, now, () => handle.assertHeld()),
      (reason, error) =>
        recordRefusal(
          emptyResult(),
          reason === "busy"
            ? "another QuickBooks sync holds the advisory lock (another instance); skipped to avoid concurrent backfills"
            : `advisory lock unavailable (database error): ${error?.message ?? "unknown"}; sync aborted safely`,
          reason === "busy" ? "advisory_busy" : "advisory_db_error",
        ),
      { requestId, log: logDbLock },
    );
  } finally {
    salesDocSyncLock.release(owner);
  }
}

/**
 * @param assertLockHeld throws if the advisory-lock connection was lost, so a
 *        run whose lock silently freed (connection death → MySQL auto-release)
 *        aborts with a failed status instead of racing another instance.
 */
async function runSalesDocSync(opts: SyncOptions, now: Date, assertLockHeld?: () => void): Promise<SyncResult> {
  const result = emptyResult();
  const started = Date.now();
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
      // Re-check the advisory lock before every QBO page: if the dedicated lock
      // connection died mid-run, MySQL already auto-released the lock, so we must
      // stop rather than keep issuing QBO calls another instance might duplicate.
      assertLockHeld?.();
      const query = buildEstimateQuery({ cursor, sinceDays, startPosition: page * PAGE_SIZE + 1, pageSize: PAGE_SIZE, now });
      const estimates = await quickbooksProvider.fetchEstimates(query);
      for (const e of estimates) {
        assertLockHeld?.(); // re-check the lock before processing each estimate
        await processEstimate(db, conn, e, now, result, assertLockHeld);
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
