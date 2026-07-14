import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeOpportunityUpdate } from "./commercialOpportunitiesLogic";

/**
 * Phase-1 usability fixes: (1) create/select customers from the opportunity flow
 * + Customer 360 links; (2) estimated value/cost optional, stored as NULL (never
 * a misleading $0). Pure-logic tests for the update path + source-text safeguards
 * across the create API, schema, migration, and the client surfaces.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const router = read("./commercialOpportunities.ts");
const schema = read("../../drizzle/schema.ts");
const migration = read("../../drizzle/0047_opportunity_amount_nullable.sql");
const createDialog = read("../../client/src/components/opportunity/commercial/CreateCommercialDialog.tsx");
const drawer = read("../../client/src/components/opportunity/commercial/CommercialDetailDrawer.tsx");
const board = read("../../client/src/components/opportunity/commercial/CommercialBoard.tsx");

describe("unknown estimated value is stored as NULL, never 0", () => {
  it("create handler stores null for a blank estimated value", () => {
    expect(router).toMatch(/amount: input\.estimatedValue != null \? input\.estimatedValue\.toFixed\(2\) : null/);
    expect(router).not.toMatch(/estimatedValue\.toFixed\(2\) : "0"/);
  });
  it("amount column is nullable (default '0' retained so legacy QBO is unchanged)", () => {
    expect(schema).toMatch(/amount: decimal\("amount", \{ precision: 12, scale: 2 \}\)\.default\("0"\),/);
    expect(schema).not.toMatch(/amount: decimal\("amount"[^\n]*\.notNull\(\)/);
  });
  it("migration 0047 widens amount to NULL", () => {
    expect(migration).toMatch(/MODIFY COLUMN `amount` decimal\(12,2\) DEFAULT '0\.00'/i);
  });
});

describe("estimated value can be added or cleared later (partial update)", () => {
  it("adds a value to an opportunity that had none", () => {
    const { set } = computeOpportunityUpdate({ amount: null }, { amount: 125000 });
    expect(set.amount).toBe("125000.00");
  });
  it("clears a value back to null", () => {
    const { set } = computeOpportunityUpdate({ amount: "125000.00" }, { amount: null });
    expect(set.amount).toBeNull();
  });
  it("no-ops when unknown stays unknown (no write, no event)", () => {
    const { set, events } = computeOpportunityUpdate({ amount: null }, { amount: null });
    expect("amount" in set).toBe(false);
    expect(events.length).toBe(0);
  });
});

describe("board never implies $0 for unknown value", () => {
  it("shows 'Not estimated' and excludes unknowns from column totals", () => {
    expect(board).toMatch(/Not estimated/);
    expect(board).toMatch(/known\.length \? fmtMoney\(total\) : "—"/);
    expect(board).not.toMatch(/Number\(r\.amount \?\? 0\)/); // old total that treated null as 0
  });
});

describe("create dialog: customer selection + creation + optional value", () => {
  it("keeps searchable existing-customer selection", () => {
    expect(createDialog).toMatch(/customers\.list\.useQuery/);
  });
  it("exposes an explicit Create New Customer action", () => {
    expect(createDialog).toMatch(/Create New Customer/);
  });
  it("reuses the shared customer API (no parallel implementation)", () => {
    expect(createDialog).toMatch(/customers\.create\.useMutation/);
    expect(createDialog).toMatch(/customers\.addProperty\.useMutation/);
  });
  it("auto-selects the new customer without resetting the opportunity form", () => {
    const h = createDialog.slice(
      createDialog.indexOf("async function handleCreateCustomer"),
      createDialog.indexOf("const canSubmit"),
    );
    expect(h).toMatch(/selectCustomer\(id/); // new customer selected
    expect(h).not.toMatch(/\breset\(\)/); // opp form NOT reset
  });
  it("guards against silently creating a duplicate", () => {
    expect(createDialog).toMatch(/Customer already exists/);
  });
  it("estimated value is optional: blank -> null, no forced '0' placeholder", () => {
    expect(createDialog).toMatch(/estimatedValue\.trim\(\) === "" \? null : Number\(estimatedValue\)/);
    expect(createDialog).not.toMatch(/placeholder="0"/);
  });
});

describe("detail drawer: linked records route to existing detail pages", () => {
  it("customer name links to Customer 360", () => {
    expect(drawer).toMatch(/href=\{`\/customers\/\$\{detail\.customer\.id\}`\}/);
  });
  it("primary contact links to Customer 360 and jobs link to /jobs/:id", () => {
    expect(drawer).toMatch(/detail\.primaryContact\.id/);
    expect(drawer).toMatch(/href=\{`\/jobs\/\$\{/);
  });
  it("header shows 'Not yet estimated' instead of $0 for an unknown value", () => {
    expect(drawer).toMatch(/fmtEstimatedValue\(opp\.amount, "Not yet estimated"\)/);
  });
});
