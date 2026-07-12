import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  convertControlMode,
  convertResultEffect,
  viewJobLabel,
  propertyChoiceAddress,
  type ConvertMutationResult,
  type PropertyChoice,
} from "./convertToJobState";

const prop = (over: Partial<PropertyChoice> = {}): PropertyChoice => ({
  id: 1, label: null, addressLine1: "1 Main St", city: "Newark", state: "NJ", zip: "07103", isPrimary: false, ...over,
});

describe("convertControlMode", () => {
  it("shows Convert to Job when there is no linked job", () => {
    expect(convertControlMode(null)).toBe("convert");
  });
  it("shows View Job once a job is linked", () => {
    expect(convertControlMode({ id: 5, jobNumber: "ME-2026-0005", status: "new" })).toBe("view_job");
  });
});

describe("convertResultEffect", () => {
  it("opens the property modal when selection is required (no write happened)", () => {
    const res: ConvertMutationResult = { ok: false, reason: "property_selection_required", candidates: [prop({ id: 1 }), prop({ id: 2 })] };
    expect(convertResultEffect(res)).toEqual({ kind: "open_property_modal", candidates: res.ok === false ? res.candidates : [] });
  });
  it("resolves as converted for a newly created job", () => {
    const res: ConvertMutationResult = { ok: true, jobId: 9, jobNumber: "ME-2026-0009", status: "new", alreadyConverted: false, propertyId: 5 };
    expect(convertResultEffect(res)).toEqual({ kind: "converted", jobId: 9, jobNumber: "ME-2026-0009", alreadyConverted: false });
  });
  it("resolves as converted (idempotent) when the job already existed", () => {
    const res: ConvertMutationResult = { ok: true, jobId: 9, jobNumber: "ME-2026-0009", status: "scheduled", alreadyConverted: true, propertyId: null };
    expect(convertResultEffect(res)).toEqual({ kind: "converted", jobId: 9, jobNumber: "ME-2026-0009", alreadyConverted: true });
  });
});

describe("viewJobLabel", () => {
  it("uses the job number and humanizes the status", () => {
    expect(viewJobLabel({ id: 5, jobNumber: "ME-2026-0005", status: "in_progress" })).toEqual({ label: "ME-2026-0005", status: "in progress" });
  });
  it("falls back to #id when the job number is empty", () => {
    expect(viewJobLabel({ id: 5, jobNumber: "", status: "new" })).toEqual({ label: "#5", status: "new" });
  });
});

describe("propertyChoiceAddress", () => {
  it("joins present address parts, skipping blanks", () => {
    expect(propertyChoiceAddress(prop({ addressLine1: "360 Littleton Ave", city: "Newark", state: "NJ", zip: "07103" }))).toBe("360 Littleton Ave, Newark, NJ, 07103");
    expect(propertyChoiceAddress(prop({ addressLine1: "351 Central Ave", city: null, state: null, zip: null }))).toBe("351 Central Ave");
  });
});

// Structural consistency: both opportunity surfaces must render the ONE shared
// control and must NOT contain their own conversion mutation, so they can never
// diverge in behavior.
describe("both opportunity surfaces use the shared ConvertToJobControl", () => {
  const drawer = readFileSync("client/src/components/opportunity/OpportunityDetailDrawer.tsx", "utf8");
  const page = readFileSync("client/src/pages/OpportunityDetail.tsx", "utf8");
  const control = readFileSync("client/src/components/opportunity/ConvertToJobControl.tsx", "utf8");

  it("the drawer renders <ConvertToJobControl> and owns no conversion mutation", () => {
    expect(drawer).toContain("<ConvertToJobControl");
    expect(drawer).not.toContain("convertToJob.useMutation");
  });
  it("the full page renders <ConvertToJobControl> and owns no conversion mutation", () => {
    expect(page).toContain("<ConvertToJobControl");
    expect(page).not.toContain("convertToJob.useMutation");
  });
  it("only the shared control holds the convertToJob mutation", () => {
    expect(control).toContain("convertToJob.useMutation");
  });
});
