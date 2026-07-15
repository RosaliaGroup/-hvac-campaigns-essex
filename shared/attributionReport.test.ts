import { describe, it, expect } from "vitest";
import {
  buildRevenueAttribution,
  attributeOpportunity,
  type LeadTouch,
  type WonOpportunity,
} from "./attributionReport";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000; // fixed clock

function lead(p: Partial<LeadTouch> & { id: number }): LeadTouch {
  return {
    id: p.id,
    customerId: p.customerId ?? null,
    channel: p.channel ?? "organic",
    landingPath: p.landingPath ?? "/hvac-newark-nj",
    captureType: p.captureType ?? "quick_quote",
    createdAt: p.createdAt ?? T0,
  };
}
function won(p: Partial<WonOpportunity> & { id: number }): WonOpportunity {
  return {
    id: p.id,
    customerId: p.customerId ?? null,
    sourceLeadCaptureId: p.sourceLeadCaptureId ?? null,
    amount: p.amount ?? 1000,
    wonAt: p.wonAt ?? T0,
  };
}

describe("attributeOpportunity — tiers & guards", () => {
  const mkMaps = (leads: LeadTouch[]) => {
    const byId = new Map(leads.map(l => [l.id, l]));
    const byCust = new Map<number, LeadTouch[]>();
    for (const l of leads) if (l.customerId != null) byCust.set(l.customerId, [...(byCust.get(l.customerId) ?? []), l]);
    return { byId, byCust };
  };

  it("confirmed: explicit sourceLeadCaptureId wins even against the window", () => {
    const leads = [lead({ id: 1, customerId: 5, channel: "paid", landingPath: "/lp-heat-pump" })];
    const { byId, byCust } = mkMaps(leads);
    const a = attributeOpportunity(won({ id: 9, customerId: 5, sourceLeadCaptureId: 1, amount: 4000 }), byCust, byId, 180 * DAY);
    expect(a.tier).toBe("confirmed");
    expect(a.channel).toBe("paid");
    expect(a.landingPath).toBe("/lp-heat-pump");
    expect(a.amount).toBe(4000);
  });

  it("QBO-origin deal with no link and no matching lead → unattributed (not credited to organic)", () => {
    const leads: LeadTouch[] = [];
    const { byId, byCust } = mkMaps(leads);
    const a = attributeOpportunity(won({ id: 9, customerId: 5, amount: 12000 }), byCust, byId, 180 * DAY);
    expect(a.tier).toBe("unattributed");
    expect(a.channel).toBeNull();
  });

  it("PREVENTS lifetime over-attribution: a lead cannot claim a deal outside the window", () => {
    const leads = [lead({ id: 1, customerId: 5, createdAt: T0 })];
    const { byId, byCust } = mkMaps(leads);
    // Deal won 2 years after the lead — well outside a 180-day window.
    const a = attributeOpportunity(won({ id: 9, customerId: 5, wonAt: T0 + 730 * DAY }), byCust, byId, 180 * DAY);
    expect(a.tier).toBe("unattributed");
  });

  it("PREVENTS backward attribution: a deal won BEFORE the lead is never attributed to it", () => {
    const leads = [lead({ id: 1, customerId: 5, createdAt: T0 })];
    const { byId, byCust } = mkMaps(leads);
    const a = attributeOpportunity(won({ id: 9, customerId: 5, wonAt: T0 - 10 * DAY }), byCust, byId, 180 * DAY);
    expect(a.tier).toBe("unattributed");
  });

  it("inferred: within-window customer match, last touch wins", () => {
    const leads = [
      lead({ id: 1, customerId: 5, createdAt: T0, channel: "organic", landingPath: "/a" }),
      lead({ id: 2, customerId: 5, createdAt: T0 + 10 * DAY, channel: "social", landingPath: "/b" }),
    ];
    const { byId, byCust } = mkMaps(leads);
    const a = attributeOpportunity(won({ id: 9, customerId: 5, wonAt: T0 + 20 * DAY }), byCust, byId, 180 * DAY);
    expect(a.tier).toBe("inferred");
    expect(a.leadCaptureId).toBe(2); // most recent preceding touch
    expect(a.channel).toBe("social");
  });

  it("inference disabled (window 0) → unattributed even with a customer match", () => {
    const leads = [lead({ id: 1, customerId: 5 })];
    const { byId, byCust } = mkMaps(leads);
    const a = attributeOpportunity(won({ id: 9, customerId: 5, wonAt: T0 + DAY }), byCust, byId, 0);
    expect(a.tier).toBe("unattributed");
  });

  it("dangling explicit link (lead row missing) → unattributed, never a different lead", () => {
    const leads = [lead({ id: 2, customerId: 5 })];
    const { byId, byCust } = mkMaps(leads);
    const a = attributeOpportunity(won({ id: 9, customerId: 5, sourceLeadCaptureId: 999 }), byCust, byId, 180 * DAY);
    expect(a.tier).toBe("unattributed");
  });
});

