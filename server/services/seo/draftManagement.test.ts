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
  };
});

import { getDb } from "../../db";
import { seoAiDrafts, seoPages, seoAuditLog } from "../../../drizzle/schema";
import { discardAllDrafts } from "./draftManagement";

type Cond = { __op: "eq"; col: { name: string }; val: unknown } | undefined;

function rowMatches(row: Record<string, any>, cond: Cond): boolean {
  if (!cond) return true;
  return row[cond.col.name] === cond.val;
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
      values: (vals: Record<string, any>) => {
        if (table === seoAuditLog) auditRows.push({ id: nextAuditId++, ts: new Date(), ...vals });
        return Promise.resolve([{ insertId: 1 }]);
      },
    }),
  };
  return { db, pages, drafts, auditRows };
}

function page(overrides: Record<string, any> = {}) {
  return { id: 1, page: "/hvac-newark-nj", status: "optimizing", ...overrides };
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
