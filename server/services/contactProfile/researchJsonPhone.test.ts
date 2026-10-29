import { describe, expect, it, vi } from "vitest";
import { anthropicSearch, parseJsonObject } from "./anthropicSearch";
import { validateResearch } from "./research";

describe("search reply assembly", () => {
  it("joins citation-split text blocks without inserting separators (keeps JSON valid)", async () => {
    const content = [
      { type: "text", text: '{"prospects":[{"name":"Jane Smith","evidence":"' },
      { type: "text", text: "Jane Smith, Community Manager, jsmith@acme.com", citations: [{ url: "https://acme.com/team" }] },
      { type: "text", text: '"}]}' },
    ];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ stop_reason: "end_turn", content, usage: {} }), { status: 200 }));
    const r = await anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, fetchImpl as any);
    expect(parseJsonObject(r.text)?.prospects[0].name).toBe("Jane Smith");
    expect(r.citations).toContain("https://acme.com/team");
  });
});

describe("parseJsonObject", () => {
  it("reads fenced JSON and recovers from raw line breaks inside strings", () => {
    expect(parseJsonObject('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('{"evidence":"line one\nline two"}')).toEqual({ evidence: "line one line two" });
    expect(parseJsonObject("no json here")).toBeNull();
  });
});

describe("published business phone", () => {
  const src = "https://acme.com/team";
  const identity = { name: "Jane Smith", email: "jsmith@acme.com", company: "Acme Property Group" };
  const raw = (value: string, evidence: string) => ({ phone: { value, source: src, evidence } });
  it("is accepted when the cited evidence shows the same number next to the contact", () => {
    const p = validateResearch(raw("973-555-0142", "Jane Smith, Community Manager — Tel: (973) 555-0142"), [src], identity);
    expect(p.phone?.value).toBe("(973) 555-0142");
    expect(p.phone?.source).toBe(src);
    expect(p.status).toBe("matched");
  });
  it("is rejected when the number is not in the evidence, unnamed, or uncited", () => {
    expect(validateResearch(raw("973-555-0142", "Jane Smith, Community Manager"), [src], identity).phone).toBeUndefined();
    expect(validateResearch(raw("973-555-0142", "Main line (973) 555-0142"), [src], identity).phone).toBeUndefined();
    expect(validateResearch(raw("973-555-0142", "Jane Smith (973) 555-0142"), ["https://other.com"], identity).phone).toBeUndefined();
    expect(validateResearch(raw("555-0142", "Jane Smith 555-0142"), [src], identity).phone).toBeUndefined();
  });
  it("accepts a company office number printed beside the company name", () => {
    const p = validateResearch(raw("+1 201 555 0199", "Acme Property Group office: 201.555.0199"), [src], identity);
    expect(p.phone?.value).toBe("(201) 555-0199");
  });
});

describe("lookup robustness", () => {
  const reply = (body: any) => new Response(JSON.stringify({ usage: {}, ...body }), { status: 200 });
  it("a search-limit error result keeps the answer instead of failing the lookup", async () => {
    const fetchImpl = vi.fn(async () => reply({ stop_reason: "end_turn", content: [
      { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://acme.com/team" }] },
      { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
      { type: "text", text: '{"company":{}}' },
    ] }));
    const r = await anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, fetchImpl as any);
    expect(parseJsonObject(r.text)).toEqual({ company: {} });
    expect(r.citations).toContain("https://acme.com/team");
  });
  it("a reply cut off at the length limit is used when it still holds a complete object", async () => {
    const ok = vi.fn(async () => reply({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"company":{}} and then more' }] }));
    expect(parseJsonObject((await anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, ok as any)).text)).toEqual({ company: {} });
    const cut = vi.fn(async () => reply({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"company":{"name":' }] }));
    await expect(anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, cut as any)).rejects.toMatchObject({ name: "ProfileLookupError", category: "truncated" });
  });
  it("pause_turn resumes by sending the paused turn back without an extra user message", async () => {
    const bodies: any[] = [];
    const fetchImpl = vi.fn(async (_u: string, init: any) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1
        ? reply({ stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} }] })
        : reply({ stop_reason: "end_turn", content: [{ type: "text", text: '{"company":{}}' }] });
    });
    await anthropicSearch("q", { ANTHROPIC_API_KEY: "k" } as any, fetchImpl as any);
    expect(bodies[1].messages.map((m: any) => m.role)).toEqual(["user", "assistant"]);
  });
  it("contact research asks for up to 5 searches", async () => {
    const { researchContact } = await import("./research");
    let body: any;
    const fetchImpl = vi.fn(async (_u: string, init: any) => { body = JSON.parse(init.body); return reply({ stop_reason: "end_turn", content: [{ type: "text", text: '{"company":{}}' }] }); });
    await researchContact({ name: "Jane Smith", email: "jsmith@acme.com", company: "Acme" }, { ANTHROPIC_API_KEY: "k" } as any, fetchImpl as any);
    expect(body.tools[0].max_uses).toBe(5);
    expect(body.max_tokens).toBe(4000);
  });
});
