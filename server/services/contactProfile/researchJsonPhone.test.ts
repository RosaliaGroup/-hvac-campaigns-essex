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
