import { describe, it, expect } from "vitest";
import { formatPropertyAddress, missingAddressParts, isCompleteAddress } from "./address";

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

const complete = { addressLine1: "61 1/2 Merchant St", city: "Newark", state: "NJ", zip: "07105" };

describe("missingAddressParts / isCompleteAddress", () => {
  it("a complete property address has no missing parts", () => {
    expect(missingAddressParts(complete)).toEqual([]);
    expect(isCompleteAddress(complete)).toBe(true);
  });
  it("a property with a Unit is complete and formats the unit", () => {
    const withUnit = { ...complete, addressLine2: "Apt 3B" };
    expect(isCompleteAddress(withUnit)).toBe(true);
    expect(formatPropertyAddress(withUnit)).toBe("61 1/2 Merchant St, Apt 3B, Newark, NJ 07105");
  });
  it("detects missing Street", () => {
    expect(missingAddressParts({ city: "Newark", state: "NJ", zip: "07105" })).toEqual(["Street"]);
  });
  it("detects missing City", () => {
    expect(missingAddressParts({ ...complete, city: null })).toEqual(["City"]);
  });
  it("detects missing State", () => {
    expect(missingAddressParts({ ...complete, state: "  " })).toEqual(["State"]);
  });
  it("detects missing ZIP", () => {
    expect(missingAddressParts({ ...complete, zip: "" })).toEqual(["ZIP"]);
  });
  it("lists multiple missing parts in display order", () => {
    expect(missingAddressParts({ addressLine1: "61 1/2 Merchant St" })).toEqual(["City", "State", "ZIP"]);
    expect(isCompleteAddress({ addressLine1: "61 1/2 Merchant St" })).toBe(false);
  });
  it("the reported partial address (street only) is flagged incomplete", () => {
    expect(missingAddressParts({ addressLine1: "61 1/2 Merchant St" })).toContain("City");
    expect(missingAddressParts({ addressLine1: "61 1/2 Merchant St" })).toContain("ZIP");
  });
});
