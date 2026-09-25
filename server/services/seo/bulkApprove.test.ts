/**
 * Acceptance tests for the bulk-approve PR flow (docs/seo-bulk-approve-spec.md §11).
 *
 * Drives approveBatchToPR()/revertBatch() against an in-memory fake `db` (same
 * pattern as optimizations.test.ts) and a fake in-memory "GitHub" (branches +
 * PRs, via a mocked ./github module) — no real network call, no real database.
 * Pins the spec's hard guarantees: exactly one commit + one PR per batch,
 * zero writes to `main`, batch/audit rows that match the diff shown in the PR
 * body, locked/blocked pages rejected before anything is written, and revert
 * restoring only the pages a specific batch touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type GhOverrides = Record<string, { title: string; description: string }>;

const { ghState, resetGhState, FakeGithubNotConfiguredError } = vi.hoisted(() => {
  type GhOverrides = Record<string, { title: string; description: string }>;

  const ghState = {
    configured: true,
    /** branch name -> { overrides, sha } — "main" seeded separately below. */
    branches: new Map<string, { overrides: GhOverrides; sha: string }>(),
    prs: new Map<string, { url: string; number: number; body: string; title: string }>(),
    commits: [] as Array<{ branch: string; content: GhOverrides; message: string }>,
    commitCounter: 0,
    prCounter: 0,
  };

  function resetGhState(mainOverrides: GhOverrides = {}) {
    ghState.configured = true;
    ghState.branches = new Map([["main", { overrides: mainOverrides, sha: "blobsha-main" }]]);
    ghState.prs = new Map();
    ghState.commits = [];
    ghState.commitCounter = 0;
    ghState.prCounter = 0;
  }
  resetGhState();

  class FakeGithubNotConfiguredError extends Error {
    constructor() {
      super("SEO_GITHUB_TOKEN is not set — the bulk-approve PR flow is not configured.");
      this.name = "GithubNotConfiguredError";
    }
  }

  return { ghState, resetGhState, FakeGithubNotConfiguredError };
});

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    and: (...conds: unknown[]) => ({ __op: "and", conds }),
    inArray: (col: { name: string }, vals: unknown[]) => ({ __op: "in", col, vals }),
  };
});

vi.mock("./github", () => ({
  isGithubConfigured: () => ghState.configured,
  GithubNotConfiguredError: FakeGithubNotConfiguredError,
  ensureBranch: vi.fn(async (branch: string) => {
    if (!ghState.branches.has(branch)) {
      const main = ghState.branches.get("main")!;
      ghState.branches.set(branch, { overrides: { ...main.overrides }, sha: `blobsha-${branch}` });
    }
  }),
  getOverridesFile: vi.fn(async (branch: string) => {
    const b = ghState.branches.get(branch);
    if (!b) throw new Error(`branch ${branch} not found`);
    return { content: b.overrides, sha: b.sha };
  }),
  commitOverridesFile: vi.fn(async (branch: string, content: GhOverrides, message: string) => {
    const commitSha = `commit-${++ghState.commitCounter}`;
    ghState.branches.set(branch, { overrides: content, sha: `blobsha-${ghState.commitCounter}` });
    ghState.commits.push({ branch, content, message });
    return commitSha;
  }),
  openOrGetPR: vi.fn(async (branch: string, title: string, body: string) => {
    const existing = ghState.prs.get(branch);
    if (existing) {
      existing.body = body;
      return { url: existing.url, number: existing.number, created: false };
    }
    const number = ++ghState.prCounter;
    const pr = { url: `https://github.com/RosaliaGroup/-hvac-campaigns-essex/pull/${number}`, number, body, title };
    ghState.prs.set(branch, pr);
    return { url: pr.url, number: pr.number, created: true };
  }),
}));

