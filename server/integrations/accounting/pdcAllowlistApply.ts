/**
 * PDC-only allowlisted apply tool — the SMALLEST, hard-gated writer for exactly
 * two human-approved QuickBooks estimates:
 *
 *   2545 / Estimate 2141 / PN#135  → CRM customer 9 (PDC LLC), 457-461 Washington St
 *   3314 / Estimate 2160 / York Ave → CRM customer 9 (already linked), 10 York Ave
 *
 * Hard safety contract (enforced, not merely documented):
 *  - REFUSES to run unless the caller passes the exact allowlist ["2545","3314"].
 *  - REFUSES any estimate id outside the allowlist.
 *  - NEVER inserts/merges a Customer (verifies the approved customer exists; aborts if not).
 *  - NEVER inserts a Job.
 *  - NEVER writes the salesDocCursor / quickbooksConnections.
 *  - NEVER touches any other estimate, opportunity, property, or the 114 review records.
 *  - Uses the caller-approved Property values verbatim (no HQ/billing/composite guessing).
 *  - An Opportunity title change is applied ONLY when the live title matches the
 *    caller's exact `expectedCurrent`; otherwise it is refused (never silently changed).
 *  - Idempotent: sales-doc dedup on the UNIQUE quickbooksId; property dedup on
 *    (customerId, street); opportunity reuse. Re-running is a no-op.
 *  - `execute:false` (default) is a DRY RUN — it reads to build the plan and
 *    writes NOTHING.
 */
import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "../../db";
import {
  opportunities,
  opportunityEvents,
  properties,
  quickbooksSalesDocuments,
  customers,
} from "../../../drizzle/schema";
import { mapDocStatusToStage, mapEstimateToSalesDoc, type QboEstimate } from "./estimates";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** The ONLY estimate ids this tool will ever touch. */
export const PDC_ALLOWLIST_IDS = ["2545", "3314"] as const;

export interface ApprovedProperty {
  addressLine1: string;
  city: string;
  state: string;
  zip: string | null;
  propertyType: "commercial" | "residential";
  label: string;
}

export interface AllowlistRecord {
  qboEstimateId: string;
  estimateNumber: string;
  /** Human-approved CRM customer. The tool verifies it exists and NEVER creates it. */
  customerId: number;
  projectReference: string;
  /** "import" = create the sales-doc; "reuse" = an already-linked estimate. */
  mode: "import" | "reuse";
  property: ApprovedProperty;
  /** For reuse mode: the existing Opportunity id to reuse (never create a new one). */
  reuseOpportunityId?: number;
  /** Gated title change — applied only if the live title === expectedCurrent. */
  opportunityTitle?: { expectedCurrent: string; proposed: string };
}

export class ApplyRefusal extends Error {
  code: "ALLOWLIST_MISMATCH" | "ALLOWLIST_VIOLATION" | "NO_CUSTOMER" | "ESTIMATE_NOT_FOUND" | "MISSING_LINK";
  constructor(code: ApplyRefusal["code"], message: string) {
    super(message);
    this.name = "ApplyRefusal";
    this.code = code;
  }
}

export interface ApplyDeps {
  db: Db;
  /** Fetch one QBO estimate by id (read-only). Injected for tests. */
  fetchEstimateById(id: string): Promise<QboEstimate | null>;
  realmId: string | null;
  now: Date;
}

export interface ApplyOptions {
  /** MUST equal PDC_ALLOWLIST_IDS (order-insensitive) or the tool refuses to run. */
  allowlist: string[];
  records: AllowlistRecord[];
  /** false (default) = DRY RUN: reads + plans, writes nothing. */
  execute?: boolean;
}

export interface ApplyRecordResult {
  qboEstimateId: string;
  estimateNumber: string;
  customerId: number;
  salesDoc: "inserted" | "reused";
  opportunity: "created" | "reused";
  property: "created" | "reused";
  titleUpdate: "applied" | "skipped_no_approval" | "refused_mismatch" | "none";
  /** Invariants — always zero. */
  customerWrites: 0;
  jobWrites: 0;
  cursorWrites: 0;
  plannedWrites: string[];
  executed: boolean;
}

export interface ApplyResult {
  ok: boolean;
  dryRun: boolean;
  records: ApplyRecordResult[];
  totals: {
    salesDocsInserted: number;
    opportunitiesCreated: number;
    propertiesCreated: number;
    customerWrites: 0;
    jobWrites: 0;
    cursorWrites: 0;
  };
}

function assertAllowlist(allowlist: string[], records: AllowlistRecord[]): void {
  const expected = [...PDC_ALLOWLIST_IDS].sort();
  const got = [...allowlist].sort();
  if (got.length !== expected.length || got.some((v, i) => v !== expected[i])) {
    throw new ApplyRefusal(
      "ALLOWLIST_MISMATCH",
      `Refusing: allowlist must be exactly [${expected.join(",")}], got [${got.join(",")}]`,
    );
  }
  for (const r of records) {
    if (!allowlist.includes(r.qboEstimateId)) {
      throw new ApplyRefusal("ALLOWLIST_VIOLATION", `Refusing: estimate ${r.qboEstimateId} is not in the allowlist`);
    }
  }
}

