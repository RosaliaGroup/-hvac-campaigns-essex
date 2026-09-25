/**
 * Router-level tests for the bulk-approve procedures (docs/seo-bulk-approve-spec.md
 * §11). The service-layer logic is already covered by
 * server/services/seo/bulkApprove.test.ts; this file pins the HTTP-facing
 * contract those tests can't see — that a locked/lint-blocked page actually
 * surfaces as a 422 (tRPC's UNPROCESSABLE_CONTENT) through the real seoRouter,
 * that the write procedures are actually admin-gated (not just correct once
 * called), and that an unset SEO_GITHUB_TOKEN produces a real
 * PRECONDITION_FAILED error rather than a silent no-op.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    and: (...conds: unknown[]) => ({ __op: "and", conds }),
    inArray: (col: { name: string }, vals: unknown[]) => ({ __op: "in", col, vals }),
  };
});
// SEO_GITHUB_TOKEN is unset in this test process — isGithubConfigured() is
// real (not mocked) so the PRECONDITION_FAILED test reflects actual env
// behavior, not a stubbed answer.
vi.stubEnv("SEO_GITHUB_TOKEN", "");

import { getDb } from "../db";
import { seoPages, seoAiDrafts, seoPageTags } from "../../drizzle/schema";

type Cond =
  | { __op: "eq"; col: { name: string }; val: unknown }
  | { __op: "in"; col: { name: string }; vals: unknown[] }
  | { __op: "and"; conds: Cond[] }
  | undefined;

function rowMatches(row: Record<string, any>, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.__op === "eq") return row[cond.col.name] === cond.val;
  if (cond.__op === "in") return cond.vals.includes(row[cond.col.name]);
  return cond.conds.every((c) => rowMatches(row, c));
}

function makeDb(pages: Array<Record<string, any>>) {
  const backing = (table: unknown) => {
    if (table === seoPages) return pages;
    if (table === seoAiDrafts) return [];
    if (table === seoPageTags) return []; // no tags seeded — static lock rules only
    return [];
  };
  const db: any = {
    select: () => ({
      from: (table: unknown) => {
        const all = () => backing(table) as Record<string, any>[];
        const resultMethods = (rows: () => Record<string, any>[]) => ({
          limit: () => Promise.resolve(rows()),
          orderBy: () => ({ limit: () => Promise.resolve(rows()) }),
          then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(rows()).then(res, rej),
        });
        return {
          where: (cond: Cond) => resultMethods(() => all().filter((r) => rowMatches(r, cond))),
          ...resultMethods(all),
        };
      },
    }),
  };
  return db;
}

function page(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: 1,
    page: "/hvac-elizabeth-nj",
    url: "https://mechanicalenterprise.com/hvac-elizabeth-nj",
    title: "Elizabeth NJ HVAC Contractor | AC & Heat Pump Installation",
    metaDescription: "Licensed HVAC installation in Elizabeth, NJ. Free assessment, no obligation. Call (862) 423-9396.",
    h1: "Elizabeth H1",
    category: "residential",
    clicks: 10,
    impressions: 5000,
    ctr: 0.002,
    position: 12,
    problems: [],
    siteUrl: "sc-domain:example.com",
    status: "needs_review",
    ...overrides,
  };
}

async function seoCaller(user: unknown) {
  const { createCallerFactory } = await import("../_core/trpc");
  const { seoRouter } = await import("./seo");
  return createCallerFactory(seoRouter)({ user } as never);
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
});

describe("seoRouter.buildBatchDiff — locked pages surface as 422; lint-blocked pages surface inline (spec §11)", () => {
  it("a locked page (exact-path exclusion) throws UNPROCESSABLE_CONTENT", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1, page: "/qualify" })]) as never);
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    await expect(caller.buildBatchDiff({ pageIds: [1] })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" });
  });

  it('a "#1" title fails the claims linter — buildBatchDiff resolves with the finding attached, not a bare throw', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1, title: "#1 HVAC Contractor in Elizabeth, NJ" })]) as never);
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    const result = await caller.buildBatchDiff({ pageIds: [1] });
    expect(result?.rows[0].lint.passes).toBe(false);
    expect(result?.rows[0].lint.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "superlative", severity: "block" })]),
    );
  });

  it('a "$2K federal tax credit" meta description fails the claims linter — buildBatchDiff resolves with the findings attached', async () => {
    vi.mocked(getDb).mockResolvedValue(
      makeDb([page({ id: 1, metaDescription: "Combine PSE&G rebates with the $2K federal tax credit and save big." })]) as never,
    );
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    const result = await caller.buildBatchDiff({ pageIds: [1] });
    expect(result?.rows[0].lint.passes).toBe(false);
    expect(result?.rows[0].lint.findings.some((f: { code: string }) => f.code === "expired_incentive")).toBe(true);
  });

  it("a clean, unlocked page returns a diff instead of throwing", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1 })]) as never);
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    const result = await caller.buildBatchDiff({ pageIds: [1] });
    expect(result?.rows).toHaveLength(1);
  });
});

describe("seoRouter — bulk-approve write procedures are admin-gated", () => {
  it("rejects a non-admin caller on approveBatchToPR, revertBatch, addTag, removeTag, discardAllDrafts (FORBIDDEN)", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1 })]) as never);
    const caller = await seoCaller({ id: 1, role: "member", teamRole: "member" });

    await expect(caller.approveBatchToPR({ pageIds: [1], label: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.revertBatch({ batchId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.addTag({ pagePath: "/hvac-elizabeth-nj", tag: "locked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.removeTag({ pagePath: "/hvac-elizabeth-nj", tag: "locked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.discardAllDrafts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.regenerateUnlockedDrafts({ ids: [1] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows protected reads (getLockStatus, getTags, getAuditLog, listBatches, githubConfigured) for a non-admin caller", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1 })]) as never);
    const caller = await seoCaller({ id: 1, role: "member", teamRole: "member" });

    await expect(caller.getLockStatus({ paths: ["/hvac-elizabeth-nj"] })).resolves.toBeDefined();
    await expect(caller.getTags({ pagePath: "/hvac-elizabeth-nj" })).resolves.toBeDefined();
    await expect(caller.getAuditLog()).resolves.toBeDefined();
    await expect(caller.listBatches()).resolves.toBeDefined();
    await expect(caller.githubConfigured()).resolves.toEqual({ configured: false });
  });
});

describe("seoRouter — SEO_GITHUB_TOKEN unset (spec: clear \"not configured\" state, never a silent no-op)", () => {
  it("githubConfigured reports false", async () => {
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });
    expect(await caller.githubConfigured()).toEqual({ configured: false });
  });

  it("approveBatchToPR throws PRECONDITION_FAILED instead of silently doing nothing", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1 })]) as never);
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    await expect(caller.approveBatchToPR({ pageIds: [1], label: "x" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("revertBatch also throws PRECONDITION_FAILED rather than a no-op", async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1 })]) as never);
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    await expect(caller.revertBatch({ batchId: 1 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("seoRouter — AI provider status (no real provider configured anywhere yet)", () => {
  it("aiProviderStatus reports the mock provider", async () => {
    const caller = await seoCaller({ id: 1, role: "member", teamRole: "member" });
    expect(await caller.aiProviderStatus()).toEqual({ model: "mock-v1", isMock: true });
  });

  it("approveBatchToPR throws PRECONDITION_FAILED for the mock provider even with GitHub configured", async () => {
    vi.stubEnv("SEO_GITHUB_TOKEN", "gh-pat-test-value");
    vi.mocked(getDb).mockResolvedValue(makeDb([page({ id: 1 })]) as never);
    const caller = await seoCaller({ id: 1, role: "admin", teamRole: "admin" });

    await expect(caller.approveBatchToPR({ pageIds: [1], label: "x" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    vi.stubEnv("SEO_GITHUB_TOKEN", ""); // restore this file's baseline for later tests
  });
});
