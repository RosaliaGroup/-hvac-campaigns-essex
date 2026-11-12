import { describe, expect, it } from "vitest";
import { QC_CRITERIA, parseQcResponse, verdictFor } from "./callQc";

const full = Object.fromEntries(QC_CRITERIA.map((c) => [c.key, { score: c.max, note: "ok" }]));

describe("parseQcResponse", () => {
  it("scores a clean booked call as a pass", () => {
    const r = parseQcResponse(
      JSON.stringify({ scorable: true, outcome: "booked", appointmentBooked: true, summary: "Booked Tue 10 AM.", scores: full, flags: [], strengths: ["Warm opening"], coaching: [] }),
    )!;
    expect(r.score).toBe(100);
    expect(r.verdict).toBe("pass");
    expect(r.appointmentBooked).toBe(true);
    expect(r.scores).toHaveLength(QC_CRITERIA.length);
  });

  it("tolerates prose or code fences around the JSON", () => {
    const r = parseQcResponse("Here you go:\n```json\n" + JSON.stringify({ outcome: "voicemail", scores: full }) + "\n```");
    expect(r?.outcome).toBe("voicemail");
  });

  it("fails a call with a red flag and zeroes compliance", () => {
    const r = parseQcResponse(
      JSON.stringify({ outcome: "booked", scores: full, flags: [{ code: "price_quoted", quote: "it's about eight grand" }] }),
    )!;
    expect(r.verdict).toBe("fail");
    expect(r.scores.find((s) => s.key === "compliance")!.score).toBe(0);
    expect(r.score).toBe(85);
  });

  it("clamps out-of-range scores and drops unknown flags and outcomes", () => {
    const r = parseQcResponse(
      JSON.stringify({ outcome: "sold_a_boat", scores: { opening: { score: 99 }, discovery: -5 }, flags: [{ code: "made_up" }] }),
    )!;
    expect(r.outcome).toBe("other");
    expect(r.scores.find((s) => s.key === "opening")!.score).toBe(10);
    expect(r.scores.find((s) => s.key === "discovery")!.score).toBe(0);
    expect(r.flags).toEqual([]);
  });

  it("does not score a call with no conversation", () => {
    const r = parseQcResponse(JSON.stringify({ scorable: false, outcome: "no_conversation", scores: full }))!;
    expect(r.score).toBeNull();
    expect(r.verdict).toBe("not_scored");
  });

  it("returns null for unparseable replies", () => {
    expect(parseQcResponse("sorry, I can't")).toBeNull();
    expect(parseQcResponse("{not json}")).toBeNull();
  });
});

describe("verdictFor", () => {
  it("uses 80 / 60 thresholds", () => {
    expect(verdictFor(80, [])).toBe("pass");
    expect(verdictFor(79, [])).toBe("coach");
    expect(verdictFor(60, [])).toBe("coach");
    expect(verdictFor(59, [])).toBe("fail");
  });
  it("a soft flag alone doesn't fail a good call", () => {
    expect(verdictFor(90, [{ code: "no_next_step", quote: "" }])).toBe("pass");
  });
});
