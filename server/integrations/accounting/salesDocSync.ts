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
  quickbooksConnections,
  type QuickbooksConnection,
} from "../../../drizzle/schema";
import { buildDisplayName, normalizePhone, splitName } from "../../routers/customers";
import { quickbooksProvider, writeSyncLog } from "./quickbooks";
import {
  buildContactFromEstimate,
  buildEstimateQuery,
  mapDocStatusToStage,
  mapEstimateToSalesDoc,
  pickContactMatch,
  shouldSkipExistingDoc,
  type QboEstimate,
} from "./estimates";
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

/**
 * Resolve an existing CRM contact for this estimate, or auto-create one.
 * Dedup priority: quickbooksCustomerId → email → phone → name.
 */
async function resolveOrCreateContact(
  db: Db,
  estimate: QboEstimate,
  now: Date,
): Promise<{ customerId: number; created: boolean; displayName: string }> {
  const qbCustomerId = estimate.CustomerRef?.value ?? null;

  // 1) Already linked by QuickBooks customer id — the strongest key.
  if (qbCustomerId) {
    const linked = await db
      .select({ id: customers.id, displayName: customers.displayName })
      .from(customers)
      .where(eq(customers.quickbooksCustomerId, qbCustomerId))
      .limit(1);
    if (linked[0]) return { customerId: linked[0].id, created: false, displayName: linked[0].displayName };
  }

  // Fetch the full QBO customer for email/phone/address (best effort).
  const qboCustomer = qbCustomerId ? await quickbooksProvider.fetchQboCustomer(qbCustomerId) : null;
  const contact = buildContactFromEstimate(estimate, qboCustomer);

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
      // Backfill the QuickBooks link onto the matched contact if it lacks one.
      const matched = candidates.find(c => c.id === match.id)!;
      if (qbCustomerId && !matched.quickbooksCustomerId) {
        await db
          .update(customers)
          .set({ quickbooksCustomerId: qbCustomerId, quickbooksSyncStatus: "synced", quickbooksSyncedAt: now })
          .where(eq(customers.id, match.id));
      }
      return { customerId: match.id, created: false, displayName: matched.displayName };
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
    source: "quickbooks",
    notes: "Created automatically from QuickBooks sales document.",
    quickbooksCustomerId: qbCustomerId,
    quickbooksSyncStatus: qbCustomerId ? "synced" : "not_synced",
    quickbooksSyncedAt: qbCustomerId ? now : null,
  });
  const customerId = Number((inserted as { insertId?: number }).insertId);
  return { customerId, created: true, displayName };
}

/** Create or update the opportunity backing a sales document. */
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
    now: Date;
  },
): Promise<{ id: number; created: boolean; stageChanged: boolean }> {
  const stage = mapDocStatusToStage(args.status, args.sentAt);
  const isClosed = stage === "won" || stage === "lost";

  if (args.existingOpportunityId) {
    const prev = (
      await db.select({ stage: opportunities.stage, closedAt: opportunities.closedAt })
        .from(opportunities)
        .where(eq(opportunities.id, args.existingOpportunityId))
        .limit(1)
    )[0];
    const stageChanged = !prev || prev.stage !== stage;
    await db
      .update(opportunities)
      .set({
        customerId: args.customerId,
        amount: args.totalAmount,
        stage,
        closedAt: isClosed ? prev?.closedAt ?? args.now : null,
      })
      .where(eq(opportunities.id, args.existingOpportunityId));
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

  if (existing && shouldSkipExistingDoc(existing, mapped)) {
    result.skipped++;
    return;
  }

  // Resolve/auto-create the contact (reuse the link if we already have one).
  let customerId = existing?.customerId ?? null;
  let displayName = "QuickBooks Customer";
  if (customerId == null) {
    const c = await resolveOrCreateContact(db, estimate, now);
    customerId = c.customerId;
    displayName = c.displayName;
    if (c.created) result.contactsCreated++;
  } else {
    const row = (await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1))[0];
    displayName = row?.displayName ?? displayName;
  }

  const opp = await upsertOpportunity(db, {
    existingOpportunityId: existing?.opportunityId ?? null,
    customerId,
    displayName,
    docNumber: mapped.docNumber ?? null,
    totalAmount: mapped.totalAmount as string,
    status: mapped.status ?? "pending",
    sentAt: mapped.sentAt ?? null,
    now,
  });
  if (opp.created) result.opportunitiesCreated++;

  // Upsert the sales-document row (unique on quickbooksId).
  if (existing) {
    await db
      .update(quickbooksSalesDocuments)
      .set({ ...mapped, customerId, opportunityId: opp.id })
      .where(eq(quickbooksSalesDocuments.id, existing.id));
    result.updated++;
  } else {
    await db.insert(quickbooksSalesDocuments).values({ ...mapped, customerId, opportunityId: opp.id });
    result.created++;
    await db.insert(opportunityEvents).values({
      opportunityId: opp.id,
      type: "doc_synced",
      message: `Synced estimate ${mapped.docNumber ?? mapped.quickbooksId} ($${mapped.totalAmount}).`,
      metadata: { quickbooksId: mapped.quickbooksId, status: mapped.status },
    });
  }

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
