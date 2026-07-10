import { describe, it, expect } from "vitest";
import {
  deriveWorkCategory,
  isChangeOrder,
  isCommercial,
  deriveDocTypeLabel,
  extractSalesDocSignals,
  workCategoryLabel,
  WORK_CATEGORY_LABELS,
} from "./opportunityCategory";

const RESIDENTIAL_CUSTOMER = { type: "residential", companyName: null, displayName: "Jane Homeowner" };
const COMMERCIAL_CUSTOMER = { type: "commercial", companyName: "Acme Retail", displayName: "Acme Retail" };

describe("deriveWorkCategory — Change Order (rule 1, conservative)", () => {
  it("classifies an explicit 'change order' memo as Change Order", () => {
    expect(
      deriveWorkCategory({ text: "Change Order for additional ductwork" }, RESIDENTIAL_CUSTOMER),
    ).toBe("change_order");
  });

  it("matches the hyphenated 'change-order' spelling", () => {
    expect(deriveWorkCategory({ text: "Approved change-order #3" }, RESIDENTIAL_CUSTOMER)).toBe("change_order");
  });

  it("matches a 'CO #' number reference", () => {
    expect(deriveWorkCategory({ docNumber: "CO #1042" }, RESIDENTIAL_CUSTOMER)).toBe("change_order");
  });

  it("matches 'change to existing work'", () => {
    expect(
      deriveWorkCategory({ text: "This covers a change to existing work on the rooftop unit" }, RESIDENTIAL_CUSTOMER),
    ).toBe("change_order");
  });

  it("classifies as Change Order when reliably linked to an existing job", () => {
    expect(deriveWorkCategory({ text: "", linkedToExistingJob: true }, RESIDENTIAL_CUSTOMER)).toBe("change_order");
  });

  it("Change Order takes priority over a commercial customer", () => {
    expect(deriveWorkCategory({ text: "change order" }, COMMERCIAL_CUSTOMER)).toBe("change_order");
  });
});

describe("deriveWorkCategory — ambiguous 'change' must NOT become Change Order", () => {
  it("does not flag 'change filter'", () => {
    expect(isChangeOrder({ text: "Annual maintenance: change filter and inspect" })).toBe(false);
    expect(deriveWorkCategory({ text: "Annual maintenance: change filter" }, RESIDENTIAL_CUSTOMER)).toBe("residential");
  });

  it("does not flag 'no change' / 'thermostat change'", () => {
    expect(isChangeOrder({ text: "No change to scope; thermostat change included" })).toBe(false);
  });

  it("does not flag a bare 'CO' token without a number (e.g. state code)", () => {
    expect(isChangeOrder({ text: "Ship to Denver CO 80202" })).toBe(false);
  });
});

describe("deriveWorkCategory — Commercial (rule 2)", () => {
  it("classifies a commercial-typed customer as Commercial", () => {
    expect(deriveWorkCategory({ text: "Rooftop RTU replacement" }, COMMERCIAL_CUSTOMER)).toBe("commercial");
  });

  it("promotes an obvious company name (LLC) even when type is residential", () => {
    expect(isCommercial({ type: "residential", companyName: "Summit Plaza LLC" })).toBe(true);
    expect(
      deriveWorkCategory({ text: "HVAC install" }, { type: "residential", companyName: "Summit Plaza LLC" }),
    ).toBe("commercial");
  });

  it("recognises common commercial project keywords (school, properties, construction)", () => {
    expect(isCommercial({ companyName: "Riverside Properties" })).toBe(true);
    expect(isCommercial({ companyName: "Lincoln Elementary School" })).toBe(true);
    expect(isCommercial({ companyName: "BuildRight Construction" })).toBe(true);
  });
});

describe("deriveWorkCategory — Residential (rule 3, default fallback)", () => {
  it("defaults to Residential for a plain homeowner", () => {
    expect(deriveWorkCategory({ text: "Furnace replacement" }, RESIDENTIAL_CUSTOMER)).toBe("residential");
  });

  it("defaults to Residential when signals are empty", () => {
    expect(deriveWorkCategory({}, {})).toBe("residential");
  });

  it("does not treat a personal name in companyName as commercial", () => {
    expect(isCommercial({ type: "residential", companyName: "The Smith Family" })).toBe(false);
    expect(
      deriveWorkCategory({ text: "AC tune-up" }, { type: "residential", companyName: "The Smith Family" }),
    ).toBe("residential");
  });
});

describe("labels", () => {
  it("maps categories to display labels", () => {
    expect(workCategoryLabel("residential")).toBe("Residential");
    expect(workCategoryLabel("commercial")).toBe("Commercial");
    expect(workCategoryLabel("change_order")).toBe("Change Order");
    expect(WORK_CATEGORY_LABELS.change_order).toBe("Change Order");
  });
});

describe("deriveDocTypeLabel — secondary badge (QBO doc type unchanged)", () => {
  it("shows 'Estimate' for a normal estimate", () => {
    expect(deriveDocTypeLabel({ docType: "estimate", text: "Furnace replacement" })).toBe("Estimate");
  });

  it("shows 'Proposal' when the estimate text says proposal", () => {
    expect(deriveDocTypeLabel({ docType: "estimate", text: "See attached proposal" })).toBe("Proposal");
  });

  it("defaults to 'Estimate' when docType is missing", () => {
    expect(deriveDocTypeLabel({})).toBe("Estimate");
  });
});

describe("extractSalesDocSignals — raw QBO payload parsing (single source)", () => {
  it("concatenates memo, private note, doc number, and line descriptions", () => {
    const raw = {
      DocNumber: "2162",
      CustomerMemo: { value: "Change Order for extra returns" },
      PrivateNote: "internal",
      Line: [{ Description: "Add 2 supply runs" }, { Description: "Seal plenum" }],
    };
    const sig = extractSalesDocSignals(raw);
    expect(sig.text).toContain("Change Order for extra returns");
    expect(sig.text).toContain("Add 2 supply runs");
    expect(sig.linkedToExistingJob).toBe(false);
    // end-to-end: this raw should classify as a change order
    expect(isChangeOrder({ text: sig.text, linkedToExistingJob: sig.linkedToExistingJob })).toBe(true);
  });

  it("detects linkedToExistingJob from a non-empty LinkedTxn array", () => {
    const raw = { LinkedTxn: [{ TxnId: "55", TxnType: "Invoice" }] };
    expect(extractSalesDocSignals(raw).linkedToExistingJob).toBe(true);
  });

  it("parses a JSON string payload", () => {
    const sig = extractSalesDocSignals(JSON.stringify({ CustomerMemo: { value: "proposal for new system" } }));
    expect(sig.text).toContain("proposal");
  });

  it("returns empty signals for null / malformed input", () => {
    expect(extractSalesDocSignals(null)).toEqual({ text: "", linkedToExistingJob: false });
    expect(extractSalesDocSignals("{not json")).toEqual({ text: "", linkedToExistingJob: false });
  });
});
