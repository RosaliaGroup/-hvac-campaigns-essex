import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the commercial QA-template seed race.
 *
 * The QA checklist template was seeded with a check-then-insert on the
 * (non-unique) `name`, so two concurrent first-time seeds each inserted a
 * template — reproduced on staging (12 concurrent requests -> 2 duplicate rows).
 * The fix keys the system template off a UNIQUE `systemKey` and converges with
 * ON DUPLICATE KEY UPDATE; items are upserted against a UNIQUE (templateId,
 * sortOrder) slot. These source/schema/migration safeguards prevent regression.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const router = read("./commercialOpportunities.ts");
const schema = read("../../drizzle/schema.ts");
const migration = read("../../drizzle/0046_commercial_qa_seed_race_guard.sql");

describe("QA template seed is concurrency-safe (no duplicate templates)", () => {
  it("keys the system template off a stable systemKey", () => {
    expect(router).toMatch(/const QA_SYSTEM_KEY = "commercial_qa"/);
    expect(router).toMatch(/systemKey: QA_SYSTEM_KEY/);
  });

  it("converges concurrent inserts with ON DUPLICATE KEY UPDATE (not a bare insert)", () => {
    // The template row and the items are both upserted, so a racing seed is a no-op.
    expect((router.match(/onDuplicateKeyUpdate/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("looks the template up by the unique systemKey, never by non-unique name", () => {
    expect(router).toMatch(/eq\(opportunityChecklistTemplates\.systemKey, QA_SYSTEM_KEY\)/);
    // The old racy lookup — check-then-insert on name — must be gone.
    expect(router).not.toMatch(/\.where\(eq\(opportunityChecklistTemplates\.name, QA_TEMPLATE_NAME\)\)/);
  });
});

describe("schema enforces the uniqueness the seed relies on", () => {
  it("template.systemKey is unique (NULL-able so user templates stay unconstrained)", () => {
    expect(schema).toMatch(/systemKey: varchar\("systemKey", \{ length: 48 \}\)/);
    expect(schema).toMatch(/unique\("opportunityChecklistTemplates_systemKey_unique"\)\.on\(table\.systemKey\)/);
  });
  it("template items are unique per (templateId, sortOrder)", () => {
    expect(schema).toMatch(
      /unique\("opportunityChecklistTemplateItems_template_sort_unique"\)\.on\(\s*table\.templateId,\s*table\.sortOrder,?\s*\)/,
    );
  });
});

describe("migration 0046 adds the guard additively", () => {
  it("adds the systemKey column and both unique constraints", () => {
    expect(migration).toMatch(/ADD `systemKey` varchar\(48\)/);
    expect(migration).toMatch(/ADD CONSTRAINT `opportunityChecklistTemplates_systemKey_unique` UNIQUE\(`systemKey`\)/);
    expect(migration).toMatch(
      /ADD CONSTRAINT `opportunityChecklistTemplateItems_template_sort_unique` UNIQUE\(`templateId`,`sortOrder`\)/,
    );
  });
  it("backfills the existing QA template's systemKey", () => {
    expect(migration).toMatch(/UPDATE `opportunityChecklistTemplates` SET `systemKey` = 'commercial_qa'/);
  });
});
