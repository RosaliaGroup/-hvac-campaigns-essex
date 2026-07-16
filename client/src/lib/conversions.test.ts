/**
 * Tests for the frontend conversion emitter + its wiring.
 *
 * Runs in the vitest "node" environment (no jsdom): `window`/`sessionStorage`
 * are stubbed via vi.stubGlobal and the GA4 env var via vi.stubEnv. Behavioural
 * tests cover the helper contract; static "wiring proof" tests read the form /
 * ServicePage source to assert the fire-only-on-success wiring (mirrors
 * client/src/lib/analytics.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  trackConversion,
  trackLeadConversion,
  resolveConversion,
  sanitizeParams,
  ADS_CONVERSION_LABELS,
  type ConversionEventName,
} from "./conversions";

const GA4_ID = "G-TEST12345";
const ADS_ID = "AW-17768263516";
const root = path.resolve(__dirname, "..", "..", "..");

function enableGa4() {
  vi.stubEnv("VITE_GA4_MEASUREMENT_ID", GA4_ID);
}
function disableGa4() {
  vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "");
}

function fakeSessionStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

let gtag: ReturnType<typeof vi.fn>;
beforeEach(() => {
  gtag = vi.fn();
  vi.stubGlobal("window", { gtag, sessionStorage: fakeSessionStorage() });
  enableGa4();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The GA4 event call (first gtag arg === "event", second !== "conversion"). */
function ga4Calls() {
  return gtag.mock.calls.filter((c) => c[0] === "event" && c[1] !== "conversion");
}
/** The Google Ads conversion call. */
function adsCalls() {
  return gtag.mock.calls.filter((c) => c[0] === "event" && c[1] === "conversion");
}

describe("trackConversion — allowlist / PII firewall", () => {
  it("passes allowlisted parameters through to GA4", () => {
    trackConversion("quote_request", {
      dedupeKey: "k1",
      params: { service_type: "installation", segment: "residential", value: 100, currency: "USD" },
    });
    const [, name, params] = ga4Calls()[0];
    expect(name).toBe("quote_request");
    expect(params).toMatchObject({
      send_to: GA4_ID,
      service_type: "installation",
      segment: "residential",
      value: 100,
      currency: "USD",
    });
  });

  it("strips PII — name/email/phone/address/message never reach gtag", () => {
    trackConversion("quote_request", {
      dedupeKey: "k2",
      // Cast: these keys are not on ConvParams; the firewall must drop them anyway.
      params: {
        service_type: "repair",
        name: "Jane Homeowner",
        email: "jane@example.com",
        phone: "862-555-1234",
        address: "12 Main St, Newark NJ",
        message: "My furnace is broken",
      } as never,
    });
    const [, , params] = ga4Calls()[0];
    const json = JSON.stringify(params);
    expect(params).toMatchObject({ send_to: GA4_ID, service_type: "repair" });
    expect(json).not.toContain("jane@example.com");
    expect(json).not.toContain("Jane");
    expect(json).not.toContain("862-555-1234");
    expect(json).not.toContain("Main St");
    expect(json).not.toContain("furnace");
    expect(Object.keys(params as object).sort()).toEqual(["send_to", "service_type"]);
  });

  it("strips the query string and hash from page_path", () => {
    trackConversion("quote_request", {
      dedupeKey: "k3",
      params: { page_path: "/services/ac?token=secret&email=a@b.com#frag" },
    });
    const [, , params] = ga4Calls()[0] as [string, string, Record<string, unknown>];
    expect(params.page_path).toBe("/services/ac");
    expect(JSON.stringify(params)).not.toContain("secret");
    expect(JSON.stringify(params)).not.toContain("a@b.com");
  });
});

