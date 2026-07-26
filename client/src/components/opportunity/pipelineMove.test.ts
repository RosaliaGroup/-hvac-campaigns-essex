import { describe, it, expect } from "vitest";
import { parseDropId, shouldApplyMove } from "./pipelineMove";

describe("parseDropId", () => {
  it("parses a positive integer id from the drag payload", () => {
    expect(parseDropId("42")).toBe(42);
  });
  it("rejects empty, non-numeric, zero, negative, and fractional payloads", () => {
    for (const bad of [null, undefined, "", "abc", "0", "-3", "1.5"]) {
      expect(parseDropId(bad)).toBeNull();
    }
  });
});

describe("shouldApplyMove (drag-and-drop regression)", () => {
  it("applies a move to a different stage when idle", () => {
    expect(shouldApplyMove({ from: "new", to: "pending", pending: false })).toBe(true);
    expect(shouldApplyMove({ from: null, to: "won", pending: false })).toBe(true);
  });

  it("ignores a drop onto the same column (no-op move)", () => {
    expect(shouldApplyMove({ from: "pending", to: "pending", pending: false })).toBe(false);
  });

  it("ignores re-fires while a move is already in flight", () => {
    expect(shouldApplyMove({ from: "new", to: "won", pending: true })).toBe(false);
  });
});
