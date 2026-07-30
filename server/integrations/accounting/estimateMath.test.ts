import { describe, it, expect } from "vitest";
import {
  computeLineAmount,
  computeOptionTotals,
  buildApprovedSnapshot,
} from "./estimateMath";
import { buildQboEstimateBody } from "./quickbooks";

describe("estimate math", () => {
  it("computes line amount = qty × unitPrice rounded to cents", () => {
    expect(computeLineAmount(3, 199.99)).toBe(599.97);
    expect(computeLineAmount("2", "10.005")).toBe(20.01);
    expect(computeLineAmount(0, 100)).toBe(0);
  });

  it("computes option subtotal/total from line amounts (v1 total === subtotal)", () => {
    const { subtotal, total } = computeOptionTotals([{ amount: 599.97 }, { amount: "100.02" }, { amount: 0.01 }]);
    expect(subtotal).toBe(700);
    expect(total).toBe(700);
  });

});

describe("approval snapshot immutability", () => {
  it("deep-copies option + line items so later source edits never change the snapshot", () => {
    const option = {
      id: 5, tier: "better", label: "Better", description: "d",
      subtotal: "700.00", total: "700.00", rebateAmount: "50.00",
      warrantyTerms: "10yr", maintenancePlan: "annual",
    };
    const lines = [
      { name: "Furnace", description: null, itemType: "equipment", quantity: "1", unitPrice: "600.00", amount: "600.00" },
      { name: "Labor", description: null, itemType: "labor", quantity: "2", unitPrice: "50.00", amount: "100.00" },
    ];
    const snap = buildApprovedSnapshot(option, lines, new Date("2026-07-27T00:00:00Z"));
    expect(snap.total).toBe(700);
    expect(snap.rebateAmount).toBe(50);
    expect(snap.lineItems).toHaveLength(2);
    expect(snap.lineItems[0]).toMatchObject({ name: "Furnace", quantity: 1, unitPrice: 600, amount: 600 });

    // Mutate the SOURCE option + lines AFTER snapshotting.
    lines[0].name = "CHANGED";
    lines.push({ name: "Extra", description: null, itemType: "other", quantity: "1", unitPrice: "1", amount: "1" });
    option.label = "CHANGED";

    // Snapshot is unaffected.
    expect(snap.lineItems).toHaveLength(2);
    expect(snap.lineItems[0].name).toBe("Furnace");
    expect(snap.label).toBe("Better");
  });
});

describe("QBO estimate payload (approved option only)", () => {
  it("maps lines to SalesItemLineDetail on the generic item + carries docNumber/privateNote", () => {
    const body = buildQboEstimateBody(
      {
        customerRef: "QB-42",
        docNumber: "ME-EST-2026-0007",
        privateNote: "Opportunity #7 — Furnace replacement",
        lines: [
          { name: "Furnace", description: "High-eff", quantity: 1, unitPrice: 600, amount: 600 },
          { name: "Labor", description: null, quantity: 2, unitPrice: 50, amount: 100 },
        ],
      },
      { value: "ITEM-1", name: "HVAC Services" },
    );
    expect(body.CustomerRef).toEqual({ value: "QB-42" });
    expect(body.DocNumber).toBe("ME-EST-2026-0007");
    expect(body.PrivateNote).toBe("Opportunity #7 — Furnace replacement");
    const lines = body.Line as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      DetailType: "SalesItemLineDetail",
      Amount: 600,
      Description: "Furnace — High-eff",
      SalesItemLineDetail: { ItemRef: { value: "ITEM-1", name: "HVAC Services" }, Qty: 1, UnitPrice: 600 },
    });
    expect(lines[1].Description).toBe("Labor");
  });
});
