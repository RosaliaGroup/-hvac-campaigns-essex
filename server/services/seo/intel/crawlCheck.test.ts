import { describe, it, expect, vi } from "vitest";

vi.mock("../../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../../integrations/searchConsole", () => ({ getSeoSiteUrl: () => "https://x.test/", getSiteOrigin: () => "https://x.test" }));

import { parseHead, evaluatePage, pickUrls, runCrawlCheck, snapshot, GOOGLEBOT_UA, BROWSER_UA, type Snapshot } from "./crawlCheck";

const ORIGIN = "https://x.test";
const html = (over: { title?: string | null; canonical?: string; robots?: string } = {}) =>
  `<html><head>${over.title === null ? "" : `<title>${over.title ?? "Heat pump | Acme"}</title>`}${over.canonical ? `<link rel="canonical" href="${over.canonical}">` : ""}${over.robots ? `<meta name="robots" content="${over.robots}">` : ""}</head><body>${"x".repeat(2000)}</body></html>`;
const ok = (over: Partial<Extract<Snapshot, { ok: true }>> = {}): Snapshot => ({ ok: true, status: 200, location: null, xRobots: null, title: "Heat pump | Acme", canonical: null, metaRobots: null, bytes: 5000, ...over });
const NO_REDIRECTS = new Map<string, string>();

describe("parseHead", () => {
  it("reads title, canonical and robots regardless of attribute order", () => {
    expect(parseHead(`<title> A  B </title><link href="/p" rel="canonical"><meta content="noindex, follow" name="robots">`)).toEqual({ title: "A B", canonical: "/p", metaRobots: "noindex, follow" });
  });
  it("returns nulls when absent", () => {
    expect(parseHead("<html></html>")).toEqual({ title: null, canonical: null, metaRobots: null });
  });
});

describe("evaluatePage", () => {
  it("a healthy page has no anomalies", () => {
    expect(evaluatePage("/p", ORIGIN, ok({ canonical: "https://x.test/p" }), ok({ canonical: "https://x.test/p" }), NO_REDIRECTS)).toEqual([]);
  });
  it("flags an UNEXPECTED redirect (the 2026-07 'Page with redirect' pattern)", () => {
    const r = evaluatePage("/p", ORIGIN, ok({ status: 301, location: "https://x.test/other" }), ok({ status: 301, location: "https://x.test/other" }), NO_REDIRECTS);
    expect(r.map((a) => a.kind)).toEqual(["unexpected_redirect"]);
    expect(r[0].detail).toContain("301 → https://x.test/other");
  });
  it("does not flag a redirect that netlify.toml declares", () => {
    const r = evaluatePage("/old", ORIGIN, ok({ status: 301, location: "/new" }), ok({ status: 301, location: "/new" }), new Map([["/old", "/new"]]));
    expect(r).toEqual([]);
  });
  it("flags HTTP errors, noindex (meta or header), a canonical pointing elsewhere, no title, tiny body", () => {
    expect(evaluatePage("/p", ORIGIN, ok({ status: 503 }), ok({ status: 503 }), NO_REDIRECTS).map((a) => a.kind)).toEqual(["http_error"]);
    expect(evaluatePage("/p", ORIGIN, ok({ metaRobots: "noindex" }), ok({ metaRobots: "noindex" }), NO_REDIRECTS).map((a) => a.kind)).toContain("noindex");
    expect(evaluatePage("/p", ORIGIN, ok({ xRobots: "NOINDEX" }), ok({ xRobots: "NOINDEX" }), NO_REDIRECTS).map((a) => a.kind)).toContain("noindex");
    expect(evaluatePage("/p", ORIGIN, ok({ canonical: "https://x.test/q" }), ok({ canonical: "https://x.test/q" }), NO_REDIRECTS).map((a) => a.kind)).toContain("canonical_mismatch");
    expect(evaluatePage("/p", ORIGIN, ok({ title: null }), ok({ title: null }), NO_REDIRECTS).map((a) => a.kind)).toContain("no_title");
    expect(evaluatePage("/p", ORIGIN, ok({ bytes: 200 }), ok({ bytes: 200 }), NO_REDIRECTS).map((a) => a.kind)).toContain("tiny_body");
  });
  it("accepts a relative or trailing-slash canonical that resolves to the same page", () => {
    expect(evaluatePage("/p", ORIGIN, ok({ canonical: "/p/" }), ok({ canonical: "/p/" }), NO_REDIRECTS)).toEqual([]);
  });
  it("flags a page the bot sees differently from a browser", () => {
    const r = evaluatePage("/p", ORIGIN, ok({ status: 301, location: "/x" }), ok(), new Map([["/p", "/x"]]));
    expect(r.map((a) => a.kind)).toEqual(["bot_diverges"]);
    expect(evaluatePage("/p", ORIGIN, ok({ title: "A" }), ok({ title: "B" }), NO_REDIRECTS).map((a) => a.kind)).toEqual(["bot_diverges"]);
  });
  it("a failed bot fetch is reported and stops further checks", () => {
    expect(evaluatePage("/p", ORIGIN, { ok: false, error: "timeout" }, ok(), NO_REDIRECTS)).toEqual([{ url: "https://x.test/p", kind: "fetch_failed", detail: "Googlebot UA: timeout" }]);
  });
});