import { getDb } from "../../db";
import { seoPages, seoAiDrafts, seoApprovalBatches, seoAuditLog, seoPageTags } from "../../../drizzle/schema";
import {
  buildBatchDiff,
  approveBatchToPR,
  revertBatch,
  isInPendingBatch,
  assertReindexAllowed,
  LockedPagesError,
  LintBlockedError,
  BatchTooLargeError,
  PendingBatchError,
  MAX_BATCH_SIZE,
  MockProviderError,
} from "./bulkApprove";
import { GithubNotConfiguredError } from "./github";
import { setAiOptimizationProvider, type AiOptimizationProvider } from "./ai/optimizationProvider";

/** A non-mock stand-in so approveBatchToPR's happy-path tests aren't blocked by the new mock-provider gate; only `.model` is ever read by bulkApprove.ts. */
const REAL_TEST_PROVIDER = { model: "real-test-provider" } as AiOptimizationProvider;

/* ── In-memory fake drizzle db — seoPages, seoAiDrafts, seoApprovalBatches, seoAuditLog, seoPageTags ── */

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
  const drafts = new Map<number, Record<string, any>>();
  const batches = new Map<number, Record<string, any>>();
  const auditRows: Array<Record<string, any>> = [];
  const tagRows: Array<Record<string, any>> = [];
  let nextBatchId = 1;
  let nextAuditId = 1;

  const backing = (table: unknown) => {
    if (table === seoPages) return pages;
    if (table === seoAiDrafts) return [...drafts.values()];
    if (table === seoApprovalBatches) return [...batches.values()];
    if (table === seoAuditLog) return auditRows;
    if (table === seoPageTags) return tagRows;
    return [];
  };

  const db: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: Cond) => {
          const rows = () => backing(table).filter((r) => rowMatches(r, cond));
          return {
            limit: () => Promise.resolve(rows()),
            orderBy: () => ({ limit: () => Promise.resolve(rows()) }),
            then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(rows()).then(res, rej),
          };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, any>) => {
        if (table === seoAiDrafts) {
          return {
            onDuplicateKeyUpdate: ({ set }: { set: Record<string, any> }) => {
              const existing = drafts.get(vals.pageId);
              if (existing) Object.assign(existing, set);
              else
                drafts.set(vals.pageId, {
                  id: drafts.size + 1,
                  generatedTitle: null,
                  generatedMetaDescription: null,
                  generatedH1: null,
                  faq: null,
                  internalLinks: null,
                  schema: null,
                  contentExpansion: null,
                  model: "mock-v1",
                  status: "draft",
                  updatedAt: new Date("2026-07-14T00:00:00Z"),
                  ...vals,
                });
              return Promise.resolve([{ insertId: 1 }]);
            },
          };
        }
        if (table === seoApprovalBatches) {
          const id = nextBatchId++;
          const row = {
            id,
            actorId: null,
            commitSha: null,
            prUrl: null,
            prNumber: null,
            status: "pr_open",
            revertsBatchId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...vals,
          };
          batches.set(id, row);
          return Promise.resolve([{ insertId: id }]);
        }
        if (table === seoAuditLog) {
          const id = nextAuditId++;
          auditRows.push({ id, ts: new Date(), actorId: null, batchId: null, pagePath: null, before: null, after: null, lintResult: null, ...vals });
          return Promise.resolve([{ insertId: id }]);
        }
        // seoPageTags — not exercised by these tests (no tag rows seeded)
        return Promise.resolve([{ insertId: 1 }]);
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (cond: Cond) => {
          for (const r of backing(table).filter((r) => rowMatches(r, cond))) Object.assign(r, vals);
          return Promise.resolve([{}]);
        },
      }),
    }),
  };
  return { db, pages, drafts, batches, auditRows, tagRows };
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

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  resetGhState();
  // buildBatchDiff() doesn't touch the AI provider (a locked/lint-blocked
  // page must reject regardless of what's drafting), but every
  // approveBatchToPR() test below assumes a real, non-mock provider unless
  // it explicitly resets to the default (see the MockProviderError test).
  setAiOptimizationProvider(REAL_TEST_PROVIDER);
});

