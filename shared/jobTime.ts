/**
 * Technician time tracking (PR #41) — pure, framework-free. An append-only log
 * of time events (jobTimeEvents) drives the clock; this module derives the
 * current state, the buttons that are legal next, and the travel / labor / pause
 * / elapsed totals. Kept separate from the work-status lifecycle (PR #39) — both
 * coexist; this one is the clock, that one is the state. Shared by client + server.
 */

export const TIME_EVENT_TYPES = [
  "travel_start",
  "arrived",
  "work_start",
  "pause",
  "resume",
  "work_finish",
] as const;
export type TimeEventType = (typeof TIME_EVENT_TYPES)[number];

export function isTimeEventType(v: unknown): v is TimeEventType {
  return typeof v === "string" && (TIME_EVENT_TYPES as readonly string[]).includes(v);
}

/** Button labels for the six actions. */
export const TIME_ACTION_LABEL: Record<TimeEventType, string> = {
  travel_start: "Start Travel",
  arrived: "Arrived",
  work_start: "Start Work",
  pause: "Pause Work",
  resume: "Resume Work",
  work_finish: "Finish Work",
};

/** The clock's derived state (last-event driven). */
export type TimeState = "not_started" | "traveling" | "arrived" | "working" | "paused" | "finished";

const STATE_OF_LAST: Record<TimeEventType, TimeState> = {
  travel_start: "traveling",
  arrived: "arrived",
  work_start: "working",
  resume: "working",
  pause: "paused",
  work_finish: "finished",
};

/** Legal next actions from each state (guides the UI; enforced on the server). */
const NEXT_ACTIONS: Record<TimeState, TimeEventType[]> = {
  not_started: ["travel_start", "work_start"],
  traveling: ["arrived"],
  arrived: ["work_start"],
  working: ["pause", "work_finish"],
  paused: ["resume", "work_finish"],
  finished: [],
};

export function nextTimeActions(state: TimeState): TimeEventType[] {
  return NEXT_ACTIONS[state] ?? [];
}

export function canAddTimeEvent(state: TimeState, eventType: TimeEventType): boolean {
  return nextTimeActions(state).includes(eventType);
}

interface RawEvent {
  eventType: TimeEventType;
  occurredAt: Date | string | number;
}
function toMs(v: Date | string | number): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  return new Date(v).getTime();
}

export interface TimeSummary {
  travelMs: number;
  laborMs: number;
  pauseMs: number;
  elapsedMs: number;
  state: TimeState;
}

/**
 * Compute travel / labor / pause / elapsed from the ordered events. When `now`
 * is supplied, any still-open segment (e.g. currently traveling or working) is
 * counted up to `now` so the UI can tick live; without it, only closed segments
 * count (deterministic for a completed job — pass the finish time or omit).
 */
export function computeTimeSummary(events: RawEvent[], now?: Date | string | number): TimeSummary {
  const evs = events
    .map(e => ({ t: e.eventType, at: toMs(e.occurredAt) }))
    .filter(e => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);

  let travel = 0, labor = 0, pause = 0;
  let travelStart: number | null = null;
  let laborStart: number | null = null;
  let pauseStart: number | null = null;

  for (const e of evs) {
    switch (e.t) {
      case "travel_start": travelStart = e.at; break;
      case "arrived":
        if (travelStart != null) { travel += e.at - travelStart; travelStart = null; }
        break;
      case "work_start": laborStart = e.at; break;
      case "resume":
        if (pauseStart != null) { pause += e.at - pauseStart; pauseStart = null; }
        laborStart = e.at;
        break;
      case "pause":
        if (laborStart != null) { labor += e.at - laborStart; laborStart = null; }
        pauseStart = e.at;
        break;
      case "work_finish":
        if (laborStart != null) { labor += e.at - laborStart; laborStart = null; }
        if (pauseStart != null) { pause += e.at - pauseStart; pauseStart = null; }
        break;
    }
  }

  const state: TimeState = evs.length ? STATE_OF_LAST[evs[evs.length - 1].t] : "not_started";
  const nowMs = now != null ? toMs(now) : (evs.length ? evs[evs.length - 1].at : 0);
  // Count still-open segments up to `now` (live display).
  if (travelStart != null && nowMs > travelStart) travel += nowMs - travelStart;
  if (laborStart != null && nowMs > laborStart) labor += nowMs - laborStart;
  if (pauseStart != null && nowMs > pauseStart) pause += nowMs - pauseStart;

  const elapsedMs = evs.length ? Math.max(0, nowMs - evs[0].at) : 0;
  return { travelMs: travel, laborMs: labor, pauseMs: pause, elapsedMs, state };
}

/** Format a millisecond duration as "2h 05m" / "12m" / "0m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
