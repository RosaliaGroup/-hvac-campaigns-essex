import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../db";
import { pageHash } from "./sync";
import { getSeoSiteUrl } from "../../integrations/searchConsole";
import { isLocked } from "../../seo/lockedPages";
import { NON_MARKETING_ROUTES, loadRoutesManifest, registrableRoutes, registerManifestRoutes } from "./routeRegistry";

const siteUrl = () => getSeoSiteUrl();

/** Fake drizzle handle: `existingPaths` are already in seoPages; captures every insert. */
function makeDb(existingPaths: string[]) {
  const inserts: Array<Record<string, unknown>> = [];
  const db: any = {
    select: () => ({ from: () => Promise.resolve(existingPaths.map((p) => ({ hash: pageHash(siteUrl(), p) }))) }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserts.push(v);
        return { onDuplicateKeyUpdate: () => Promise.resolve() };
      },
    }),
  };
  return { db, inserts };
}

beforeEach(() => vi.mocked(getDb).mockReset());

describe("registrableRoutes", () => {
  it("keeps marketing routes, sorted and de-duplicated, with trailing slashes normalized", () => {
    expect(registrableRoutes(["/warranty/", "/warranty", "/commercial", "/", "/blog/x"])).toEqual(["/", "/blog/x", "/commercial", "/warranty"]);
  });

  it("drops app/auth surfaces, noindex pages, params/wildcards/queries and non-paths", () => {
    const out = registrableRoutes([
      "/accept-invite", "/reset-password", "/team-login", "/portal", // app/auth
      "/courses", "/estimating", "/presentation-2026", "/lp/fb-commercial", "/lp/referral-partner", // noindex
      "/jobs/:id", "/files/*", "/x?y=1", "/x#frag", "not-a-path", // not registrable
      "/warranty",
    ]);
    expect(out).toEqual(["/warranty"]);
    for (const p of NON_MARKETING_ROUTES) expect(out).not.toContain(p);
  });

  it("the real manifest yields the pinned positioning pages", () => {
    const out = registrableRoutes(loadRoutesManifest());
    for (const p of ["/warranty", "/commercial", "/commercial/property-managers", "/commercial/hvac-service-contracts", "/heat-pump-installation-nj", "/residential"]) {
      expect(out, p).toContain(p);
    }
    for (const p of ["/accept-invite", "/team-login", "/courses"]) expect(out, p).not.toContain(p);
  });
});

describe("registerManifestRoutes", () => {
  it("inserts a zero-impression needs_review row for each missing route, and skips routes that already have a row", async () => {
    const { db, inserts } = makeDb(["/commercial", "/residential"]);
    vi.mocked(getDb).mockResolvedValue(db);

    const r = await registerManifestRoutes(["/commercial", "/residential", "/warranty", "/commercial/property-managers", "/accept-invite"]);

    expect(r).toEqual({ manifest: 5, registrable: 4, inserted: 2, existing: 2 });
    expect(inserts.map((i) => i.page)).toEqual(["/commercial/property-managers", "/warranty"]);
    const w = inserts.find((i) => i.page === "/warranty")!;
    expect(w.pageHash).toBe(pageHash(siteUrl(), "/warranty")); // the GSC sync's own upsert key, so a later sync takes the row over
    expect(w.status).toBe("needs_review");
    expect(w.url).toMatch(/^https:\/\/.+\/warranty$/);
    expect(w).not.toHaveProperty("impressions"); // DB default 0 — never set here
    expect(w).not.toHaveProperty("clicks");
  });

  it("is idempotent — a second run inserts nothing", async () => {
    const { db, inserts } = makeDb(["/warranty", "/commercial/property-managers"]);
    vi.mocked(getDb).mockResolvedValue(db);
    const r = await registerManifestRoutes(["/warranty", "/commercial/property-managers"]);
    expect(r.inserted).toBe(0);
    expect(inserts).toHaveLength(0);
  });

  it("never updates an existing row: the duplicate-key clause is a no-op on id", async () => {
    const onDup = vi.fn(() => Promise.resolve());
    const db: any = { select: () => ({ from: () => Promise.resolve([]) }), insert: () => ({ values: () => ({ onDuplicateKeyUpdate: onDup }) }) };
    vi.mocked(getDb).mockResolvedValue(db);
    await registerManifestRoutes(["/warranty"]);
    const arg = (onDup.mock.calls[0] as unknown as [{ set: Record<string, unknown> }])[0];
    expect(Object.keys(arg.set)).toEqual(["id"]);
  });

  it("returns zeros without a database", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    expect(await registerManifestRoutes(["/warranty"])).toEqual({ manifest: 1, registrable: 1, inserted: 0, existing: 0 });
  });
});

describe("registering a page does not unlock it", () => {
  it("/commercial stays locked; the /commercial/* and /warranty positioning pages are draftable", async () => {
    expect((await isLocked("/commercial")).locked).toBe(true);
    for (const p of ["/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts"]) {
      expect((await isLocked(p)).locked, p).toBe(false);
    }
  });
});
