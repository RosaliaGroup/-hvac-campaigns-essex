import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("drizzle-orm", async (orig) => {
  const actual = await orig<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    inArray: (col: { name: string }, vals: unknown[]) => ({ __op: "in", col, vals }),
  };
});

import { getDb } from "../../db";
import { uniqueBranchFor, findOpenBatchWithPrefix, META_BRANCH_PREFIX, CONTENT_BRANCH_PREFIX } from "./batchBranches";

type Row = { id: number; branch: string; status: string; prNumber: number | null };
type Cond = { __op: "eq"; col: { name: string }; val: unknown } | { __op: "in"; col: { name: string }; vals: unknown[] };

function fakeDb(rows: Row[]) {
  const match = (r: Row, c: Cond) => (c.__op === "eq" ? (r as any)[c.col.name] === c.val : c.vals.includes((r as any)[c.col.name]));
  return { select: () => ({ from: () => ({ where: (c: Cond) => Promise.resolve(rows.filter((r) => match(r, c))) }) }) } as never;
}

beforeEach(() => vi.mocked(getDb).mockReset());

describe("uniqueBranchFor — one branch per batch", () => {
  it("returns the base name when no batch has used it", async () => {
    vi.mocked(getDb).mockResolvedValue(fakeDb([{ id: 1, branch: "pr-seo-meta-20260929", status: "merged", prNumber: 141 }]));
    expect(await uniqueBranchFor("pr-seo-meta-20260930")).toBe("pr-seo-meta-20260930");
  });

  it("adds -2, -3 … when the day's name was already used by ANY batch (open, merged, reverted or failed)", async () => {
    const rows: Row[] = [
      { id: 1, branch: "pr-seo-meta-20260930", status: "merged", prNumber: 143 },
      { id: 2, branch: "pr-seo-meta-20260930-2", status: "failed", prNumber: 150 },
    ];
    vi.mocked(getDb).mockResolvedValue(fakeDb(rows));
    expect(await uniqueBranchFor("pr-seo-meta-20260930")).toBe("pr-seo-meta-20260930-3");
  });

  it("never reuses a merged-and-kept branch (its base would be stale)", async () => {
    vi.mocked(getDb).mockResolvedValue(fakeDb([{ id: 1, branch: "pr-content-20260930-t4", status: "merged", prNumber: 1 }]));
    expect(await uniqueBranchFor("pr-content-20260930-t4")).toBe("pr-content-20260930-t4-2");
    expect(await uniqueBranchFor("pr-content-20260930-t5")).toBe("pr-content-20260930-t5");
  });

  it("falls back to the base name without a database", async () => {
    vi.mocked(getDb).mockResolvedValue(null as never);
    expect(await uniqueBranchFor("pr-seo-meta-20260930")).toBe("pr-seo-meta-20260930");
  });
});

describe("findOpenBatchWithPrefix — one open PR per lane", () => {
  const rows: Row[] = [
    { id: 1, branch: "pr-seo-meta-20260930", status: "merged", prNumber: 143 },
    { id: 2, branch: "pr-seo-meta-20260930-2", status: "pr_open", prNumber: 150 },
    { id: 3, branch: "pr-content-20260930-t4", status: "pr_open", prNumber: 151 },
    { id: 4, branch: "revert-pr-seo-meta-20260929-123", status: "pr_open", prNumber: 152 },
  ];

  it("finds the open batch in the requested lane only, ignoring merged batches and revert branches", async () => {
    vi.mocked(getDb).mockResolvedValue(fakeDb(rows));
    expect((await findOpenBatchWithPrefix(META_BRANCH_PREFIX))?.id).toBe(2);
    expect((await findOpenBatchWithPrefix(CONTENT_BRANCH_PREFIX))?.id).toBe(3);
  });

  it("returns null when the lane has nothing open", async () => {
    vi.mocked(getDb).mockResolvedValue(fakeDb(rows.filter((r) => r.id === 1)));
    expect(await findOpenBatchWithPrefix(META_BRANCH_PREFIX)).toBeNull();
    expect(await findOpenBatchWithPrefix(CONTENT_BRANCH_PREFIX)).toBeNull();
  });
});
