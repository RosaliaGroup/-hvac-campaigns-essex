import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_STAGE_SEEDS,
  COMMERCIAL_STAGE_KEYS,
  CONVERT_ELIGIBLE_STAGE_KEYS,
  isConvertEligibleStageKey,
  OPPORTUNITY_RECORD_TYPES,
  OPPORTUNITY_STATUSES,
  statusForClassification,
  OPPORTUNITY_TYPES,
  PROJECT_CATEGORIES,
  DOCUMENT_CATEGORIES,
  OPPORTUNITY_PRIORITIES,
  isRecordType,
  isDocumentCategory,
  isProjectCategory,
  isPriority,
  grossMargin,
  grossMarginPercent,
  weightedValue,
  makeOpportunityNumber,
  documentCategoryLabel,
  opportunityTypeLabel,
} from "./commercialPipeline";

describe("commercial pipeline seeds", () => {
  it("seeds exactly the 16 approved stages", () => {
    expect(COMMERCIAL_STAGE_SEEDS).toHaveLength(16);
    expect(COMMERCIAL_STAGE_KEYS).toEqual([
      "new_lead", "contacted", "qualified", "site_visit_scheduled", "site_visit_complete",
      "estimating", "internal_review", "proposal_sent", "follow_up", "negotiation",
      "awarded", "contract_signed", "deposit_received", "ready_for_scheduling",
      "converted_to_job", "lost",
    ]);
  });

  it("has contiguous 1..16 order and unique keys", () => {
    const orders = COMMERCIAL_STAGE_SEEDS.map(s => s.order);
    expect(orders).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(new Set(COMMERCIAL_STAGE_KEYS).size).toBe(16);
  });

  it("classifies awarded→converted as won, lost as lost, rest open", () => {
    const won = COMMERCIAL_STAGE_SEEDS.filter(s => s.classification === "won").map(s => s.key);
    const lost = COMMERCIAL_STAGE_SEEDS.filter(s => s.classification === "lost").map(s => s.key);
    const open = COMMERCIAL_STAGE_SEEDS.filter(s => s.classification === "open").map(s => s.key);
    expect(won).toEqual(["awarded", "contract_signed", "deposit_received", "ready_for_scheduling", "converted_to_job"]);
    expect(lost).toEqual(["lost"]);
    expect(open).toHaveLength(10);
  });

  it("keeps probabilities within 0..100", () => {
    for (const s of COMMERCIAL_STAGE_SEEDS) {
      expect(s.defaultProbability).toBeGreaterThanOrEqual(0);
      expect(s.defaultProbability).toBeLessThanOrEqual(100);
    }
  });
});

describe("convert eligibility", () => {
  it("only awarded/contract_signed/deposit_received/ready_for_scheduling are eligible", () => {
    expect([...CONVERT_ELIGIBLE_STAGE_KEYS]).toEqual([
      "awarded", "contract_signed", "deposit_received", "ready_for_scheduling",
    ]);
    expect(isConvertEligibleStageKey("awarded")).toBe(true);
    expect(isConvertEligibleStageKey("ready_for_scheduling")).toBe(true);
    // converted_to_job is a won stage but NOT re-convertible
    expect(isConvertEligibleStageKey("converted_to_job")).toBe(false);
    expect(isConvertEligibleStageKey("proposal_sent")).toBe(false);
    expect(isConvertEligibleStageKey(null)).toBe(false);
  });

  it("every eligible key is a real seeded stage", () => {
    for (const k of CONVERT_ELIGIBLE_STAGE_KEYS) expect(COMMERCIAL_STAGE_KEYS).toContain(k);
  });
});

describe("status derivation", () => {
  it("maps classification to status", () => {
    expect(statusForClassification("won")).toBe("awarded");
    expect(statusForClassification("lost")).toBe("lost");
    expect(statusForClassification("open")).toBe("open");
  });
});

describe("vocabularies", () => {
  it("has the expected counts", () => {
    expect(OPPORTUNITY_RECORD_TYPES).toContain("qbo_residential");
    expect(OPPORTUNITY_RECORD_TYPES).toContain("commercial");
    expect(OPPORTUNITY_STATUSES).toEqual(["open", "awarded", "lost", "on_hold", "cancelled"]);
    expect(OPPORTUNITY_TYPES).toHaveLength(9);
    expect(PROJECT_CATEGORIES).toHaveLength(16);
    expect(DOCUMENT_CATEGORIES).toHaveLength(18);
    expect(OPPORTUNITY_PRIORITIES).toEqual(["low", "normal", "high", "urgent"]);
  });

  it("document categories include the expanded set", () => {
    const keys = DOCUMENT_CATEGORIES.map(c => c.key);
    for (const k of ["drone_photos", "videos", "plans", "submittals", "rfis", "change_orders", "closeout", "warranty"]) {
      expect(keys).toContain(k);
    }
    expect(documentCategoryLabel("drone_photos")).toBe("Drone Photos");
    expect(opportunityTypeLabel("public_work")).toBe("Public Work");
  });

  it("validation guards accept known keys and reject junk", () => {
    expect(isRecordType("commercial")).toBe(true);
    expect(isRecordType("nope")).toBe(false);
    expect(isDocumentCategory("permit")).toBe(true);
    expect(isDocumentCategory("permits")).toBe(false);
    expect(isProjectCategory("data_center")).toBe(true);
    expect(isPriority("urgent")).toBe(true);
    expect(isPriority("critical")).toBe(false);
  });
});

describe("money helpers (exact, no float error)", () => {
  it("computes gross margin as a fixed-2 string", () => {
    expect(grossMargin("1000.00", "600.00")).toBe("400.00");
    expect(grossMargin("100.10", "0.20")).toBe("99.90");
    expect(grossMargin("0.30", "0.10")).toBe("0.20"); // classic 0.1+0.2 float trap
    expect(grossMargin("500", null)).toBeNull();
    expect(grossMargin(null, "5")).toBeNull();
  });

  it("supports negative margin", () => {
    expect(grossMargin("100.00", "150.00")).toBe("-50.00");
  });

  it("computes margin percent", () => {
    expect(grossMarginPercent("1000", "600")).toBe(40);
    expect(grossMarginPercent("1000", "750")).toBe(25);
    expect(grossMarginPercent("0", "10")).toBeNull();
    expect(grossMarginPercent(null, "10")).toBeNull();
  });

  it("computes weighted value", () => {
    expect(weightedValue("1000.00", 55)).toBe("550.00");
    expect(weightedValue("1000.00", null)).toBe("0.00");
    expect(weightedValue("1000.00", 150)).toBe("1000.00"); // clamped to 100
    expect(weightedValue(null, 50)).toBeNull();
  });
});

describe("opportunity number", () => {
  it("formats OPP-<year>-<padded id>", () => {
    expect(makeOpportunityNumber(42, 2026)).toBe("OPP-2026-0042");
    expect(makeOpportunityNumber(12345, 2026)).toBe("OPP-2026-12345");
  });
});
