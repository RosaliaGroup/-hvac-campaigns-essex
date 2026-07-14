import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildCommercialListInput,
  COMMERCIAL_VIEWS,
  type CommercialView,
  type CommercialFilters,
} from "./commercialOpportunities";

/**
 * Isolation safeguard: the Commercial Opportunities client can never touch the
 * legacy QuickBooks (`qbo_residential`) opportunities or their 5-stage `stage`
 * enum. This test fails if any commercial page request could query/mutate a
 * legacy record, or if a commercial component reaches a non-commercial API.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const commercialDir = fileURLToPath(new URL("../components/opportunity/commercial/", import.meta.url));
const componentFiles = readdirSync(commercialDir).filter(f => f.endsWith(".tsx"));
const componentSources = componentFiles.map(f => [f, readFileSync(commercialDir + f, "utf8")] as const);

// Every server `opportunities.*` procedure the commercial UI is allowed to call
// that is NOT under `.commercial.`: read-only shared helpers + the single shared
// (server-gated) converter. Anything else must live under `opportunities.commercial.*`.
const NON_COMMERCIAL_ALLOWLIST = new Set(["salespeople", "convertToJob"]);

const ALL_VIEWS: CommercialView[] = COMMERCIAL_VIEWS.map(v => v.key);
const FILTER_COMBOS: CommercialFilters[] = [
  {},
  { search: "acme", stageId: [3], priority: ["high"] },
  { wonLostOpen: ["open"], city: "Boston", valueMin: 1000 },
  { assignedToId: [7], estimatorId: [9], overdue: true, followUpDue: true },
];

describe("recordType is always pinned to commercial", () => {
  it("covers every Sales sub-view", () => {
    expect(ALL_VIEWS.sort()).toEqual(["all", "board", "followups", "lost", "mine", "won"]);
  });

  for (const view of ALL_VIEWS) {
    for (const [i, filters] of FILTER_COMBOS.entries()) {
      it(`${view} view (filters #${i}) sends recordType:"commercial"`, () => {
        const input = buildCommercialListInput(view, filters, { limit: 50, offset: 0 });
        expect(input.recordType).toBe("commercial");
        // The legacy 5-stage `stage` enum is never a list key — commercial uses stageId.
        expect(input).not.toHaveProperty("stage");
        expect(input).not.toHaveProperty("recordTypes");
      });
    }
  }

  it("view presets never override recordType", () => {
    // won/lost/mine/followups add their own predicate but must not repoint the type.
    for (const view of ALL_VIEWS) {
      const input = buildCommercialListInput(view, { wonLostOpen: ["won", "lost", "open"] });
      expect(input.recordType).toBe("commercial");
    }
  });

  it("won and lost views scope by outcome without leaving commercial", () => {
    expect(buildCommercialListInput("won").wonLostOpen).toContain("won");
    expect(buildCommercialListInput("lost").wonLostOpen).toContain("lost");
    expect(buildCommercialListInput("mine").mine).toBe(true);
    expect(buildCommercialListInput("followups").followUpDue).toBe(true);
  });
});

describe("commercial components only reach commercial (or allow-listed) APIs", () => {
  it("scans a non-trivial number of component files", () => {
    expect(componentFiles.length).toBeGreaterThan(8);
  });

  for (const [name, src] of componentSources) {
    it(`${name} makes no legacy opportunity API call`, () => {
      const calls = [...src.matchAll(/trpc\.opportunities\.([A-Za-z][A-Za-z0-9]*)/g)].map(m => m[1]);
      for (const first of calls) {
        if (first === "commercial") continue; // trpc.opportunities.commercial.*
        expect(
          NON_COMMERCIAL_ALLOWLIST.has(first),
          `${name} calls trpc.opportunities.${first} — not commercial-scoped nor allow-listed`,
        ).toBe(true);
      }
    });

    it(`${name} never writes the legacy 5-stage 'stage' enum`, () => {
      // A mutation payload like `{ stage: "won" }` would target the legacy column.
      expect(src).not.toMatch(/\bstage:\s*["'`]/);
      // Nor any legacy stage-write procedure name.
      expect(src).not.toMatch(/\.updateStage\b/);
      expect(src).not.toMatch(/\.setStage\b/);
    });
  }
});

describe("board stage moves use the commercial transition API only", () => {
  const board = read("../components/opportunity/commercial/CommercialBoard.tsx");

  it("mutates via opportunities.commercial.transitionStage", () => {
    expect(board).toMatch(/trpc\.opportunities\.commercial\.transitionStage\.useMutation/);
  });

  it("addresses the target stage by stageId (toStageId), never by enum", () => {
    expect(board).toMatch(/toStageId:/);
    expect(board).not.toMatch(/\btoStage:\s*["'`]/);
    expect(board).not.toMatch(/\bstage:\s*["'`]/);
  });
});

describe("server enforces commercial-only reads/writes (defense in depth)", () => {
  const router = read("../../../server/routers/commercialOpportunities.ts");

  it("defines an assertCommercial guard that rejects non-commercial records", () => {
    expect(router).toMatch(/function assertCommercial/);
    expect(router).toMatch(/recordType !== "commercial"/);
  });

  it("guards detail load, update, and stage transition", () => {
    // Every place that loads an opportunity row for the drawer / edit / move must
    // run the guard so a legacy id cannot be loaded, edited, or transitioned.
    const guardCount = (router.match(/assertCommercial\(/g) ?? []).length;
    // one definition site + at least the three call sites (get / update / transitionStage)
    expect(guardCount).toBeGreaterThanOrEqual(4);
  });
});
