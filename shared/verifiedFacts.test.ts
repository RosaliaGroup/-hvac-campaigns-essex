import { describe, it, expect } from "vitest";
import { VERIFIED_FACTS, isFactsConfigured } from "./verifiedFacts";
import { NJ_COUNTIES } from "../client/src/data/njCounties";

const FORBIDDEN_TERMS = [
  "25c",
  "federal tax credit",
  "hear",
  "homes rebate",
  "23,500",
  "29,800",
];

describe("VERIFIED_FACTS", () => {
  it("has no fabricated address or founding year", () => {
    expect(VERIFIED_FACTS.business.address).toBeNull();
    expect(VERIFIED_FACTS.business.founded).toBeNull();
  });

  it("certifications and projects stay empty — not requested, nothing invented", () => {
    expect(VERIFIED_FACTS.certifications).toEqual([]);
    expect(VERIFIED_FACTS.projects).toEqual([]);
  });

  it("service counties stay in sync with the city-page registry", () => {
    expect(VERIFIED_FACTS.business.serviceCounties.sort()).toEqual(Object.keys(NJ_COUNTIES).sort());
  });

  it("services list is the live, individually-routed service pages — not the rebate/financing landing pages on the same template", () => {
    expect(VERIFIED_FACTS.services.sort()).toEqual(
      ["Heat Pump", "Central AC", "Ductless Mini-Split", "Full HVAC System Replacement", "Commercial HVAC", "VRV/VRF System"].sort(),
    );
    expect(VERIFIED_FACTS.services).not.toContain("Heat Pump Rebates NJ");
    expect(VERIFIED_FACTS.services).not.toContain("HVAC Financing");
  });

  describe("incentives (owner-attested 2026-09-26)", () => {
    it("has exactly the three standardized programs: residential rebate, commercial Direct Install, On-Bill Repayment", () => {
      expect(VERIFIED_FACTS.incentives).toHaveLength(3);
      const programs = VERIFIED_FACTS.incentives.map((i) => i.program);
      expect(programs.some((p) => /residential/i.test(p) && /rebate/i.test(p))).toBe(true);
      expect(programs.some((p) => /direct install/i.test(p))).toBe(true);
      expect(programs.some((p) => /on-bill repayment/i.test(p))).toBe(true);
    });

    it("every entry is dated 2026-09-26 and sourced as owner-attested site copy", () => {
      for (const incentive of VERIFIED_FACTS.incentives) {
        expect(incentive.verifiedOn).toBe("2026-09-26");
        expect(incentive.source).toBe("owner-attested; site copy");
      }
    });

    it("states the standardized $16,000 residential figure, not a stale/inflated one", () => {
      const residential = VERIFIED_FACTS.incentives.find((i) => /residential/i.test(i.program));
      expect(residential?.amountText).toMatch(/\$16,000/);
      expect(residential?.amountText).not.toMatch(/\$18,000|\$20,000|\$22,000|\$23,500|\$29,800/);
    });

    it("states 80% for commercial Direct Install", () => {
      const commercial = VERIFIED_FACTS.incentives.find((i) => /direct install/i.test(i.program));
      expect(commercial?.amountText).toMatch(/80%/);
    });

    it("describes On-Bill Repayment as 0% interest financing of the post-rebate balance", () => {
      const obr = VERIFIED_FACTS.incentives.find((i) => /on-bill repayment/i.test(i.program));
      expect(obr?.amountText).toMatch(/0%/);
      expect(obr?.amountText.toLowerCase()).toMatch(/remaining balance|after rebates/);
    });

    it("never mentions the expired federal 25C credit, HEAR/HOMES, or illustrative example figures", () => {
      const allText = VERIFIED_FACTS.incentives.map((i) => `${i.program} ${i.amountText}`).join(" ").toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(allText).not.toContain(term);
      }
    });
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

  it("is true for the real VERIFIED_FACTS constant — both autopublish lanes are now unblocked on facts", () => {
    expect(isFactsConfigured()).toBe(true);
  });
});
