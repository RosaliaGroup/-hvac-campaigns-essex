import { describe, it, expect } from "vitest";
import {
  suggestMatches,
  type MatchCapture,
  type MatchOpportunity,
  type MatchCustomer,
} from "./attributionMatch";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

function cap(p: Partial<MatchCapture> & { id: number }): MatchCapture {
  return {
    id: p.id,
    customerId: p.customerId ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    createdAt: p.createdAt ?? T0,
    channel: p.channel ?? "organic",
    landingPath: p.landingPath ?? "/hvac-newark-nj",
    captureType: p.captureType ?? "quick_quote",
  };
}
function opp(p: Partial<MatchOpportunity> & { id: number }): MatchOpportunity {
  return {
    id: p.id,
    customerId: p.customerId ?? null,
    sourceLeadCaptureId: p.sourceLeadCaptureId ?? null,
    amount: p.amount ?? 1000,
    wonAt: p.wonAt ?? T0 + 10 * DAY,
    title: p.title ?? "Deal",
  };
}
function cust(p: Partial<MatchCustomer> & { id: number }): MatchCustomer {
  return { id: p.id, convertedFromCaptureId: p.convertedFromCaptureId ?? null, email: p.email ?? null, phone: p.phone ?? null };
}

describe("suggestMatches — confidence & guards", () => {
  it("HIGH: provenance (convertedFromCaptureId) within window", () => {
    const captures = [cap({ id: 1, customerId: 5, createdAt: T0 })];
    const opps = [opp({ id: 9, customerId: 5, wonAt: T0 + 5 * DAY })];
    const customers = [cust({ id: 5, convertedFromCaptureId: 1 })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].confidence).toBe("high");
    expect(r.suggestions[0].leadCaptureId).toBe(1);
    expect(r.suggestions[0].rationale[0]).toMatch(/provenance/i);
  });

  it("MEDIUM: conversion link (capture.customerId === opp.customerId) with no provenance", () => {
    const captures = [cap({ id: 2, customerId: 5, createdAt: T0 })];
    const opps = [opp({ id: 9, customerId: 5, wonAt: T0 + 3 * DAY })];
    const customers = [cust({ id: 5 })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions[0].confidence).toBe("medium");
  });

  it("LOW: email/phone identity match only, no conversion link", () => {
    const captures = [cap({ id: 3, customerId: null, email: "JANE@x.com", createdAt: T0 })];
    const opps = [opp({ id: 9, customerId: 5, wonAt: T0 + 2 * DAY })];
    const customers = [cust({ id: 5, email: "jane@x.com" })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions[0].confidence).toBe("low");
    expect(r.suggestions[0].rationale[0]).toMatch(/email/i);
  });

  it("provenance outranks a conversion capture for the same opportunity", () => {
    const captures = [
      cap({ id: 1, customerId: 5, createdAt: T0 }), // provenance target
      cap({ id: 2, customerId: 5, createdAt: T0 + 1 * DAY }), // later conversion capture
    ];
    const opps = [opp({ id: 9, customerId: 5, wonAt: T0 + 5 * DAY })];
    const customers = [cust({ id: 5, convertedFromCaptureId: 1 })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions[0].confidence).toBe("high");
    expect(r.suggestions[0].leadCaptureId).toBe(1);
    expect(r.suggestions[0].otherCandidateCount).toBe(1);
  });

  it("SKIPS opportunities that already have an explicit link (direct link overrides)", () => {
    const captures = [cap({ id: 1, customerId: 5 })];
    const opps = [opp({ id: 9, customerId: 5, sourceLeadCaptureId: 1 })];
    const customers = [cust({ id: 5, convertedFromCaptureId: 1 })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions).toHaveLength(0);
    expect(r.alreadyLinkedCount).toBe(1);
  });

  it("TIMING: a capture after the win is never suggested", () => {
    const captures = [cap({ id: 1, customerId: 5, createdAt: T0 + 20 * DAY })];
    const opps = [opp({ id: 9, customerId: 5, wonAt: T0 + 10 * DAY })];
    const customers = [cust({ id: 5, convertedFromCaptureId: 1 })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions).toHaveLength(0);
    expect(r.unmatchedCount).toBe(1);
  });

  it("TIMING: a capture outside the window is never suggested", () => {
    const captures = [cap({ id: 1, customerId: 5, createdAt: T0 })];
    const opps = [opp({ id: 9, customerId: 5, wonAt: T0 + 400 * DAY })];
    const customers = [cust({ id: 5, convertedFromCaptureId: 1 })];
    const r = suggestMatches(opps, captures, customers, { windowDays: 180 });
    expect(r.suggestions).toHaveLength(0);
  });

  it("unmatched when the customer has no candidate capture at all", () => {
    const r = suggestMatches([opp({ id: 9, customerId: 5 })], [], [cust({ id: 5 })]);
    expect(r.suggestions).toHaveLength(0);
    expect(r.unmatchedCount).toBe(1);
  });

  it("orders the review queue by confidence then amount", () => {
    const captures = [
      cap({ id: 1, customerId: 5, createdAt: T0 }),
      cap({ id: 2, customerId: 6, createdAt: T0 }),
    ];
    const opps = [
      opp({ id: 91, customerId: 6, amount: 9000, wonAt: T0 + 2 * DAY }), // medium, big
      opp({ id: 92, customerId: 5, amount: 100, wonAt: T0 + 2 * DAY }), // high, small
    ];
    const customers = [cust({ id: 5, convertedFromCaptureId: 1 }), cust({ id: 6 })];
    const r = suggestMatches(opps, captures, customers);
    expect(r.suggestions.map(s => s.confidence)).toEqual(["high", "medium"]); // high first despite smaller amount
  });
});
