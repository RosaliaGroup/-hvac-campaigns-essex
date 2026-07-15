import { describe, it, expect } from "vitest";
import { computeSyncWindow, ga4RowHash } from "./sync";
import type { Ga4ReportRow } from "../../integrations/ga4";

describe("computeSyncWindow", () => {
  it("produces an inclusive window ending today (UTC)", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    expect(computeSyncWindow(now, 90)).toEqual({ start: "2026-04-16", end: "2026-07-14" });
  });
  it("honours a custom window length", () => {
    const now = new Date("2026-07-14T00:00:00Z");
    expect(computeSyncWindow(now, 7)).toEqual({ start: "2026-07-08", end: "2026-07-14" });
  });
});

describe("ga4RowHash", () => {
  const row: Ga4ReportRow = {
    date: "2026-07-14",
    source: "google",
    medium: "organic",
    campaign: "(organic)",
    landingPage: "/",
    channelGroup: "Organic Search",
    pageViews: 1,
    sessions: 1,
    users: 1,
    conversions: 0,
    events: 1,
  };

  it("is deterministic for the same dimension tuple", () => {
    expect(ga4RowHash("p1", row)).toBe(ga4RowHash("p1", row));
  });

  it("changes when any dimension (or property) changes", () => {
    const base = ga4RowHash("p1", row);
    expect(ga4RowHash("p2", row)).not.toBe(base);
    expect(ga4RowHash("p1", { ...row, medium: "cpc" })).not.toBe(base);
    expect(ga4RowHash("p1", { ...row, landingPage: "/other" })).not.toBe(base);
  });

  it("ignores metric values (hash is keyed on dimensions only)", () => {
    expect(ga4RowHash("p1", { ...row, sessions: 999, conversions: 5 })).toBe(ga4RowHash("p1", row));
  });
});
