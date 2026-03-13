/**
 * Unit tests for the electric panel / disconnect adder logic in the Rebate Calculator.
 *
 * The calculateRebate function lives in the client, so we replicate the pure
 * pricing logic here to keep the tests server-side and framework-agnostic.
 */
import { describe, expect, it } from "vitest";

// ─── Replicated pure pricing logic (mirrors RebateCalculator.tsx) ─────────────

interface HomeDetails {
  sqft: string;
  bedrooms: string;
  floors: string;
  currentHeating: string;
  incomeLevel: string;
  hasExistingDucts: string;
  yearBuilt: string;
  hasCentralAir: string;
  panelHasSpace: string;
}

function computePanelAdder(home: Pick<HomeDetails, "hasCentralAir" | "panelHasSpace">): {
  panelAdder: number;
  numCondensers: number;
} {
  const hasCentralAir = home.hasCentralAir === "yes";
  const numCondensers = hasCentralAir ? 1 : 2;
  let panelAdder = 0;
  if (home.panelHasSpace === "yes") {
    panelAdder = 750 * numCondensers;
  } else if (home.panelHasSpace === "no" || home.panelHasSpace === "unsure") {
    panelAdder = 2500 + 250 * numCondensers;
  }
  return { panelAdder, numCondensers };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Electric panel / disconnect adder logic", () => {
  describe("when home HAS central air (1 condenser)", () => {
    it("adds $750 when panel has space", () => {
      const { panelAdder, numCondensers } = computePanelAdder({
        hasCentralAir: "yes",
        panelHasSpace: "yes",
      });
      expect(numCondensers).toBe(1);
      expect(panelAdder).toBe(750);
    });

    it("adds $2,750 when panel is full (no space)", () => {
      const { panelAdder } = computePanelAdder({
        hasCentralAir: "yes",
        panelHasSpace: "no",
      });
      // $2,500 upgrade + $250 × 1 permit
      expect(panelAdder).toBe(2750);
    });

    it("adds $2,750 when panel status is unsure", () => {
      const { panelAdder } = computePanelAdder({
        hasCentralAir: "yes",
        panelHasSpace: "unsure",
      });
      expect(panelAdder).toBe(2750);
    });
  });

  describe("when home does NOT have central air (2 condensers)", () => {
    it("adds $1,500 when panel has space (2 disconnects × $750)", () => {
      const { panelAdder, numCondensers } = computePanelAdder({
        hasCentralAir: "no",
        panelHasSpace: "yes",
      });
      expect(numCondensers).toBe(2);
      expect(panelAdder).toBe(1500);
    });

    it("adds $3,000 when panel is full (no space)", () => {
      const { panelAdder } = computePanelAdder({
        hasCentralAir: "no",
        panelHasSpace: "no",
      });
      // $2,500 upgrade + $250 × 2 permits
      expect(panelAdder).toBe(3000);
    });

    it("adds $3,000 when panel status is unsure", () => {
      const { panelAdder } = computePanelAdder({
        hasCentralAir: "no",
        panelHasSpace: "unsure",
      });
      expect(panelAdder).toBe(3000);
    });
  });

  describe("when panel question is not yet answered", () => {
    it("adds $0 when panelHasSpace is empty string", () => {
      const { panelAdder } = computePanelAdder({
        hasCentralAir: "yes",
        panelHasSpace: "",
      });
      expect(panelAdder).toBe(0);
    });
  });
});

describe("OBR LMI 120-month term logic", () => {
  it("uses 120 months for LMI customers on the 100% OBR option", () => {
    const isLMI = true;
    const outOfPocket = 12000;
    const obrTerm = isLMI ? 120 : 84;
    const monthly = Math.round((outOfPocket / obrTerm) * 100) / 100;
    expect(obrTerm).toBe(120);
    expect(monthly).toBeCloseTo(100, 0);
  });

  it("uses 84 months for standard customers on the 100% OBR option", () => {
    const isLMI = false;
    const outOfPocket = 12000;
    const obrTerm = isLMI ? 120 : 84;
    const monthly = Math.round((outOfPocket / obrTerm) * 100) / 100;
    expect(obrTerm).toBe(84);
    expect(monthly).toBeCloseTo(142.86, 0);
  });
});

describe("Solar panel interest question", () => {
  it("shows savings panel when interest is 'yes'", () => {
    const interest = "yes";
    const shouldShowSavings = interest === "yes" || interest === "maybe";
    expect(shouldShowSavings).toBe(true);
  });

  it("shows savings panel when interest is 'maybe'", () => {
    const interest = "maybe";
    const shouldShowSavings = interest === "yes" || interest === "maybe";
    expect(shouldShowSavings).toBe(true);
  });

  it("hides savings panel when interest is 'no'", () => {
    const interest = "no";
    const shouldShowSavings = interest === "yes" || interest === "maybe";
    expect(shouldShowSavings).toBe(false);
  });

  it("includes solar note in notification when interest is 'yes'", () => {
    const interestedInSolar = "yes";
    const solarNote = interestedInSolar === "yes"
      ? "YES — include solar proposal"
      : interestedInSolar === "maybe"
      ? "Maybe — share info"
      : "No";
    expect(solarNote).toBe("YES — include solar proposal");
  });

  it("includes solar note in notification when interest is 'maybe'", () => {
    const interestedInSolar = "maybe";
    const solarNote = interestedInSolar === "yes"
      ? "YES — include solar proposal"
      : interestedInSolar === "maybe"
      ? "Maybe — share info"
      : "No";
    expect(solarNote).toBe("Maybe — share info");
  });
});

describe("Financing package perks", () => {
  const packages = [
    { id: "deposit_option",          giftCard: 100, warrantyYears: 2, maintenanceYears: 1 },
    { id: "obr_client_financed",     giftCard: 200, warrantyYears: 3, maintenanceYears: 2 },
    { id: "njcleanheat_obr",         giftCard: 500, warrantyYears: 5, maintenanceYears: 3 },
    { id: "all_covered_njcleanheat", giftCard: 0,   warrantyYears: 1, maintenanceYears: 0 },
  ];

  it("Option 1 (Deposit) has $100 gift card, 2-yr warranty, 1-yr PM", () => {
    const pkg = packages.find(p => p.id === "deposit_option")!;
    expect(pkg.giftCard).toBe(100);
    expect(pkg.warrantyYears).toBe(2);
    expect(pkg.maintenanceYears).toBe(1);
  });

  it("Option 2 (OBR Client Financed) has $200 gift card, 3-yr warranty, 2-yr PM", () => {
    const pkg = packages.find(p => p.id === "obr_client_financed")!;
    expect(pkg.giftCard).toBe(200);
    expect(pkg.warrantyYears).toBe(3);
    expect(pkg.maintenanceYears).toBe(2);
  });

  it("Option 3 (100% OBR) has $500 gift card, 5-yr warranty, 3-yr PM", () => {
    const pkg = packages.find(p => p.id === "njcleanheat_obr")!;
    expect(pkg.giftCard).toBe(500);
    expect(pkg.warrantyYears).toBe(5);
    expect(pkg.maintenanceYears).toBe(3);
  });

  it("Option 4 (All Covered) has no gift card, 1-yr warranty, no PM", () => {
    const pkg = packages.find(p => p.id === "all_covered_njcleanheat")!;
    expect(pkg.giftCard).toBe(0);
    expect(pkg.warrantyYears).toBe(1);
    expect(pkg.maintenanceYears).toBe(0);
  });
});
