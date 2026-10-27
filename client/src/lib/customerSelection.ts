/** Pure CRM contact selection + permanent imported-cohort identification. */
export const MAX_SMS_SELECTION = 20;
const IMPORT_START_MS = Date.parse("2026-10-27T00:00:00-04:00");
const IMPORT_END_MS = Date.parse("2026-10-28T00:00:00-04:00");

export function isOct27HvacImport(
  source: string | null | undefined, createdAt: Date | string | number,
): boolean {
  if (source !== "hvac-list-07105") return false;
  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) && time >= IMPORT_START_MS && time < IMPORT_END_MS;
}

export function toggleContactSelection(
  selected: readonly number[], contactId: number, limit = MAX_SMS_SELECTION,
): number[] {
  if (selected.includes(contactId)) return selected.filter(id => id !== contactId);
  return selected.length < limit ? [...selected, contactId] : [...selected];
}

export function selectContactsFromPage(
  selected: readonly number[], pageIds: readonly number[], limit = MAX_SMS_SELECTION,
): number[] {
  const next = new Set(selected);
  for (const id of pageIds) {
    if (next.size >= limit) break;
    next.add(id);
  }
  return Array.from(next);
}

export function deselectContactsFromPage(
  selected: readonly number[], pageIds: readonly number[],
): number[] {
  const page = new Set(pageIds);
  return selected.filter(id => !page.has(id));
}
