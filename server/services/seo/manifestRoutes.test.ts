import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../db";
import { pageHash } from "./sync";
import { getSeoSiteUrl, getSiteOrigin } from "../../integrations/searchConsole";
import { seoPages } from "../../../drizzle/schema";
import { selectRoutesToRegister, readSitemapPaths, readRoutesManifest, registerManifestRoutes } from "./manifestRoutes";

const set = (...p: string[]) => new Set(p);

describe("selectRoutesToRegister (pure)", () => {
  const indexable = set("/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts", "/commercial", "/hvac-newark-nj", "/blog/a");

  it("registers manifest routes that are in the sitemap and not yet in seoPages, in manifest order", () => {
    const out = selectRoutesToRegister(["/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts"], new Set(), indexable);
    expect(out).toEqual(["/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts"]);
  });

  it("skips anything that already has a row — an existing page is never a candidate (so /commercial stays exactly as it is)", () => {
    const out = selectRoutesToRegister(["/commercial", "/warranty"], set("/commercial"), indexable);
    expect(out).toEqual(["/warranty"]);
  });

  it("skips real pages the site deliberately keeps out of the sitemap (auth pages, etc.)", () => {
    const out = selectRoutesToRegister(["/accept-invite", "/reset-password", "/team-login", "/warranty"], new Set(), indexable);
    expect(out).toEqual(["/warranty"]);
  });

  it("skips internal CRM routes and the noindex sets even if they somehow appear in the sitemap", () => {
    const loose = set("/leads", "/jobs", "/courses", "/estimating", "/lp/fb-commercial", "/warranty");
    const out = selectRoutesToRegister(["/leads", "/jobs", "/courses", "/estimating", "/lp/fb-commercial", "/warranty"], new Set(), loose);
    expect(out).toEqual(["/warranty"]);
  });

  it("skips dynamic route patterns and non-string / non-path entries", () => {
    const loose = set("/blog/:slug", "/x/*");
    expect(selectRoutesToRegister(["/blog/:slug", "/x/*", 42, null, { path: "/a" }, "no-leading-slash", "/blog/a"], new Set(), loose.add("/blog/a"))).toEqual(["/blog/a"]);
  });

  it("normalizes trailing slashes, query strings and fragments, and de-duplicates", () => {
    const out = selectRoutesToRegister(["/warranty/", "/warranty", "/warranty?utm=x", "/warranty#top"], new Set(), indexable);
    expect(out).toEqual(["/warranty"]);
  });

  it("matches existing rows regardless of a trailing slash on either side", () => {
    expect(selectRoutesToRegister(["/warranty/"], set("/warranty"), indexable)).toEqual([]);
  });
});

describe("readSitemapPaths", () => {
  it("extracts the path of every <loc>, normalizing the root and trailing slashes", () => {
    const xml = `<urlset><url><loc>https://mechanicalenterprise.com/</loc></url><url><loc>https://mechanicalenterprise.com/warranty/</loc></url><url><loc> https://mechanicalenterprise.com/hvac-newark-nj </loc></url></urlset>`;
    expect(readSitemapPaths(xml)).toEqual(new Set(["/", "/warranty", "/hvac-newark-nj"]));
  });

  it("returns an empty set — with a warning — when there is no sitemap (callers fail closed)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(readSitemapPaths(null).size).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("fail closed"));
    warn.mockRestore();
  });

  it("ignores a malformed <loc> instead of throwing", () => {
    expect(readSitemapPaths(`<loc>not a url</loc><loc>https://x.com/ok</loc>`)).toEqual(new Set(["/ok"]));
  });
});

