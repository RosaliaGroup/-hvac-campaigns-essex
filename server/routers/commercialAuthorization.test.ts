import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isAssignmentAuthorized, type OpportunityPeople } from "./commercialOpportunitiesLogic";

/**
 * Convert-to-Job authorization + commercial-list isolation hardening.
 *
 * The assignment rule is a single PURE decision (isAssignmentAuthorized) reused
 * by every commercial edit AND by Convert-to-Job (preview + execution). These
 * tests prove the decision itself, and — via source-text safeguards — that both
 * conversion entry points enforce it BEFORE revealing any validation/job info,
 * and that the commercial list is server-pinned to recordType="commercial".
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const router = read("./commercialOpportunities.ts");
const oppRouter = read("./opportunities.ts");

// Identities (positive teamMembers.id values, as stored on the opportunity).
const OWNER = 10, ESTIMATOR = 20, PM = 30, CREATOR = 40, MEMBER = 50, STRANGER = 99;
const base: OpportunityPeople = {
  assignedToId: OWNER,
  estimatorId: ESTIMATOR,
  projectManagerId: PM,
  createdBy: CREATOR,
  memberIds: [MEMBER],
};

describe("isAssignmentAuthorized — the single assignment rule", () => {
  it("authorizes the owner (assignedTo)", () => expect(isAssignmentAuthorized(base, OWNER)).toBe(true));
  it("authorizes the estimator", () => expect(isAssignmentAuthorized(base, ESTIMATOR)).toBe(true));
  it("authorizes the project manager", () => expect(isAssignmentAuthorized(base, PM)).toBe(true));
  it("authorizes the creator", () => expect(isAssignmentAuthorized(base, CREATOR)).toBe(true));
  it("authorizes an explicit opportunity member", () => expect(isAssignmentAuthorized(base, MEMBER)).toBe(true));

  it("refuses an unassigned member", () => expect(isAssignmentAuthorized(base, STRANGER)).toBe(false));
  it("refuses an unidentifiable caller (no team-member id)", () => expect(isAssignmentAuthorized(base, null)).toBe(false));
  it("refuses everyone when the opportunity has no assignments", () => {
    const empty: OpportunityPeople = { assignedToId: null, estimatorId: null, projectManagerId: null, createdBy: null, memberIds: [] };
    expect(isAssignmentAuthorized(empty, OWNER)).toBe(false);
    expect(isAssignmentAuthorized(empty, null)).toBe(false);
  });
  it("matches a member among several", () => {
    const many: OpportunityPeople = { ...base, memberIds: [1, 2, MEMBER, 3] };
    expect(isAssignmentAuthorized(many, MEMBER)).toBe(true);
    expect(isAssignmentAuthorized(many, STRANGER)).toBe(false);
  });
});

describe("assertCanEdit uses the shared rule (admin bypass, viewer blocked upstream)", () => {
  it("admins bypass the assignment check", () => {
    expect(router).toMatch(/if \(isAdmin\(ctx\)\) return;/);
  });
  it("members are gated by isAssignmentAuthorized (no separate weaker path)", () => {
    expect(router).toMatch(/if \(!isAssignmentAuthorized\(people, me\)\)/);
    expect(router).toMatch(/code: "FORBIDDEN"/);
  });
});

// ── helper: slice a named procedure body out of a router source ──
function proc(src: string, name: string, until: string): string {
  const start = src.indexOf(name + ":");
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = src.indexOf(until, start + name.length);
  return src.slice(start, end > start ? end : start + 4000);
}

describe("conversion preview enforces the same authorization before revealing anything", () => {
  const body = proc(router, "convertToJobValidate", "setProjectCategories");
  it("is commercial-only", () => expect(body).toMatch(/assertCommercial\(opp\)/));
  it("requires edit authorization", () => expect(body).toMatch(/await assertCanEdit\(db, ctx, input\.id\)/));
  it("authorizes BEFORE loading/evaluating conversion data (no info leak)", () => {
    const authIdx = body.indexOf("assertCanEdit");
    const evalIdx = body.indexOf("evaluateCommercialConversion");
    const jobIdx = body.indexOf("jobs)"); // existing-job lookup in the Promise.all
    expect(authIdx).toBeGreaterThan(-1);
    expect(evalIdx).toBeGreaterThan(authIdx); // evaluation happens after the gate
    if (jobIdx > -1) expect(jobIdx).toBeGreaterThan(authIdx); // existing-job read after the gate
  });
  it("passes ctx into the query handler", () => expect(body).toMatch(/\.query\(async \(\{ input, ctx \}\)/));
});

describe("convert mutation enforces authorization before the gate and existing-job return", () => {
  const body = proc(oppRouter, "convertToJob", "assignSalesperson");
  it("authorizes commercial conversions with the shared rule", () => {
    expect(body).toMatch(/await assertCanEdit\(db, ctx, input\.id\)/);
  });
  it("authorizes BEFORE the conversion gate / existing-job handling (idempotent requests included)", () => {
    const authIdx = body.indexOf("assertCanEdit");
    const evalIdx = body.indexOf("evaluateCommercialConversion");
    expect(authIdx).toBeGreaterThan(-1);
    expect(evalIdx).toBeGreaterThan(authIdx);
  });
  it("preserves the gate + reuse + zero-QBO behavior (unchanged downstream)", () => {
    expect(body).toMatch(/evaluateCommercialConversion/); // stage/customer/property/checklist gate
    expect(body).toMatch(/convertOpportunityToJob/); // single shared converter (idempotent, reuses records)
    expect(body).not.toMatch(/\.insert\(\s*quickbooksSalesDocuments/); // no QBO writes
  });
});

describe("commercial list is server-pinned to recordType='commercial'", () => {
  it("input accepts only the literal 'commercial' (crafted recordType rejected by zod)", () => {
    expect(router).toMatch(/recordType: z\.literal\("commercial"\)\.default\("commercial"\)/);
    expect(router).not.toMatch(/recordType: z\.string\(\)\.default\("commercial"\)/);
  });
  it("query hardcodes the filter (never input-derived)", () => {
    expect(router).toMatch(/eq\(opportunities\.recordType, "commercial" as never\)/);
    expect(router).not.toMatch(/eq\(opportunities\.recordType, input\.recordType/);
  });
  it("counts/totals reuse the same pinned where clause", () => {
    // The list rows and the count query both apply `where`, which starts from the
    // hardcoded commercial condition — so totals exclude legacy QBO rows too.
    // (`where` is local to the list procedure, so asserting on the whole file is safe.)
    expect(router).toMatch(/const where = and\(\.\.\.conds\)/);
    expect((router.match(/\.where\(where\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(router).toMatch(/count\(\*\)/);
  });
});
