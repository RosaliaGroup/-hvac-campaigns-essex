/**
 * Dated hand-written notes that ride along in one day's intel report.
 *
 * A file in docs/intel-notes/ with front matter
 *
 *   ---
 *   publish: 2026-10-01
 *   title: Some finding
 *   ---
 *   body…
 *
 * is added to the report generated on that date (report.date, UTC) as `sections.notes`, and shown as
 * a card on the Market Intel page. One day only: a note without a valid `publish` date is never shown,
 * so an old note can't leak into later reports.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveRepoPath } from "../repoPath";
import type { ReportNote } from "../../../../shared/marketIntelTypes";


/** `null` when the file has no usable front matter (or no publish date). */
export function parseNote(id: string, raw: string): (ReportNote & { publish: string }) | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return null;
  const field = (name: string) => new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m").exec(m[1])?.[1] ?? null;
  const publish = field("publish");
  if (!publish || !/^\d{4}-\d{2}-\d{2}$/.test(publish)) return null;
  const markdown = m[2].trim();
  if (!markdown) return null;
  return { id, publish, title: field("title") ?? id, markdown };
}

/** Notes scheduled for `date` (YYYY-MM-DD). Never throws: an unreadable directory just means no notes. */
export function loadReportNotes(date: string, dir: string | null = resolveRepoPath("docs", "intel-notes")): ReportNote[] {
  if (!dir) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => parseNote(f.replace(/\.md$/, ""), readFileSync(path.join(dir, f), "utf8")))
      .filter((n): n is ReportNote & { publish: string } => !!n && n.publish === date)
      .map(({ id, title, markdown }) => ({ id, title, markdown }));
  } catch {
    return [];
  }
}
