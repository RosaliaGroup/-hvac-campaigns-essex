import { describe, it, expect } from "vitest";
import { computeSyncWindows } from "./sync";

describe("computeSyncWindows", () => {
  const w = computeSyncWindows(new Date("2026-07-14T12:00:00Z"));

  it("ends the current window 3 days before now (Search Console lag)", () => {
    expect(w.current.end).toBe("2026-07-11");
  });

  it("spans 90 days for the current window", () => {
    expect(w.current.start).toBe("2026-04-13"); // 2026-07-11 minus 89 days
  });

  it("places the previous window immediately before the current one, non-overlapping", () => {
    expect(w.previous.end).toBe("2026-04-12"); // day before current.start
    expect(w.previous.start).toBe("2026-01-13"); // 90-day span
    expect(w.previous.end < w.current.start).toBe(true);
  });
});
