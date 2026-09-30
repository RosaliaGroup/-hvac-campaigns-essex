import { describe, it, expect } from "vitest";
import { mergedBeforeHold, mergeModeFromAudit, EARLY_MERGE_TOLERANCE_MS } from "./drainGuards";

const HOLD = new Date("2026-09-30T14:24:06Z");
const at = (iso: string) => new Date(iso);

describe("mergedBeforeHold", () => {
  it("flags a merge ~1h before the hold (the 2026-09-30 #150/#151 pattern)", () => {
    expect(mergedBeforeHold(HOLD, at("2026-09-30T13:28:01Z"))).toBe(true);
  });
  it("does not flag a merge at or after the hold", () => {
    expect(mergedBeforeHold(HOLD, HOLD)).toBe(false);
    expect(mergedBeforeHold(HOLD, at("2026-09-30T14:30:00Z"))).toBe(false);
  });
  it("tolerates operator/DB clock skew up to the tolerance, not beyond", () => {
    expect(mergedBeforeHold(HOLD, new Date(HOLD.getTime() - EARLY_MERGE_TOLERANCE_MS + 1000))).toBe(false); // ~102s skew seen in prod
    expect(mergedBeforeHold(HOLD, new Date(HOLD.getTime() - EARLY_MERGE_TOLERANCE_MS - 1000))).toBe(true);
  });
  it("a batch with no hold is never 'early'", () => {
    expect(mergedBeforeHold(null, at("2026-09-30T13:28:01Z"))).toBe(false);
    expect(mergedBeforeHold(undefined, at("2026-09-30T13:28:01Z"))).toBe(false);
  });
});

describe("mergeModeFromAudit", () => {
  it("auto = poller's audit row", () => {
    expect(mergeModeFromAudit([{ action: "pr_opened", after: {} }, { action: "merged_detected", after: { status: "merged", mergeMode: "auto" } }])).toBe("auto");
  });
  it("manual_override = publishNow", () => {
    expect(mergeModeFromAudit([{ action: "merged_detected", after: { mergeMode: "manual_override" } }])).toBe("manual_override");
  });
  it("external = merged on GitHub, only noticed by refreshBatchStatus (no mergeMode) — what #150/#151 look like", () => {
    expect(mergeModeFromAudit([{ action: "merged_detected", after: { status: "merged" } }])).toBe("external");
    expect(mergeModeFromAudit([{ action: "merged_detected", after: null }])).toBe("external");
  });
  it("no merged_detected row yet → external (unverified is treated as not-the-poller)", () => {
    expect(mergeModeFromAudit([{ action: "pr_opened", after: {} }])).toBe("external");
  });
  it("uses the latest merged_detected row", () => {
    expect(mergeModeFromAudit([{ action: "merged_detected", after: { status: "merged" } }, { action: "merged_detected", after: { mergeMode: "auto" } }])).toBe("auto");
  });
});
