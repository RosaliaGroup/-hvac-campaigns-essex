import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { VERIFIED_FACTS as F } from "../../../shared/verifiedFacts";
import { validateFaqSet, MIN_FAQ_ITEMS, MAX_FAQ_ITEMS, type AiFaqFile } from "../../../shared/aiFaq";
import { INSTALL_PAGES } from "../../../shared/llmsTxt";
import { allowedPlacesFor } from "./aiFaqGen";
import { ALL_CITIES } from "../../../client/src/data/njCounties";

const file = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../client/src/data/aiFaqs.json"), "utf8")) as AiFaqFile;
const cityOf = (p: string) => ALL_CITIES.find((c) => `/hvac-${c.slug}-nj` === p)?.city;

describe("committed aiFaqs.json (what ships on the pages)", () => {
  it("covers every install page and every ServicePage-routed service page", () => {
    for (const p of INSTALL_PAGES) expect(file.pages[p.path], p.path).toBeDefined();
    for (const p of ["/hvac-system-replacement-nj", "/commercial-hvac-installation-nj", "/heat-pump-rebates-nj", "/hvac-financing-nj"]) expect(file.pages[p], p).toBeDefined();
  });
  it("has city pages only for cities in the registry, and never more than 25 (no scaled thin content)", () => {
    const cities = Object.entries(file.pages).filter(([, v]) => v.kind === "city");
    for (const [p] of cities) expect(cityOf(p), p).toBeDefined();
    expect(cities.length).toBeLessThanOrEqual(25);
  });
  for (const [pagePath, page] of Object.entries(file.pages)) {
    it(`${pagePath}: ${MIN_FAQ_ITEMS}-${MAX_FAQ_ITEMS} Q&As, all pass the facts-only gate`, () => {
      const city = cityOf(pagePath);
      const issues = validateFaqSet(page.items, F, allowedPlacesFor(F, city ? { path: pagePath, kind: "city", name: pagePath, city } : undefined));
      expect(issues, issues.map((i) => i.message).join(" | ")).toEqual([]);
    });
  }
  it("no two pages share an identical answer (de-templated)", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [p, page] of Object.entries(file.pages)) {
      for (const i of page.items) {
        const k = i.a.trim().toLowerCase();
        if (seen.has(k) && seen.get(k) !== p) dupes.push(`${p} = ${seen.get(k)}`);
        seen.set(k, p);
      }
    }
    expect(dupes).toEqual([]);
  });
  it("records when it was generated", () => { expect(file.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); });
});
