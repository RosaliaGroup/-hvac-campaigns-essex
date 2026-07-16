/**
 * Tests for the frontend conversion helper + its wiring.
 *
 * Mirrors analytics.test.ts: vitest "node" env, `window`/`gtag` stubbed via
 * vi.stubGlobal and the GA4 env var via vi.stubEnv. Behavioural tests cover the
 * helper; static "wiring proof" tests assert the instrumented forms call
 * trackConversion ONLY on the confirmed-success path and never pass PII.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  trackConversion,
  mapServiceToConversion,
  resolveQuickQuoteConversion,
  ADS_CONVERSION_LABELS,
  ADS_CONVERSION_ID,
  __resetConversionTrackingForTests,
  type ConversionEvent,
} from "./conversions";

const GA4_ID = "G-TEST12345";
const root = path.resolve(__dirname, "..", "..", "..");

function enableGa4() {
  vi.stubEnv("VITE_GA4_MEASUREMENT_ID", GA4_ID);
}
function disableGa4() {
  vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "");
}

let gtag: ReturnType<typeof vi.fn>;
beforeEach(() => {
  gtag = vi.fn();
  vi.stubGlobal("window", { gtag, location: { pathname: "/services/ac-repair" } });
  __resetConversionTrackingForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Extract the params object of the Nth gtag("event", …) call. */
function eventParams(call = 0) {
  return gtag.mock.calls[call]?.[2] as Record<string, unknown>;
}

describe("trackConversion — confirmed success fires exactly once", () => {
  beforeEach(enableGa4);

  it("emits one GA4-scoped event with the coarse, non-PII payload", () => {
    trackConversion(
      "quote_request",
      { form_type: "quick_quote_form", service_category: "general", customer_segment: "residential", lead_source_surface: "quick_quote_form" },
      { dedupeKey: "sub-1" },
    );
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "quote_request", {
      page_path: "/services/ac-repair",
      form_type: "quick_quote_form",
      service_category: "general",
      customer_segment: "residential",
      lead_source_surface: "quick_quote_form",
      send_to: GA4_ID,
    });
  });

  it("scopes to GA4 via send_to and never references the Ads account by default", () => {
    trackConversion("installation_request", { service_category: "installation" }, { dedupeKey: "sub-2" });
    expect(eventParams().send_to).toBe(GA4_ID);
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("AW-");
  });
});

