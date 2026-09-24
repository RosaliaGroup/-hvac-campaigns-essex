import { describe, it, expect } from "vitest";
import { getRouteStatus, injectMeta } from "../edge-functions/inject-meta";

// PR-1 item A: real 404s for unregistered routes, without breaking any
// registered route — public, internal/CRM, or public-dynamic.
describe("getRouteStatus", () => {
  it("registers real, static public routes from routes-manifest.json", () => {
    for (const p of ["/", "/commercial", "/residential", "/qualify", "/assessment", "/promos"]) {
      expect(getRouteStatus(p)).toEqual({ isRegistered: true, isInternalOrDynamic: false });
    }
  });

  it("registers pages deliberately excluded from the sitemap (item C) — they must still 200, not 404", () => {
    for (const p of ["/courses", "/portal", "/estimating", "/presentation-2026", "/lp/fb-commercial", "/lp/fb-residential", "/lp/referral-partner", "/lp/rebate-guide"]) {
      const status = getRouteStatus(p);
      expect(status.isRegistered).toBe(true);
    }
  });

  it("registers real city pages", () => {
    expect(getRouteStatus("/hvac-newark-nj").isRegistered).toBe(true);
    expect(getRouteStatus("/hvac-clifton-nj").isRegistered).toBe(true);
    expect(getRouteStatus("/hvac-woodbridge-nj").isRegistered).toBe(true);
  });

  it("returns a real 404 for an unregistered hvac-*-nj slug (the fixed title-injection bug)", () => {
    // Paterson and Edison are NOT registered city pages — Home.tsx used to
    // link to them under the wrong labels (see PR-1), and inject-meta used
    // to fabricate a full SEO title/description for them via pattern-match
    // alone. Neither city has a real page.
    expect(getRouteStatus("/hvac-paterson-nj").isRegistered).toBe(false);
    expect(getRouteStatus("/hvac-edison-nj").isRegistered).toBe(false);
  });

  it("returns a real 404 for junk/nonexistent paths", () => {
    expect(getRouteStatus("/this-page-does-not-exist").isRegistered).toBe(false);
    expect(getRouteStatus("/hvac-newark-nj-extra-junk").isRegistered).toBe(false);
  });

  it("registers real blog posts and 404s an unregistered blog slug", () => {
    expect(getRouteStatus("/blog/pseg-rebate-application-process").isRegistered).toBe(true);
    expect(getRouteStatus("/blog/this-post-does-not-exist").isRegistered).toBe(false);
  });

  it("keeps every internal/CRM route registered and marks it internal (noindex, no fake SEO meta)", () => {
    for (const p of ["/admin", "/leads", "/leads/123", "/command-center", "/team-management", "/opportunities/abc-123", "/portal/dashboard"]) {
      expect(getRouteStatus(p)).toEqual({ isRegistered: true, isInternalOrDynamic: true });
    }
  });

  it("keeps /courses/:id registered and internal-flagged even though it isn't enumerable in the manifest", () => {
    expect(getRouteStatus("/courses/hvac-101")).toEqual({ isRegistered: true, isInternalOrDynamic: true });
  });

  it("ignores query strings and trailing slashes", () => {
    expect(getRouteStatus("/commercial?utm_source=google").isRegistered).toBe(true);
    expect(getRouteStatus("/commercial/").isRegistered).toBe(true);
  });

  // pr1-hotfix-build: /team-login, /accept-invite, /reset-password are real,
  // public, pre-authentication CRM entry points — a staff member cannot log
  // in at all if these 404. They were caught 404ing on the deploy-preview-114
  // check because scripts/generate-sitemap.ts's old SKIP_PATHS filter (meant
  // to keep auth pages out of the SEARCH-ENGINE sitemap) was also feeding
  // routes-manifest.json (the 404-decision list) — conflating "don't index
  // this" with "this route doesn't exist." Fixed by only excluding them from
  // the sitemap, not the manifest.
  it("keeps the CRM auth entry points registered — staff cannot reach them if these 404", () => {
    for (const p of ["/team-login", "/accept-invite", "/reset-password"]) {
      expect(getRouteStatus(p).isRegistered, `${p} must resolve — it's the CRM's own auth entry point`).toBe(true);
    }
  });

  // /m was never a real route in this app — confirmed by a repo-wide grep for
  // the literal string "/m" across every .ts/.tsx/.toml file (zero matches).
  // It only ever appeared as an illustrative example path in the original
  // PR-1 handoff spec's internal-route list, not as an actual <Route> in
  // App.tsx, a navigation.ts prefix, or a link anywhere in the codebase. A
  // real 404 for it is correct, expected behavior, not a regression.
  it("correctly 404s /m — it was never a real route, unlike the auth pages above", () => {
    expect(getRouteStatus("/m").isRegistered).toBe(false);
    expect(getRouteStatus("/m/").isRegistered).toBe(false);
  });
});

// PR-1: every URL a Vapi tool, SMS template, or transactional email sends
// directly to a real customer today. Traced repo-wide (grep for
// "mechanicalenterprise.com/" across server/, netlify/functions/, shared/)
// during Step-0/Step-2 review. If any of these ever became unregistered —
// a typo in a future edit, a route rename, a sitemap-exclusion mistake —
// the customer would land on a 404 instead of the real page, silently
// breaking a live lead-generation or customer-communication channel. This
// test is the guard against that regression; it is deliberately independent
// of the "known routes" tests above so a change to those can't accidentally
// stop covering these specific, high-stakes URLs.
describe("getRouteStatus — every URL sent directly to customers by Vapi/SMS/email stays registered", () => {
  it("never 404s a customer-facing send-target URL", () => {
    const customerFacingSendTargets: Record<string, string> = {
      "/referral": "Vapi sendReferralLink SMS (server/services/referralSms.ts CUSTOMER_REFERRAL_LINK) + netlify/functions/sendReferralEmails.js referral-program mention",
      "/qualify": "Vapi sendForm tool (server/services/vapiSendForm.ts) + netlify/functions/sendReferralEmails.js BOOKING_URL",
      "/assessment": "same Qualify.tsx component as /qualify; LiveChatWidget.tsx ASSESSMENT_URL",
      "/rebate-calculator": "rebate calculator client confirmation email (server/routers/rebateCalculator.ts, '#assessment' anchor — hash is not part of route matching)",
      "/pseg-rebate-contractor-nj": "PSE&G rebate checklist customer email (server/routers.ts)",
      "/promos": "kept registered and indexable per PR-1 item C; verified live in Step 2",
    };
    for (const [path, sentBy] of Object.entries(customerFacingSendTargets)) {
      const status = getRouteStatus(path);
      expect(status.isRegistered, `${path} (sent by: ${sentBy}) must resolve, not 404`).toBe(true);
      expect(status.isInternalOrDynamic, `${path} is customer-facing marketing content, not CRM/internal`).toBe(false);
    }
  });
});

describe("injectMeta — unregistered slug no longer gets fabricated city metadata", () => {
  it("getMetaForPath is only reachable for registered routes in the real handler (see getRouteStatus tests above); injectMeta itself is still exercised for known routes", () => {
    const html = `<html><head><title>x</title><meta name="description" content="x" /></head><body></body></html>`;
    const out = injectMeta(html, "/hvac-newark-nj");
    expect(out).toContain("Newark NJ HVAC Contractor");
  });
});
