/**
 * Pure helpers for the Appointment Calendar's display pipeline.
 *
 * Extracted from AppointmentCalendar.tsx so the "does this appointment surface
 * on the grid, and on which day" logic is unit-testable in node (the repo's
 * vitest env is node-only). Framework-free on purpose.
 */

export interface CalendarFilterState {
  /** "all" | "unassigned" | "<teamMemberId>" */
  assignee: string;
  /** empty array = all statuses */
  statuses: string[];
  /** "all" | appointmentType */
  type: string;
}

/** Minimal shape the calendar needs off an appointment row. */
export interface CalendarAppointment {
  scheduledAt?: string | Date | null;
  status: string;
  assignedToId?: number | null;
  appointmentType?: string | null;
}

/**
 * Local Y-M-D key (month is 0-indexed). MUST match how the grid keys its day
 * cells (react-day-picker hands us local Date objects), so an appointment and
 * its cell agree on the same string.
 */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Apply the calendar's assignee / status / type filters to one appointment. */
export function appointmentMatchesFilters(a: CalendarAppointment, f: CalendarFilterState): boolean {
  if (f.assignee !== "all") {
    if (f.assignee === "unassigned" ? a.assignedToId != null : String(a.assignedToId) !== f.assignee) return false;
  }
  if (f.statuses.length > 0 && !f.statuses.includes(a.status)) return false;
  if (f.type !== "all" && a.appointmentType !== f.type) return false;
  return true;
}

export interface DayBucket<T> {
  total: number;
  statuses: Record<string, number>;
  appts: T[];
}

/**
 * Bucket appointments by local day, applying filters. Rows without a
 * scheduledAt are skipped — they belong to the "unscheduled" backlog, not the
 * month grid. Each bucket's appts are sorted earliest-first.
 */
export function bucketAppointmentsByDay<T extends CalendarAppointment>(
  appts: T[],
  filters: CalendarFilterState,
): Map<string, DayBucket<T>> {
  const map = new Map<string, DayBucket<T>>();
  for (const a of appts) {
    if (!a.scheduledAt) continue;
    if (!appointmentMatchesFilters(a, filters)) continue;
    const key = dayKey(new Date(a.scheduledAt));
    const entry = map.get(key) ?? { total: 0, statuses: {}, appts: [] };
    entry.total++;
    entry.statuses[a.status] = (entry.statuses[a.status] ?? 0) + 1;
    entry.appts.push(a);
    map.set(key, entry);
  }
  map.forEach(entry => {
    entry.appts.sort((x, y) => new Date(x.scheduledAt!).getTime() - new Date(y.scheduledAt!).getTime());
  });
  return map;
}
