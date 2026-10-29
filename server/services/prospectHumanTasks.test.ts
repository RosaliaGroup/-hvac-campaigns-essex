import { describe, expect, it } from "vitest";
import { THIRTY_DAY_STEPS, cadenceDueAt } from "./crm30DayRules";

describe("call steps used for new prospects", () => {
  it("are the five human steps on days 2, 7, 14, 22 and 30, on weekdays", () => {
    const human = THIRTY_DAY_STEPS.filter(s => s.kind === "human");
    expect(human.map(s => s.day)).toEqual([2, 7, 14, 22, 30]);
    const intro = new Date("2026-10-29T14:00:00Z"); // Thu
    for (const s of human) expect([0, 6]).not.toContain(cadenceDueAt(intro, s.touch).getUTCDay());
  });
});
