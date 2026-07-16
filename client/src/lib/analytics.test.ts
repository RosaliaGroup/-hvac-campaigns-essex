/**
 * Tests for the frontend GA4 analytics helper + its wiring.
 *
 * Runs in the vitest "node" environment (no jsdom), so `window`/`document` are
 * stubbed via vi.stubGlobal and the GA4 env var via vi.stubEnv. Behavioural
 * tests cover the helper; static "wiring proof" tests assert index.html / App.tsx
 * are hooked up correctly (mirrors client/src/__tests__/formatterRender.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { trackPageView, toPagePath, isGa4Enabled, getGa4MeasurementId } from "./analytics";

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
  vi.stubGlobal("window", { gtag });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getGa4MeasurementId / isGa4Enabled", () => {
  it("returns the id when a valid G- value is set", () => {
    enableGa4();
    expect(getGa4MeasurementId()).toBe(GA4_ID);
    expect(isGa4Enabled()).toBe(true);
  });

  it("returns undefined when unset (empty)", () => {
    disableGa4();
    expect(getGa4MeasurementId()).toBeUndefined();
    expect(isGa4Enabled()).toBe(false);
  });

  it("ignores a non-G- value (e.g. a numeric property id or placeholder)", () => {
    vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "480827123");
    expect(getGa4MeasurementId()).toBeUndefined();
    vi.stubEnv("VITE_GA4_MEASUREMENT_ID", "%VITE_GA4_MEASUREMENT_ID%");
    expect(getGa4MeasurementId()).toBeUndefined();
  });
});

describe("trackPageView — no-op when GA4 is not configured", () => {
  it("does nothing when the env var is absent", () => {
    disableGa4();
    trackPageView("/pricing");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("does nothing when window.gtag is unavailable", () => {
    enableGa4();
    vi.stubGlobal("window", {}); // no gtag
    expect(() => trackPageView("/pricing")).not.toThrow();
  });

  it("does nothing when there is no window at all (SSR/test)", () => {
    enableGa4();
    vi.stubGlobal("window", undefined);
    expect(() => trackPageView("/pricing")).not.toThrow();
  });
});

describe("trackPageView — correct page_view payload", () => {
  beforeEach(enableGa4);

  it("emits a single GA4-scoped page_view with the clean path", () => {
    trackPageView("/services/hvac");
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/services/hvac",
      send_to: GA4_ID,
    });
  });

  it("scopes the event to GA4 via send_to (never the Ads account)", () => {
    trackPageView("/");
    const [, , params] = gtag.mock.calls[0];
    expect(params.send_to).toBe(GA4_ID);
    expect(JSON.stringify(params)).not.toContain("AW-");
  });
});

describe("toPagePath — strips sensitive query/hash", () => {
  it("drops the query string (tokens/PII never sent)", () => {
    expect(toPagePath("/reset?token=secret&email=a@b.com")).toBe("/reset");
  });
  it("drops the hash fragment", () => {
    expect(toPagePath("/faq#section-3")).toBe("/faq");
  });
  it("normalises a missing leading slash and empty input", () => {
    expect(toPagePath("about")).toBe("/about");
    expect(toPagePath("")).toBe("/");
  });

  it("trackPageView applies the sanitiser end-to-end", () => {
    enableGa4();
    trackPageView("/verify?token=abc123");
    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/verify",
      send_to: GA4_ID,
    });
    const [, , params] = gtag.mock.calls[0];
    expect(JSON.stringify(params)).not.toContain("token");
  });
});

describe("route-change tracking — one page_view per view (initial + navigations)", () => {
  beforeEach(enableGa4);

  it("fires once per distinct location as the SPA navigates", () => {
    // Simulates the App effect firing on mount then on each route change.
    for (const loc of ["/", "/services", "/contact"]) trackPageView(loc);
    expect(gtag).toHaveBeenCalledTimes(3);
    expect(gtag.mock.calls.map((c) => c[2].page_path)).toEqual(["/", "/services", "/contact"]);
  });
});

/* ── Static wiring proofs (no DOM needed) ─────────────────────────────────── */

describe("index.html — Google Ads intact + GA4 added without duplicate init", () => {
  const html = readFileSync(path.join(root, "client", "index.html"), "utf8");

  it("preserves the Google Ads AW-17768263516 configuration", () => {
    expect(html).toContain("gtag('config', 'AW-17768263516')");
  });

  it("loads gtag.js exactly once (no duplicate script)", () => {
    const loads = html.match(/googletagmanager\.com\/gtag\/js/g) ?? [];
    expect(loads).toHaveLength(1);
  });

  it("adds a GA4 config from VITE_GA4_MEASUREMENT_ID with send_page_view:false", () => {
    expect(html).toContain("%VITE_GA4_MEASUREMENT_ID%");
    expect(html).toMatch(/send_page_view:\s*false/);
  });
});

describe("App.tsx — page-view tracking wired, ScrollToTop preserved", () => {
  const app = readFileSync(path.join(root, "client", "src", "App.tsx"), "utf8");

  it("imports trackPageView and calls it inside a location effect", () => {
    expect(app).toMatch(/import\s+\{\s*trackPageView\s*\}\s+from\s+["']@\/lib\/analytics["']/);
    expect(app).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{\s*trackPageView\(location\);?\s*\}\s*,\s*\[location\]\s*\)/);
  });

  it("keeps the existing ScrollToTop scroll behavior intact", () => {
    expect(app).toContain('window.scrollTo({ top: 0, behavior: "instant" })');
    expect(app).toMatch(/<ScrollToTop \/>/);
    expect(app).toMatch(/<AnalyticsTracker \/>/);
  });
});