/** Find an existing service property by (customer, street) — the dedup key. */
async function findProperty(db: Db, customerId: number, addressLine1: string): Promise<number | null> {
  const line1 = addressLine1.trim().toLowerCase();
  const rows = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.customerId, customerId), sql`LOWER(TRIM(${properties.addressLine1})) = ${line1}`))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function processRecord(deps: ApplyDeps, record: AllowlistRecord, execute: boolean): Promise<ApplyRecordResult> {
  const { db, now } = deps;
  const plannedWrites: string[] = [];

  // 1) Verify the approved customer EXISTS. Never create/merge a customer.
  const cust = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, record.customerId)).limit(1);
  if (!cust[0]) {
    throw new ApplyRefusal("NO_CUSTOMER", `Refusing: customer ${record.customerId} does not exist (tool never creates customers)`);
  }

  // 2) Fetch the estimate (read-only) for the sales-doc mapping.
  const estimate = await deps.fetchEstimateById(record.qboEstimateId);
  if (!estimate) throw new ApplyRefusal("ESTIMATE_NOT_FOUND", `Estimate ${record.qboEstimateId} not found in QuickBooks`);
  const mapped = mapEstimateToSalesDoc(estimate, deps.realmId, now);

  // 3) Existing sales-doc? (unique quickbooksId → dedup / idempotency)
  const existingDoc = (
    await db
      .select({ id: quickbooksSalesDocuments.id, opportunityId: quickbooksSalesDocuments.opportunityId })
      .from(quickbooksSalesDocuments)
      .where(eq(quickbooksSalesDocuments.quickbooksId, String(record.qboEstimateId)))
      .limit(1)
  )[0];

  // 4) Existing approved property?
  const existingPropertyId = await findProperty(db, record.customerId, record.property.addressLine1);

  // 5) Opportunity to reuse (explicit id, or the existing doc's link).
  const reuseOppId = record.reuseOpportunityId ?? existingDoc?.opportunityId ?? null;

  const salesDocResult: ApplyRecordResult["salesDoc"] = existingDoc ? "reused" : "inserted";
  const opportunityResult: ApplyRecordResult["opportunity"] = reuseOppId ? "reused" : "created";
  const propertyResult: ApplyRecordResult["property"] = existingPropertyId ? "reused" : "created";

  // Gated title update: read the live title first; only change on exact match.
  let titleUpdate: ApplyRecordResult["titleUpdate"] = "none";
  let liveTitle: string | null = null;
  if (record.opportunityTitle && reuseOppId) {
    const opp = (await db.select({ title: opportunities.title }).from(opportunities).where(eq(opportunities.id, reuseOppId)).limit(1))[0];
    liveTitle = opp?.title ?? null;
    titleUpdate = liveTitle === record.opportunityTitle.expectedCurrent ? "applied" : "refused_mismatch";
  } else if (record.opportunityTitle && !reuseOppId) {
    titleUpdate = "skipped_no_approval";
  }

  // Build the plan (both dry-run and execute report this).
  if (salesDocResult === "inserted") plannedWrites.push(`INSERT quickbooksSalesDocuments(quickbooksId=${record.qboEstimateId}, customerId=${record.customerId}, status=${mapped.status})`);
  else plannedWrites.push(`REUSE  quickbooksSalesDocuments(id=${existingDoc!.id}) — status preserved`);
  if (opportunityResult === "created") plannedWrites.push(`INSERT opportunities(customerId=${record.customerId}, title="PDC LLC — Estimate ${record.estimateNumber}")`);
  else plannedWrites.push(`REUSE  opportunities(id=${reuseOppId})`);
  if (propertyResult === "created") plannedWrites.push(`INSERT properties(customerId=${record.customerId}, addressLine1="${record.property.addressLine1}", zip=${record.property.zip ?? "NULL"}, type=${record.property.propertyType})`);
  else plannedWrites.push(`REUSE  properties(id=${existingPropertyId})`);
  if (titleUpdate === "applied") plannedWrites.push(`UPDATE opportunities(id=${reuseOppId}).title: "${record.opportunityTitle!.expectedCurrent}" → "${record.opportunityTitle!.proposed}"`);
  else if (titleUpdate === "refused_mismatch") plannedWrites.push(`REFUSE title change on opportunities(id=${reuseOppId}) — live title "${liveTitle}" != approved "${record.opportunityTitle!.expectedCurrent}"`);

  const result: ApplyRecordResult = {
    qboEstimateId: record.qboEstimateId,
    estimateNumber: record.estimateNumber,
    customerId: record.customerId,
    salesDoc: salesDocResult,
    opportunity: opportunityResult,
    property: propertyResult,
    titleUpdate,
    customerWrites: 0,
    jobWrites: 0,
    cursorWrites: 0,
    plannedWrites,
    executed: false,
  };

  if (!execute) return result; // DRY RUN — nothing written.

  // 6) Execute — atomically per record. NEVER: customers, jobs, cursor.
  await db.transaction(async (tx) => {
    // Property (create or reuse).
    let propertyId = existingPropertyId;
    if (propertyId == null) {
      const [insP] = await tx.insert(properties).values({
        customerId: record.customerId,
        label: record.property.label,
        addressLine1: record.property.addressLine1,
        city: record.property.city,
        state: record.property.state,
        zip: record.property.zip,
        propertyType: record.property.propertyType,
        isPrimary: false,
      });
      propertyId = Number((insP as { insertId?: number }).insertId);
    }

    // Opportunity (create or reuse).
    let opportunityId = reuseOppId;
    if (opportunityId == null) {
      const stage = mapDocStatusToStage(mapped.status ?? "pending", mapped.sentAt ?? null);
      const [insO] = await tx.insert(opportunities).values({
        customerId: record.customerId,
        title: `PDC LLC — Estimate ${record.estimateNumber}`,
        source: "quickbooks",
        stage,
        amount: mapped.totalAmount as string,
        workCategory: "commercial",
        closedAt: stage === "won" || stage === "lost" ? now : null,
      });
      opportunityId = Number((insO as { insertId?: number }).insertId);
      await tx.insert(opportunityEvents).values({
        opportunityId,
        type: "created",
        message: `Opportunity created from PDC allowlist apply (estimate ${record.estimateNumber}).`,
      });
    }

    // Sales document (insert or reuse; status preserved on reuse).
    let docId: number;
    if (existingDoc) {
      docId = existingDoc.id;
      // Ensure the link only; do NOT rewrite status (preserve).
      await tx.update(quickbooksSalesDocuments).set({ customerId: record.customerId, opportunityId }).where(eq(quickbooksSalesDocuments.id, docId));
    } else {
      const [insD] = await tx.insert(quickbooksSalesDocuments).values({ ...mapped, customerId: record.customerId, opportunityId });
      docId = Number((insD as { insertId?: number }).insertId);
      await tx.insert(opportunityEvents).values({
        opportunityId,
        type: "doc_synced",
        message: `Synced estimate ${record.estimateNumber} (PDC allowlist apply).`,
      });
    }

    // Point the opportunity at its primary sales-doc (first wins).
    await tx
      .update(opportunities)
      .set({ quickbooksSalesDocumentId: docId })
      .where(and(eq(opportunities.id, opportunityId), sql`${opportunities.quickbooksSalesDocumentId} IS NULL`));

    // Gated title update — only on exact live-title match.
    if (titleUpdate === "applied") {
      await tx.update(opportunities).set({ title: record.opportunityTitle!.proposed }).where(eq(opportunities.id, opportunityId));
    }
  });

  result.executed = true;
  return result;
}

