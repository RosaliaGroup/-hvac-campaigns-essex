import { describe, expect, it } from "vitest";
import { formatTranscript, parseConnectionMap } from "./callQc";

describe("formatTranscript", () => {
  it("orders segments by time and labels channels", () => {
    const out = formatTranscript({
      segments: [
        { start: 4.2, end: 6, text: "Hi, yes this is Dana.", channel: 1 },
        { start: 0.5, end: 4, text: "Hi Dana, this is Heidi from Mechanical Enterprise.", channel: 0 },
        { start: 7, end: 8, text: "   ", channel: 0 },
      ],
    });
    expect(out.split("\n")).toEqual([
      "[0:00] Channel 1: Hi Dana, this is Heidi from Mechanical Enterprise.",
      "[0:04] Channel 2: Hi, yes this is Dana.",
    ]);
  });

  it("falls back to plain text without segments", () => {
    expect(formatTranscript({ text: " hello there " })).toBe("hello there");
  });
});

describe("parseConnectionMap", () => {
  it("parses connection:member pairs", () => {
    const m = parseConnectionMap("3091736895672026799:12, 555:");
    expect(m.get("3091736895672026799")).toBe(12);
    expect(m.get("555")).toBeNull();
    expect(parseConnectionMap(undefined).size).toBe(0);
  });
});