describe("pickUrls", () => {
  const pages = Array.from({ length: 40 }, (_, i) => ({ page: `/p${i}`, impressions: i, previousImpressions: 0 }));
  it("takes the top N by demand, always adds / and the extras, and de-duplicates", () => {
    const r = pickUrls(pages, ["/held", "/p39"], 30);
    expect(r).toContain("/p39");
    expect(r).not.toContain("/p0");
    expect(r).toContain("/");
    expect(r).toContain("/held");
    expect(new Set(r).size).toBe(r.length);
    expect(r).toHaveLength(30 + 2); // 30 ranked + "/" + "/held" (p39 already ranked)
  });
  it("keeps a page whose CURRENT impressions collapsed but whose prior demand was high", () => {
    const r = pickUrls([...pages, { page: "/collapsed", impressions: 0, previousImpressions: 5000 }], [], 3);
    expect(r).toContain("/collapsed");
  });
});

describe("snapshot + runCrawlCheck (injected fetch)", () => {
  const res = (status: number, body = "", headers: Record<string, string> = {}) => new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
  it("does not follow redirects and records Location", async () => {
    const f = vi.fn(async () => res(301, "", { location: "https://x.test/other" })) as unknown as typeof fetch;
    const s = await snapshot("https://x.test/p", GOOGLEBOT_UA, f);
    expect(s).toMatchObject({ ok: true, status: 301, location: "https://x.test/other" });
    expect(vi.mocked(f).mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });
  it("reports a network error as ok:false, never throws", async () => {
    const f = vi.fn(async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    expect(await snapshot("https://x.test/p", BROWSER_UA, f)).toEqual({ ok: false, error: "ECONNRESET" });
  });
  it("fetches every path with BOTH user agents and returns sorted anomalies", async () => {
    const seen: Array<[string, string]> = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      seen.push([url, String((init.headers as Record<string, string>)["User-Agent"]).includes("Googlebot") ? "bot" : "browser"]);
      return url.endsWith("/bad") ? res(302, "", { location: "/elsewhere" }) : res(200, html({ canonical: url }));
    }) as unknown as typeof fetch;
    const out = await runCrawlCheck({ origin: ORIGIN, paths: ["/", "/ok", "/bad"], redirects: NO_REDIRECTS, fetchImpl: f, now: new Date("2026-10-01T10:00:00Z") });
    expect(out.checked).toBe(3);
    expect(out.checkedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(seen).toHaveLength(6);
    expect(seen.filter(([, ua]) => ua === "bot")).toHaveLength(3);
    expect(out.anomalies.map((a) => [a.url, a.kind])).toEqual([["https://x.test/bad", "unexpected_redirect"]]);
  });
});
