import { describe, it, expect } from "vitest";
import {
  isFieldLocked, canMutateField, validateJobCompletion, COMPLETABLE_WORK_STATUSES,
} from "./jobCompletion";

describe("jobCompletion — field lock after completion", () => {
  it("locks technicians once the job is completed; admins override", () => {
    expect(isFieldLocked(true, false)).toBe(true);   // tech, completed
    expect(isFieldLocked(true, true)).toBe(false);   // admin, completed
    expect(isFieldLocked(false, false)).toBe(false); // tech, open
    expect(canMutateField(true, false)).toBe(false);
    expect(canMutateField(true, true)).toBe(true);
    expect(canMutateField(false, false)).toBe(true);
  });
});

describe("jobCompletion — validateJobCompletion", () => {
  const ok = { currentWorkStatus: "working" as const, hasCustomerNote: true, noCompletionNote: false, requireSignature: false, hasSignature: false };

  it("passes when work is done and a customer note exists", () => {
    expect(validateJobCompletion(ok)).toEqual({ ok: true });
  });

  it("blocks when work has not started (status not completable)", () => {
    for (const st of ["assigned", "accepted", "en_route", "arrived"] as const) {
      expect(validateJobCompletion({ ...ok, currentWorkStatus: st })).toEqual({ ok: false, reason: "not_ready" });
    }
    // working / waiting_parts are completable
    expect(COMPLETABLE_WORK_STATUSES).toEqual(["working", "waiting_parts"]);
  });

  it("requires a customer note OR explicit 'No completion note'", () => {
    expect(validateJobCompletion({ ...ok, hasCustomerNote: false, noCompletionNote: false }))
      .toEqual({ ok: false, reason: "note_required" });
    expect(validateJobCompletion({ ...ok, hasCustomerNote: false, noCompletionNote: true }))
      .toEqual({ ok: true });
  });

  it("requires a signature only when the company setting demands it", () => {
    // required + missing → blocked
    expect(validateJobCompletion({ ...ok, requireSignature: true, hasSignature: false }))
      .toEqual({ ok: false, reason: "signature_required" });
    // required + present → ok
    expect(validateJobCompletion({ ...ok, requireSignature: true, hasSignature: true }))
      .toEqual({ ok: true });
    // not required → ok regardless
    expect(validateJobCompletion({ ...ok, requireSignature: false, hasSignature: false }))
      .toEqual({ ok: true });
  });

  it("checks reasons in order: not_ready → note_required → signature_required", () => {
    // not ready AND missing note AND missing sig → not_ready wins
    expect(validateJobCompletion({ currentWorkStatus: "assigned", hasCustomerNote: false, noCompletionNote: false, requireSignature: true, hasSignature: false }))
      .toEqual({ ok: false, reason: "not_ready" });
    // ready but missing note AND missing sig → note_required wins
    expect(validateJobCompletion({ currentWorkStatus: "working", hasCustomerNote: false, noCompletionNote: false, requireSignature: true, hasSignature: false }))
      .toEqual({ ok: false, reason: "note_required" });
  });
});