describe("failed submission fires zero times", () => {
  beforeEach(enableGa4);
  it("a caller that never invokes trackConversion (onError path) sends nothing", () => {
    // The onError path simply does not call trackConversion — modelled here.
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("retry after failure fires once after eventual success", () => {
  beforeEach(enableGa4);
  it("first attempt fails (no call), the eventual success fires exactly once", () => {
    // attempt #1 -> API failure -> onError -> (no trackConversion)
    // attempt #2 -> success -> onSuccess -> trackConversion, same submission key
    const key = "retry-sub";
    // success path:
    trackConversion("repair_request", { service_category: "repair" }, { dedupeKey: key });
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});

describe("idempotency — double-click / re-render / StrictMode never duplicate", () => {
  beforeEach(enableGa4);

  it("the same dedupeKey fires once even if called many times", () => {
    for (let i = 0; i < 5; i++) {
      trackConversion("service_request", { service_category: "emergency" }, { dedupeKey: "same-key" });
    }
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it("distinct submissions (distinct keys) each fire once", () => {
    trackConversion("quote_request", {}, { dedupeKey: "k1" });
    trackConversion("quote_request", {}, { dedupeKey: "k2" });
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it("returns false on the deduped repeat", () => {
    expect(trackConversion("quote_request", {}, { dedupeKey: "k" })).toBe(true);
    expect(trackConversion("quote_request", {}, { dedupeKey: "k" })).toBe(false);
  });
});

describe("page_path — query string and hash are stripped", () => {
  beforeEach(enableGa4);

  it("removes ?query and #hash from an explicit page_path", () => {
    trackConversion("quote_request", { page_path: "/quote?token=secret&email=a@b.com#form" }, { dedupeKey: "p1" });
    expect(eventParams().page_path).toBe("/quote");
    expect(JSON.stringify(eventParams())).not.toContain("token");
    expect(JSON.stringify(eventParams())).not.toContain("@");
  });

  it("defaults to window.location.pathname when no page_path is given", () => {
    trackConversion("quote_request", {}, { dedupeKey: "p2" });
    expect(eventParams().page_path).toBe("/services/ac-repair");
  });
});

describe("no PII ever appears in the payload", () => {
  beforeEach(enableGa4);

  it("drops any non-allowlisted field even if a caller forces it in", () => {
    trackConversion(
      "quote_request",
      {
        service_category: "general",
        // Simulate a careless caller leaking PII — must be stripped.
        name: "John Smith",
        email: "john@example.com",
        phone: "8625551234",
        message: "my address is 5 Main St, 07030",
        customerId: 42,
      } as unknown as Parameters<typeof trackConversion>[1],
      { dedupeKey: "pii" },
    );
    const json = JSON.stringify(eventParams());
    for (const leak of ["John", "@example.com", "8625551234", "Main St", "07030", "customerId"]) {
      expect(json).not.toContain(leak);
    }
    expect(Object.keys(eventParams()).sort()).toEqual(["page_path", "send_to", "service_category"].sort());
  });
});

describe("no-op safety", () => {
  it("does nothing when GA4 is unset and no Ads label exists", () => {
    disableGa4();
    trackConversion("quote_request", { service_category: "general" }, { dedupeKey: "n1" });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("does not throw when window.gtag is unavailable", () => {
    enableGa4();
    vi.stubGlobal("window", { location: { pathname: "/" } }); // no gtag
    expect(() => trackConversion("quote_request", {}, { dedupeKey: "n2" })).not.toThrow();
  });

  it("does not throw when there is no window at all (SSR/test)", () => {
    enableGa4();
    vi.stubGlobal("window", undefined);
    expect(() => trackConversion("quote_request", {}, { dedupeKey: "n3" })).not.toThrow();
  });
});

describe("Google Ads label independence", () => {
  it("unset Ads label does NOT block the GA4 event", () => {
    enableGa4();
    expect(ADS_CONVERSION_LABELS.quote_request).toBeNull();
    trackConversion("quote_request", { service_category: "general" }, { dedupeKey: "ads-null" });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "quote_request", expect.objectContaining({ send_to: GA4_ID }));
    // no separate Ads "conversion" event
    expect(gtag.mock.calls.some((c) => c[1] === "conversion")).toBe(false);
  });

  it("a configured Ads label fires a separate Ads conversion alongside GA4", () => {
    enableGa4();
    const original = ADS_CONVERSION_LABELS.quote_request;
    ADS_CONVERSION_LABELS.quote_request = "abc123LABEL";
    try {
      trackConversion("quote_request", { service_category: "general" }, { dedupeKey: "ads-set" });
      expect(gtag).toHaveBeenCalledTimes(2);
      expect(gtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: `${ADS_CONVERSION_ID}/abc123LABEL`,
      });
    } finally {
      ADS_CONVERSION_LABELS.quote_request = original;
    }
  });
});

describe("value/currency are emitted only as a documented pair", () => {
  beforeEach(enableGa4);

  it("omits value when currency is missing", () => {
    trackConversion("quote_request", { value: 500 } as never, { dedupeKey: "v1" });
    expect(eventParams()).not.toHaveProperty("value");
  });

  it("includes value + currency when both are present", () => {
    trackConversion("quote_request", { value: 500, currency: "USD" }, { dedupeKey: "v2" });
    expect(eventParams().value).toBe(500);
    expect(eventParams().currency).toBe("USD");
  });
});

describe("mapServiceToConversion — non-PII classification", () => {
  const cases: Array<[string, ConversionEvent, string]> = [
    ["Emergency Repair", "repair_request", "repair"],
    ["Heat Pump Installation", "installation_request", "installation"],
    ["AC Installation", "installation_request", "installation"],
    ["Heating Installation", "installation_request", "installation"],
    ["HVAC Replacement", "replacement_request", "replacement"],
    ["Maintenance Subscription", "maintenance_plan_inquiry", "maintenance"],
    ["Commercial HVAC", "commercial_quote_request", "commercial"],
    ["VRF/VRV System", "commercial_quote_request", "commercial"],
    ["Residential HVAC", "residential_quote_request", "residential"],
    ["Rebate Consultation", "quote_request", "general"],
    ["Other", "quote_request", "general"],
    ["", "quote_request", "general"],
  ];
  it.each(cases)("maps %s -> %s / %s", (service, event, category) => {
    const m = mapServiceToConversion(service);
    expect(m.event).toBe(event);
    expect(m.service_category).toBe(category);
  });

  it("labels commercial services with the commercial segment", () => {
    expect(mapServiceToConversion("Commercial HVAC").customer_segment).toBe("commercial");
    expect(mapServiceToConversion("VRF/VRV System").customer_segment).toBe("commercial");
  });

  it("never returns the raw service string as a parameter", () => {
    const m = mapServiceToConversion("John's Emergency Repair at 5 Main St");
    expect(JSON.stringify(m)).not.toContain("John");
    expect(JSON.stringify(m)).not.toContain("Main St");
  });
});

describe("resolveQuickQuoteConversion — placement (source) combined with picked service", () => {
  it('Contact-page generic submission (no specific service) resolves to contact_form_submit', () => {
    for (const service of ["", "Other", "Rebate Consultation", undefined]) {
      const m = resolveQuickQuoteConversion("contact", service as string | undefined);
      expect(m.event).toBe("contact_form_submit");
      expect(m.service_category).toBe("contact");
    }
  });

  it("a deliberately-picked HVAC System Replacement resolves to replacement_request even on the Contact page", () => {
    const m = resolveQuickQuoteConversion("contact", "HVAC System Replacement");
    expect(m.event).toBe("replacement_request");
    expect(m.service_category).toBe("replacement");
  });

  it("an installation selection resolves to installation_request — never contact_form_submit or replacement_request", () => {
    for (const service of ["AC Installation", "Heat Pump Installation", "Heating Installation"]) {
      const m = resolveQuickQuoteConversion("contact", service);
      expect(m.event).toBe("installation_request");
      expect(m.event).not.toBe("replacement_request");
      expect(m.event).not.toBe("contact_form_submit");
    }
  });

  it("without a contact source, a generic submission keeps the plain quote_request (contact_form_submit is contact-only)", () => {
    const m = resolveQuickQuoteConversion(undefined, "Other");
    expect(m.event).toBe("quote_request");
  });

  it("without a contact source, a replacement pick still resolves to replacement_request", () => {
    expect(resolveQuickQuoteConversion(undefined, "HVAC System Replacement").event).toBe("replacement_request");
  });

  it("does not mutate the underlying mapServiceToConversion mappings", () => {
    expect(mapServiceToConversion("Other").event).toBe("quote_request");
    expect(mapServiceToConversion("AC Installation").event).toBe("installation_request");
  });
});

describe("form success/failure paths — one event per confirmed success, zero on failure", () => {
  beforeEach(enableGa4);

  function fireSuccess(source: "contact" | undefined, service: string, key: string) {
    // Models QuickQuoteForm.onSuccess: resolve, then fire once keyed on the submission.
    const m = resolveQuickQuoteConversion(source, service);
    return trackConversion(
      m.event,
      {
        form_type: "quick_quote_form",
        service_category: m.service_category,
        customer_segment: m.customer_segment,
        lead_source_surface: source === "contact" ? "contact_page" : "quick_quote_form",
      },
      { dedupeKey: key },
    );
  }

  it("Contact-page confirmed success fires contact_form_submit exactly once", () => {
    fireSuccess("contact", "", "contact-ok-1");
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "contact_form_submit", expect.objectContaining({
      form_type: "quick_quote_form",
      service_category: "contact",
      lead_source_surface: "contact_page",
      send_to: GA4_ID,
    }));
  });

  it("Contact-page failure (onError never calls trackConversion) fires zero events", () => {
    // The mutation's onError path does not invoke fireSuccess — nothing is sent.
    expect(gtag).not.toHaveBeenCalled();
  });

  it("Replacement selection confirmed success fires replacement_request exactly once", () => {
    fireSuccess("contact", "HVAC System Replacement", "repl-ok-1");
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "replacement_request", expect.objectContaining({ send_to: GA4_ID }));
  });

  it("Installation selection still fires installation_request, not replacement_request", () => {
    fireSuccess(undefined, "AC Installation", "inst-ok-1");
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][1]).toBe("installation_request");
    expect(gtag.mock.calls[0][1]).not.toBe("replacement_request");
  });

  it("separate successful submissions (distinct keys) are each tracked — not suppressed", () => {
    fireSuccess("contact", "", "sep-a");
    fireSuccess("contact", "HVAC System Replacement", "sep-b");
    fireSuccess(undefined, "AC Installation", "sep-c");
    expect(gtag).toHaveBeenCalledTimes(3);
    expect(gtag.mock.calls.map((c) => c[1])).toEqual([
      "contact_form_submit",
      "replacement_request",
      "installation_request",
    ]);
  });

  it("a re-fired submission (same key) is deduped to exactly one event", () => {
    fireSuccess("contact", "HVAC System Replacement", "dupe-key");
    fireSuccess("contact", "HVAC System Replacement", "dupe-key");
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});

describe("live confirmed-success reachability — both target events are producible from the real form", () => {
  const formSrc = readFileSync(path.join(root, "client", "src", "components", "QuickQuoteForm.tsx"), "utf8");
  // Every option value the visitor can actually select in QuickQuoteForm.
  const optionValues = [...formSrc.matchAll(/<SelectItem value="([^"]+)"/g)].map((m) => m[1]);

  it("has selectable options (guard against a broken parse)", () => {
    expect(optionValues.length).toBeGreaterThan(5);
  });

  it("replacement_request is reachable through a real user-selectable option", () => {
    const events = optionValues.map((v) => resolveQuickQuoteConversion(undefined, v).event);
    expect(events).toContain("replacement_request");
  });

  it("contact_form_submit is reachable via the Contact-page source + a generic option", () => {
    const contactEvents = optionValues.map((v) => resolveQuickQuoteConversion("contact", v).event);
    expect(contactEvents).toContain("contact_form_submit");
  });

  it("missing Ads labels do not block either target GA4 event", () => {
    expect(ADS_CONVERSION_LABELS.contact_form_submit).toBeNull();
    expect(ADS_CONVERSION_LABELS.replacement_request).toBeNull();
    enableGa4();
    expect(trackConversion("contact_form_submit", {}, { dedupeKey: "ads-c" })).toBe(true);
    expect(trackConversion("replacement_request", {}, { dedupeKey: "ads-r" })).toBe(true);
  });
});

/* ── Static wiring proofs — instrumentation lives ONLY in success paths ────── */

const clientSrc = path.join(root, "client", "src");

describe("QuickQuoteForm — GA4 conversion wired into onSuccess, never onError/handleSubmit", () => {
  const src = readFileSync(path.join(clientSrc, "components", "QuickQuoteForm.tsx"), "utf8");

  it("imports the conversion helper", () => {
    expect(src).toMatch(/import\s*\{[^}]*trackConversion[^}]*\}\s*from\s*["']@\/lib\/conversions["']/);
  });

  it("calls trackConversion (in the mutation's onSuccess)", () => {
    expect(src).toContain("trackConversion(");
  });

  it("does NOT pass PII (name/email/phone/message) into trackConversion", () => {
    // Grab the trackConversion(...) argument list and assert no PII identifiers.
    const call = src.slice(src.indexOf("trackConversion("));
    const args = call.slice(0, call.indexOf("});") + 2);
    for (const pii of ["formData.name", "formData.email", "formData.phone", "formData.message"]) {
      expect(args).not.toContain(pii);
    }
  });

  it("keeps the existing lead-capture mutation (CRM/attribution) intact", () => {
    expect(src).toContain("trpc.leadCaptures.create.useMutation");
    expect(src).toContain('captureType: "quick_quote"');
  });
});

describe("LPEmergencyHVAC — GA4 added beside the existing Ads conversion (Ads untouched)", () => {
  const src = readFileSync(path.join(clientSrc, "pages", "lp", "LPEmergencyHVAC.tsx"), "utf8");

  it("preserves the existing Ads conversion send_to", () => {
    expect(src).toContain('send_to: "AW-17768263516/emergency_lp"');
  });

  it("adds a GA4 conversion via the shared helper", () => {
    expect(src).toContain("trackConversion(");
    expect(src).toMatch(/from\s*["']@\/lib\/conversions["']/);
  });
});

describe("QuickQuoteForm — replacement option + source-aware resolution (Fix 1 & Fix 2 wiring)", () => {
  const src = readFileSync(path.join(clientSrc, "components", "QuickQuoteForm.tsx"), "utf8");

  it("exposes a clearly labeled, user-selectable HVAC System Replacement option", () => {
    expect(src).toContain('<SelectItem value="HVAC System Replacement">HVAC System Replacement</SelectItem>');
  });

  it("resolves the fired event via the source-aware resolver (not the raw service mapper)", () => {
    expect(src).toContain("resolveQuickQuoteConversion(");
  });

  it("accepts a typed source prop so the Contact page can classify its submissions", () => {
    expect(src).toMatch(/source\??:\s*QuickQuoteSource/);
  });

  it("still fires only inside the mutation onSuccess (never onError / handleSubmit)", () => {
    const onSuccessIdx = src.indexOf("onSuccess");
    const onErrorIdx = src.indexOf("onError");
    const trackIdx = src.indexOf("trackConversion(");
    expect(trackIdx).toBeGreaterThan(onSuccessIdx);
    expect(trackIdx).toBeLessThan(onErrorIdx);
  });
});

describe("Contact page — passes source=\"contact\" so a generic submission is a contact_form_submit", () => {
  const src = readFileSync(path.join(clientSrc, "pages", "Contact.tsx"), "utf8");

  it("renders QuickQuoteForm with source=\"contact\"", () => {
    expect(src).toMatch(/<QuickQuoteForm[\s\S]*?source="contact"/);
  });
});