/**
 * Apply the PDC allowlist. Refuses unless the exact allowlist is passed. Dry-run
 * by default (writes nothing). NEVER creates customers/jobs, never moves the cursor.
 */
export async function applyPdcAllowlist(opts: ApplyOptions, deps: ApplyDeps): Promise<ApplyResult> {
  assertAllowlist(opts.allowlist, opts.records);
  const execute = opts.execute === true;

  const records: ApplyRecordResult[] = [];
  for (const record of opts.records) {
    records.push(await processRecord(deps, record, execute));
  }

  const totals = {
    salesDocsInserted: records.filter(r => r.salesDoc === "inserted" && r.executed).length,
    opportunitiesCreated: records.filter(r => r.opportunity === "created" && r.executed).length,
    propertiesCreated: records.filter(r => r.property === "created" && r.executed).length,
    customerWrites: 0 as const,
    jobWrites: 0 as const,
    cursorWrites: 0 as const,
  };
  return { ok: true, dryRun: !execute, records, totals };
}

/** The two approved PDC records, ready to pass as `opts.records`. */
export const PDC_APPROVED_RECORDS: AllowlistRecord[] = [
  {
    qboEstimateId: "2545",
    estimateNumber: "2141",
    customerId: 9,
    projectReference: "PN#135",
    mode: "import",
    property: {
      addressLine1: "457-461 Washington St",
      city: "Newark",
      state: "NJ",
      zip: null,
      propertyType: "commercial",
      label: "PN#135 — 457-461 Washington St",
    },
  },
  {
    qboEstimateId: "3314",
    estimateNumber: "2160",
    customerId: 9,
    projectReference: "York Ave",
    mode: "reuse",
    reuseOpportunityId: 20,
    property: {
      addressLine1: "10 York Ave",
      city: "West Caldwell",
      state: "NJ",
      zip: "07006",
      propertyType: "commercial",
      label: "York Ave — 10 York Ave",
    },
    // Title cleanup left unset until the exact before/after is approved (see report).
  },
];
