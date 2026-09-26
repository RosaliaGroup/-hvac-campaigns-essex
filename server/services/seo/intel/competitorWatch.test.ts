import { describe, it, expect } from "vitest";
import { classifyCompetitorDiff, normalizeCompetitorHtml, type PageSnapshotText } from "./competitorWatch";

const COMPETITOR = { name: "Test Co", domain: "testco.example" };

function snap(overrides: Partial<PageSnapshotText> = {}): PageSnapshotText {
  return { title: "24/7 HVAC Repair | Test Co", meta: "Fast HVAC repair in NJ.", headings: ["Emergency HVAC Repair"], offers: [], ...overrides };
}

describe("classifyCompetitorDiff (§7 cosmetic vs material fixture test)", () => {
  it("returns new_page findings when there is no prior snapshot", () => {
    const result = classifyCompetitorDiff(COMPETITOR, "/warranty", null, snap());
    expect(result).toEqual([{ competitor: "Test Co", domain: "testco.example", pagePath: "/warranty", kind: "new_page", before: null, after: "24/7 HVAC Repair | Test Co", field: "title" }]);
  });

  it("classifies a whitespace/case-only title change as cosmetic", () => {
    const before = snap({ title: "24/7 HVAC Repair | Test Co" });
    const after = snap({ title: "24/7  hvac repair | test co" });
    const result = classifyCompetitorDiff(COMPETITOR, "/warranty", before, after);
    expect(result.find((r) => r.field === "title")?.kind).toBe("cosmetic");
  });

  it("classifies a dollar-figure change as price_change", () => {
    const before = snap({ title: "Installs from $4,500" });
    const after = snap({ title: "Installs from $3,999" });
    const result = classifyCompetitorDiff(COMPETITOR, "/pricing", before, after);
    expect(result.find((r) => r.field === "title")?.kind).toBe("price_change");
  });

  it("classifies a new warranty-year claim as warranty_change", () => {
    const before = snap({ meta: "Quality HVAC service you can trust." });
    const after = snap({ meta: "Now with a 10-year warranty on every install." });
    const result = classifyCompetitorDiff(COMPETITOR, "/warranty", before, after);
    expect(result.find((r) => r.field === "meta")?.kind).toBe("warranty_change");
  });

  it("classifies a genuinely new offer sentence as new_offer", () => {
    const before = snap({ offers: [] });
    const after = snap({ offers: ["Get 15% off your first service call."] });
    const result = classifyCompetitorDiff(COMPETITOR, "/", before, after);
    expect(result).toContainEqual(expect.objectContaining({ kind: "new_offer", field: "offer", after: "Get 15% off your first service call." }));
  });

  it("classifies an unrelated messaging change as messaging_change", () => {
    const before = snap({ title: "24/7 HVAC Repair | Test Co" });
    const after = snap({ title: "Trusted Local HVAC Experts | Test Co" });
    const result = classifyCompetitorDiff(COMPETITOR, "/", before, after);
    expect(result.find((r) => r.field === "title")?.kind).toBe("messaging_change");
  });

  it("reports nothing when nothing changed", () => {
    const s = snap();
    expect(classifyCompetitorDiff(COMPETITOR, "/", s, s)).toEqual([]);
  });
});

describe("normalizeCompetitorHtml", () => {
  it("extracts title, meta description, headings, and offer-shaped sentences", () => {
    const html = `
      <html><head><title>HVAC Experts | Test Co</title>
      <meta name="description" content="We fix HVAC systems fast.">
      </head><body><h1>Emergency Repair</h1><h2>Now with a 10-year warranty.</h2>
      <p>Call us today for a free estimate.</p></body></html>`;
    const result = normalizeCompetitorHtml(html);
    expect(result.title).toBe("HVAC Experts | Test Co");
    expect(result.meta).toBe("We fix HVAC systems fast.");
    expect(result.headings).toEqual(["Emergency Repair", "Now with a 10-year warranty."]);
    expect(result.offers.some((o) => /free estimate/i.test(o))).toBe(true);
  });
});
