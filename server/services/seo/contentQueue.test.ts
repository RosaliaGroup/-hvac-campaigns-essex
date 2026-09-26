import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("./auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: { name: string }, val: unknown) => ({ __op: "eq", col, val }),
    or: (...conds: unknown[]) => ({ __op: "or", conds }),
    asc: (col: { name: string }) => col,
  };
});

import { getDb } from "../../db";
import { logAudit } from "./auditLog";
import { seedContentQueue, listContentQueue, proposeTopic, updateQueueStatus, nextTopicToProcess, SEED_TOPICS } from "./contentQueue";

type Cond = { __op: "eq"; col: { name: string }; val: unknown } | { __op: "or"; conds: Cond[] } | undefined;

function rowMatches(row: Record<string, any>, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.__op === "eq") return row[cond.col.name] === cond.val;
  return cond.conds.some((c) => rowMatches(row, c));
}

function makeDb(initialRows: Array<Record<string, any>> = []) {
  const rows = [...initialRows];
  let nextId = rows.length + 1;
  const db: any = {
    select: () => ({
      from: () => ({
        where: (cond: Cond) => ({
          orderBy: () => ({ limit: (n: number) => Promise.resolve(rows.filter((r) => rowMatches(r, cond)).slice(0, n)) }),
          limit: (n: number) => Promise.resolve(rows.filter((r) => rowMatches(r, cond)).slice(0, n)),
        }),
        orderBy: () => Promise.resolve([...rows]),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve([...rows]).then(res, rej),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, any>) => {
        rows.push({ id: nextId++, createdAt: rows.length, ...vals });
        return Promise.resolve([{ insertId: nextId - 1 }]);
      },
    }),
    update: () => ({
      set: (patch: Record<string, any>) => ({
        where: (cond: Cond) => {
          const row = rows.find((r) => rowMatches(r, cond));
          if (row) Object.assign(row, patch);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db, rows };
}

beforeEach(() => {
  vi.mocked(getDb).mockReset();
  vi.mocked(logAudit).mockReset();
});

describe("seedContentQueue", () => {
  it("inserts all 10 seed topics on a fresh queue", async () => {
    const { db, rows } = makeDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const result = await seedContentQueue();
    expect(result.inserted).toBe(SEED_TOPICS.length);
    expect(rows.length).toBe(SEED_TOPICS.length);
    expect(rows.every((r) => r.status === "queued" && r.source === "seed")).toBe(true);
  });

  it("is idempotent — a second call inserts nothing new", async () => {
    const { db } = makeDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await seedContentQueue();
    const second = await seedContentQueue();
    expect(second.inserted).toBe(0);
  });
});

describe("proposeTopic", () => {
  it("inserts with status 'proposed' and logs topic_proposed", async () => {
    const { db, rows } = makeDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await proposeTopic({ title: "AI-suggested topic" });
    expect(rows[0].status).toBe("proposed");
    expect(rows[0].source).toBe("proposed");
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "topic_proposed" }));
  });
});

describe("nextTopicToProcess", () => {
  it("never returns a 'proposed' topic — the model cannot self-select", async () => {
    const { db } = makeDb([{ id: 1, title: "proposed one", status: "proposed", createdAt: 1 }]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    expect(await nextTopicToProcess()).toBeNull();
  });

  it("returns a 'queued' topic", async () => {
    const { db } = makeDb([{ id: 1, title: "queued one", status: "queued", createdAt: 1 }]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const next = await nextTopicToProcess();
    expect(next?.title).toBe("queued one");
  });

  it("returns a 'refresh_due' topic", async () => {
    const { db } = makeDb([{ id: 1, title: "refresh one", status: "refresh_due", createdAt: 1 }]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const next = await nextTopicToProcess();
    expect(next?.title).toBe("refresh one");
  });

  it("skips a proposed topic and returns the queued one when both exist", async () => {
    const { db } = makeDb([
      { id: 1, title: "proposed one", status: "proposed", createdAt: 1 },
      { id: 2, title: "queued one", status: "queued", createdAt: 2 },
    ]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const next = await nextTopicToProcess();
    expect(next?.title).toBe("queued one");
  });
});

describe("updateQueueStatus", () => {
  it("updates the row's status", async () => {
    const { db, rows } = makeDb([{ id: 1, title: "x", status: "queued", createdAt: 1 }]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    await updateQueueStatus(1, "drafted");
    expect(rows[0].status).toBe("drafted");
  });
});

describe("listContentQueue", () => {
  it("returns all rows", async () => {
    const { db } = makeDb([{ id: 1, title: "x", status: "queued", createdAt: 1 }]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    const rows = await listContentQueue();
    expect(rows.length).toBe(1);
  });
});

describe("SEED_TOPICS — docs/positioning-warranty-spec.md §5", () => {
  const WARRANTY_TITLES = [
    "What a 10-Year HVAC Warranty Should Actually Cover",
    "Extended Coverage for an Older HVAC System: When It's Worth It",
    "How to Compare HVAC Installation Quotes in NJ",
    "Heat Pump vs. Furnace Replacement: Total Cost of Ownership Over 10 Years",
    "Why Compressor Failures Happen in Years 5-8 (and What Protects You)",
  ];

  const DIFFERENTIATION_TITLES = [
    "What a Heat Pump Installation Costs in Essex County (Real Ranges, and What Changes Them)",
    "Fixed Per-Unit HVAC Pricing for Apartment Portfolios: How It Works",
    "What a 24-Hour HVAC Response SLA Should Actually Include",
  ];

  it("includes all 5 new installation/warranty topics", () => {
    const titles = SEED_TOPICS.map((t) => t.title);
    for (const title of WARRANTY_TITLES) expect(titles).toContain(title);
  });

  it("includes all 3 new §9 differentiation topics (price ranges + portfolio SLA)", () => {
    const titles = SEED_TOPICS.map((t) => t.title);
    for (const title of DIFFERENTIATION_TITLES) expect(titles).toContain(title);
  });

  it("keeps every pre-existing B2B topic, including the PTAC package", () => {
    expect(SEED_TOPICS.some((t) => t.title === "PTAC Replacement for Condo Associations")).toBe(true);
    expect(SEED_TOPICS.some((t) => t.title === "Multifamily HVAC Replacement Planning in Occupied Buildings")).toBe(true);
  });

  it("no topic's title or audience trips the residential/rebate refusal gate", async () => {
    const { isResidentialOrRebateTopic } = await import("../../../shared/contentLinter");
    for (const topic of SEED_TOPICS) {
      expect(isResidentialOrRebateTopic(topic), topic.title).toBe(false);
    }
  });
});
