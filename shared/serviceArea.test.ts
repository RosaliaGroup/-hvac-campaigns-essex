import { describe, it, expect } from "vitest";
import { isInServiceArea, normalizeZip, joinName } from "./serviceArea";

describe("isInServiceArea", () => {
  it("accepts North/Central NJ ZIPs", () => {
    for (const z of ["07105", "07078", "07030", "07601", "07960", "07704", "08836", "08901"]) {
      expect(isInServiceArea(z)).toBe(true);
    }
  });
  it("rejects South NJ, Trenton, Ocean and out-of-state ZIPs", () => {
    for (const z of ["08046", "08002", "08608", "08701", "08401", "10001", "19103"]) {
      expect(isInServiceArea(z)).toBe(false);
    }
  });
  it("handles ZIP+4 and junk", () => {
    expect(normalizeZip("07105-1234")).toBe("07105");
    expect(isInServiceArea("07105-1234")).toBe(true);
    expect(isInServiceArea("7105")).toBe(false);
    expect(isInServiceArea("")).toBe(false);
  });
});

describe("joinName", () => {
  it("does not double a name autofilled into both boxes", () => {
    expect(joinName("Farada Thompson", "Farada Thompson")).toBe("Farada Thompson");
    expect(joinName("Farada Thompson", "Thompson")).toBe("Farada Thompson");
    expect(joinName("Farada", "Farada Thompson")).toBe("Farada Thompson");
  });
  it("joins normal first + last", () => {
    expect(joinName("Ana", "Haynes")).toBe("Ana Haynes");
    expect(joinName("Ana", "")).toBe("Ana");
  });
});
