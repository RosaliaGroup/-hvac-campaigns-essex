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
