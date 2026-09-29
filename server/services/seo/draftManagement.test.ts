/**
 * Tests for discardAllDrafts()'s excludePageIds option (no prior coverage
 * existed for this file). Drives against an in-memory fake db, same pattern
 * as the other seo service tests — no real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    lt: (col: { name: string }, val: unknown) => ({ __op: "lt", col, val }),
    and: (...conds: Cond[]) => ({ __op: "and", conds }),
  };
});

import { getDb } from "../../db";
import { seoAiDrafts, seoPages, seoAuditLog } from "../../../drizzle/schema";
import { discardAllDrafts, sweepStaleOptimizingPages } from "./draftManagement";

type Cond =
  | { __op: "eq"; col: { name: string }; val: unknown }
  | { __op: "lt"; col: { name: string }; val: unknown }
  | { __op: "and"; conds: Cond[] }
  | undefined;

function rowMatches(row: Record<string, any>, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.__op === "and") return cond.conds.every((c) => rowMatches(row, c));
  if (cond.__op === "lt") return row[cond.col.name] < cond.val;
  return row[cond.col.name] === cond.val; // eq
}

function makeDb(pages: Array<Record<string, any>>, drafts: Array<Record<string, any>>) {
  const auditRows: Array<Record<string, any>> = [];
  let nextAuditId = 1;
  const backing = (table: unknown) => (table === seoPages ? pages : table === seoAiDrafts ? drafts : []);

  const db: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: Cond) => Promise.resolve(backing(table).filter((r) => rowMatches(r, cond))),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(backing(table)).then(res, rej),
      }),
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (cond: Cond) => {
          for (const r of backing(table).filter((r) => rowMatches(r, cond))) Object.assign(r, vals);
          return Promise.resolve([{}]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, any>) => ({
        onDuplicateKeyUpdate: ({ set }: { set: Record<string, unknown> }) => {
          if (table === seoAiDrafts) {
            const existing = drafts.find((d) => d.pageId === vals.pageId);
            if (existing) Object.assign(existing, set);
            else drafts.push({ ...vals, ...set });
          }
          return Promise.resolve([{ insertId: 1 }]);
        },
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
          if (table === seoAuditLog) auditRows.push({ id: nextAuditId++, ts: new Date(), ...vals });
          return Promise.resolve([{ insertId: 1 }]).then(res, rej);
        },
      }),
    }),
  };
  return { db, pages, drafts, auditRows };
}

function page(overrides: Record<string, any> = {}) {
  return { id: 1, page: "/hvac-newark-nj", status: "optimizing", siteUrl: "https://mechanicalenterprise.com/", updatedAt: new Date(), ...overrides };
}

function draft(overrides: Record<string, any> = {}) {
  return { pageId: 1, generatedTitle: "Old title", generatedMetaDescription: "Old meta", status: "draft", ...overrides };
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
});

describe("discardAllDrafts", () => {
  it("discards every draft and resets every page to needs_review when nothing is excluded", async () => {
    const pages = [page({ id: 1, page: "/a" }), page({ id: 2, page: "/b" })];
    const drafts = [draft({ pageId: 1 }), draft({ pageId: 2, generatedTitle: "Other title" })];
    const { db } = makeDb(pages, drafts);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await discardAllDrafts(1);

    expect(result.discarded).toBe(2);
    expect(drafts[0].generatedTitle).toBeNull();
    expect(drafts[0].status).toBe("draft");
    expect(drafts[1].generatedTitle).toBeNull();
    expect(pages[0].status).toBe("needs_review");
    expect(pages[1].status).toBe("needs_review");
  });

  it("excludes the given page ids entirely — their draft content and page status are untouched", async () => {
    const pages = [
      page({ id: 1, page: "/about", status: "optimizing" }),
      page({ id: 2, page: "/hvac-newark-nj", status: "optimizing" }),
    ];
    const drafts = [
      draft({ pageId: 1, generatedTitle: "About Mechanical Enterprise", model: "anthropic-claude-sonnet-5" }),
      draft({ pageId: 2, generatedTitle: "Stale mock title", model: "mock-v1" }),
    ];
    const { db } = makeDb(pages, drafts);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await discardAllDrafts(1, [1]);

    expect(result.discarded).toBe(1); // only page 2 counted
    expect(drafts[0].generatedTitle).toBe("About Mechanical Enterprise"); // excluded — untouched
    expect(pages[0].status).toBe("optimizing"); // excluded — untouched
    expect(drafts[1].generatedTitle).toBeNull(); // discarded
    expect(pages[1].status).toBe("needs_review"); // discarded
  });

  it("logs draft_discarded only for the non-excluded pages", async () => {
    const pages = [page({ id: 1, page: "/about" }), page({ id: 2, page: "/hvac-newark-nj" })];
    const drafts = [draft({ pageId: 1 }), draft({ pageId: 2 })];
    const { db, auditRows } = makeDb(pages, drafts);
    vi.mocked(getDb).mockResolvedValue(db as never);

    await discardAllDrafts(1, [1]);

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("draft_discarded");
    expect(auditRows[0].pagePath).toBe("/hvac-newark-nj");
  });

  it("excluding every page discards nothing", async () => {
    const pages = [page({ id: 1 })];
    const drafts = [draft({ pageId: 1 })];
    const { db } = makeDb(pages, drafts);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await discardAllDrafts(1, [1]);

    expect(result.discarded).toBe(0);
    expect(drafts[0].generatedTitle).toBe("Old title");
  });
});

describe("sweepStaleOptimizingPages", () => {
  const NOW = new Date("2026-09-28T12:00:00Z");
  const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

  it("resets a page stuck in optimizing past the 30min threshold, preserving its draft content", async () => {
    const pages = [page({ id: 1, page: "/hvac-short-hills-nj", status: "optimizing", updatedAt: minutesAgo(45) })];
    const drafts = [draft({ pageId: 1, generatedTitle: "AI-generated title", status: "draft" })];
    const { db, auditRows } = makeDb(pages, drafts);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await sweepStaleOptimizingPages(NOW);

    expect(result.reset).toBe(1);
    expect(pages[0].status).toBe("needs_review");
    expect(drafts[0].generatedTitle).toBe("AI-generated title"); // content NOT wiped, unlike discardAllDrafts
    expect(drafts[0].status).toBe("draft");
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("draft_discarded");
    expect(auditRows[0].pagePath).toBe("/hvac-short-hills-nj");
    expect(auditRows[0].before.reason).toBe("stale-optimizing sweep");
  });

  it("leaves a page that entered optimizing less than 30min ago untouched", async () => {
    const pages = [page({ id: 1, status: "optimizing", updatedAt: minutesAgo(10) })];
    const drafts = [draft({ pageId: 1 })];
    const { db, auditRows } = makeDb(pages, drafts);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await sweepStaleOptimizingPages(NOW);

    expect(result.reset).toBe(0);
    expect(pages[0].status).toBe("optimizing");
    expect(auditRows).toHaveLength(0);
  });

  it("ignores a stale page that isn't in optimizing (e.g. already approved)", async () => {
    const pages = [page({ id: 1, status: "approved", updatedAt: minutesAgo(120) })];
    const { db } = makeDb(pages, []);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await sweepStaleOptimizingPages(NOW);

    expect(result.reset).toBe(0);
    expect(pages[0].status).toBe("approved");
  });

  it("resets multiple stale pages in one pass", async () => {
    const pages = [
      page({ id: 1, page: "/a", status: "optimizing", updatedAt: minutesAgo(60) }),
      page({ id: 2, page: "/b", status: "optimizing", updatedAt: minutesAgo(31) }),
      page({ id: 3, page: "/c", status: "optimizing", updatedAt: minutesAgo(5) }), // not stale yet
    ];
    const { db } = makeDb(pages, []);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await sweepStaleOptimizingPages(NOW);

    expect(result.reset).toBe(2);
    expect(pages[0].status).toBe("needs_review");
    expect(pages[1].status).toBe("needs_review");
    expect(pages[2].status).toBe("optimizing");
  });
});
