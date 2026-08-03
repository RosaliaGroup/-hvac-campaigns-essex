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
 * legacy QuickBooks (`qbo_residential`) opportunities or their `stage` enum. This
 * test fails if a commercial page request could query/mutate a legacy record, if
 * a commercial component reaches a non-commercial API, or if a commercial stage
 * move addresses the enum instead of a stageId.
 *
 * REWRITE NOTE (P2 rescue): the original coupled to now-DISCARDED filenames
 * (CommercialBoard.tsx, the parallel commercial board/drawer/list shells) and a
 * ">8 files" count from that 12-file layout. Those filenames were INCIDENTAL. The
 * INVARIANTS are unchanged and all preserved here:
 *   1. every commercial list request pins recordType:"commercial", never a `stage`;
 *   2. commercial components call only opportunities.commercial.* or the read-only
 *      allow-list (salespeople, convertToJob) — never a legacy opportunities.* proc;
 *   3. commercial components never write the legacy `stage` enum;
 *   4. commercial stage moves address the target by stageId (toStageId), never the
 *      enum — asserted at the server contract (the board shell that used to prove
 *      this is discarded; the guarantee now lives in the transitionStage input);
 *   5. the server assertCommercial guard rejects non-commercial records on every
 *      single-row read/mutate.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const commercialDir = fileURLToPath(new URL("../components/opportunity/commercial/", import.meta.url));
const componentFiles = readdirSync(commercialDir).filter(f => f.endsWith(".tsx"));
const componentSources = componentFiles.map(f => [f, readFileSync(commercialDir + f, "utf8")] as const);

// Server `opportunities.*` procedures the commercial UI may call that are NOT under
// `.commercial.`: read-only shared helpers + the single shared (server-gated) converter.
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
        // The legacy `stage` enum is never a list key — commercial uses stageId.
        expect(input).not.toHaveProperty("stage");
        expect(input).not.toHaveProperty("recordTypes");
      });
    }
  }

  it("view presets never override recordType", () => {
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
  it("scans the harvested commercial components", () => {
    // Post-rescue the commercial dir holds only the harvested detail sections +
    // shared + the drawer wrapper (the discarded board/drawer/list shells are gone).
    expect(componentFiles.length).toBeGreaterThanOrEqual(5);
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

    it(`${name} never writes the legacy 'stage' enum`, () => {
      expect(src).not.toMatch(/\bstage:\s*["'`]/);
      expect(src).not.toMatch(/\.updateStage\b/);
      expect(src).not.toMatch(/\.setStage\b/);
    });
  }
});

describe("commercial stage moves address a stageId, never the enum (server contract)", () => {
  // The discarded CommercialBoard proved this in the UI; post-rescue the guarantee
  // is enforced by the server: transitionStage takes a numeric toStageId and the
  // commercial router never writes opportunities.stage (also asserted in
  // commercialSafeguards.test.ts). We pin it here so an enum-based move can't slip in.
  const router = read("../../../server/routers/commercialOpportunities.ts");

  it("transitionStage addresses the target by numeric toStageId", () => {
    expect(router).toMatch(/transitionStage:/);
    expect(router).toMatch(/toStageId:\s*z\.number\(\)/);
  });

  it("never writes the legacy stage enum column", () => {
    expect(router).not.toMatch(/\.set\(\s*\{[^}]*\bstage:\s*["'`]/s);
  });
});

describe("server enforces commercial-only reads/writes (defense in depth)", () => {
  const router = read("../../../server/routers/commercialOpportunities.ts");

  it("defines an assertCommercial guard that rejects non-commercial records", () => {
    expect(router).toMatch(/function assertCommercial/);
    expect(router).toMatch(/recordType !== "commercial"/);
  });

  it("guards detail load, update, and stage transition", () => {
    const guardCount = (router.match(/assertCommercial\(/g) ?? []).length;
    // one definition site + at least the three call sites (get / update / transitionStage)
    expect(guardCount).toBeGreaterThanOrEqual(4);
  });
});
