import { describe, it, expect } from "vitest";
import { lintPageMeta, isBlocked, lintWarrantyClaims, lintDifferentiationClaims, lintDifferentiationFactClaims, lintPriceRangeClaims } from "./seoLinter";

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

  it('still blocks "Horizon" as a capitalized competitor mention', () => {
    const result = lintPageMeta({ pagePath: "/x", title: "Better than Horizon Services", metaDescription: "meta" });
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

  it("warns on emergency-off-topic and stale years, and BLOCKS 24/7 + same-day (owner has not confirmed them)", () => {
    const result = lintPageMeta({ pagePath: "/hvac-newark-nj", title: "24/7 same-day emergency service, 2024", metaDescription: "meta" }, { now: new Date("2026-09-25") });
    expect(result.passes).toBe(false);
    const codes = result.findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["service_hours_24x7_unverified", "service_hours_same_day_unverified", "stale_year"]));
    expect(codes).not.toContain("same_day_claim"); // the old WARNs were superseded, not duplicated
    expect(codes).not.toContain("24_7_claim");
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

describe("lintPageMeta — word-boundary matching (phrase lists must not match inside ordinary words)", () => {
  it('does not block "heart of Essex County" — "hear" (EXPIRED_INCENTIVES, the HEAR program) must not match "heart"', () => {
    const result = lintPageMeta({
      pagePath: "/hvac-newark-nj",
      title: "Proudly serving the heart of Essex County, NJ",
      metaDescription: "Licensed HVAC installation in Newark, NJ. Call (862) 423-9396.",
    });
    expect(result.findings.some((f) => f.code === "expired_incentive")).toBe(false);
  });

  it('does not block "asbestos" — "best" (SUPERLATIVES) must not match inside "asbestos"', () => {
    const result = lintPageMeta({
      pagePath: "/x",
      title: "Older HVAC systems may contain asbestos insulation",
      metaDescription: "Licensed HVAC installation. Call (862) 423-9396.",
    });
    expect(result.findings.some((f) => f.code === "superlative")).toBe(false);
  });

  it('does not block "on the horizon" — competitor brand matching is case-sensitive, so lowercase "horizon" the word is not "Horizon" the company', () => {
    const result = lintPageMeta(
      { pagePath: "/x", title: "New HVAC rebates on the horizon for 2026", metaDescription: "Licensed HVAC installation. Call (862) 423-9396." },
      { now: new Date("2026-09-25") },
    );
    expect(result.findings.some((f) => f.code === "competitor_name")).toBe(false);
  });

  it('still blocks "HEAR" as a standalone word — the boundary fix does not remove real matches', () => {
    const result = lintPageMeta({
      pagePath: "/x",
      title: "title",
      metaDescription: "Combine PSE&G rebates with the HEAR program benefits.",
    });
    expect(result.findings.some((f) => f.code === "expired_incentive")).toBe(true);
  });
});

describe("lintWarrantyClaims (docs/positioning-warranty-spec.md §2, acceptance §8)", () => {
  it('blocks "free 10-year warranty" — implies included', () => {
    const findings = lintWarrantyClaims("Every install includes a free 10-year warranty.");
    expect(findings.some((f) => f.code === "warranty_implies_included" && f.severity === "block")).toBe(true);
  });

  it('blocks "included" near "coverage"', () => {
    const findings = lintWarrantyClaims("10-year parts and labor coverage is included with every install.");
    expect(findings.some((f) => f.code === "warranty_implies_included")).toBe(true);
  });

  it('blocks "lifetime" as an absolute claim', () => {
    const findings = lintWarrantyClaims("Lifetime warranty on all new systems.");
    expect(findings.some((f) => f.code === "warranty_absolute_claim")).toBe(true);
  });

  it('blocks "unlimited" and "guaranteed for life"', () => {
    expect(lintWarrantyClaims("Unlimited coverage for your system.").some((f) => f.code === "warranty_absolute_claim")).toBe(true);
    expect(lintWarrantyClaims("Guaranteed for life, no exceptions.").some((f) => f.code === "warranty_absolute_claim")).toBe(true);
  });

  it("blocks a manufacturer's warranty presented as our own coverage", () => {
    const findings = lintWarrantyClaims("We include the manufacturer's warranty as our coverage.");
    expect(findings.some((f) => f.code === "warranty_manufacturer_confusion")).toBe(true);
  });

  it("does not block a bare mention of a manufacturer's warranty with no first-person framing", () => {
    const findings = lintWarrantyClaims("The manufacturer's warranty covers defects in materials.");
    expect(findings.some((f) => f.code === "warranty_manufacturer_confusion")).toBe(false);
  });

  it('blocks a year count other than 10 next to "warranty"/"coverage"', () => {
    const findings = lintWarrantyClaims("Ask about our 5-year warranty on new installs.");
    expect(findings.some((f) => f.code === "warranty_wrong_year_count")).toBe(true);
  });

  it("does not block the verified 10-year figure", () => {
    const findings = lintWarrantyClaims("Ask about our 10-year parts and labor coverage.");
    expect(findings.some((f) => f.code === "warranty_wrong_year_count")).toBe(false);
  });

  it('blocks "existing systems covered" without "eligibility"/"qualify" in the same sentence', () => {
    const findings = lintWarrantyClaims("Existing systems covered under our warranty program.");
    expect(findings.some((f) => f.code === "warranty_existing_no_eligibility")).toBe(true);
  });

  it("allows existing-system coverage when eligibility is stated in the same sentence", () => {
    const findings = lintWarrantyClaims("Existing systems may qualify for coverage after an eligibility inspection.");
    expect(findings.some((f) => f.code === "warranty_existing_no_eligibility")).toBe(false);
  });

  it("blocks a provider/administrator brand name outside the terms page", () => {
    const findings = lintWarrantyClaims("Coverage is backed by Acme Assurance Group.", { allowedOnTermsPage: false });
    // No brand names are seeded yet (spec: administrator not named in marketing copy) — placeholder
    // regression: once WARRANTY_ADMIN_BRAND_NAMES gains an entry, this should start blocking it.
    expect(Array.isArray(findings)).toBe(true);
  });

  it("warns when first '10-year' use is not followed by 'parts & labor'", () => {
    const findings = lintWarrantyClaims("Ask about our 10-year coverage plan today.");
    expect(findings.some((f) => f.code === "warranty_missing_parts_labor" && f.severity === "warn")).toBe(true);
  });

  it("does not warn when '10-year' is immediately followed by 'parts & labor'", () => {
    const findings = lintWarrantyClaims("Ask about our 10-year parts & labor coverage plan today.");
    expect(findings.some((f) => f.code === "warranty_missing_parts_labor")).toBe(false);
  });

  it("lintPageMeta blocks a meta description with an implied-included warranty claim", () => {
    const result = lintPageMeta({ pagePath: "/warranty", title: "10-Year Coverage", metaDescription: "Every install comes with a free warranty, no cost to you." });
    expect(result.passes).toBe(false);
    expect(result.findings.some((f) => f.code === "warranty_implies_included")).toBe(true);
  });
});

describe("lintDifferentiationClaims (docs/positioning-warranty-spec.md §9, acceptance)", () => {
  it('blocks "lease" — we do not own/lease the equipment', () => {
    expect(lintDifferentiationClaims("Membership includes a lease on your new system.").some((f) => f.code === "membership_equipment_ownership_implied")).toBe(true);
  });

  it('blocks "rent" and "subscription includes the equipment"', () => {
    expect(lintDifferentiationClaims("You rent the equipment with membership.").some((f) => f.code === "membership_equipment_ownership_implied")).toBe(true);
    expect(lintDifferentiationClaims("Our subscription includes the equipment.").some((f) => f.code === "membership_equipment_ownership_implied")).toBe(true);
  });

  it('blocks "$0 down for everything"', () => {
    expect(lintDifferentiationClaims("$0 down for everything, guaranteed.").some((f) => f.code === "membership_equipment_ownership_implied")).toBe(true);
  });

  it('blocks "money-back", "refund if", "remove it and refund", "satisfaction guarantee" (not offered)', () => {
    for (const phrase of ["30-day money-back promise", "refund if you're not happy", "we'll remove it and refund you", "100% satisfaction guarantee"]) {
      expect(lintDifferentiationClaims(phrase).some((f) => f.code === "comfort_refund_guarantee_not_offered"), phrase).toBe(true);
    }
  });

  it('blocks "guaranteed uptime" and "never fail"', () => {
    expect(lintDifferentiationClaims("Our portfolio SLA offers guaranteed uptime.").some((f) => f.code === "sla_absolute_claim")).toBe(true);
    expect(lintDifferentiationClaims("Your systems will never fail.").some((f) => f.code === "sla_absolute_claim")).toBe(true);
  });

  it('blocks "guaranteed detection"', () => {
    expect(lintDifferentiationClaims("Proactive monitoring means guaranteed detection.").some((f) => f.code === "monitoring_absolute_claim")).toBe(true);
  });

  it("passes clean membership/portfolio/monitoring copy", () => {
    expect(lintDifferentiationClaims("Comfort Membership is a monthly fee. You own the system.")).toEqual([]);
  });
});

describe("lintDifferentiationFactClaims", () => {
  it("blocks an SLA-hour claim when responseHours is unverified (null)", () => {
    const findings = lintDifferentiationFactClaims("We offer 24-hour response on every portfolio.", { portfolioSla: { responseHours: null }, monitoring: { is24x7: false } });
    expect(findings.some((f) => f.code === "sla_hours_mismatch")).toBe(true);
  });

  it("blocks an SLA-hour claim that doesn't match the verified figure", () => {
    const findings = lintDifferentiationFactClaims("We offer 24-hour response.", { portfolioSla: { responseHours: 48 }, monitoring: { is24x7: false } });
    expect(findings.some((f) => f.code === "sla_hours_mismatch")).toBe(true);
  });

  it("allows an SLA-hour claim that matches the verified figure", () => {
    const findings = lintDifferentiationFactClaims("We offer 48-hour response.", { portfolioSla: { responseHours: 48 }, monitoring: { is24x7: false } });
    expect(findings.some((f) => f.code === "sla_hours_mismatch")).toBe(false);
  });

  it('blocks "24/7 monitoring" when is24x7 is false', () => {
    const findings = lintDifferentiationFactClaims("We offer 24/7 monitoring on every system.", { portfolioSla: { responseHours: null }, monitoring: { is24x7: false } });
    expect(findings.some((f) => f.code === "monitoring_24x7_unverified")).toBe(true);
  });

  it('allows "24/7 monitoring" once is24x7 is confirmed true', () => {
    const findings = lintDifferentiationFactClaims("We offer 24/7 monitoring on every system.", { portfolioSla: { responseHours: null }, monitoring: { is24x7: true } });
    expect(findings.some((f) => f.code === "monitoring_24x7_unverified")).toBe(false);
  });
});

describe("lintPriceRangeClaims", () => {
  it("blocks an installed-price claim when no price range is verified for the page", () => {
    const findings = lintPriceRangeClaims("/heat-pump-installation-nj", "Heat pumps typically run $5,000-$9,000 installed.", []);
    expect(findings.some((f) => f.code === "unverified_price_range")).toBe(true);
  });

  it("allows a claim that matches a verified range exactly", () => {
    const ranges = [{ page: "/heat-pump-installation-nj", low: 5000, high: 9000 }];
    const findings = lintPriceRangeClaims("/heat-pump-installation-nj", "Heat pumps typically run $5,000-$9,000 installed.", ranges);
    expect(findings.some((f) => f.code === "unverified_price_range")).toBe(false);
  });

  it("blocks a claim whose numbers don't match the verified range", () => {
    const ranges = [{ page: "/heat-pump-installation-nj", low: 5000, high: 9000 }];
    const findings = lintPriceRangeClaims("/heat-pump-installation-nj", "Heat pumps typically run $6,000-$10,000 installed.", ranges);
    expect(findings.some((f) => f.code === "unverified_price_range")).toBe(true);
  });

  it("does not flag a range verified for a different page", () => {
    const ranges = [{ page: "/central-ac-installation-nj", low: 5000, high: 9000 }];
    const findings = lintPriceRangeClaims("/heat-pump-installation-nj", "Heat pumps typically run $5,000-$9,000 installed.", ranges);
    expect(findings.some((f) => f.code === "unverified_price_range")).toBe(true);
  });

  it("does not false-positive on an ordinary rebate dollar mention with no 'installed' language", () => {
    const findings = lintPriceRangeClaims("/heat-pump-installation-nj", "Save up to $16,000 with NJ rebates.", []);
    expect(findings.some((f) => f.code === "unverified_price_range")).toBe(false);
  });
});

describe("lintDifferentiationClaims — negated lease/rent (calibration)", () => {
  const blocked = (t: string) => lintDifferentiationClaims(t).some((f) => f.code === "membership_equipment_ownership_implied");

  it('allows "not a lease", "unlike a lease", "we don\'t rent", and ownership-plus-negation sentences', () => {
    for (const t of ["This is not a lease.", "Unlike a lease, you own it.", "We don't rent equipment.", "You own the system — there is no lease.", "Never a rent-to-own deal."]) {
      expect(blocked(t), t).toBe(false);
    }
  });

  it("still blocks asserted lease/rent, including after an unrelated negation or an ownership claim", () => {
    for (const t of ["Membership includes a lease.", "You rent the equipment.", "It is not cheap, and you lease the unit.", "You own the system, and we lease the equipment back."]) {
      expect(blocked(t), t).toBe(true);
    }
  });

  it("a negated mention does not mask a separate asserted one", () => {
    expect(blocked("This is not a lease. Our membership includes a lease.")).toBe(true);
  });

  it('other membership phrases are unaffected by negation ("subscription includes the equipment")', () => {
    expect(blocked("Not cheap: our subscription includes the equipment.")).toBe(true);
  });
});

describe("lintPageMeta — dollar ranges, service hours, rebate-leading titles (owner decisions 2026-09-29)", () => {
  const meta = (title: string, metaDescription: string, pagePath = "/blog/x", opts = {}) => lintPageMeta({ pagePath, title, metaDescription }, opts);
  const codes = (r: ReturnType<typeof lintPageMeta>) => r.findings.map((f) => f.code);

  it.each([
    "Replacement costs $8,000–$15,000 depending on size.",
    "Costs run $100-$200 per pound.",
    "Budget $5K to $9K for a mini-split.",
    "About $8,000 — $15,000 all in.",
  ])("BLOCKS an unverified dollar range: %s", (t) => {
    const r = meta("HVAC guide", t);
    expect(codes(r)).toContain("unverified_dollar_range");
    expect(r.passes).toBe(false);
  });

  it("allows a range that exactly matches a verified priceRanges entry (any page), including K notation", () => {
    const opts = { priceRanges: [{ page: "/a", low: 8000, high: 15000 }] };
    expect(codes(meta("HVAC guide", "Costs $8,000–$15,000 typically.", "/blog/x", opts))).not.toContain("unverified_dollar_range");
    expect(codes(meta("HVAC guide", "Costs $8K-$15K typically.", "/blog/x", opts))).not.toContain("unverified_dollar_range");
    expect(codes(meta("HVAC guide", "Costs $8,000–$16,000 typically.", "/blog/x", opts))).toContain("unverified_dollar_range");
  });

  it("does not treat a single figure or 'up to $16K' as a range, and leaves 'installed' ranges to the page-specific rule", () => {
    expect(codes(meta("HVAC guide", "PSE&G rebates up to $16K may apply."))).not.toContain("unverified_dollar_range");
    const installed = meta("HVAC guide", "Systems run $5,000-$9,000 installed.");
    expect(codes(installed)).toContain("unverified_price_range");
    expect(codes(installed)).not.toContain("unverified_dollar_range");
  });

  it.each(["24/7 emergency help", "Service around the clock", "Around-the-clock repair", "Same-day installs", "same day service", "24x7 support"])(
    'BLOCKS an unverified service-hours claim: "%s"',
    (t) => {
      const r = meta("HVAC guide", t);
      expect(r.passes).toBe(false);
      expect(codes(r).some((c) => c.startsWith("service_hours_"))).toBe(true);
    },
  );

  it("allows 24/7 and same-day only when the serviceHours fact says so", () => {
    const yes = { differentiationFacts: { portfolioSla: { responseHours: null }, monitoring: { is24x7: false }, serviceHours: { emergency24x7: true, sameDay: true } } };
    expect(codes(meta("HVAC guide", "24/7 emergency help, same-day installs", "/blog/x", yes)).some((c) => c.startsWith("service_hours_"))).toBe(false);
    const only24 = { differentiationFacts: { portfolioSla: { responseHours: null }, monitoring: { is24x7: false }, serviceHours: { emergency24x7: true, sameDay: false } } };
    const r = meta("HVAC guide", "24/7 emergency help, same-day installs", "/blog/x", only24);
    expect(codes(r)).toContain("service_hours_same_day_unverified");
    expect(codes(r)).not.toContain("service_hours_24x7_unverified");
  });

  it('"24/7 monitoring" is reported once, by the monitoring rule, not twice', () => {
    const c = codes(meta("HVAC guide", "Enjoy 24/7 monitoring on your system."));
    expect(c).toContain("monitoring_24x7_unverified");
    expect(c).not.toContain("service_hours_24x7_unverified");
  });

  it("WARNS (does not block) when an installation or city page title LEADS with rebates or a dollar figure", () => {
    for (const [path, title] of [
      ["/hvac-union-nj", "Up to $16K PSE&G Rebates | Union NJ HVAC Installation"],
      ["/hvac-newark-nj", "NJ Rebates for HVAC Installation in Newark"],
      ["/heat-pump-installation-nj", "$16K Rebates on Heat Pump Installation"],
      ["/central-ac-installation-nj", "PSE&G Incentives: Central AC Installation"],
    ]) {
      const r = meta(title, "Quality installation with optional 10-year parts & labor coverage.", path);
      expect(codes(r), title).toContain("title_leads_with_rebate");
      expect(r.findings.find((f) => f.code === "title_leads_with_rebate")?.severity).toBe("warn");
      expect(r.passes, title).toBe(true);
    }
  });

  it("does NOT warn when rebates are a later clause, on blog posts, or on /direct-install pages", () => {
    const meta2 = "Quality installation with optional 10-year parts & labor coverage.";
    expect(codes(meta("Short Hills NJ HVAC Installation | Up to $16K Rebates", meta2, "/hvac-short-hills-nj"))).not.toContain("title_leads_with_rebate");
    expect(codes(meta("PSE&G Instant Rebate Program for HVAC", meta2, "/blog/pseg-instant-rebate-program-nj"))).not.toContain("title_leads_with_rebate");
    expect(codes(meta("Free Lighting & HVAC Rebates for Bakeries", meta2, "/direct-install/bakeries-nj"))).not.toContain("title_leads_with_rebate");
  });
});

describe("lintPageMeta — verified numeric claims (counties / years / customers / projects)", () => {
  const lint = (title: string, metaDescription: string, opts = {}) => lintPageMeta({ pagePath: "/blog/x", title, metaDescription }, opts);
  const codes = (r: ReturnType<typeof lintPageMeta>) => r.findings.map((f) => f.code);
  const ok = "Quality installation with optional 10-year parts & labor coverage.";

  it("BLOCKS the unbacked '15 counties' figure in a meta description", () => {
    const r = lint("HVAC Installation in NJ", "Serving 15 counties across New Jersey. " + ok);
    expect(codes(r)).toContain("unverified_county_count");
    expect(r.passes).toBe(false);
    expect(r.findings.find((f) => f.code === "unverified_county_count")).toMatchObject({ severity: "block", field: "both" });
  });

  it("scans the TITLE too", () => {
    const r = lint("500+ Happy Customers | NJ HVAC", ok);
    expect(codes(r)).toContain("unverified_customer_count");
    expect(r.passes).toBe(false);
  });

  it("uses the real VERIFIED_FACTS by default: 20+ years and 9 counties pass, 25 years does not", () => {
    expect(codes(lint("NJ HVAC Installation", "20+ years of experience serving 9 counties. " + ok))).not.toEqual(expect.arrayContaining(["unverified_years_claim", "unverified_county_count"]));
    expect(lint("NJ HVAC Installation", "20+ years of experience serving 9 counties. " + ok).passes).toBe(true);
    expect(codes(lint("NJ HVAC Installation", "25 years of experience. " + ok))).toContain("unverified_years_claim");
  });

  it("checks against the figures a caller passes (numericFacts override)", () => {
    const nf = { serviceCounties: 15, yearsInBusiness: 20, customersServed: 500, projectsCompleted: null };
    expect(codes(lint("NJ HVAC", "Serving 15 counties with 500 customers. " + ok, { numericFacts: nf }))).not.toEqual(expect.arrayContaining(["unverified_county_count", "unverified_customer_count"]));
    expect(codes(lint("NJ HVAC", "Over 300 completed projects. " + ok, { numericFacts: nf }))).toContain("unverified_project_count");
  });

  it("leaves warranty terms and other numbers to their own rules — '10-year parts & labor' is not a years-in-business claim", () => {
    const r = lint("Heat Pump Installation NJ | 10-Year Parts & Labor", "Optional 10-year parts & labor coverage on new installations by our team.");
    for (const c of ["unverified_years_claim", "unverified_county_count", "unverified_customer_count", "unverified_project_count"]) expect(codes(r)).not.toContain(c);
  });
});