/* ── buildBatchDiff — validation gates ───────────────────────────────────── */

describe("buildBatchDiff — validation", () => {
  it("throws BatchTooLargeError over the cap without touching the db", async () => {
    const ids = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => i + 1);
    await expect(buildBatchDiff(ids)).rejects.toBeInstanceOf(BatchTooLargeError);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects a locked page and writes nothing to GitHub", async () => {
    const { db } = makeDb([page({ id: 1, page: "/qualify" })]); // exact-path locked
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(buildBatchDiff([1])).rejects.toBeInstanceOf(LockedPagesError);
    expect(ghState.commits).toHaveLength(0);
    expect(ghState.prs.size).toBe(0);
  });

  it("rejects a page whose title fails the claims linter", async () => {
    const { db } = makeDb([page({ id: 1, title: "#1 HVAC Contractor in Elizabeth, NJ" })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(buildBatchDiff([1])).rejects.toBeInstanceOf(LintBlockedError);
  });

  it("returns a clean diff row for a valid, unlocked page", async () => {
    const { db } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const rows = await buildBatchDiff([1]);
    expect(rows).toHaveLength(1);
    expect(rows[0].pagePath).toBe("/hvac-elizabeth-nj");
    expect(rows[0].after.title).toBe(page().title);
    expect(rows[0].lint.passes).toBe(true);
  });
});

/* ── approveBatchToPR — one commit, one PR, zero writes to main ─────────── */

describe("approveBatchToPR — commit/PR guarantees (spec §11)", () => {
  it("throws GithubNotConfiguredError and writes nothing when the token is absent", async () => {
    ghState.configured = false;
    const { db, batches } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(approveBatchToPR({ pageIds: [1], label: "test", actorId: 1 })).rejects.toBeInstanceOf(GithubNotConfiguredError);
    expect(batches.size).toBe(0);
    expect(ghState.commits).toHaveLength(0);
  });

  it("throws MockProviderError and writes nothing while the active provider is the mock", async () => {
    setAiOptimizationProvider(null); // back to the real default — MockAiOptimizationProvider
    const { db, batches } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(approveBatchToPR({ pageIds: [1], label: "test", actorId: 1 })).rejects.toBeInstanceOf(MockProviderError);
    expect(batches.size).toBe(0);
    expect(ghState.commits).toHaveLength(0);
    expect(ghState.prs.size).toBe(0);
  });

  it("creates exactly one commit and one PR for a two-page batch, and never writes to main", async () => {
    const pages = [
      page({ id: 1, page: "/hvac-elizabeth-nj" }),
      page({ id: 2, page: "/hvac-clifton-nj", title: "Clifton NJ HVAC Contractor | AC Repair & Install", metaDescription: "Licensed HVAC in Clifton, NJ. Free assessment. Call (862) 423-9396." }),
    ];
    const { db, drafts } = makeDb(pages);
    vi.mocked(getDb).mockResolvedValue(db as never);
    // Draft with a changed title for page 1 — proves the PR carries the *new* value.
    drafts.set(1, { pageId: 1, generatedTitle: "Elizabeth NJ Heating & Cooling | Same-Week Install", generatedMetaDescription: null, generatedH1: null, faq: null, internalLinks: null, schema: null, contentExpansion: null, model: "mock-v1", status: "draft", updatedAt: new Date() });

    const beforeMainOverrides = { ...ghState.branches.get("main")!.overrides };
    const result = await approveBatchToPR({ pageIds: [1, 2], label: "batch-1", actorId: 7 });

    expect(ghState.commits).toHaveLength(1);
    expect(ghState.commits[0].branch).not.toBe("main");
    expect(ghState.commits[0].branch).toMatch(/^pr-seo-meta-\d{8}$/);
    expect(ghState.prs.size).toBe(1);
    expect(result.prUrl).toBe([...ghState.prs.values()][0].url);
    expect(result.prNumber).toBe([...ghState.prs.values()][0].number);
    // `main`'s overrides file is untouched — the flow only ever writes the batch branch.
    expect(ghState.branches.get("main")!.overrides).toEqual(beforeMainOverrides);

    const committed = ghState.commits[0].content;
    expect(committed["/hvac-elizabeth-nj"].title).toBe("Elizabeth NJ Heating & Cooling | Same-Week Install");
    expect(committed["/hvac-clifton-nj"].title).toBe(pages[1].title);

    expect(result.batch.status).toBe("pr_open");
    expect(result.batch.pages).toEqual(["/hvac-elizabeth-nj", "/hvac-clifton-nj"]);
  });

  it("approving a full 20-page batch (the cap) still creates exactly one commit and one PR, zero writes to main", async () => {
    const pages = Array.from({ length: MAX_BATCH_SIZE }, (_, i) =>
      page({
        id: i + 1,
        page: `/hvac-city-${i + 1}-nj`,
        title: `City ${i + 1} NJ HVAC Contractor | AC & Heat Pump Installation`,
        metaDescription: `Licensed HVAC installation in City ${i + 1}, NJ. Free assessment, no obligation. Call (862) 423-9396.`,
      }),
    );
    const { db } = makeDb(pages);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const beforeMainOverrides = { ...ghState.branches.get("main")!.overrides };

    const result = await approveBatchToPR({ pageIds: pages.map((p) => p.id), label: "twenty-page-batch", actorId: 1 });

    expect(pages).toHaveLength(MAX_BATCH_SIZE);
    expect(ghState.commits).toHaveLength(1);
    expect(ghState.commits[0].branch).not.toBe("main");
    expect(ghState.prs.size).toBe(1);
    expect(ghState.branches.get("main")!.overrides).toEqual(beforeMainOverrides);
    expect(result.batch.pages).toHaveLength(MAX_BATCH_SIZE);
    expect(Object.keys(ghState.commits[0].content)).toHaveLength(MAX_BATCH_SIZE);
  });

  it("records a batch row and audit rows that match the diff shown in the PR body", async () => {
    const pages = [page({ id: 1 })];
    const { db, batches, auditRows } = makeDb(pages);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await approveBatchToPR({ pageIds: [1], label: "single-page", actorId: 3 });

    const batchRow = batches.get(result.batch.id)!;
    expect(batchRow.prUrl).toBe(result.prUrl);
    expect(batchRow.prNumber).toBe(result.prNumber);
    expect((batchRow.diff as Array<{ pagePath: string; after: { title: string } }>)[0].pagePath).toBe("/hvac-elizabeth-nj");

    const pr = [...ghState.prs.values()][0];
    expect(pr.body).toContain("/hvac-elizabeth-nj");
    // The PR body markdown-escapes "|" in the title, so match the substring around it.
    expect(pr.body).toContain("Elizabeth NJ HVAC Contractor");

    const approvedRows = auditRows.filter((r) => r.action === "approved_to_pr");
    expect(approvedRows).toHaveLength(1);
    expect(approvedRows[0].pagePath).toBe("/hvac-elizabeth-nj");
    expect(approvedRows[0].batchId).toBe(result.batch.id);

    const openedRows = auditRows.filter((r) => r.action === "pr_opened");
    expect(openedRows).toHaveLength(1);
    expect((openedRows[0].after as { prUrl: string }).prUrl).toBe(result.prUrl);
  });

  it("rejects the whole batch (no partial commit) when one page is locked", async () => {
    const { db, batches } = makeDb([page({ id: 1 }), page({ id: 2, page: "/qualify" })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(approveBatchToPR({ pageIds: [1, 2], label: "mixed", actorId: 1 })).rejects.toBeInstanceOf(LockedPagesError);
    expect(ghState.commits).toHaveLength(0);
    expect(batches.size).toBe(0);
  });
});

/* ── revertBatch — restores only that batch's pages ──────────────────────── */

describe("revertBatch", () => {
  it("restores the pre-batch title/meta for a merged batch, without touching other pages' later changes", async () => {
    const pages = [
      page({ id: 1, page: "/hvac-elizabeth-nj" }),
      page({ id: 2, page: "/hvac-clifton-nj", title: "Clifton NJ HVAC Contractor | AC Repair & Install", metaDescription: "Licensed HVAC in Clifton, NJ. Free assessment. Call (862) 423-9396." }),
    ];
    const { db, drafts, batches } = makeDb(pages);
    vi.mocked(getDb).mockResolvedValue(db as never);
    drafts.set(1, { pageId: 1, generatedTitle: "Elizabeth NJ Heating & Cooling | Same-Week Install", generatedMetaDescription: null, generatedH1: null, faq: null, internalLinks: null, schema: null, contentExpansion: null, model: "mock-v1", status: "draft", updatedAt: new Date() });

    const approved = await approveBatchToPR({ pageIds: [1, 2], label: "batch-1", actorId: 1 });
    batches.get(approved.batch.id)!.status = "merged"; // simulate merge detection

    // A second, unrelated batch changes page 2 again on a NEW branch after batch 1 merged.
    drafts.set(2, { pageId: 2, generatedTitle: "Clifton Heating & Air | 24/7 Service", generatedMetaDescription: null, generatedH1: null, faq: null, internalLinks: null, schema: null, contentExpansion: null, model: "mock-v1", status: "draft", updatedAt: new Date() });
    const mainOverridesAfterMerge = { ...ghState.branches.get("main")!.overrides };
    // Simulate batch 1's PR having actually merged to main.
    ghState.branches.set("main", { overrides: ghState.commits[0].content, sha: "blobsha-main-2" });

    const revert = await revertBatch(approved.batch.id, 9);

    expect(revert.batch.revertsBatchId).toBe(approved.batch.id);
    expect(revert.batch.branch).not.toBe(approved.batch.branch);
    expect(ghState.prs.size).toBe(2); // original PR + revert PR, both open

    const revertedOverrides = ghState.branches.get(revert.batch.branch)!.overrides;
    // Page 1 is restored to its pre-batch (original) title — batch 1's only actual change.
    expect(revertedOverrides["/hvac-elizabeth-nj"].title).toBe(pages[0].title);
    // Page 2's before/after in batch 1 were identical (no draft yet at approval time),
    // so reverting batch 1 restores that same unchanged value — it does not touch the
    // page-2 draft generated afterward, which was never part of batch 1's diff.
    expect(revertedOverrides["/hvac-clifton-nj"].title).toBe(pages[1].title);
    void mainOverridesAfterMerge;
  });

  it("throws for a batch that is not in 'merged' status", async () => {
    const { db } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const approved = await approveBatchToPR({ pageIds: [1], label: "still-open", actorId: 1 });
    await expect(revertBatch(approved.batch.id, 1)).rejects.toThrow(/not "merged"/);
  });
});

/* ── isInPendingBatch / assertReindexAllowed — reindex gate (spec §11) ──── */

describe("assertReindexAllowed — Request Reindex disabled for pr_open pages", () => {
  it("blocks reindex while the page's batch PR is open, allows it once merged", async () => {
    const { db, batches } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const approved = await approveBatchToPR({ pageIds: [1], label: "reindex-gate", actorId: 1 });
    expect(await isInPendingBatch("/hvac-elizabeth-nj")).toBe(true);
    await expect(assertReindexAllowed(1)).rejects.toBeInstanceOf(PendingBatchError);

    batches.get(approved.batch.id)!.status = "merged";
    expect(await isInPendingBatch("/hvac-elizabeth-nj")).toBe(false);
    await expect(assertReindexAllowed(1)).resolves.toBeUndefined();
  });

  it("allows reindex for a page never part of any batch", async () => {
    const { db } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await expect(assertReindexAllowed(1)).resolves.toBeUndefined();
  });
});
