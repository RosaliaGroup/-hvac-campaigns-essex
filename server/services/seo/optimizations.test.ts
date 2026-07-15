/**
 * AI SEO Optimization Engine — service + job-runner + authorization tests.
 *
 * Drives the draft service (optimizations.ts) and job runner (ai/jobs.ts) with
 * an in-memory fake `db` (via a getDb mock). The fake introspects the drizzle
 * `eq`/`inArray` conditions — which are partially mocked to expose {col,val} —
 * so multi-page bulk paths resolve the correct rows. Nothing here hits a real
 * database, network, or the live site.
 *
 * These tests pin the drafts-only guarantees: the service writes seoAiDrafts and
 * the seoPages.status workflow column ONLY — never any live page-content column.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("../../integrations/searchConsole", () => ({
  getSeoSiteUrl: () => "sc-domain:example.com",
}));
// Expose eq/inArray as inspectable descriptors so the fake db can filter rows.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    inArray: (col: { name: string }, vals: unknown[]) => ({ __op: "in", col, vals }),
  };
});

import { getDb } from "../../db";
import { seoPages, seoAiDrafts } from "../../../drizzle/schema";
import {
  generateOptimization,
  updateDraft,
  approveDraft,
  rejectDraft,
  getDraft,
  getBusinessImpact,
} from "./optimizations";
import {
  runOptimizationJob,
  runBulkOptimization,
  mapWithConcurrency,
  DuplicateJobError,
  isJobActive,
  activeJobCount,
  _resetJobs,
  DEFAULT_BULK_CONCURRENCY,
} from "./ai/jobs";
import {
  setAiOptimizationProvider,
  MockAiOptimizationProvider,
  type AiOptimizationProvider,
  type PageContext,
} from "./ai/optimizationProvider";

/* ── In-memory fake drizzle db ───────────────────────────────────────────── */

type Cond = { __op: "eq"; col: { name: string }; val: unknown } | { __op: "in"; col: { name: string }; vals: unknown[] };

function makeDb(pages: Array<Record<string, any>>) {
  const drafts = new Map<number, Record<string, any>>();
  /** Every object passed to `.set()` on seoPages — proves what columns are mutated. */
  const pageUpdates: Array<Record<string, unknown>> = [];

  const rowVal = (row: Record<string, any>, cond: Cond) => row[cond.col.name];
  const filter = (rows: Array<Record<string, any>>, cond: Cond | undefined) => {
    if (!cond) return rows;
    if (cond.__op === "eq") return rows.filter((r) => rowVal(r, cond) === cond.val);
    return rows.filter((r) => cond.vals.includes(rowVal(r, cond)));
  };

  const db: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: Cond) => {
          const rows = () => filter(table === seoPages ? pages : [...drafts.values()], cond);
          return {
            limit: () => Promise.resolve(rows()),
            then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve(rows()).then(res, rej),
          };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, any>) => ({
        onDuplicateKeyUpdate: ({ set }: { set: Record<string, any> }) => {
          if (table === seoAiDrafts) {
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
          }
          return Promise.resolve([{ insertId: 1 }]);
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => {
        if (table === seoPages) pageUpdates.push(vals);
        return {
          where: (cond: Cond) => {
            if (table === seoPages) for (const p of filter(pages, cond)) Object.assign(p, vals);
            return Promise.resolve([{}]);
          },
        };
      },
    }),
  };
  return { db, drafts, pageUpdates };
}

function page(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: 1,
    page: "/hvac-newark-nj",
    url: "https://mechanicalenterprise.com/hvac-newark-nj",
    title: "Old title",
    metaDescription: "Old meta",
    h1: "Old H1",
    category: "commercial",
    clicks: 10,
    impressions: 5000,
    ctr: 0.002,
    position: 12,
    problems: ["weak_title"],
    siteUrl: "sc-domain:example.com",
    status: "needs_review",
    ...overrides,
  };
}

/* ── Provider test doubles ───────────────────────────────────────────────── */

function failingProvider(msg = "provider down"): AiOptimizationProvider {
  const fail = async () => {
    throw new Error(msg);
  };
  return {
    model: "failing",
    generateTitle: fail,
    generateMetaDescription: fail,
    generateH1: fail,
    generateFaq: fail,
    generateInternalLinks: fail,
    generateSchema: fail,
    expandContent: fail,
  };
}

/** Delegates to the real mock, but throws for one page path (bulk isolation). */
function providerFailingFor(failPath: string): AiOptimizationProvider {
  const base = new MockAiOptimizationProvider();
  const guard =
    <T,>(fn: (ctx: PageContext) => Promise<T>) =>
    (ctx: PageContext) =>
      ctx.page === failPath ? Promise.reject(new Error("provider down")) : fn.call(base, ctx);
  return {
    model: base.model,
    generateTitle: guard(base.generateTitle),
    generateMetaDescription: guard(base.generateMetaDescription),
    generateH1: guard(base.generateH1),
    generateFaq: guard(base.generateFaq),
    generateInternalLinks: guard(base.generateInternalLinks),
    generateSchema: guard(base.generateSchema),
    expandContent: guard(base.expandContent),
  };
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  setAiOptimizationProvider(null); // back to the default deterministic mock
  _resetJobs();
});

