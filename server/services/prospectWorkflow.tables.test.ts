import { describe, expect, it, vi } from "vitest";
vi.mock("../integrations/google/calendar", () => ({ googleCalendarProvider: { getValidAccessToken: vi.fn() } }));
import { ensureProspectTables } from "./prospectWorkflow";

describe("prospect tables are created at runtime when the manual migration is missing", () => {
  it("creates both tables and the settings row once, idempotently and additively", async () => {
    const statements: string[] = [];
    const db = { execute: vi.fn(async (q: any) => { statements.push(JSON.stringify(q)); return [{}]; }) } as any;
    await ensureProspectTables(db);
    await ensureProspectTables(db); // memoized
    expect(db.execute).toHaveBeenCalledTimes(3);
    const all = statements.join("\n");
    expect(all).toContain("CREATE TABLE IF NOT EXISTS prospectWorkflowSettings");
    expect(all).toContain("INSERT IGNORE INTO prospectWorkflowSettings");
    expect(all).toContain("CREATE TABLE IF NOT EXISTS prospectWorkflowQueue");
    expect(all).not.toMatch(/DROP|TRUNCATE|DELETE|ALTER/);
  });
});
