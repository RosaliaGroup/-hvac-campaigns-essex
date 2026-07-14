import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source-text guarantees for the Commercial Opportunities server layer:
 *  - zero QuickBooks side effects (it may READ sales documents to reuse an
 *    estimate reference, but never writes/syncs them)
 *  - the legacy `opportunities.stage` enum is never touched by the commercial
 *    stage flow (commercial uses `stageId`)
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const router = read("./commercialOpportunities.ts");
const conversion = read("./commercialConversion.ts");
const logic = read("./commercialOpportunitiesLogic.ts");

describe("no QuickBooks side effects", () => {
  for (const [name, src] of [
    ["commercialOpportunities.ts", router],
    ["commercialConversion.ts", conversion],
    ["commercialOpportunitiesLogic.ts", logic],
  ] as const) {
    it(`${name} never writes QuickBooks tables`, () => {
      expect(src).not.toMatch(/\.insert\(\s*quickbooksSalesDocuments/);
      expect(src).not.toMatch(/\.update\(\s*quickbooksSalesDocuments/);
      expect(src).not.toMatch(/\.delete\(\s*quickbooksSalesDocuments/);
      expect(src).not.toMatch(/quickbooksSyncStatus/);
      expect(src).not.toMatch(/\bpushTo|syncTo|postToQuickbooks/i);
    });
  }
});

describe("legacy stage enum untouched by the commercial flow", () => {
  it("the commercial router never writes opportunities.stage (uses stageId)", () => {
    // Guard against a set that assigns the legacy enum column, e.g. `stage: "won"`.
    expect(router).not.toMatch(/\bset\([^)]*\bstage:\s*["']/);
    expect(router).toMatch(/stageId/);
  });
});
