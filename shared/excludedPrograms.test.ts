import { describe, expect, it } from "vitest";
import { factsForWriters } from "./excludedPrograms";
import { VERIFIED_FACTS } from "./verifiedFacts";

describe("factsForWriters", () => {
  it("drops On-Bill Repayment and keeps the other incentives", () => {
    const f = factsForWriters(VERIFIED_FACTS);
    expect(f.incentives.some((i) => /on-bill|obr/i.test(i.program))).toBe(false);
    expect(f.incentives.map((i) => i.amountText)).toContain("Up to $16,000");
    expect(VERIFIED_FACTS.incentives.some((i) => /On-Bill/.test(i.program))).toBe(true);
  });
});