/* ── Draft creation ──────────────────────────────────────────────────────── */

describe("generateOptimization — draft creation", () => {
  it("stores a draft, fills the action's fields, and moves the page to optimizing", async () => {
    const p = page();
    const { db, drafts, pageUpdates } = makeDb([p]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const draft = await generateOptimization(1, "rewrite_title");

    expect(draft?.title).toBeTruthy();
    expect(draft?.h1).toBeTruthy(); // rewrite_title covers title + h1
    expect(draft?.metaDescription).toBeNull(); // untouched field stays empty
    expect(drafts.get(1)?.status).toBe("draft");
    expect(p.status).toBe("optimizing");
    expect(pageUpdates).toEqual([{ status: "optimizing" }]);
  });

  it("optimize_everything generates every draft section", async () => {
    const { db } = makeDb([page()]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const d = await generateOptimization(1, "optimize_everything");

    expect(d?.title).toBeTruthy();
    expect(d?.metaDescription).toBeTruthy();
    expect(d?.h1).toBeTruthy();
    expect(d?.contentExpansion).toBeTruthy();
    expect(d?.faq.length).toBeGreaterThan(0);
    expect(d?.internalLinks.length).toBeGreaterThan(0);
    expect(d?.schema).toBeTruthy();
  });

  it("request_reindex generates no content and writes no draft fields", async () => {
    const p = page();
    const { db, drafts } = makeDb([p]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const d = await generateOptimization(1, "request_reindex");

    expect(d).not.toBeNull();
    expect(drafts.has(1)).toBe(false); // nothing generated → no draft row
    expect(p.status).toBe("needs_review"); // service leaves status; caller flags reindex
  });

  it("returns null for an unknown page", async () => {
    const { db } = makeDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    expect(await generateOptimization(999, "rewrite_title")).toBeNull();
  });
});

/* ── Job success / failure / duplicate protection ────────────────────────── */

describe("runOptimizationJob — success & finalization", () => {
  it("returns the draft and clears the active-job flag on success", async () => {
    const { db } = makeDb([page()]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const d = await runOptimizationJob(1, "rewrite_meta");

    expect(d?.metaDescription).toBeTruthy();
    expect(isJobActive(1)).toBe(false);
    expect(activeJobCount()).toBe(0);
  });

  it("provider failure rejects the job, un-sticks the page, and writes no draft", async () => {
    const p = page();
    const { db, drafts, pageUpdates } = makeDb([p]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    setAiOptimizationProvider(failingProvider("boom"));

    await expect(runOptimizationJob(1, "rewrite_title")).rejects.toThrow("boom");

    expect(isJobActive(1)).toBe(false); // finally released
    expect(p.status).toBe("needs_review"); // never advanced to optimizing
    expect(drafts.has(1)).toBe(false); // no partial draft persisted
    expect(pageUpdates).toEqual([]); // no page write at all on failure
  });

  it("rejects a second job while one is already in flight (duplicate protection)", async () => {
    const { db } = makeDb([page()]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const base = new MockAiOptimizationProvider();
    setAiOptimizationProvider({
      model: base.model,
      generateTitle: async (ctx) => {
        await gate; // hold the first job in flight
        return base.generateTitle(ctx);
      },
      generateMetaDescription: (ctx) => base.generateMetaDescription(ctx),
      generateH1: (ctx) => base.generateH1(ctx),
      generateFaq: (ctx) => base.generateFaq(ctx),
      generateInternalLinks: (ctx) => base.generateInternalLinks(ctx),
      generateSchema: (ctx) => base.generateSchema(ctx),
      expandContent: (ctx) => base.expandContent(ctx),
    });

    const first = runOptimizationJob(1, "rewrite_title");
    expect(isJobActive(1)).toBe(true);

    await expect(runOptimizationJob(1, "rewrite_title")).rejects.toBeInstanceOf(DuplicateJobError);

    release();
    await first;
    expect(isJobActive(1)).toBe(false);
  });
});

/* ── Regenerate / approve / reject ───────────────────────────────────────── */

describe("regenerate / approve / reject lifecycle", () => {
  it("regenerate replaces human-edited content and resets status to draft", async () => {
    const { db, drafts } = makeDb([page()]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await generateOptimization(1, "rewrite_title");
    await updateDraft(1, { title: "Human edited title" });
    expect(drafts.get(1)?.status).toBe("edited");

    const d = await runOptimizationJob(1, "rewrite_title"); // regenerate
    expect(drafts.get(1)?.generatedTitle).not.toBe("Human edited title");
    expect(d?.status).toBe("draft");
  });

  it("approve promotes draft + page to approved; reject reverts to draft / needs_review", async () => {
    const p = page();
    const { db, drafts, pageUpdates } = makeDb([p]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await generateOptimization(1, "rewrite_title");
    await approveDraft(1);
    expect(drafts.get(1)?.status).toBe("approved");
    expect(p.status).toBe("approved");

    await rejectDraft(1);
    expect(drafts.get(1)?.status).toBe("draft");
    expect(p.status).toBe("needs_review");

    // Reject preserves the generated content — nothing is deleted.
    expect(drafts.get(1)?.generatedTitle).toBeTruthy();
  });
});

/* ── Bulk actions / bounded concurrency ──────────────────────────────────── */

describe("runBulkOptimization — bulk actions", () => {
  it("returns one result per page and marks each success", async () => {
    const { db } = makeDb([
      page({ id: 1 }),
      page({ id: 2, page: "/hvac-edison-nj" }),
      page({ id: 3, page: "/hvac-clifton-nj" }),
    ]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const results = await runBulkOptimization([1, 2, 3], "rewrite_title");

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.pageId)).toEqual([1, 2, 3]);
  });

  it("isolates a single page's failure without aborting the batch", async () => {
    const { db } = makeDb([
      page({ id: 1 }),
      page({ id: 2, page: "/hvac-edison-nj" }),
      page({ id: 3, page: "/hvac-clifton-nj" }),
    ]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    setAiOptimizationProvider(providerFailingFor("/hvac-edison-nj"));

    const results = await runBulkOptimization([1, 2, 3], "rewrite_title");

    const failed = results.filter((r) => !r.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ pageId: 2, ok: false, error: "provider down" });
    expect(results.filter((r) => r.ok)).toHaveLength(2);
  });

  it("collapses duplicate ids so a page is optimized once", async () => {
    const { db } = makeDb([page({ id: 1 })]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const results = await runBulkOptimization([1, 1, 1], "rewrite_title");
    expect(results).toHaveLength(1);
  });
});

describe("mapWithConcurrency — bounded concurrency", () => {
  it("never exceeds the limit and preserves input order", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    const out = await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 2;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBe(3); // a 12-item batch does saturate the pool
    expect(out).toEqual(items.map((n) => n * 2));
  });

  it("uses a conservative default concurrency", () => {
    expect(DEFAULT_BULK_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_BULK_CONCURRENCY).toBeLessThanOrEqual(8);
  });
});

/* ── Drafts-only guarantee: no live-page mutation ────────────────────────── */

describe("no live-page mutation", () => {
  it("only ever writes the seoPages.status column — never page content", async () => {
    const { db, pageUpdates } = makeDb([page()]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await generateOptimization(1, "optimize_everything");
    await updateDraft(1, { title: "edited", contentExpansion: "edited body" });
    await approveDraft(1);
    await rejectDraft(1);

    expect(pageUpdates.length).toBeGreaterThan(0);
    const forbidden = ["title", "metaDescription", "h1", "url", "page", "content", "contentExpansion"];
    for (const u of pageUpdates) {
      expect(Object.keys(u)).toEqual(["status"]);
      for (const k of forbidden) expect(u).not.toHaveProperty(k);
    }
  });

  it("stores edits on the draft, leaving the source page row untouched", async () => {
    const p = page();
    const { db, drafts } = makeDb([p]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await generateOptimization(1, "rewrite_title");
    await updateDraft(1, { title: "Brand-new human title" });

    expect(drafts.get(1)?.generatedTitle).toBe("Brand-new human title");
    expect(p.title).toBe("Old title"); // live page content never changes
    expect(p.h1).toBe("Old H1");
  });
});

/* ── Business impact (assumptions surfaced) ──────────────────────────────── */

describe("getBusinessImpact", () => {
  it("aggregates the funnel and never projects below current clicks", async () => {
    const { db } = makeDb([
      page({ id: 1, clicks: 10, impressions: 5000, ctr: 0.002, position: 12 }),
      page({ id: 2, clicks: 4, impressions: 2000, ctr: 0.002, position: 15, page: "/hvac-edison-nj" }),
    ]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const impact = await getBusinessImpact();

    expect(impact.projected.clicks).toBeGreaterThanOrEqual(impact.current.clicks);
    expect(impact.deltaRevenue).toBe(impact.projected.revenue - impact.current.revenue);
    expect(impact.conversions).toBeTruthy(); // funnel assumptions surfaced for the UI
  });
});

/* ── Authorization (router-level) ────────────────────────────────────────── */

describe("authorization", () => {
  // Imported lazily so the drizzle-orm / db mocks are installed first.
  async function seoCaller(user: unknown) {
    const { createCallerFactory } = await import("../../_core/trpc");
    const { seoRouter } = await import("../../routers/seo");
    return createCallerFactory(seoRouter)({ user } as never);
  }

  it("rejects admin-only write mutations for a non-admin caller (FORBIDDEN)", async () => {
    const caller = await seoCaller({ id: 1, role: "member", teamRole: "member" });

    await expect(caller.generateOptimization({ id: 1, action: "rewrite_title" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.approveOptimization({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.rejectOptimization({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.bulkGenerateOptimization({ ids: [1], action: "rewrite_title" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a protected read for an authenticated non-admin user", async () => {
    const { db } = makeDb([page()]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = await seoCaller({ id: 1, role: "member", teamRole: "member" });

    const draft = await caller.getOptimization({ id: 1 });
    expect(draft.pageId).toBe(1);
  });
});
