import { describe, expect, it, vi } from "vitest";
vi.mock("../integrations/google/calendar", () => ({ googleCalendarProvider: { getValidAccessToken: vi.fn() } }));
import { anthropicSearch } from "./contactProfile/anthropicSearch";
import { researchSegment, RESEARCH_SEGMENTS } from "./prospectWorkflow";

const ok = () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }], usage: {} }), { status: 200 });

describe("prospect research search budget", () => {
  it("prospect discovery can request 8 web searches", async () => {
    let body: any;
    const fetchImpl = vi.fn(async (_u: string, init: any) => { body = JSON.parse(init.body); return ok(); });
    await anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, fetchImpl as any, { maxSearches: 8, maxTokens: 4000 });
    expect(body.tools[0].max_uses).toBe(8);
    expect(body.max_tokens).toBe(4000);
  });
  it("single-contact profile lookups keep the small default (2 searches)", async () => {
    let body: any;
    const fetchImpl = vi.fn(async (_u: string, init: any) => { body = JSON.parse(init.body); return ok(); });
    await anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, fetchImpl as any);
    expect(body.tools[0].max_uses).toBe(2);
    expect(body.model).toBe("claude-haiku-4-5");
  });
});

describe("hourly research segment rotation", () => {
  it("rotates through every target segment across a working day", () => {
    const seen = new Set<string>();
    for (let h = 13; h <= 20; h++) seen.add(researchSegment(new Date(`2026-10-28T${h}:05:00Z`)));
    expect(seen.size).toBe(RESEARCH_SEGMENTS.length);
  });
  it("is stable within an hour", () => {
    expect(researchSegment(new Date("2026-10-28T19:01:00Z"))).toBe(researchSegment(new Date("2026-10-28T19:59:00Z")));
  });
});

describe("second search in the same hour", () => {
  it("the fallback search uses a different segment than the first", async () => {
    const { RESEARCH_ATTEMPTS_PER_HOUR } = await import("./prospectWorkflow");
    expect(RESEARCH_ATTEMPTS_PER_HOUR).toBe(4);
    for (let h = 13; h <= 20; h++) {
      const t = new Date(`2026-10-29T${h}:05:00Z`);
      expect(researchSegment(t, 1)).not.toBe(researchSegment(t, 0));
    }
  });
  it("no longer targets building superintendents (rarely publish emails)", () => {
    expect(RESEARCH_SEGMENTS.join(" ")).not.toMatch(/superintendent/i);
  });
});

describe("county rotation", () => {
  it("each search in an hour targets a different county", async () => {
    const { researchCounty } = await import("./prospectWorkflow");
    for (let h = 13; h <= 20; h++) {
      const t = new Date(`2026-10-29T${h}:05:00Z`);
      const counties = [0, 1, 2, 3].map(i => researchCounty(t, i));
      expect(new Set(counties).size).toBe(4);
    }
  });
  it("intros per hour defaults to 10 and is capped at 15", async () => {
    const { introsPerHour } = await import("../../shared/prospectCadence");
    expect(introsPerHour({})).toBe(10);
    expect(introsPerHour({ PROSPECT_INTROS_PER_HOUR: "40" })).toBe(15);
    expect(introsPerHour({ PROSPECT_INTROS_PER_HOUR: "6" })).toBe(6);
  });
});

describe("segment mix", () => {
  it("covers all eight segments across a sending day and drops multifamily-owner searches", () => {
    expect(RESEARCH_SEGMENTS).toHaveLength(8);
    expect(RESEARCH_SEGMENTS.join(" ")).not.toMatch(/multifamily/i);
    const seen = new Set<string>();
    for (let h = 13; h <= 20; h++) seen.add(researchSegment(new Date(`2026-10-30T${h}:05:00Z`)));
    expect(seen.size).toBe(8);
  });
});
