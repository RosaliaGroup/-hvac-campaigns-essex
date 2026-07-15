import { describe, it, expect, afterEach } from "vitest";
import {
  normalizeGa4Date,
  normalizeLandingPage,
  parseRunReport,
  fetchWithRetry,
  getGa4PropertyId,
  isValidGa4PropertyId,
  Ga4UnavailableError,
} from "./ga4";

describe("normalizeGa4Date", () => {
  it("turns YYYYMMDD into YYYY-MM-DD", () => {
    expect(normalizeGa4Date("20260714")).toBe("2026-07-14");
  });
  it("passes through already-normalised or unexpected values", () => {
    expect(normalizeGa4Date("2026-07-14")).toBe("2026-07-14");
    expect(normalizeGa4Date("")).toBe("");
    expect(normalizeGa4Date(undefined)).toBe("");
  });
});

describe("normalizeLandingPage (URL normalization)", () => {
  it("adds a leading slash to a bare path", () => {
    expect(normalizeLandingPage("hvac-newark-nj")).toBe("/hvac-newark-nj");
  });
  it("keeps an already-rooted path (with query) intact", () => {
    expect(normalizeLandingPage("/services?x=1")).toBe("/services?x=1");
  });
  it("reduces a full URL to path + query so the same page never splits", () => {
    expect(normalizeLandingPage("https://mechanicalenterprise.com/hvac?ref=a")).toBe("/hvac?ref=a");
    // Both forms collapse to one cache key.
    expect(normalizeLandingPage("https://mechanicalenterprise.com/hvac?ref=a")).toBe(normalizeLandingPage("/hvac?ref=a"));
  });
  it("preserves GA4 placeholder tokens verbatim", () => {
    expect(normalizeLandingPage("(not set)")).toBe("(not set)");
    expect(normalizeLandingPage("(direct)")).toBe("(direct)");
  });
  it("maps empty / missing to empty string", () => {
    expect(normalizeLandingPage("")).toBe("");
    expect(normalizeLandingPage(undefined)).toBe("");
  });
});

describe("isValidGa4PropertyId", () => {
  it("accepts a numeric property id", () => {
    expect(isValidGa4PropertyId("480827123")).toBe(true);
  });
  it("rejects measurement ids, UA ids and junk", () => {
    expect(isValidGa4PropertyId("G-ABC123")).toBe(false);
    expect(isValidGa4PropertyId("UA-12345-1")).toBe(false);
    expect(isValidGa4PropertyId("")).toBe(false);
    expect(isValidGa4PropertyId("480827123 ")).toBe(false);
  });
});

describe("parseRunReport", () => {
  it("maps dimension/metric order into typed rows and rounds integer metrics", () => {
    const json = {
      rows: [
        {
          dimensionValues: [
            { value: "20260714" },
            { value: "google" },
            { value: "organic" },
            { value: "(organic)" },
            { value: "/hvac-newark-nj" },
            { value: "Organic Search" },
          ],
          metricValues: [
            { value: "120" },
            { value: "80" },
            { value: "60" },
            { value: "3.5" },
            { value: "240" },
          ],
        },
      ],
    };
    expect(parseRunReport(json)).toEqual([
      {
        date: "2026-07-14",
        source: "google",
        medium: "organic",
        campaign: "(organic)",
        landingPage: "/hvac-newark-nj",
        channelGroup: "Organic Search",
        pageViews: 120,
        sessions: 80,
        users: 60,
        conversions: 3.5,
        events: 240,
      },
    ]);
  });

  it("tolerates missing rows / fields", () => {
    expect(parseRunReport({})).toEqual([]);
    expect(parseRunReport(null)).toEqual([]);
    const [row] = parseRunReport({ rows: [{}] });
    expect(row).toMatchObject({ date: "", source: "", pageViews: 0, conversions: 0 });
  });
});

describe("getGa4PropertyId", () => {
  const prev = process.env.GA4_PROPERTY_ID;
  const prevAlt = process.env.GA4_ANALYTICS_PROPERTY_ID;
  afterEach(() => {
    if (prev === undefined) delete process.env.GA4_PROPERTY_ID;
    else process.env.GA4_PROPERTY_ID = prev;
    if (prevAlt === undefined) delete process.env.GA4_ANALYTICS_PROPERTY_ID;
    else process.env.GA4_ANALYTICS_PROPERTY_ID = prevAlt;
  });
  it("strips a properties/ prefix and trims", () => {
    delete process.env.GA4_ANALYTICS_PROPERTY_ID;
    process.env.GA4_PROPERTY_ID = " properties/480827123 ";
    expect(getGa4PropertyId()).toBe("480827123");
  });
  it("returns empty string when unset", () => {
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_ANALYTICS_PROPERTY_ID;
    expect(getGa4PropertyId()).toBe("");
  });
  it("rejects a non-numeric value (e.g. a G- measurement id) → empty", () => {
    delete process.env.GA4_ANALYTICS_PROPERTY_ID;
    process.env.GA4_PROPERTY_ID = "G-ABC123";
    expect(getGa4PropertyId()).toBe("");
  });
});

describe("fetchWithRetry", () => {
  const noSleep = async () => {};
  const resp = (status: number, headers: Record<string, string> = {}) =>
    ({ ok: status >= 200 && status < 300, status, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Response;

  it("returns immediately on success", async () => {
    let calls = 0;
    const res = await fetchWithRetry("u", {}, { fetchImpl: async () => { calls++; return resp(200); }, sleepImpl: noSleep });
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
  });

  it("retries on 429/5xx then succeeds", async () => {
    const seq = [429, 503, 200];
    let i = 0;
    const res = await fetchWithRetry("u", {}, { fetchImpl: async () => resp(seq[i++]), sleepImpl: noSleep, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(i).toBe(3);
  });

  it("honours a Retry-After header (seconds → ms) over exponential backoff", async () => {
    const delays: number[] = [];
    const record = async (ms: number) => { delays.push(ms); };
    const seq = [
      resp(429, { "retry-after": "2" }), // → 2000ms
      resp(200),
    ];
    let i = 0;
    const res = await fetchWithRetry("u", {}, { fetchImpl: async () => seq[i++], sleepImpl: record, baseDelayMs: 500 });
    expect(res.status).toBe(200);
    expect(delays).toEqual([2000]); // used Retry-After, not baseDelay*2^0 = 500
  });

  it("falls back to exponential backoff when no Retry-After is present", async () => {
    const delays: number[] = [];
    const record = async (ms: number) => { delays.push(ms); };
    const seq = [resp(503), resp(503), resp(200)];
    let i = 0;
    await fetchWithRetry("u", {}, { fetchImpl: async () => seq[i++], sleepImpl: record, baseDelayMs: 100 });
    expect(delays).toEqual([100, 200]); // 100*2^0, 100*2^1
  });

  it("does not retry a non-retryable 4xx", async () => {
    let calls = 0;
    const res = await fetchWithRetry("u", {}, { fetchImpl: async () => { calls++; return resp(403); }, sleepImpl: noSleep });
    expect(res.status).toBe(403);
    expect(calls).toBe(1);
  });

  it("gives up after the retry budget and throws Ga4UnavailableError", async () => {
    await expect(
      fetchWithRetry("u", {}, { fetchImpl: async () => { throw new Error("network down"); }, sleepImpl: noSleep, retries: 2, baseDelayMs: 1 }),
    ).rejects.toBeInstanceOf(Ga4UnavailableError);
  });
});
