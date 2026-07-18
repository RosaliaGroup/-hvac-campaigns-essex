import { describe, it, expect } from "vitest";
import { planLifecycleTransition, lifecycleIdempotencyKey, type TransitionCtx } from "./jobLifecycle";
import type { LifecycleInput } from "@shared/jobLifecycle";

const scheduled: LifecycleInput = { officeStatus: "scheduled", technicianWorkStatus: "assigned", appointmentStatuses: ["confirmed"] };
const working: LifecycleInput = { officeStatus: "in_progress", technicianWorkStatus: "working" };
const webhook = (id: string): TransitionCtx => ({ source: "field", eventKey: id });

describe("planLifecycleTransition — idempotency", () => {
  it("records a change when derived state differs from current", () => {
    const p = planLifecycleTransition("scheduled", working, 42, webhook("evt-1"));
    expect(p.changed).toBe(true);
    expect(p.from).toBe("scheduled");
    expect(p.to).toBe("in_progress");
    expect(p.idempotencyKey).toBeTruthy();
  });

  it("RETRY: re-running after the state already advanced is a no-op", () => {
    // current already reflects the target → nothing to record
    const p = planLifecycleTransition("in_progress", working, 42, webhook("evt-1"));
    expect(p.changed).toBe(false);
    expect(p.idempotencyKey).toBeNull();
  });

  it("DUPLICATE WEBHOOK: identical (job, from, to, source, eventKey) → identical key", () => {
    const a = planLifecycleTransition("scheduled", working, 42, webhook("evt-DUP"));
    const b = planLifecycleTransition("scheduled", working, 42, webhook("evt-DUP"));
    expect(a.idempotencyKey).toBe(b.idempotencyKey); // UNIQUE constraint collapses to one row
  });

  it("RE-ENTRY: same states but a different eventKey → different key (allowed distinct transition)", () => {
    const a = planLifecycleTransition("in_progress", { officeStatus: "in_progress", technicianWorkStatus: "waiting_parts" }, 42, webhook("hold-1"));
    const b = planLifecycleTransition("in_progress", { officeStatus: "in_progress", technicianWorkStatus: "waiting_parts" }, 42, webhook("hold-2"));
    expect(a.to).toBe("on_hold");
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });

  it("key is stable & collision-resistant across the tuple", () => {
    const base = lifecycleIdempotencyKey(1, "scheduled", "in_progress", "field", "e");
    expect(base).toBe(lifecycleIdempotencyKey(1, "scheduled", "in_progress", "field", "e"));
    expect(base).not.toBe(lifecycleIdempotencyKey(2, "scheduled", "in_progress", "field", "e"));
    expect(base).not.toBe(lifecycleIdempotencyKey(1, "scheduled", "in_progress", "office", "e"));
    expect(base).not.toBe(lifecycleIdempotencyKey(1, "new", "in_progress", "field", "e"));
  });

  it("first-ever record (null current) works", () => {
    const p = planLifecycleTransition(null, scheduled, 7, { source: "backfill", eventKey: "backfill:7" });
    expect(p.changed).toBe(true);
    expect(p.from).toBeNull();
    expect(p.to).toBe("scheduled");
  });
});
