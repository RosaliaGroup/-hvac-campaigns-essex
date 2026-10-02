import { describe, it, expect } from "vitest";
import { signedDeltaLabel } from "./deltaLabel";

const pct = (f: number) => `${(f * 100).toFixed(1)}%`;

describe("signedDeltaLabel", () => {
  it("shows + for a gain and a real minus for a drop", () => {
    expect(signedDeltaLabel(0.284, pct)).toBe("+28.4%");
    expect(signedDeltaLabel(-0.284, pct)).toBe("−28.4%");
  });
  it("a drop never renders as an unsigned or positive number", () => {
    expect(signedDeltaLabel(-0.01, pct).startsWith("+")).toBe(false);
    expect(signedDeltaLabel(-0.01, pct).startsWith("−")).toBe(true);
  });
  it("zero has no sign", () => {
    expect(signedDeltaLabel(0, pct)).toBe("0.0%");
  });
});
