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
