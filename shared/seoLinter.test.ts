import { describe, it, expect } from "vitest";
import { lintPageMeta, isBlocked } from "./seoLinter";

describe("lintPageMeta — BLOCK rules (spec §3, acceptance test §11)", () => {
  it('blocks "#1" superlative claims', () => {
    const result = lintPageMeta({ pagePath: "/hvac-newark-nj", title: "#1 HVAC Contractor in Newark, NJ", metaDescription: "Licensed HVAC in Newark. Call now." });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "superlative" && f.severity === "block")).toBe(true);
  });

  it('blocks "$2K federal tax credit" (expired incentive)', () => {
    const result = lintPageMeta({ pagePath: "/hvac-newark-nj", title: "HVAC Newark NJ", metaDescription: "Combine PSE&G rebates with the $2K federal tax credit and save big." });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "expired_incentive")).toBe(true);
  });

  it("blocks other superlatives (best, top-rated, guaranteed, award-winning)", () => {
    for (const phrase of ["best HVAC company", "top-rated contractor", "guaranteed lowest price", "award-winning service"]) {
      const result = lintPageMeta({ pagePath: "/x", title: phrase, metaDescription: "meta" });
      expect(result.passes, phrase).toBe(false);
    }
  });

  it("blocks unverified certification wording (no approved phrase seeded yet)", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "MWBE Certified HVAC Contractor", metaDescription: "meta" });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "unverified_certification")).toBe(true);
  });

  it("blocks competitor brand names", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "Better than A.J. Perri", metaDescription: "meta" });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "competitor_name")).toBe(true);
  });

  it("blocks a non-canonical phone number", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Call (862) 419-1763 today." });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "non_canonical_phone")).toBe(true);
  });

  it("does NOT block the canonical phone number", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Call (862) 423-9396 today." });
    expect(result.findings.some((f) => f.code === "non_canonical_phone")).toBe(false);
  });

  it("blocks dollar figures over $16,000", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Get up to $20,000 back." });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "dollar_over_max")).toBe(true);
  });

  it("blocks $16K on a known non-PSE&G town", () => {
    const result = lintPageMeta({ pagePath: "/hvac-morristown-nj", title: "title", metaDescription: "Up to $16,000 in rebates." });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "dollar_wrong_territory")).toBe(true);
  });

  it("does not block (only warns) $16K on an unknown-territory page", () => {
    const result = lintPageMeta({ pagePath: "/some-other-page", title: "title", metaDescription: "Up to $16,000 in rebates." });
    expect(result.findings.find((f) => f.code === "dollar_unknown_territory")?.severity).toBe("warn");
    expect(result.findings.some((f) => f.code === "dollar_over_max" || f.code === "dollar_wrong_territory")).toBe(false);
  });

  it("blocks empty title/meta", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "", metaDescription: "" });
    expect(result.findings.some((f) => f.code === "empty_title")).toBe(true);
    expect(result.findings.some((f) => f.code === "empty_meta")).toBe(true);
  });

  it("blocks title > 60 chars and meta > 155 chars", () => {
    const result = lintPageMeta({
      pagePath: "/x",
      title: "A".repeat(61),
      metaDescription: "B".repeat(156),
    });
    expect(result.findings.some((f) => f.code === "title_too_long")).toBe(true);
    expect(result.findings.some((f) => f.code === "meta_too_long")).toBe(true);
  });

  it('blocks "limited time" with no date', () => {
    const result = lintPageMeta({ pagePath: "/x", title: "Limited Time Offer", metaDescription: "meta" });
    expect(result.findings.some((f) => f.code === "urgency_no_date")).toBe(true);
  });

  it("blocks urgency language with a past date", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Offer expires 1/1/2020." }, { now: new Date("2026-09-25") });
    expect(result.findings.some((f) => f.code === "urgency_past_date")).toBe(true);
  });

  it("does not block urgency language with a real future date", () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Offer expires 12/31/2027." }, { now: new Date("2026-09-25") });
    expect(result.findings.some((f) => f.severity === "block" && f.code.startsWith("urgency"))).toBe(false);
  });

  it("blocks a title/meta identical to one already used on another page", () => {
    const result = lintPageMeta(
      { pagePath: "/x", title: "Same Title", metaDescription: "meta" },
      { existingTitles: ["Same Title"] },
    );
    expect(result.findings.some((f) => f.code === "duplicate_title")).toBe(true);
  });

  it("isBlocked() convenience matches lintPageMeta().passes inverted", () => {
    expect(isBlocked({ pagePath: "/x", title: "#1 contractor", metaDescription: "meta" })).toBe(true);
    expect(isBlocked({ pagePath: "/x", title: "Fine Title", metaDescription: "A perfectly normal meta description under the limit." })).toBe(false);
  });
});

describe("lintPageMeta — WARN rules (approvable, not blocking)", () => {
  it('warns (does not block) on "free" without context', () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Something free here." });
    expect(result.passes).toBe(true);
    expect(result.findings.some((f) => f.code === "free_without_context" && f.severity === "warn")).toBe(true);
  });

  it('does not warn when "free" has context (e.g. "free assessment")', () => {
    const result = lintPageMeta({ pagePath: "/x", title: "title", metaDescription: "Book a free assessment today." });
    expect(result.findings.some((f) => f.code === "free_without_context")).toBe(false);
  });

  it("warns on same-day/24-7/emergency-off-topic and stale years without blocking", () => {
    const result = lintPageMeta({ pagePath: "/hvac-newark-nj", title: "24/7 same-day emergency service, 2024", metaDescription: "meta" }, { now: new Date("2026-09-25") });
    expect(result.passes).toBe(true);
    expect(result.findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(["same_day_claim", "24_7_claim", "stale_year"]),
    );
  });

  it("does not warn emergency wording on an actual emergency page", () => {
    const result = lintPageMeta({ pagePath: "/emergency-hvac-repair-nj", title: "Emergency HVAC Repair", metaDescription: "meta" });
    expect(result.findings.some((f) => f.code === "emergency_off_topic")).toBe(false);
  });
});

describe("lintPageMeta — a clean page passes with zero findings", () => {
  it("passes a realistic, compliant title/meta", () => {
    const result = lintPageMeta({
      pagePath: "/hvac-newark-nj",
      title: "Newark NJ HVAC Contractor | AC & Heat Pump Installation",
      metaDescription: "Licensed HVAC installation in Newark, NJ. Free assessment, no obligation. Call (862) 423-9396.",
    });
    // Note: this fixture intentionally avoids every BLOCK trigger above.
    expect(result.findings.filter((f) => f.severity === "block")).toEqual([]);
  });
});
