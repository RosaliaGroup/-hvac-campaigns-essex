import { describe, expect, it } from "vitest";
import { nyDayBounds } from "./teamHubStats";

describe("nyDayBounds", () => {
  it("uses EST in November", () => {
    const [a, b] = nyDayBounds("2026-11-16");
    expect(a.toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(b.toISOString()).toBe("2026-11-17T05:00:00.000Z");
  });
  it("uses EDT in July", () => {
    expect(nyDayBounds("2026-07-01")[0].toISOString()).toBe("2026-07-01T04:00:00.000Z");
  });
});
