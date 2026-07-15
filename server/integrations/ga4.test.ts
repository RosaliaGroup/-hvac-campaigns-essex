import { describe, it, expect, afterEach } from "vitest";
import {
  normalizeGa4Date,
  parseRunReport,
  fetchWithRetry,
  getGa4PropertyId,
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
  afterEach(() => {
    if (prev === undefined) delete process.env.GA4_PROPERTY_ID;
    else process.env.GA4_PROPERTY_ID = prev;
  });
  it("strips a properties/ prefix and trims", () => {
    process.env.GA4_PROPERTY_ID = " properties/480827123 ";
    expect(getGa4PropertyId()).toBe("480827123");
  });
  it("returns empty string when unset", () => {
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_ANALYTICS_PROPERTY_ID;
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
