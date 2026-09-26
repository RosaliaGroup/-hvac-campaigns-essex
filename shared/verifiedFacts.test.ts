import { describe, it, expect } from "vitest";
import { VERIFIED_FACTS, isFactsConfigured } from "./verifiedFacts";
import { SERVICE_TYPES } from "./appointmentTypes";
import { NJ_COUNTIES } from "../client/src/data/njCounties";

describe("VERIFIED_FACTS", () => {
  it("has no fabricated address or founding year", () => {
    expect(VERIFIED_FACTS.business.address).toBeNull();
    expect(VERIFIED_FACTS.business.founded).toBeNull();
  });

  it("starts with empty owner-maintained arrays — nothing invented", () => {
    expect(VERIFIED_FACTS.incentives).toEqual([]);
    expect(VERIFIED_FACTS.certifications).toEqual([]);
    expect(VERIFIED_FACTS.projects).toEqual([]);
  });

  it("service counties stay in sync with the city-page registry", () => {
    expect(VERIFIED_FACTS.business.serviceCounties.sort()).toEqual(Object.keys(NJ_COUNTIES).sort());
  });

  it("services list stays in sync with the booking form's SERVICE_TYPES, minus catch-alls", () => {
    const expected = SERVICE_TYPES.map((t) => t.label).filter((l) => l !== "General" && l !== "Other");
    expect(VERIFIED_FACTS.services.sort()).toEqual(expected.sort());
    expect(VERIFIED_FACTS.services).not.toContain("General");
    expect(VERIFIED_FACTS.services).not.toContain("Other");
  });
});

describe("isFactsConfigured", () => {
  it("is false with no incentives", () => {
    expect(isFactsConfigured({ ...VERIFIED_FACTS, incentives: [] })).toBe(false);
  });

  it("is false when an incentive exists but lacks a verifiedOn date", () => {
    expect(
      isFactsConfigured({
        ...VERIFIED_FACTS,
        incentives: [{ program: "Test", amountText: "$1", verifiedOn: "", source: "x" }],
      }),
    ).toBe(false);
  });

  it("is true once at least one incentive has a verifiedOn date", () => {
    expect(
      isFactsConfigured({
        ...VERIFIED_FACTS,
        incentives: [{ program: "Test", amountText: "$1", verifiedOn: "2026-09-26", source: "x" }],
      }),
    ).toBe(true);
  });

  it("defaults to checking the real VERIFIED_FACTS constant when called with no argument", () => {
    // Documents current state: false until the owner fills in real incentives.
    expect(isFactsConfigured()).toBe(VERIFIED_FACTS.incentives.some((i) => !!i.verifiedOn?.trim()));
  });
});
