import { describe, expect, it } from "vitest";
import { parseTime } from "./sync";
describe("GBP MySQL timestamp parsing", () => {
  it("accepts valid dates", () => expect(parseTime("2026-10-16T18:00:00Z")?.getUTCFullYear()).toBe(2026));
  it("ignores dates outside TIMESTAMP range", () => {
    expect(parseTime("0001-01-01T00:00:00Z")).toBeNull();
    expect(parseTime("2040-01-01T00:00:00Z")).toBeNull();
  });
  it("ignores malformed dates", () => expect(parseTime("not-a-date")).toBeNull());
});
