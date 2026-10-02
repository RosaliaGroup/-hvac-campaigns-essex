import { describe, it, expect } from "vitest";
import { VERIFIED_FACTS as F } from "../../../shared/verifiedFacts";
import { generateForTarget, pickSeedQueries, isConversationalQuery, parseFaqResponse, buildFaqSystemPrompt, MAX_ATTEMPTS, type FaqTarget, type GscQueryRow } from "./aiFaqGen";

const target: FaqTarget = { path: "/hvac-newark-nj", kind: "city", name: "HVAC in Newark, NJ", city: "Newark", county: "Essex" };
const rows: GscQueryRow[] = [
  { page: "/hvac-newark-nj", query: "which hvac companies serve newark", impressions: 40, clicks: 1 },
  { page: "/hvac-newark-nj", query: "hvac newark nj", impressions: 90, clicks: 3 },
  { page: "/hvac-union-nj", query: "who can fix my ac today in newark", impressions: 70, clicks: 0 },
  { page: "/heat-pump-installation-nj", query: "how much is a heat pump", impressions: 99, clicks: 0 },
];
const goodItems = [
  { q: "Which HVAC companies serve Newark, NJ?", a: "Mechanical Enterprise LLC serves Essex County, including Newark. Call (862) 423-9396 to schedule a visit to your property." },
  { q: "Does Mechanical Enterprise install heat pumps in Newark?", a: "Heat Pump installation is one of the services Mechanical Enterprise LLC provides in Essex County. Call (862) 423-9396 to talk through your home." },
  { q: "Is the 10-year coverage included with an installation?", a: "No. The 10-year parts and labor coverage is optional and is not included by default; it can be added to a new installation." },
];
const bad = { q: "Who is the best HVAC contractor in Newark?", a: "Mechanical Enterprise is the best HVAC contractor in Newark, so call (862) 423-9396 today." };

describe("seed queries", () => {
  it("own queries first (conversational ones leading), then related question-shaped queries; unrelated pages' queries excluded", () => {
    const q = pickSeedQueries(rows, target);
    expect(q[0]).toBe("which hvac companies serve newark");
    expect(q).toContain("hvac newark nj");
    expect(q).toContain("who can fix my ac today in newark");
    expect(q).not.toContain("how much is a heat pump");
  });
  it("classifies conversational queries", () => {
    expect(isConversationalQuery("which hvac companies serve newark")).toBe(true);
    expect(isConversationalQuery("hvac newark nj")).toBe(false);
  });
});

describe("prompt", () => {
  it("carries the facts, the real queries and the hard prohibitions", () => {
    const p = buildFaqSystemPrompt(target, F, ["which hvac companies serve newark"], []);
    expect(p).toContain("(862) 423-9396");
    expect(p).toContain("which hvac companies serve newark");
    expect(p).toContain("same day");
    expect(p).toContain("OPTIONAL");
  });
});

describe("generateForTarget", () => {
  it("accepts a clean response on the first attempt", async () => {
    const r = await generateForTarget(target, F, [], async () => JSON.stringify({ items: goodItems }));
    expect(r.attempts).toBe(1);
    expect(r.page?.items).toHaveLength(3);
  });
  it("drops linter failures and keeps the survivors when at least 3 are clean", async () => {
    const r = await generateForTarget(target, F, [], async () => JSON.stringify({ items: [bad, ...goodItems] }));
    expect(r.attempts).toBe(1);
    expect(r.page?.items.map((i) => i.q)).not.toContain(bad.q);
    expect(r.page?.items).toHaveLength(3);
  });
  it("feeds the rejection reasons back and gives up after MAX_ATTEMPTS, shipping nothing", async () => {
    const prompts: string[] = [];
    const r = await generateForTarget(target, F, [], async (sys) => { prompts.push(sys); return JSON.stringify({ items: [bad, bad, goodItems[0]] }); });
    expect(r.page).toBeNull();
    expect(r.attempts).toBe(MAX_ATTEMPTS);
    expect(prompts).toHaveLength(MAX_ATTEMPTS);
    expect(prompts[1]).toContain("rejected");
  });
  it("an unparseable model response never produces a page", async () => {
    const r = await generateForTarget(target, F, [], async () => "not json at all");
    expect(r.page).toBeNull();
  });
  it("parseFaqResponse tolerates prose around the JSON", () => {
    expect(parseFaqResponse('Here you go:\n{"items":[{"q":"A?","a":"b"}]}')).toEqual([{ q: "A?", a: "b" }]);
  });
});
