import { describe, it, expect } from "vitest";
import { SEO_LANDING_PAGES, type SeoLandingPageData } from "./seoLandingPages";
import { VERIFIED_FACTS } from "../../../shared/verifiedFacts";
import { lintClaims } from "../../../shared/contentLinter";
import { lintPageMeta } from "../../../shared/seoLinter";

const SERVICE_SLUGS = [
  "commercial-hvac-service-nj",
  "commercial-rtu-service-nj",
  "commercial-hvac-maintenance-nj",
  "emergency-hvac-repair-nj",
];
const pages = SERVICE_SLUGS.map((slug) => SEO_LANDING_PAGES.find((p) => p.slug === slug) as SeoLandingPageData);

/** All page-specific copy that renders on the page. */
function pageText(p: SeoLandingPageData): string {
  return [
    p.h1, p.heroSub, p.introHeading, p.intro,
    ...p.cards.flatMap((c) => [c.title, c.desc]),
    ...(p.deepDive ?? []).flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
    ...(p.sendUs ? [p.sendUs.heading, ...p.sendUs.items] : []),
    ...p.faqs.flatMap((f) => [f.q, f.a]),
    p.ctaHeading, p.ctaSub,
  ].join("\n");
}
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe("service-led commercial landing pages", () => {
  it("exist, are service-only and carry substantial page-specific copy", () => {
    for (const p of pages) {
      expect(p, "missing page").toBeTruthy();
      expect(p.serviceOnly).toBe(true);
      expect(p.deepDive?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(p.sendUs?.items.length ?? 0).toBeGreaterThanOrEqual(5);
      expect(words(pageText(p))).toBeGreaterThan(850);
    }
  });

  it("pass the fact-firewall claim linter with no blocking findings", () => {
    for (const p of pages) {
      const blocks = lintClaims(pageText(p), VERIFIED_FACTS).filter((f) => f.severity === "block");
      expect(blocks, `${p.slug}: ${blocks.map((b) => b.message).join(" | ")}`).toEqual([]);
    }
  });

  it("have distinct, valid titles and meta descriptions that lead with the service", () => {
    for (const p of pages) {
      expect(p.metaTitle.length).toBeLessThanOrEqual(60);
      expect(p.metaDescription.length).toBeLessThanOrEqual(155);
      const others = pages.filter((o) => o !== p);
      const res = lintPageMeta(
        { pagePath: `/${p.slug}`, title: p.metaTitle, metaDescription: p.metaDescription },
        { existingTitles: others.map((o) => o.metaTitle), existingMetas: others.map((o) => o.metaDescription) },
      );
      expect(res.findings.filter((f) => f.severity === "block"), p.slug).toEqual([]);
    }
    expect(new Set(pages.map((p) => p.metaTitle)).size).toBe(pages.length);
  });

  it("contain no rebate, incentive, financing, 24/7 or same-day claims", () => {
    for (const p of pages) {
      const t = `${pageText(p)} ${p.metaTitle} ${p.metaDescription}`;
      expect(t, p.slug).not.toMatch(/rebate|incentive|direct install|financ|24\s*\/\s*7|same[- ]day|around the clock|certified/i);
    }
  });

  it("link to the property-manager hub and to property-manager guides", () => {
    for (const p of pages) {
      const hrefs = p.related.map((r) => r.href);
      expect(hrefs).toContain("/commercial/for-property-management");
      expect(hrefs.filter((h) => h.startsWith("/blog/")).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("are not near-duplicates of each other (5-word phrase overlap)", () => {
    const shingles = (x: string) => {
      const w = x.toLowerCase().match(/[a-z0-9']+/g) ?? [];
      const out = new Set<string>();
      for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(" "));
      return out;
    };
    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const a = shingles(pageText(pages[i]));
        const b = shingles(pageText(pages[j]));
        const inter = Array.from(a).filter((x) => b.has(x)).length;
        expect(inter / (a.size + b.size - inter), `${pages[i].slug} vs ${pages[j].slug}`).toBeLessThan(0.05);
      }
    }
  });
});
