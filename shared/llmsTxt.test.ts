import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { VERIFIED_FACTS } from "./verifiedFacts";
import { buildLlmsTxt, INSTALL_PAGES, LLMS_BASE } from "./llmsTxt";
import { buildEntityRows, buildEntityJsonLd } from "./companyEntity";

const txt = buildLlmsTxt(VERIFIED_FACTS);

describe("llms.txt", () => {
  it("links the entity page, /warranty, /commercial and all five install pages (absolute URLs)", () => {
    for (const p of ["/company", "/warranty", "/commercial", ...INSTALL_PAGES.map((i) => i.path)]) {
      expect(txt).toContain(`(${LLMS_BASE}${p})`);
    }
    expect(INSTALL_PAGES).toHaveLength(5);
  });
  it("states the verified name, phone and counties — and nothing about fields that are still null", () => {
    expect(txt.startsWith("# Mechanical Enterprise LLC")).toBe(true);
    expect(txt).toContain(VERIFIED_FACTS.business.phone);
    for (const c of VERIFIED_FACTS.business.serviceCounties) expect(txt).toContain(`${c} County`);
    expect(VERIFIED_FACTS.business.address).toBeNull();
    expect(txt).not.toMatch(/Address:|License:|Hours:/);
  });
  it("renders address/license/hours lines once the owner supplies them", () => {
    const facts = {
      ...VERIFIED_FACTS,
      business: {
        ...VERIFIED_FACTS.business,
        address: "1 Test St, Newark, NJ",
        license: { text: "NJ HVACR Lic. 000", verifiedOn: "2026-10-02", source: "owner" },
        hours: { text: "Mon-Fri 8-5", verifiedOn: "2026-10-02", source: "owner" },
      },
    };
    const t = buildLlmsTxt(facts);
    expect(t).toContain("Address: 1 Test St, Newark, NJ");
    expect(t).toContain("License: NJ HVACR Lic. 000");
    expect(t).toContain("Hours: Mon-Fri 8-5");
  });
  it("the committed client/public/llms.txt equals the generator output (run scripts/generate-llms-txt.ts)", () => {
    const file = fs.readFileSync(path.resolve(import.meta.dirname, "../client/public/llms.txt"), "utf8").replace(/\r\n/g, "\n");
    expect(file).toBe(txt);
  });
});

describe("company entity", () => {
  const rows = buildEntityRows(VERIFIED_FACTS);
  const get = (l: string) => rows.find((r) => r.label === l)?.value;
  it("states legal name, phone, counties, services and the optional 10-year coverage from the facts", () => {
    expect(get("Legal name")).toBe("Mechanical Enterprise LLC");
    expect(get("Phone")).toBe(VERIFIED_FACTS.business.phone);
    expect(get("Counties served")).toContain("Essex County");
    expect(get("Services")).toBe(VERIFIED_FACTS.services.join(", "));
    expect(get("Coverage")).toMatch(/Optional 10-year parts and labor coverage \(not included by default/);
  });
  it("omits License/Address/Hours rows (and JSON-LD fields) while those facts are null", () => {
    expect(rows.map((r) => r.label)).not.toEqual(expect.arrayContaining(["License"]));
    expect(rows.map((r) => r.label)).not.toContain("Address");
    expect(rows.map((r) => r.label)).not.toContain("Hours");
    const ld = buildEntityJsonLd(VERIFIED_FACTS);
    expect(ld).not.toHaveProperty("address");
    expect(ld).not.toHaveProperty("openingHours");
    expect(ld).not.toHaveProperty("hasCredential");
    expect(ld["@type"]).toBe("HVACBusiness");
    expect(ld.telephone).toBe("+18624239396");
  });
  it("never contains a number the facts don't hold (no invented counts or years)", () => {
    const all = JSON.stringify(rows) + JSON.stringify(buildEntityJsonLd(VERIFIED_FACTS));
    const nums = all.match(/\d+/g) ?? [];
    const allowed = new Set(["1", "862", "423", "9396", "10", "20", "18624239396"]);
    for (const n of nums) expect(allowed.has(n) || n.length >= 10).toBe(true);
  });
});