describe("trackConversion — GA4 / Ads independence", () => {
  it("fires GA4 even when the Ads label is unavailable (null)", () => {
    const fired = trackConversion("quote_request", { dedupeKey: "k4", adsLabel: null });
    expect(fired).toBe(true);
    expect(ga4Calls()).toHaveLength(1);
    expect(adsCalls()).toHaveLength(0);
  });

  it("treats placeholder labels as absent (no malformed send_to)", () => {
    trackConversion("quote_request", { dedupeKey: "k5", adsLabel: "  " });
    trackConversion("repair_request", { dedupeKey: "k5b", adsLabel: "TODO" });
    expect(adsCalls()).toHaveLength(0);
    expect(ga4Calls()).toHaveLength(2);
  });

  it("fires the Ads conversion with a real label, including value/currency", () => {
    trackConversion("quote_request", {
      dedupeKey: "k6",
      adsLabel: "AbCdEfLabel",
      params: { value: 250 },
    });
    expect(ga4Calls()).toHaveLength(1);
    const [, , ads] = adsCalls()[0] as [string, string, Record<string, unknown>];
    expect(ads.send_to).toBe(`${ADS_ID}/AbCdEfLabel`);
    expect(ads.value).toBe(250);
    expect(ads.currency).toBe("USD");
  });
});

