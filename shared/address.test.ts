import { describe, it, expect } from "vitest";
import { formatPropertyAddress } from "./address";

describe("formatPropertyAddress (shared)", () => {
  it("composes a full single-line address", () => {
    expect(formatPropertyAddress({ addressLine1: "500 Main St", addressLine2: "Suite 200", city: "Newark", state: "NJ", zip: "07102" }))
      .toBe("500 Main St, Suite 200, Newark, NJ 07102");
  });
  it("omits blank parts without dangling separators", () => {
    expect(formatPropertyAddress({ addressLine1: "9 Oak Rd", state: "NJ" })).toBe("9 Oak Rd, NJ");
    expect(formatPropertyAddress({ addressLine1: "9 Oak Rd" })).toBe("9 Oak Rd");
  });
  it("returns empty string for missing input", () => {
    expect(formatPropertyAddress(null)).toBe("");
    expect(formatPropertyAddress(undefined)).toBe("");
  });
});
