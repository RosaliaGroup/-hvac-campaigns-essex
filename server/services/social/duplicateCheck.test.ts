import { describe, it, expect } from "vitest";
import { textSimilarity, isDuplicateOfRecent } from "./duplicateCheck";

describe("textSimilarity", () => {
  it("returns 1 for identical text", () => {
    expect(textSimilarity("Get your heat pump tune-up today", "Get your heat pump tune-up today")).toBe(1);
  });

  it("returns a low score for unrelated text", () => {
    const score = textSimilarity("Get your heat pump tune-up today", "Property managers love our portfolio pricing");
    expect(score).toBeLessThan(0.3);
  });

  it("returns a high score for near-duplicate text", () => {
    const score = textSimilarity(
      "Ask about our 10-year parts and labor coverage on new installs",
      "Ask about our 10 year parts and labor coverage for new installations",
    );
    expect(score).toBeGreaterThan(0.5);
  });
});

describe("isDuplicateOfRecent", () => {
  it("flags near-identical content as a duplicate", () => {
    const recent = ["Ask about our 10-year parts and labor coverage on new installs today"];
    const isDup = isDuplicateOfRecent("Ask about our 10-year parts and labor coverage on new installs today!", recent);
    expect(isDup).toBe(true);
  });

  it("does not flag distinct content", () => {
    const recent = ["Ask about our 10-year parts and labor coverage on new installs"];
    const isDup = isDuplicateOfRecent("Property managers: ask about portfolio pricing for PTAC units", recent);
    expect(isDup).toBe(false);
  });
});