describe("trackConversion — no-op safety", () => {
  it("no-ops (returns false) when GA4 is disabled", () => {
    disableGa4();
    const fired = trackConversion("quote_request", { dedupeKey: "k7" });
    expect(fired).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("no-ops when window.gtag is unavailable and never throws", () => {
    vi.stubGlobal("window", { sessionStorage: fakeSessionStorage() }); // no gtag
    expect(() => trackConversion("quote_request", { dedupeKey: "k8" })).not.toThrow();
  });

  it("no-ops when there is no window at all (SSR/test)", () => {
    vi.stubGlobal("window", undefined);
    expect(trackConversion("quote_request", { dedupeKey: "k9" })).toBe(false);
  });

  it("never emits a page_view event", () => {
    trackConversion("quote_request", { dedupeKey: "k10" });
    trackLeadConversion({ intent: "Emergency Repair", dedupeKey: "k11" });
    const emitted = gtag.mock.calls.map((c) => c[1]);
    expect(emitted).not.toContain("page_view");
  });
});

describe("trackConversion — session dedupe (retries / re-render / SPA nav)", () => {
  it("a confirmed success fires exactly once", () => {
    const first = trackConversion("quote_request", { dedupeKey: "lead:tok-1", adsLabel: "L" });
    expect(first).toBe(true);
    expect(ga4Calls()).toHaveLength(1);
    expect(adsCalls()).toHaveLength(1);
  });

  it("double onSuccess with the same key does not duplicate", () => {
    trackConversion("quote_request", { dedupeKey: "lead:tok-2", adsLabel: "L" });
    const second = trackConversion("quote_request", { dedupeKey: "lead:tok-2", adsLabel: "L" });
    expect(second).toBe(false);
    expect(ga4Calls()).toHaveLength(1);
    expect(adsCalls()).toHaveLength(1);
  });

  it("a re-render (repeated call, same key) does not re-fire", () => {
    for (let i = 0; i < 5; i++) trackConversion("repair_request", { dedupeKey: "lead:tok-3" });
    expect(ga4Calls()).toHaveLength(1);
  });

  it("a distinct submission (new key) fires again", () => {
    trackConversion("quote_request", { dedupeKey: "lead:tok-4" });
    trackConversion("quote_request", { dedupeKey: "lead:tok-5" });
    expect(ga4Calls()).toHaveLength(2);
  });
});

describe("resolveConversion — mappings", () => {
  const cases: Array<{ in: { source?: "contact"; intent?: string }; event: ConversionEventName }> = [
    { in: { source: "contact" }, event: "contact_form_submit" },
    { in: { source: "contact", intent: "Commercial HVAC" }, event: "contact_form_submit" }, // source wins
    { in: { intent: "Emergency Repair" }, event: "repair_request" },
    { in: { intent: "Heat Pump Installation" }, event: "installation_request" },
    { in: { intent: "AC Installation" }, event: "installation_request" },
    { in: { intent: "VRF/VRV System" }, event: "installation_request" },
    { in: { intent: "Full HVAC System Replacement hvac-system-replacement-nj" }, event: "replacement_request" },
    { in: { intent: "Commercial HVAC" }, event: "commercial_quote_request" },
    { in: { intent: "commercial-hvac-installation-nj" }, event: "commercial_quote_request" }, // commercial beats install
    { in: { intent: "Residential HVAC" }, event: "residential_quote_request" },
    { in: { intent: "Maintenance Subscription" }, event: "maintenance_plan_inquiry" },
    { in: { intent: "Rebate Consultation" }, event: "quote_request" },
    { in: { intent: "Other" }, event: "quote_request" },
    { in: {}, event: "quote_request" },
  ];
  for (const c of cases) {
    it(`${JSON.stringify(c.in)} -> ${c.event}`, () => {
      expect(resolveConversion(c.in).event).toBe(c.event);
    });
  }

  it("every event has an Ads-label config slot (value may be null until configured)", () => {
    const events: ConversionEventName[] = [
      "contact_form_submit",
      "quote_request",
      "repair_request",
      "installation_request",
      "replacement_request",
      "commercial_quote_request",
      "residential_quote_request",
      "maintenance_plan_inquiry",
    ];
    for (const e of events) expect(e in ADS_CONVERSION_LABELS).toBe(true);
  });
});

describe("trackLeadConversion — resolve + fire", () => {
  it("fires the resolved event with page_path and GA4 send_to", () => {
    trackLeadConversion({ intent: "Emergency Repair", dedupeKey: "lead:x", pagePath: "/x?q=1#h" });
    const [, name, params] = ga4Calls()[0] as [string, string, Record<string, unknown>];
    expect(name).toBe("repair_request");
    expect(params.service_type).toBe("repair");
    expect(params.page_path).toBe("/x");
    expect(params.send_to).toBe(GA4_ID);
  });
});

describe("sanitizeParams", () => {
  it("keeps only allowlisted keys", () => {
    const out = sanitizeParams({ service_type: "repair", secret: "x", email: "a@b.com" } as never);
    expect(out).toEqual({ service_type: "repair" });
  });
});

// ── Static wiring-proof tests: assert the fire-only-on-success wiring ──────────
describe("wiring proof — QuickQuoteForm fires only on confirmed success", () => {
  const src = readFileSync(path.join(root, "client/src/components/QuickQuoteForm.tsx"), "utf8");

  it("imports the conversion helper", () => {
    expect(src).toContain('from "@/lib/conversions"');
    expect(src).toContain("trackLeadConversion");
  });

  it("calls trackLeadConversion inside onSuccess, not in handleSubmit", () => {
    const onSuccessIdx = src.indexOf("onSuccess:");
    const onErrorIdx = src.indexOf("onError:");
    const fireIdx = src.indexOf("trackLeadConversion(");
    expect(onSuccessIdx).toBeGreaterThan(-1);
    // The only call site sits between onSuccess and onError.
    expect(fireIdx).toBeGreaterThan(onSuccessIdx);
    expect(fireIdx).toBeLessThan(onErrorIdx);
    // handleSubmit / mutate must NOT fire a conversion.
    const handleSubmit = src.slice(src.indexOf("const handleSubmit"));
    expect(handleSubmit).not.toContain("trackLeadConversion(");
  });

  it("guards with a one-shot ref so a re-invoked onSuccess cannot double-fire", () => {
    expect(src).toContain("pendingConversion");
    expect(src).toContain("pendingConversion.current = null");
  });

  it("clears the pending token on error (no conversion on failure)", () => {
    const onError = src.slice(src.indexOf("onError:"));
    expect(onError).not.toContain("trackLeadConversion(");
    expect(onError).toContain("pendingConversion.current = null");
  });
});

describe("wiring proof — ServicePage embeds the form with a conversion intent", () => {
  const src = readFileSync(path.join(root, "client/src/pages/ServicePage.tsx"), "utf8");
  it("renders QuickQuoteForm with conversionIntent", () => {
    expect(src).toContain("QuickQuoteForm");
    expect(src).toContain("conversionIntent");
  });
});

describe("wiring proof — page_view behavior is untouched", () => {
  it("the conversions module never emits a page_view gtag event", () => {
    const conv = readFileSync(path.join(root, "client/src/lib/conversions.ts"), "utf8");
    // Prose/docs may mention page_view; what matters is it never emits one.
    expect(conv).not.toMatch(/gtag\([^)]*["']page_view["']/);
    expect(conv).not.toContain('"page_view"');
  });
  it("analytics.trackPageView still owns page_view", () => {
    const analytics = readFileSync(path.join(root, "client/src/lib/analytics.ts"), "utf8");
    expect(analytics).toContain('gtag("event", "page_view"');
  });
});
