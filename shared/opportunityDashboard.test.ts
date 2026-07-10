import { describe, it, expect } from "vitest";
import {
  agingBucket,
  compareOpportunities,
  computeOverview,
  effectiveProbability,
  filterOpportunities,
  filteredTotals,
  isFollowUpDue,
  matchesFilters,
  matchesSearch,
  relationshipForOpportunity,
  sortOpportunities,
  valueDiffersFromQuickbooks,
  weightedValue,
  type OpportunityRow,
} from "./opportunityDashboard";

// Local-time clock so month math matches the helper's local getMonth().
const NOW = new Date(2026, 6, 10, 12, 0, 0); // 2026-07-10

function row(over: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: 1,
    stage: "pending",
    amount: 1000,
    probability: null,
    quickbooksAmount: 1000,
    workCategory: "residential",
    docStatus: "pending",
    docType: "estimate",
    docTypeLabel: "Estimate",
    assignedToId: 7,
    customerName: "Jane Homeowner",
    companyName: null,
    email: "jane@example.com",
    phone: "(973) 555-0100",
    docNumber: "1042",
    title: "Furnace replacement",
    daysPending: 5,
    sentAt: new Date(2026, 6, 5),
    txnDate: new Date(2026, 6, 4),
    createdAt: new Date(2026, 6, 1),
    nextActionDueAt: new Date(2026, 6, 10, 9, 0, 0),
    closedAt: null,
    ...over,
  };
}

describe("weighted value + probability", () => {
  it("uses explicit probability when present", () => {
    expect(weightedValue(row({ amount: 2000, probability: 25 }))).toBe(500);
  });
  it("falls back to the stage default probability", () => {
    // pending default = 50%
    expect(effectiveProbability(row({ probability: null, stage: "pending" }))).toBe(50);
    expect(weightedValue(row({ amount: 4000, probability: null, stage: "pending" }))).toBe(2000);
  });
  it("clamps out-of-range probabilities", () => {
    expect(effectiveProbability(row({ probability: 250 }))).toBe(100);
    expect(effectiveProbability(row({ probability: -5 }))).toBe(0);
  });
});

describe("CRM value vs QuickBooks amount", () => {
  it("flags an override that differs from the QBO amount", () => {
    expect(valueDiffersFromQuickbooks(row({ amount: 1200, quickbooksAmount: 1000 }))).toBe(true);
  });
  it("is not flagged when equal or when there is no QBO document", () => {
    expect(valueDiffersFromQuickbooks(row({ amount: 1000, quickbooksAmount: 1000 }))).toBe(false);
    expect(valueDiffersFromQuickbooks(row({ amount: 1000, quickbooksAmount: null }))).toBe(false);
  });
});

describe("aging buckets", () => {
  it("bucket boundaries", () => {
    expect(agingBucket(0)).toBe("0-3");
    expect(agingBucket(3)).toBe("0-3");
    expect(agingBucket(4)).toBe("4-7");
    expect(agingBucket(7)).toBe("4-7");
    expect(agingBucket(8)).toBe("8-14");
    expect(agingBucket(14)).toBe("8-14");
    expect(agingBucket(15)).toBe("15+");
    expect(agingBucket(null)).toBeNull();
  });
});

describe("search (requirement 2)", () => {
  it("matches customer, company, phone, email, doc number, service, amount, opp number", () => {
    const r = row({ id: 42, companyName: "Acme LLC", amount: 12500 });
    expect(matchesSearch(r, "jane")).toBe(true); // customer name
    expect(matchesSearch(r, "acme")).toBe(true); // company
    expect(matchesSearch(r, "555-0100")).toBe(true); // phone
    expect(matchesSearch(r, "jane@example")).toBe(true); // email
    expect(matchesSearch(r, "1042")).toBe(true); // doc number
    expect(matchesSearch(r, "furnace")).toBe(true); // requested service
    expect(matchesSearch(r, "12500")).toBe(true); // amount
    expect(matchesSearch(r, "OPP-42")).toBe(true); // opportunity number
    expect(matchesSearch(r, "nonsense")).toBe(false);
    expect(matchesSearch(r, "")).toBe(true); // empty = match all
  });
});

describe("combined filters (requirement 4)", () => {
  const rows = [
    row({ id: 1, workCategory: "residential", stage: "pending", amount: 1000, assignedToId: 7, daysPending: 2 }),
    row({ id: 2, workCategory: "commercial", stage: "proposal_sent", amount: 8000, assignedToId: 9, daysPending: 10 }),
    row({ id: 3, workCategory: "change_order", stage: "won", amount: 5000, assignedToId: 7, daysPending: 20, closedAt: new Date(2026, 6, 8) }),
  ];
  it("applies multiple filters conjunctively", () => {
    const out = filterOpportunities(rows, { workCategory: ["residential", "commercial"], assignedToId: [9], amountMin: 5000 }, NOW);
    expect(out.map(r => r.id)).toEqual([2]);
  });
  it("filters by won/lost/open and aging bucket", () => {
    expect(filterOpportunities(rows, { wonLostOpen: ["open"] }, NOW).map(r => r.id)).toEqual([1, 2]);
    expect(filterOpportunities(rows, { agingBucket: ["15+"] }, NOW).map(r => r.id)).toEqual([3]);
  });
  it("filters by amount range and stage together", () => {
    const out = filterOpportunities(rows, { stage: ["pending", "proposal_sent"], amountMax: 2000 }, NOW);
    expect(out.map(r => r.id)).toEqual([1]);
  });
  it("follow-up-due filter respects open + due date", () => {
    const due = row({ id: 10, stage: "pending", nextActionDueAt: new Date(2026, 6, 10, 8) });
    const future = row({ id: 11, stage: "pending", nextActionDueAt: new Date(2026, 6, 20) });
    const closed = row({ id: 12, stage: "won", nextActionDueAt: new Date(2026, 6, 1) });
    expect(isFollowUpDue(due, NOW)).toBe(true);
    expect(isFollowUpDue(future, NOW)).toBe(false);
    expect(isFollowUpDue(closed, NOW)).toBe(false);
    expect(filterOpportunities([due, future, closed], { followUpDue: true }, NOW).map(r => r.id)).toEqual([10]);
  });
});

