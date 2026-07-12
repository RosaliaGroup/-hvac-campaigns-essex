import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { ACTIVE_JOB_STATUSES, OPEN_OPPORTUNITY_STAGES } from "./customerRelations";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("Jobs module — QuickBooks safeguards", () => {
  const jobsSrc = read("./jobs.ts");

  it("the jobs router performs NO QuickBooks writes or sync", () => {
    // No imports from the accounting/QBO sync layer.
    expect(jobsSrc).not.toMatch(/from\s+["'].*integrations\/accounting/);
    // No calls to any QBO push/sync/write helpers.
    expect(jobsSrc).not.toMatch(/syncSalesDocuments|pushToQuickbooks|pushToQuickBooks|qboRequest|createEstimate|createInvoice|writeToQuickbooks/);
  });

  it("does not mutate stored QuickBooks CustomerRefs or sales documents from the jobs router", () => {
    // Never UPDATE an existing customer row (where the stored QBO CustomerRef lives).
    // (createFromAppointment may INSERT a new local customer — that has no QBO ref.)
    expect(jobsSrc).not.toMatch(/\.update\(\s*customers\b/);
    // Never write the QBO sales-document table.
    expect(jobsSrc).not.toMatch(/\.update\(\s*quickbooksSalesDocuments/);
    expect(jobsSrc).not.toMatch(/\.insert\(\s*quickbooksSalesDocuments/);
  });

  it("treats the job's QuickBooks fields as read-only references (no auto-sync on write)", () => {
    // quickbooksSyncStatus/quickbooksSyncedAt must not be flipped to a synced state here.
    expect(jobsSrc).not.toMatch(/quickbooksSyncStatus\s*:\s*["']synced["']/);
  });

  it("never ships the raw QBO payload — sales docs are selected with explicit columns", () => {
    // A bare `.select().from(quickbooksSalesDocuments)` would include the `raw`
    // JSON payload; getById must project explicit display-only columns instead.
    expect(jobsSrc).not.toMatch(/select\(\)\s*\.from\(\s*quickbooksSalesDocuments/);
  });
});

describe("Jobs module — customer 360 counts protection", () => {
  it("ACTIVE_JOB_STATUSES stays the agreed active set (changing it silently shifts customer-360 counts)", () => {
    expect([...ACTIVE_JOB_STATUSES].sort()).toEqual(
      ["approved", "estimate_sent", "in_progress", "new", "scheduled", "waiting_parts"].sort(),
    );
  });

  it("OPEN_OPPORTUNITY_STAGES is unchanged", () => {
    expect([...OPEN_OPPORTUNITY_STAGES].sort()).toEqual(["new", "pending", "proposal_sent"].sort());
  });
});
