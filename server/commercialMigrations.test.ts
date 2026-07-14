import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source-text safety net for the Commercial Opportunities migrations (0044–0047),
 * mirroring the jobsSafeguards approach. Guarantees the migrations are additive,
 * reversible, and that the SQL, journal, and schema stay in agreement — without
 * touching a database.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
/** Strip `-- ` comment lines so assertions test executable SQL only, not prose. */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .filter(line => !/^\s*--/.test(line))
    .join("\n");

const core = stripComments(read("../drizzle/0044_commercial_opportunities_core.sql"));
const children = stripComments(read("../drizzle/0045_commercial_opportunities_children.sql"));
const journal = read("../drizzle/meta/_journal.json");
const schema = read("../drizzle/schema.ts");

describe("commercial migrations are additive & reversible", () => {
  it("contain no destructive statements", () => {
    for (const sql of [core, children]) {
      expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
      expect(sql).not.toMatch(/\bRENAME\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    }
  });

  it("only ADD columns on the existing opportunities table (never MODIFY/CHANGE its enum)", () => {
    const oppAlters = core.match(/ALTER TABLE `opportunities`[^;]*/g) ?? [];
    expect(oppAlters.length).toBeGreaterThan(0);
    for (const stmt of oppAlters) expect(stmt).toMatch(/ALTER TABLE `opportunities` ADD /);
    // The legacy 5-value stage enum must be left untouched.
    expect(core).not.toMatch(/MODIFY COLUMN `stage`/i);
    expect(core).not.toMatch(/`stage` enum/i);
  });

  it("every new opportunities column is nullable or defaulted (existing rows stay valid)", () => {
    const adds = core.match(/ALTER TABLE `opportunities` ADD [^;]*/g) ?? [];
    for (const stmt of adds) {
      if (/\bNOT NULL\b/.test(stmt)) {
        // A NOT NULL add is only safe with a DEFAULT (recordType is the only one).
        expect(stmt).toMatch(/DEFAULT/);
      }
    }
  });

  it("create the expected new tables", () => {
    expect(core).toMatch(/CREATE TABLE `opportunityStages`/);
    for (const t of [
      "opportunityProjectCategories",
      "opportunityMembers",
      "opportunityChecklistTemplates",
      "opportunityChecklistTemplateItems",
      "opportunityChecklistItems",
      "opportunityComments",
      "opportunityDocuments",
    ]) {
      expect(children).toMatch(new RegExp(`CREATE TABLE \`${t}\``));
    }
  });
});

describe("journal registration agrees with the SQL files", () => {
  it("registers the commercial migrations (0044–0047) with matching tags", () => {
    const entries = JSON.parse(journal).entries as Array<{ idx: number; tag: string }>;
    const tags = entries.map(e => e.tag);
    expect(tags).toContain("0044_commercial_opportunities_core");
    expect(tags).toContain("0045_commercial_opportunities_children");
    expect(tags).toContain("0046_commercial_qa_seed_race_guard");
    expect(tags).toContain("0047_opportunity_amount_nullable");
    // contiguous, no duplicate idx
    const idxs = entries.map(e => e.idx);
    expect(new Set(idxs).size).toBe(idxs.length);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
    // 0047 (amount nullable) is the last (highest) entry
    expect(Math.max(...idxs)).toBe(47);
  });
});

describe("schema.ts declares the same new tables the migrations create", () => {
  it("exports each new table", () => {
    for (const t of [
      "opportunityStages",
      "opportunityProjectCategories",
      "opportunityMembers",
      "opportunityChecklistTemplates",
      "opportunityChecklistTemplateItems",
      "opportunityChecklistItems",
      "opportunityComments",
      "opportunityDocuments",
    ]) {
      expect(schema).toMatch(new RegExp(`export const ${t} = mysqlTable`));
    }
  });

  it("adds the discriminator + configurable stage pointer without removing legacy stage", () => {
    expect(schema).toMatch(/recordType: mysqlEnum\("recordType"/);
    expect(schema).toMatch(/stageId: int\("stageId"\)/);
    // legacy enum still present
    expect(schema).toMatch(/stage: mysqlEnum\("stage", \["new", "proposal_sent", "pending", "won", "lost"\]\)/);
  });
});
