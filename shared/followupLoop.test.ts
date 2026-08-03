import { describe, it, expect } from "vitest";
import { DECISION_TASK_LOOP_STEP, isDecisionTask } from "./followupLoop";

describe("isDecisionTask", () => {
  it("matches only the day-3 call task", () => {
    expect(isDecisionTask({ type: "call", loopStep: DECISION_TASK_LOOP_STEP })).toBe(true);
    // same-day human call
    expect(isDecisionTask({ type: "call", loopStep: 0 })).toBe(false);
    // day-3 email/text touches share loopStep 3 but are not the decision prompt
    expect(isDecisionTask({ type: "email", loopStep: DECISION_TASK_LOOP_STEP })).toBe(false);
    expect(isDecisionTask({ type: "text", loopStep: DECISION_TASK_LOOP_STEP })).toBe(false);
  });
});
