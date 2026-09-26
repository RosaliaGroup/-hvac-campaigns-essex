import { describe, it, expect } from "vitest";
import { VERIFIED_FACTS, isFactsConfigured, isPriceRangeStale, type VerifiedPriceRange } from "./verifiedFacts";
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

  it("warranty is exactly 10 years, parts and labor, not included, no deductible", () => {
    expect(VERIFIED_FACTS.warranty.years).toBe(10);
    expect(VERIFIED_FACTS.warranty.covers).toBe("parts and labor");
    expect(VERIFIED_FACTS.warranty.included).toBe(false);
    expect(VERIFIED_FACTS.warranty.deductible).toBe(0);
    expect(VERIFIED_FACTS.warranty.verifiedOn).toBe("2026-09-26");
  });

  it("does not name a specific administrator or insurer — generic wording only", () => {
    // The spec keeps the administrator/insurer's specific legal name out of
    // marketing facts (named only in the written agreement + /warranty terms
    // disclosure) — "A-rated insurers" is the allowed generic description.
    expect(VERIFIED_FACTS.warranty.administration).toBe("third-party extended service agreement, backed by A-rated insurers");
  });

  describe("§9 differentiation add-ons — every owner-gated number stays null until set", () => {
    it("membership has no price yet", () => {
      expect(VERIFIED_FACTS.membership.priceText).toBeNull();
      expect(VERIFIED_FACTS.membership.verifiedOn).toBeNull();
      expect(VERIFIED_FACTS.membership.name).toBe("Comfort Membership");
    });

    it("priceRanges starts empty — nothing invented", () => {
      expect(VERIFIED_FACTS.priceRanges).toEqual([]);
    });

    it("replacementCredit has no percentage or cap yet", () => {
      expect(VERIFIED_FACTS.replacementCredit.percentOfPremiums).toBeNull();
      expect(VERIFIED_FACTS.replacementCredit.cap).toBeNull();
    });

    it("portfolioSla has no response-hours claim yet", () => {
      expect(VERIFIED_FACTS.portfolioSla.responseHours).toBeNull();
    });

    it("monitoring is not claimed as 24/7 and lists no thermostat brands yet", () => {
      expect(VERIFIED_FACTS.monitoring.is24x7).toBe(false);
      expect(VERIFIED_FACTS.monitoring.thermostatBrands).toEqual([]);
    });
  });
});

describe("isPriceRangeStale", () => {
  function range(asOf: string): VerifiedPriceRange {
    return { page: "/heat-pump-installation-nj", item: "Heat pump", low: 5000, high: 9000, asOf, notes: "" };
  }

  it("is false for a range confirmed recently", () => {
    expect(isPriceRangeStale(range("2026-09-01"), new Date("2026-09-26"))).toBe(false);
  });

  it("is true for a range older than 180 days", () => {
    expect(isPriceRangeStale(range("2025-01-01"), new Date("2026-09-26"))).toBe(true);
  });

  it("is true for an unparseable date", () => {
    expect(isPriceRangeStale(range("not-a-date"), new Date("2026-09-26"))).toBe(true);
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