describe("registerManifestRoutes", () => {
  type Inserted = { values: Record<string, unknown>; onDup: Record<string, unknown> | null };
  let inserted: Inserted[];
  let updateSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;
  let existingRows: Array<{ page: string }>;
  const siteUrl = getSeoSiteUrl();
  const origin = getSiteOrigin();

  function makeDb() {
    return {
      select: () => ({ from: (t: unknown) => Promise.resolve(t === seoPages ? existingRows : []) }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          const rec: Inserted = { values, onDup: null };
          inserted.push(rec);
          return { onDuplicateKeyUpdate: (o: { set: Record<string, unknown> }) => { rec.onDup = o.set; return Promise.resolve(); } };
        },
      }),
      update: updateSpy,
      delete: deleteSpy,
    };
  }

  beforeEach(() => {
    inserted = [];
    updateSpy = vi.fn();
    deleteSpy = vi.fn();
    existingRows = [];
    vi.mocked(getDb).mockReset().mockResolvedValue(makeDb() as never);
  });
  afterEach(() => vi.restoreAllMocks());

  const manifest = ["/", "/commercial", "/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts", "/team-login"];
  const sitemap = set("/", "/commercial", "/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts");

  it("inserts exactly the missing indexable routes — the three pinned pages — and nothing else", async () => {
    existingRows = [{ page: "/" }, { page: "/commercial" }];
    const res = await registerManifestRoutes(manifest, sitemap);
    expect(res.registered).toEqual(["/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts"]);
    expect(inserted.map((i) => i.values.page)).toEqual(res.registered);
  });

  it("writes an honest, inert row: zero metrics (defaults), needs_review, discovered_not_indexed, low priority, derived category, full URL", async () => {
    await registerManifestRoutes(["/commercial/property-managers"], set("/commercial/property-managers"));
    const v = inserted[0].values;
    expect(v).toMatchObject({
      siteUrl,
      page: "/commercial/property-managers",
      url: `${origin}/commercial/property-managers`,
      category: "commercial",
      priority: "low",
      status: "needs_review",
      indexStatus: "discovered_not_indexed",
      problems: [],
    });
    for (const metric of ["clicks", "impressions", "ctr", "position", "previousClicks", "previousImpressions"]) expect(v).not.toHaveProperty(metric);
    expect(String(v.searchConsoleIssue)).toMatch(/hasn't reported/);
  });

  it("uses the SAME key as the GSC sync (siteUrl + path), so the daily sync updates this row instead of duplicating it", async () => {
    await registerManifestRoutes(["/warranty"], set("/warranty"));
    const expected = crypto.createHash("sha256").update(`${siteUrl}\n/warranty`).digest("hex");
    expect(inserted[0].values.pageHash).toBe(expected);
    expect(inserted[0].values.pageHash).toBe(pageHash(siteUrl, "/warranty")); // the sync's own exported function
  });

  it("is INSERT-ONLY: the duplicate-key clause is a no-op on the key itself — it can never overwrite status, metrics, locks or problems — and nothing is updated or deleted", async () => {
    await registerManifestRoutes(manifest, sitemap);
    for (const i of inserted) expect(Object.keys(i.onDup ?? {})).toEqual(["pageHash"]);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("leaves /commercial completely alone — it already has a row, so it is never inserted or touched", async () => {
    existingRows = [{ page: "/commercial" }];
    const res = await registerManifestRoutes(manifest, sitemap);
    expect(res.registered).not.toContain("/commercial");
    expect(inserted.some((i) => i.values.page === "/commercial")).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run over the now-registered rows inserts nothing", async () => {
    const first = await registerManifestRoutes(manifest, sitemap);
    existingRows = first.registered.map((page) => ({ page }));
    inserted = [];
    const second = await registerManifestRoutes(manifest, sitemap);
    expect(second.registered).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("FAILS CLOSED with no sitemap: registers nothing rather than guessing what is indexable", async () => {
    const res = await registerManifestRoutes(manifest, new Set());
    expect(res.registered).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("registers nothing for an empty manifest or when the DB is unavailable", async () => {
    expect((await registerManifestRoutes([], sitemap)).registered).toEqual([]);
    vi.mocked(getDb).mockResolvedValue(null as never);
    expect((await registerManifestRoutes(manifest, sitemap)).registered).toEqual([]);
    expect(inserted).toEqual([]);
  });
});

describe("against the REAL routes manifest + sitemap (2026-09-30: the pinned pages had no seoPages row)", () => {
  const manifest = readRoutesManifest();
  const sitemap = readSitemapPaths();
  const all = selectRoutesToRegister(manifest, new Set(), sitemap);

  it("loads both files", () => {
    expect(manifest.length).toBeGreaterThan(100);
    expect(sitemap.size).toBeGreaterThan(100);
  });

  it("would register the three pinned pages that Search Console hasn't reported yet", () => {
    for (const p of ["/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts"]) expect(all, p).toContain(p);
  });

  it("would NOT register auth/utility pages, internal routes, or anything outside the sitemap", () => {
    for (const p of ["/accept-invite", "/reset-password", "/team-login", "/portal"]) expect(all, p).not.toContain(p);
    for (const p of all) expect(sitemap.has(p), p).toBe(true);
  });
});
