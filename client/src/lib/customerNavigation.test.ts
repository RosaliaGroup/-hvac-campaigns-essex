import { describe, it, expect } from "vitest";
import { jobRoute, opportunityRoute, salesDocRoute, customerRoute } from "./customerNavigation";
import {
  assembleCustomerRelations,
  type RelSalesDoc,
  type RelOpportunity,
  type RelJob,
} from "../../../server/routers/customerRelations";

/**
 * End-to-end regression for the customer 360° dashboard: it stitches the
 * server-side relationship assembly (assembleCustomerRelations) to the
 * client-side row-click routing (customerNavigation) — the two halves the
 * profile actually runs — and asserts the whole "records appear → counts are
 * right → each row opens the correct detail page" chain.
 *
 * IMPORTANT DATA NOTE (Marco Weber, customer 23): Marco has ZERO rows in the
 * CRM `jobs` table. QuickBooks sync created 3 *opportunities* + 3 *estimates*
 * for him, not jobs. So Marco's "three jobs" in business terms are, in the
 * data model, his 3 work items (opportunity+estimate pairs). This test locks
 * Marco against that reality — it does NOT fabricate 3 job rows he doesn't
 * have. The jobs-count-card + job-click mechanics are locked separately below
 * with a synthetic customer that genuinely has 3 CRM jobs.
 */

const doc = (over: Partial<RelSalesDoc> = {}): RelSalesDoc => ({
  id: 1, docType: "estimate", docNumber: "1000", quickbooksId: "q1",
  quickbooksCustomerId: "351", customerId: 23, opportunityId: 1,
  status: "pending", totalAmount: "100.00", txnDate: null, ...over,
});
const opp = (over: Partial<RelOpportunity> = {}): RelOpportunity => ({
  id: 1, title: "Opp", stage: "won", amount: "0.00", projectReference: null,
  quickbooksSalesDocumentId: null, createdAt: null, closedAt: null, ...over,
});
const job = (over: Partial<RelJob> = {}): RelJob => ({
  id: 1, jobNumber: "J-1000", title: "Job", status: "in_progress",
  propertyId: null, quickbooksEstimateId: null, quickbooksInvoiceId: null,
  createdAt: null, ...over,
});

describe("customer dashboard E2E — Marco (customer 23) three work items", () => {
  const marco = assembleCustomerRelations({
    propertyCount: 1,
    jobs: [],
    opportunities: [
      opp({ id: 22, title: "Estimate 2164", stage: "proposal_sent", amount: "21579.00" }),
      opp({ id: 25, title: "Estimate 2163", stage: "proposal_sent", amount: "21579.00" }),
      opp({ id: 26, title: "Estimate 2162", stage: "pending", amount: "25000.00" }),
    ],
    salesDocs: [
      doc({ id: 22, quickbooksId: "3341", docNumber: "2164-B", opportunityId: 22, status: "pending", totalAmount: "21579.00" }),
      doc({ id: 25, quickbooksId: "3340", docNumber: "2163-2", opportunityId: 25, status: "pending", totalAmount: "21579.00" }),
      doc({ id: 26, quickbooksId: "3339", docNumber: "2162-1", opportunityId: 26, status: "accepted", totalAmount: "23979.00" }),
    ],
  });

  it("profile shows Marco's 3 work items (3 opportunities, 3 estimates)", () => {
    expect(marco.opportunities).toHaveLength(3);
    expect(marco.estimates).toHaveLength(3);
  });

  it("the header counts read 3 opportunities / 3 estimates / 0 jobs", () => {
    // These are the exact values the profile binds to its tab labels/cards.
    expect(marco.counts.opportunities).toBe(3);
    expect(marco.counts.estimates).toBe(3);
    expect(marco.counts.jobs).toBe(0);
  });

  it("clicking each of Marco's 3 work-item rows opens the correct opportunity detail", () => {
    expect(marco.opportunities.map(o => opportunityRoute(o)).sort()).toEqual([
      "/opportunities/22", "/opportunities/25", "/opportunities/26",
    ]);
  });

  it("each estimate row opens the opportunity that backs it (no dead links)", () => {
    expect(marco.estimates.map(d => salesDocRoute(d)).sort()).toEqual([
      "/opportunities/22", "/opportunities/25", "/opportunities/26",
    ]);
  });
});

describe("customer dashboard — jobs count card + job-click mechanics (3-job fixture)", () => {
  // A customer who genuinely has 3 CRM jobs, all active — the case Marco is NOT.
  const withJobs = assembleCustomerRelations({
    propertyCount: 0,
    opportunities: [],
    salesDocs: [],
    jobs: [
      job({ id: 101, jobNumber: "J-101", status: "scheduled" }),
      job({ id: 102, jobNumber: "J-102", status: "in_progress" }),
      job({ id: 103, jobNumber: "J-103", status: "waiting_parts" }),
    ],
  });

  it("the jobs count card shows 3 (counts.jobs and summary.activeJobs both = 3)", () => {
    // counts.jobs backs the "Jobs (n)" tab label; summary.activeJobs backs the
    // "Active Jobs" summary card. Both are the numbers the dashboard renders.
    expect(withJobs.counts.jobs).toBe(3);
    expect(withJobs.summary.activeJobs).toBe(3);
  });

  it("clicking each job row opens the correct job detail page", () => {
    expect(withJobs.jobs.map(j => jobRoute(j))).toEqual([
      "/jobs/101", "/jobs/102", "/jobs/103",
    ]);
  });
});

describe("customerNavigation — route resolvers", () => {
  it("salesDocRoute returns null for an unlinked document (row stays non-navigable)", () => {
    expect(salesDocRoute({ opportunityId: null })).toBeNull();
    expect(salesDocRoute({ opportunityId: 7 })).toBe("/opportunities/7");
  });
  it("customerRoute points back at the customer profile", () => {
    expect(customerRoute({ id: 23 })).toBe("/customers/23");
  });
});
