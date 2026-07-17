/**
 * Google Business Profile provider — graceful degradation + read-only surface.
 *
 * The admin dashboard must never break: a missing DB, an unconfigured location,
 * or a throwing query all degrade to safe empty data. The provider also exposes
 * NO write-capable methods (all Business Profile mutation lives elsewhere and is
 * intentionally absent here).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../integrations/gbp", () => ({
  getGbpTarget: vi.fn(() => ({
    accountId: "111",
    locationId: "222",
    locationName: "accounts/111/locations/222",
    locationResource: "locations/222",
  })),
}));

import { GbpProvider, getGbpProvider } from "./provider";
import { getDb } from "../../db";
import { getGbpTarget } from "../../integrations/gbp";

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(getGbpTarget).mockReset();
  vi.mocked(getGbpTarget).mockReturnValue({
    accountId: "111",
    locationId: "222",
    locationName: "accounts/111/locations/222",
    locationResource: "locations/222",
  } as never);
});

describe("GbpProvider — degradation", () => {
  const provider = new GbpProvider();

  it("returns an empty overview when the DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    const o = await provider.getOverview();
    expect(o.connected).toBe(false);
    expect(o).toMatchObject({ rating: 0, totalReviews: 0, calls: { total: 0, delta: 0 } });
  });

  it("returns empty lists when the DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    expect(await provider.getInsights()).toEqual([]);
    expect(await provider.listReviews()).toEqual([]);
    expect(await provider.listPhotos()).toEqual([]);
    expect(await provider.listPosts()).toEqual([]);
  });

  it("returns empty data when no location is configured", async () => {
    vi.mocked(getDb).mockResolvedValue({ select: () => ({}) } as never);
    vi.mocked(getGbpTarget).mockReturnValue(null as never);
    expect((await provider.getOverview()).connected).toBe(false);
    expect(await provider.listReviews()).toEqual([]);
  });

  it("swallows a throwing query and still serves empty data", async () => {
    const throwingDb = {
      select: () => {
        throw new Error("query blew up");
      },
    };
    vi.mocked(getDb).mockResolvedValue(throwingDb as never);
    expect((await provider.getOverview()).connected).toBe(false);
    expect(await provider.listReviews()).toEqual([]);
    expect(await provider.getInsights()).toEqual([]);
  });
});

describe("GbpProvider — read-only surface", () => {
  it("exposes only read methods (no write-capable verbs)", () => {
    const methods = Object.getOwnPropertyNames(GbpProvider.prototype).filter(
      (n) => n !== "constructor" && typeof (GbpProvider.prototype as never)[n] === "function",
    );
    // The only public methods are reads.
    const allowed = new Set(["allPoints", "getInsights", "getOverview", "listReviews", "listPhotos", "listPosts"]);
    for (const m of methods) expect(allowed.has(m)).toBe(true);
    // Defensive: no method name hints at a mutation.
    const writeVerb = /insert|update|delete|create|save|upsert|reply|upload|mutat|write|set[A-Z]|publish/;
    for (const m of methods) expect(writeVerb.test(m)).toBe(false);
  });

  it("getGbpProvider returns a stable singleton", () => {
    expect(getGbpProvider()).toBe(getGbpProvider());
  });
});
