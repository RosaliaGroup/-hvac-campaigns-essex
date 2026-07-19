/**
 * Dispatch board (M1) — PURE, read-only lane logic + timezone helpers.
 *
 * Groups a single day's visits into one lane per active technician (plus an
 * "Unassigned" lane), deterministically. No DB, no side effects, no Date.now()
 * in the analysis (the caller passes `now`) — same input → same output.
 *
 * Timezone handling is self-contained here (a small offset-correction wall→UTC)
 * so M1 does not modify the frozen field module. Day boundaries are computed in
 * the caller-supplied IANA timezone (client passes the browser's; server default
 * is America/New_York, matching the technician field views).
 */

export type Priority = "normal" | "urgent" | "emergency";

/** One scheduled/unscheduled visit as the board renders it. */
export interface BoardVisit {
  appointmentId: number;
  scheduledAt: string | null;        // ISO, or null for unscheduled
  durationMinutes: number;
  customerName: string;
  propertyAddress: string | null;
  appointmentType: string;
  priority: Priority;
  /** Authoritative live status: technicianWorkStatus when a job is linked, else appointment status. */
  liveStatus: string;
  jobId: number | null;
  jobNumber: string | null;
  assignedToId: number | null;
  assigneeName: string | null;
  phone: string | null;
}

export interface Technician { id: number; name: string; phone: string | null }

export interface Lane {
  /** null = the Unassigned lane. */
  technicianId: number | null;
  technicianName: string;
  count: number;
  visits: BoardVisit[];
}

// ── Timezone: wall-clock → UTC (single-offset correction; standard & deterministic) ──
function wallToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0); // mo/d overflow rolls over via Date.UTC
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  let hh = get("hour"); if (hh === 24) hh = 0; // some engines render midnight as 24
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hh, get("minute"), get("second"));
  const offset = asIfUtc - guess; // tz offset (ms) at that instant
  return new Date(guess - offset);
}

/** The `YYYY-MM-DD` calendar date of `now` in `tz`. */
export function todayInTimeZone(now: Date, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const get = (t: string) => p.find(x => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The UTC `[start, endExclusive)` window for calendar day `YYYY-MM-DD` in `tz`. */
export function resolveDayRange(day: string, tz: string): { start: Date; endExclusive: Date } {
  const [y, mo, d] = day.split("-").map(Number);
  return { start: wallToUtc(y, mo, d, 0, 0, tz), endExclusive: wallToUtc(y, mo, d + 1, 0, 0, tz) };
}

/** True when `YYYY-MM-DD` is a well-formed calendar date. */
export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, mo, d] = day.split("-").map(Number);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;
}

/** Shift a `YYYY-MM-DD` by ±n days (calendar-correct via UTC date math). */
export function shiftDay(day: string, deltaDays: number): string {
  const [y, mo, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + deltaDays));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

const sortVisits = (arr: BoardVisit[]): BoardVisit[] =>
  arr.slice().sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || a.appointmentId - b.appointmentId);

/**
 * Build the workload board: one lane per active technician (even when empty),
 * sorted by name, then an "Unassigned" lane (appended only when it has visits).
 * A visit assigned to a technician not in `technicians` (inactive/removed) falls
 * into the Unassigned lane so the board never hides work. Deterministic.
 */
export function buildDispatchLanes(visits: BoardVisit[], technicians: Technician[]): Lane[] {
  const active = new Set(technicians.map(t => t.id));
  const byTech = new Map<number, BoardVisit[]>();
  const unassigned: BoardVisit[] = [];
  for (const v of visits) {
    if (v.assignedToId != null && active.has(v.assignedToId)) {
      const a = byTech.get(v.assignedToId) ?? []; a.push(v); byTech.set(v.assignedToId, a);
    } else {
      unassigned.push(v);
    }
  }
  const lanes: Lane[] = technicians
    .slice().sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    .map(t => { const vis = sortVisits(byTech.get(t.id) ?? []); return { technicianId: t.id, technicianName: t.name, count: vis.length, visits: vis }; });
  if (unassigned.length) {
    const vis = sortVisits(unassigned);
    lanes.push({ technicianId: null, technicianName: "Unassigned", count: vis.length, visits: vis });
  }
  return lanes;
}
