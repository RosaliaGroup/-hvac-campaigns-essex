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
    // The jobs router must never update customers' QBO ref or the sales-doc tables.
    expect(jobsSrc).not.toMatch(/quickbooksCustomerId\s*:/);
    expect(jobsSrc).not.toMatch(/\.update\(\s*quickbooksSalesDocuments/);
    expect(jobsSrc).not.toMatch(/\.insert\(\s*quickbooksSalesDocuments/);
  });

  it("treats the job's QuickBooks fields as read-only references (no auto-sync on write)", () => {
    // quickbooksSyncStatus/quickbooksSyncedAt must not be flipped to a synced state here.
    expect(jobsSrc).not.toMatch(/quickbooksSyncStatus\s*:\s*["']synced["']/);
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
