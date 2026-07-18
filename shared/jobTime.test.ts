import { describe, it, expect } from "vitest";
import {
  TIME_EVENT_TYPES, TIME_ACTION_LABEL, isTimeEventType,
  nextTimeActions, canAddTimeEvent, computeTimeSummary, formatDuration,
} from "./jobTime";

const T0 = Date.parse("2026-07-17T13:00:00Z");
const min = (n: number) => new Date(T0 + n * 60000);
// Build an events array from [type, minuteOffset] pairs.
const ev = (pairs: [any, number][]) => pairs.map(([eventType, m]) => ({ eventType, occurredAt: min(m) }));

describe("jobTime — event types + actions", () => {
  it("exposes the six event types with labels", () => {
    expect(TIME_EVENT_TYPES).toEqual(["travel_start", "arrived", "work_start", "pause", "resume", "work_finish"]);
    expect(TIME_ACTION_LABEL.pause).toBe("Pause Work");
    expect(isTimeEventType("work_start")).toBe(true);
    expect(isTimeEventType("nope")).toBe(false);
  });

  it("gates next actions by state", () => {
    expect(nextTimeActions("not_started").sort()).toEqual(["travel_start", "work_start"].sort());
    expect(nextTimeActions("traveling")).toEqual(["arrived"]);
    expect(nextTimeActions("arrived")).toEqual(["work_start"]);
    expect(nextTimeActions("working").sort()).toEqual(["pause", "work_finish"].sort());
    expect(nextTimeActions("paused").sort()).toEqual(["resume", "work_finish"].sort());
    expect(nextTimeActions("finished")).toEqual([]);
  });

  it("canAddTimeEvent enforces the transition", () => {
    expect(canAddTimeEvent("working", "pause")).toBe(true);
    expect(canAddTimeEvent("working", "resume")).toBe(false);
    expect(canAddTimeEvent("not_started", "arrived")).toBe(false);
    expect(canAddTimeEvent("finished", "work_start")).toBe(false);
  });
});

describe("jobTime — computeTimeSummary", () => {
  it("computes travel from travel_start → arrived", () => {
    const s = computeTimeSummary(ev([["travel_start", 0], ["arrived", 20]]));
    expect(s.travelMs).toBe(20 * 60000);
    expect(s.state).toBe("arrived");
  });

  it("computes labor across a pause/resume (pause excluded from labor)", () => {
    // work 0-30, pause 30-40, resume, work 40-60 → labor 50m, pause 10m
    const s = computeTimeSummary(ev([
      ["work_start", 0], ["pause", 30], ["resume", 40], ["work_finish", 60],
    ]));
    expect(s.laborMs).toBe(50 * 60000);
    expect(s.pauseMs).toBe(10 * 60000);
    expect(s.state).toBe("finished");
  });

  it("computes a full flow: travel + labor + pause + elapsed", () => {
    // travel 0-15, arrived, work 15-45, pause 45-55, resume, finish 55-75
    const s = computeTimeSummary(ev([
      ["travel_start", 0], ["arrived", 15], ["work_start", 15],
      ["pause", 45], ["resume", 55], ["work_finish", 75],
    ]));
    expect(s.travelMs).toBe(15 * 60000);
    expect(s.laborMs).toBe(50 * 60000);   // 30 + 20
    expect(s.pauseMs).toBe(10 * 60000);
    expect(s.elapsedMs).toBe(75 * 60000);
  });

  it("counts an open segment up to `now` for live display", () => {
    // currently traveling since minute 0; now = minute 10
    const s = computeTimeSummary(ev([["travel_start", 0]]), min(10));
    expect(s.travelMs).toBe(10 * 60000);
    expect(s.state).toBe("traveling");
    // currently working since minute 5; now = minute 25
    const w = computeTimeSummary(ev([["work_start", 5]]), min(25));
    expect(w.laborMs).toBe(20 * 60000);
    expect(w.state).toBe("working");
  });

  it("handles empty and out-of-order input", () => {
    expect(computeTimeSummary([])).toEqual({ travelMs: 0, laborMs: 0, pauseMs: 0, elapsedMs: 0, state: "not_started" });
    // out of order gets sorted
    const s = computeTimeSummary(ev([["work_finish", 60], ["work_start", 0]]));
    expect(s.laborMs).toBe(60 * 60000);
  });
});

describe("jobTime — formatDuration", () => {
  it("formats hours and minutes", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(12 * 60000)).toBe("12m");
    expect(formatDuration(125 * 60000)).toBe("2h 05m");
  });
});
