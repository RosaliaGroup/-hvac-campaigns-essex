/**
 * Tests for the SEO page tags service (docs/seo-bulk-approve-spec.md §4).
 * No prior coverage existed. Written alongside the seoPageTags.pagePathHash
 * fix (pagePath itself is too long to index directly — see
 * server/seo/lockedPages.ts's hashPagePath()) to pin that every writer sets
 * the hash consistently and that lookups/upserts key off it correctly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    and: (...conds: unknown[]) => ({ __op: "and", conds }),
  };
});

import { getDb } from "../../db";
import { seoPageTags, seoAuditLog } from "../../../drizzle/schema";
import { listTags, addTag, removeTag, TagNoteRequiredError } from "./tags";
import { hashPagePath } from "../../seo/lockedPages";

type Cond =
  | { __op: "eq"; col: { name: string }; val: unknown }
  | { __op: "and"; conds: Cond[] }
  | undefined;

function rowMatches(row: Record<string, any>, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.__op === "eq") return row[cond.col.name] === cond.val;
  return cond.conds.every((c) => rowMatches(row, c));
}

function makeDb() {
  const tagRows: Array<Record<string, any>> = [];
  const auditRows: Array<Record<string, any>> = [];
  let nextTagId = 1;
  let nextAuditId = 1;

  const db: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: Cond) => {
          const rows = () => (table === seoPageTags ? tagRows : auditRows).filter((r) => rowMatches(r, cond));
          return { then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(rows()).then(res, rej) };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, any>) => {
        if (table === seoPageTags) {
          return {
            onDuplicateKeyUpdate: ({ set }: { set: Record<string, any> }) => {
              // Real MySQL upsert semantics: match on the actual unique index (pagePathHash, tag).
              const existing = tagRows.find((r) => r.pagePathHash === vals.pagePathHash && r.tag === vals.tag);
              if (existing) Object.assign(existing, set);
              else tagRows.push({ id: nextTagId++, note: null, createdById: null, createdAt: new Date(), ...vals });
              return Promise.resolve([{ insertId: 1 }]);
            },
          };
        }
        auditRows.push({ id: nextAuditId++, ts: new Date(), ...vals });
        return Promise.resolve([{ insertId: nextAuditId }]);
      },
    }),
    delete: (table: unknown) => ({
      where: (cond: Cond) => {
        if (table === seoPageTags) {
          const remaining = tagRows.filter((r) => !rowMatches(r, cond));
          tagRows.length = 0;
          tagRows.push(...remaining);
        }
        return Promise.resolve([{}]);
      },
    }),
  };
  return { db, tagRows, auditRows };
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
});

describe("addTag / listTags / removeTag", () => {
  it("addTag stores pagePathHash consistent with hashPagePath, and listTags finds it by pagePath", async () => {
    const { db, tagRows } = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await addTag({ pagePath: "/hvac-newark-nj", tag: "verified-project", note: null, actorId: 1 });

    expect(tagRows).toHaveLength(1);
    expect(tagRows[0].pagePathHash).toBe(hashPagePath("/hvac-newark-nj"));
    expect(tagRows[0].pagePath).toBe("/hvac-newark-nj");

    const found = await listTags("/hvac-newark-nj");
    expect(found).toHaveLength(1);
    expect(found[0].tag).toBe("verified-project");
  });

  it("adding the same pagePath+tag twice upserts (updates the note) instead of creating a duplicate row", async () => {
    const { db, tagRows } = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await addTag({ pagePath: "/hvac-newark-nj", tag: "claims-review", note: "first note", actorId: 1 });
    await addTag({ pagePath: "/hvac-newark-nj", tag: "claims-review", note: "second note", actorId: 2 });

    expect(tagRows).toHaveLength(1);
    expect(tagRows[0].note).toBe("second note");
  });

  it("different pages with the same tag don't collide (pagePathHash actually distinguishes them)", async () => {
    const { db, tagRows } = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);

    await addTag({ pagePath: "/hvac-newark-nj", tag: "locked", note: null, actorId: 1 });
    await addTag({ pagePath: "/hvac-elizabeth-nj", tag: "locked", note: null, actorId: 1 });

    expect(tagRows).toHaveLength(2);
    expect(await listTags("/hvac-newark-nj")).toHaveLength(1);
    expect(await listTags("/hvac-elizabeth-nj")).toHaveLength(1);
  });

  it("removeTag deletes the matching row and logs tag_removed", async () => {
    const { db, tagRows, auditRows } = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    await addTag({ pagePath: "/hvac-newark-nj", tag: "illustrative", note: null, actorId: 1 });

    await removeTag({ pagePath: "/hvac-newark-nj", tag: "illustrative", note: null, actorId: 1 });

    expect(tagRows).toHaveLength(0);
    expect(auditRows.some((r) => r.action === "tag_removed")).toBe(true);
  });

  it("removeTag rejects removing claims-review without a note (spec §4), and leaves the row in place", async () => {
    const { db, tagRows } = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    await addTag({ pagePath: "/hvac-newark-nj", tag: "claims-review", note: "seed", actorId: 1 });

    await expect(removeTag({ pagePath: "/hvac-newark-nj", tag: "claims-review", note: "", actorId: 1 })).rejects.toBeInstanceOf(TagNoteRequiredError);
    expect(tagRows).toHaveLength(1);

    await removeTag({ pagePath: "/hvac-newark-nj", tag: "claims-review", note: "verified 2026-09-25", actorId: 1 });
    expect(tagRows).toHaveLength(0);
  });
});
