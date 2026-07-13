/**
 * Pure assembly of a customer's QuickBooks-related records for the 360° profile.
 *
 * The DB layer (customers.getById) fetches the raw rows; this module deduplicates
 * and cross-links them so the profile can show Opportunities, Estimates/Proposals,
 * Invoices and Jobs with their project reference and QuickBooks references. Kept
 * pure (no DB) so the linkage/dedup/count logic is unit-tested directly.
 *
 * READ-ONLY: nothing here writes; `quickbooksCustomerId` is never mutated.
 */

export interface RelOpportunity {
  id: number;
  title: string;
  stage: string;
  amount: string | null;
  projectReference: string | null;
  quickbooksSalesDocumentId: number | null;
  createdAt: Date | string | null;
  closedAt: Date | string | null;
}

export interface RelSalesDoc {
  id: number;
  docType: "estimate" | "invoice";
  docNumber: string | null;
  quickbooksId: string;
  quickbooksCustomerId: string | null;
  customerId: number | null;
  opportunityId: number | null;
  status: string;
  totalAmount: string;
  txnDate: Date | string | null;
}

export interface RelJob {
  id: number;
  jobNumber: string;
  title: string;
  status: string;
  propertyId: number | null;
  quickbooksEstimateId: string | null;
  quickbooksInvoiceId: string | null;
  createdAt: Date | string | null;
}

export interface AssembleInput {
  opportunities: RelOpportunity[];
  /** May contain the same doc twice (matched by both customerId and QBO ref). */
  salesDocs: RelSalesDoc[];
  jobs: RelJob[];
  propertyCount: number;
}

/** Job statuses that count as still-in-flight work (not finished/cancelled). */
export const ACTIVE_JOB_STATUSES = new Set([
  "new", "scheduled", "in_progress", "waiting_parts", "estimate_sent", "approved",
]);
/** Opportunity stages that are still open (not decided). */
export const OPEN_OPPORTUNITY_STAGES = new Set(["new", "proposal_sent", "pending"]);
/** Sales-doc statuses that still represent money not yet settled. */
const OUTSTANDING_DOC_STATUSES = new Set(["pending", "accepted"]);

function toTime(d: Date | string | null): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}
function maxDate(dates: Array<Date | string | null>): string | null {
  let best = 0;
  for (const d of dates) best = Math.max(best, toTime(d));
  return best > 0 ? new Date(best).toISOString() : null;
}

/** Deduplicate sales docs by primary key, then by QuickBooks document id. */
export function dedupeSalesDocs(docs: RelSalesDoc[]): RelSalesDoc[] {
  const seenId = new Set<number>();
  const seenQbo = new Set<string>();
  const out: RelSalesDoc[] = [];
  for (const d of docs) {
    if (seenId.has(d.id)) continue;
    if (d.quickbooksId && seenQbo.has(d.quickbooksId)) continue;
    seenId.add(d.id);
    if (d.quickbooksId) seenQbo.add(d.quickbooksId);
    out.push(d);
  }
  return out;
}

export function assembleCustomerRelations(input: AssembleInput) {
  const docs = dedupeSalesDocs(input.salesDocs);

  const oppById = new Map(input.opportunities.map((o) => [o.id, o]));
  // First doc that backs each opportunity (reverse link), for the opp's QBO ref.
  const docByOpp = new Map<number, RelSalesDoc>();
  for (const d of docs) {
    if (d.opportunityId != null && !docByOpp.has(d.opportunityId)) docByOpp.set(d.opportunityId, d);
  }

  const opportunities = input.opportunities.map((o) => {
    const doc = docByOpp.get(o.id);
    return {
      ...o,
      /** QBO Estimate.Id backing this opportunity (via the sales-doc reverse link). */
      quickbooksReference: doc?.quickbooksId ?? null,
      documentNumber: doc?.docNumber ?? null,
    };
  });

  const enrichDoc = (d: RelSalesDoc) => {
    const opp = d.opportunityId != null ? oppById.get(d.opportunityId) : undefined;
    return {
      ...d,
      /** Derived from the linked opportunity; never written back to the customer. */
      projectReference: opp?.projectReference ?? null,
      opportunityTitle: opp?.title ?? null,
    };
  };

  const estimates = docs.filter((d) => d.docType === "estimate").map(enrichDoc);
  const invoices = docs.filter((d) => d.docType === "invoice").map(enrichDoc);

  const activeJobs = input.jobs.filter((j) => ACTIVE_JOB_STATUSES.has(j.status)).length;
  const openOpportunities = input.opportunities.filter((o) => OPEN_OPPORTUNITY_STAGES.has(o.stage)).length;
  const lifetimeRevenue = input.opportunities
    .filter((o) => o.stage === "won")
    .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const outstandingBalance = docs
    .filter((d) => OUTSTANDING_DOC_STATUSES.has(d.status))
    .reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  const lastActivityAt = maxDate([
    ...input.opportunities.flatMap((o) => [o.createdAt, o.closedAt]),
    ...docs.map((d) => d.txnDate),
    ...input.jobs.map((j) => j.createdAt),
  ]);

  return {
    opportunities,
    estimates,
    invoices,
    jobs: input.jobs,
    counts: {
      properties: input.propertyCount,
      opportunities: input.opportunities.length,
      jobs: input.jobs.length,
      estimates: estimates.length,
      invoices: invoices.length,
    },
    summary: {
      activeJobs,
      openOpportunities,
      estimates: estimates.length,
      invoices: invoices.length,
      properties: input.propertyCount,
      lifetimeRevenue,
      outstandingBalance,
      lastActivityAt,
    },
  };
}
