import { describe, expect, it, vi } from "vitest";
vi.mock("../integrations/google/calendar", () => ({ googleCalendarProvider: { getValidAccessToken: vi.fn() } }));
import { shouldLogSkip } from "./prospectWorkflow";

describe("skipped cycles are never silent, but are not spammed", () => {
  it("logs a disabled or missing-owner skip once per hour", () => {
    expect(shouldLogSkip("2026-10-28T14", "disabled_or_owner_missing")).toBe(true);
    expect(shouldLogSkip("2026-10-28T14", "disabled_or_owner_missing")).toBe(false);
    expect(shouldLogSkip("2026-10-28T15", "disabled_or_owner_missing")).toBe(true);
  });
  it("logs a different reason in the same hour", () => {
    expect(shouldLogSkip("2026-10-28T16", "crm_unavailable")).toBe(true);
    expect(shouldLogSkip("2026-10-28T16", "hour_already_run")).toBe(true);
  });
  it("never logs expected outside-schedule skips", () => {
    expect(shouldLogSkip(null, "outside_weekday_9_17_ET")).toBe(false);
  });
});

import { workflowEnabledOverride } from "./prospectWorkflow";
describe("PROSPECT_WORKFLOW_ENABLED master switch", () => {
  it("true forces on, false forces off, unset defers to the CRM toggle", () => {
    expect(workflowEnabledOverride({ PROSPECT_WORKFLOW_ENABLED: "true" } as any)).toBe(true);
    expect(workflowEnabledOverride({ PROSPECT_WORKFLOW_ENABLED: " FALSE " } as any)).toBe(false);
    expect(workflowEnabledOverride({} as any)).toBeNull();
    expect(workflowEnabledOverride({ PROSPECT_WORKFLOW_ENABLED: "yes" } as any)).toBeNull();
  });
});

import { rerunHourOverride } from "./prospectWorkflow";
describe("one-time hour rerun", () => {
  it("accepts only a well-formed Eastern hour key", () => {
    expect(rerunHourOverride({ PROSPECT_RERUN_HOUR: "2026-10-30T15" } as any)).toBe("2026-10-30T15");
    expect(rerunHourOverride({ PROSPECT_RERUN_HOUR: "3pm" } as any)).toBeNull();
    expect(rerunHourOverride({} as any)).toBeNull();
  });
});