describe("sorting (requirement 3)", () => {
  const rows = [
    row({ id: 1, amount: 3000, daysPending: 5 }),
    row({ id: 2, amount: 1000, daysPending: 20 }),
    row({ id: 3, amount: 2000, daysPending: 1 }),
  ];
  it("sorts by amount asc/desc", () => {
    expect(sortOpportunities(rows, "amount", "asc").map(r => r.id)).toEqual([2, 3, 1]);
    expect(sortOpportunities(rows, "amount", "desc").map(r => r.id)).toEqual([1, 3, 2]);
  });
  it("sorts by days pending", () => {
    expect(sortOpportunities(rows, "daysPending", "desc").map(r => r.id)).toEqual([2, 1, 3]);
  });
  it("is stable on ties via id", () => {
    const tied = [row({ id: 5, amount: 100 }), row({ id: 2, amount: 100 })];
    expect(compareOpportunities(tied[0], tied[1], "amount", "asc")).toBeGreaterThan(0);
  });
});

describe("filtered totals (requirement 7)", () => {
  it("sums value, weighted value, and QBO total across the filtered set", () => {
    const rows = [
      row({ id: 1, amount: 1000, probability: 50, quickbooksAmount: 1000 }),
      row({ id: 2, amount: 2000, probability: 25, quickbooksAmount: 1800 }),
    ];
    const t = filteredTotals(rows);
    expect(t.count).toBe(2);
    expect(t.totalValue).toBe(3000);
    expect(t.weightedValue).toBe(1000); // 500 + 500
    expect(t.quickbooksTotal).toBe(2800);
  });
});

describe("overview KPIs (requirement 1)", () => {
  const rows = [
    row({ id: 1, stage: "pending", amount: 1000, probability: 50, workCategory: "residential", daysPending: 2 }),
    row({ id: 2, stage: "proposal_sent", amount: 4000, probability: 25, workCategory: "commercial", daysPending: 10, sentAt: null }),
    row({ id: 3, stage: "new", amount: 2000, probability: null, workCategory: "change_order", daysPending: 20 }),
    row({ id: 4, stage: "won", amount: 6000, workCategory: "residential", closedAt: new Date(2026, 6, 6), createdAt: new Date(2026, 5, 27) }),
    row({ id: 5, stage: "lost", amount: 1500, workCategory: "commercial", closedAt: new Date(2026, 6, 3) }),
    row({ id: 6, stage: "won", amount: 4000, workCategory: "commercial", closedAt: new Date(2026, 4, 20), createdAt: new Date(2026, 4, 10) }),
  ];
  const m = computeOverview(rows, NOW);

  it("open + weighted pipeline over open stages only", () => {
    expect(m.openPipeline).toBe(7000); // 1000 + 4000 + 2000
    // weighted: 1000*0.5 + 4000*0.25 + 2000*0.1(new default) = 500 + 1000 + 200
    expect(m.weightedPipeline).toBe(1700);
  });
  it("pipeline by stage and category totals", () => {
    expect(m.pipelineByStage.pending).toBe(1000);
    expect(m.pipelineByStage.won).toBe(10000);
    expect(m.categoryTotals.residential).toBe(1000); // only open residential (#1)
    expect(m.categoryTotals.commercial).toBe(4000); // only open commercial (#2)
    expect(m.categoryTotals.change_order).toBe(2000);
  });
  it("won/lost this month, close rate, avg ticket, avg days to close", () => {
    expect(m.wonThisMonth).toBe(1); // #4 (July); #6 was May
    expect(m.lostThisMonth).toBe(1); // #5
    expect(m.closeRate).toBe(0.67); // 2 won / 3 closed
    expect(m.averageTicket).toBe(5000); // (6000 + 4000)/2
    expect(m.averageDaysToClose).toBe(10); // (#4: 9 days, #6: 10 days) -> 9.5 -> round -> 10
  });
  it("aging buckets over open opportunities", () => {
    expect(m.agingBuckets["0-3"].count).toBe(1);
    expect(m.agingBuckets["8-14"].count).toBe(1);
    expect(m.agingBuckets["15+"].count).toBe(1);
    expect(m.agingBuckets["0-3"].amount).toBe(1000);
  });
});

describe("relationship lifecycle (requirement 8)", () => {
  it("accepted document => Customer", () => {
    expect(relationshipForOpportunity({ stage: "won", docStatus: "accepted" })).toBe("customer");
  });
  it("pending/sent document => Prospect", () => {
    expect(relationshipForOpportunity({ stage: "pending", docStatus: "pending" })).toBe("prospect");
  });
});