describe("buildRevenueAttribution — report shape & honesty", () => {
  it("keeps confirmed, inferred, and unattributed revenue strictly separate", () => {
    const leads = [
      lead({ id: 1, customerId: 5, channel: "organic", landingPath: "/hvac-newark-nj" }),
      lead({ id: 2, customerId: 6, channel: "paid", landingPath: "/lp-heat-pump", createdAt: T0 }),
    ];
    const opps = [
      won({ id: 10, customerId: 5, sourceLeadCaptureId: 1, amount: 5000 }), // confirmed → organic
      won({ id: 11, customerId: 6, amount: 3000, wonAt: T0 + 5 * DAY }), // inferred → paid
      won({ id: 12, customerId: 99, amount: 20000 }), // QBO, no lead → unattributed
    ];
    const report = buildRevenueAttribution(leads, opps, [], { inferenceWindowDays: 180 });

    expect(report.totals.confirmedRevenue).toBe(5000);
    expect(report.totals.inferredRevenue).toBe(3000);
    expect(report.totals.unattributedRevenue).toBe(20000);
    expect(report.totals.attributedRevenue).toBe(5000); // headline = confirmed only
    expect(report.unattributed).toEqual({ wonCount: 1, revenue: 20000 });

    const organic = report.byChannel.find(b => b.key === "organic")!;
    expect(organic.confirmedRevenue).toBe(5000);
    expect(organic.inferredRevenue).toBe(0);
    const paid = report.byChannel.find(b => b.key === "paid")!;
    expect(paid.inferredRevenue).toBe(3000);
    expect(paid.confirmedRevenue).toBe(0);
  });

  it("total revenue is conserved: confirmed + inferred + unattributed == sum of won amounts", () => {
    const leads = [lead({ id: 1, customerId: 5 })];
    const opps = [
      won({ id: 10, customerId: 5, sourceLeadCaptureId: 1, amount: 1111 }),
      won({ id: 11, customerId: 5, amount: 2222, wonAt: T0 + DAY }),
      won({ id: 12, customerId: 77, amount: 3333 }),
    ];
    const r = buildRevenueAttribution(leads, opps, [], { inferenceWindowDays: 180 });
    const total = r.totals.confirmedRevenue + r.totals.inferredRevenue + r.totals.unattributedRevenue;
    expect(total).toBe(1111 + 2222 + 3333);
  });

  it("NO DOUBLE-COUNTING: every won opp lands in exactly one tier, counts reconcile", () => {
    const leads = [
      lead({ id: 1, customerId: 5, channel: "organic" }),
      lead({ id: 2, customerId: 6, channel: "paid", createdAt: T0 }),
    ];
    const opps = [
      won({ id: 10, customerId: 5, sourceLeadCaptureId: 1, amount: 100 }), // confirmed
      won({ id: 11, customerId: 6, amount: 200, wonAt: T0 + 5 * DAY }), // inferred
      won({ id: 12, customerId: 6, amount: 300, wonAt: T0 + 5 * DAY }), // inferred (same lead, distinct opp)
      won({ id: 13, customerId: 99, amount: 400 }), // unattributed
    ];
    const r = buildRevenueAttribution(leads, opps, [], { inferenceWindowDays: 180 });

    // Each attribution decision is for a distinct opportunity, one tier each.
    expect(r.attributions).toHaveLength(4);
    expect(new Set(r.attributions.map(a => a.opportunityId)).size).toBe(4);

    const confirmedWon = r.byChannel.reduce((s, b) => s + b.confirmedWon, 0);
    const inferredWon = r.byChannel.reduce((s, b) => s + b.inferredWon, 0);
    expect(confirmedWon + inferredWon + r.unattributed.wonCount).toBe(opps.length); // 4, no double count
    // Revenue also reconciles exactly to the sum of amounts.
    const totalRev = r.totals.confirmedRevenue + r.totals.inferredRevenue + r.totals.unattributedRevenue;
    expect(totalRev).toBe(100 + 200 + 300 + 400);
  });

  it("UNKNOWN preserved: unknown-channel leads are not reclassified as organic", () => {
    const leads = [lead({ id: 1, channel: "unknown", landingPath: "/x" })];
    const r = buildRevenueAttribution(leads, [], []);
    expect(r.byChannel.find(b => b.key === "unknown")!.leads).toBe(1);
    expect(r.byChannel.find(b => b.key === "organic")!.leads).toBe(0);
  });

  it("joins organic clicks to pages by normalized path (case/trailing-slash insensitive)", () => {
    const leads = [lead({ id: 1, channel: "organic", landingPath: "https://site.com/HVAC-Newark-NJ/" })];
    const traffic = [{ page: "/hvac-newark-nj", clicks: 240, impressions: 5000 }];
    const r = buildRevenueAttribution(leads, [], traffic);
    const bucket = r.byPage.find(b => b.key === "/hvac-newark-nj")!;
    expect(bucket).toBeTruthy();
    expect(bucket.organicClicks).toBe(240);
    expect(bucket.leads).toBe(1);
  });

  it("counts qualified leads and the trailing-7-day weekly metric vs the 20 goal", () => {
    const leads = [
      lead({ id: 1, createdAt: T0, captureType: "quick_quote" }),
      lead({ id: 2, createdAt: T0 - 2 * DAY, captureType: "newsletter" }), // not qualified
      lead({ id: 3, createdAt: T0 - 30 * DAY, captureType: "qualify_form" }), // outside 7d
    ];
    const r = buildRevenueAttribution(leads, [], [], { nowMs: T0, weeklyLeadGoal: 20 });
    expect(r.totals.leads).toBe(3);
    expect(r.totals.qualifiedLeads).toBe(2);
    expect(r.weekly).toEqual({ qualifiedLeadsLast7Days: 1, goal: 20, metGoal: false });
  });
});
