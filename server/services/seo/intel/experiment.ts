/**
 * Readout of the "Page with redirect" re-indexing test (shared/seoExperiment.ts, docs/pr1/july-collapse.md).
 *
 * Until `startedAt` is set the report just says so. After it: "running" until +16 days (14 days plus
 * GSC's ~2-day lag), then a readout comparing the 4 treatment pages (indexing was requested) with the 4
 * controls (left alone): did Google re-crawl, is the page indexed again, did impressions move.
 * The conclusion is a labeled heuristic, not a verdict; the raw per-page numbers are always shown.
 */
import { getSearchConsoleAccessToken, getSeoSiteUrl, getSiteOrigin, inspectUrl, querySearchAnalytics } from "../../../integrations/searchConsole";
import { REINDEX_EXPERIMENT, experimentPhase } from "../../../../shared/seoExperiment";
import type { ExperimentPageRead, ExperimentReadout } from "../../../../shared/marketIntelTypes";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Pure. Turns the per-page reads into a labeled conclusion. */
export function concludeExperiment(pages: ExperimentPageRead[]): Pick<Extract<ExperimentReadout, { phase: "read" }>, "conclusion" | "summary"> {
  const T = pages.filter((p) => p.group === "treatment");
  const C = pages.filter((p) => p.group === "control");
  const indexed = (p: ExperimentPageRead) => p.verdict === "indexed";
  const iT = T.filter(indexed).length, iC = C.filter(indexed).length;
  const rT = T.filter((p) => p.recrawledSinceStart).length, rC = C.filter((p) => p.recrawledSinceStart).length;
  const sum = (ps: ExperimentPageRead[], k: "impressionsBefore" | "impressionsAfter") => ps.reduce((s, p) => s + p[k], 0);
  const facts = `Treatment (${T.length}): ${rT} re-crawled, ${iT} indexed again, impressions ${sum(T, "impressionsBefore")} → ${sum(T, "impressionsAfter")}. Control (${C.length}): ${rC} re-crawled, ${iC} indexed, impressions ${sum(C, "impressionsBefore")} → ${sum(C, "impressionsAfter")}.`;

  if (iT >= 2 && iT - iC >= 2) return { conclusion: "supports_crawl_fault", summary: `Requesting indexing brought pages back and the controls stayed out: consistent with a crawl-time fault (H2). ${facts}` };
  if (rT >= 2 && iT === 0) return { conclusion: "supports_quality_demotion", summary: `Google re-crawled the treatment pages and still did not restore them: consistent with a quality/spam demotion (H1). ${facts}` };
  return { conclusion: "inconclusive", summary: `Not enough separation between treatment and control to call it. ${facts}` };
}

/** Pure: sum a {path → date → impressions} map over [from, to] (inclusive ISO dates). */
export function sumWindow(byDate: Record<string, number> | undefined, from: string, to: string): number {
  let n = 0;
  for (const [d, v] of Object.entries(byDate ?? {})) if (d >= from && d <= to) n += v;
  return n;
}

export function holdIsOver(now: Date): boolean {
  return now.getTime() > Date.parse(`${REINDEX_EXPERIMENT.holdUntil}T23:59:59Z`);
}

/** Real I/O. Returns null once the hold window is over (experiment closed) or on failure; never throws. */
export async function collectExperimentReadout(now: Date = new Date()): Promise<ExperimentReadout | null> {
  try {
    if (holdIsOver(now)) return null;
    const phase = experimentPhase(now);
    if (phase.phase === "not_started") {
      return { phase: "not_started", note: `Waiting for "Request indexing" to be done on the ${REINDEX_EXPERIMENT.treatment.length} treatment pages (${REINDEX_EXPERIMENT.treatment.join(", ")}); set REINDEX_EXPERIMENT.startedAt to that date. Rewrites of the 15 flagged pages are on hold until ${REINDEX_EXPERIMENT.holdUntil}.` };
    }
    if (phase.phase === "running") return { phase: "running", startedAt: REINDEX_EXPERIMENT.startedAt!, daysUntilRead: phase.daysUntilRead };

    const startedAt = phase.startedAt;
    const start = new Date(`${startedAt}T00:00:00Z`);
    const site = getSeoSiteUrl();
    const origin = getSiteOrigin().replace(/\/+$/, "");
    const token = await getSearchConsoleAccessToken();
    const rows = await querySearchAnalytics({ accessToken: token, siteUrl: site, startDate: iso(new Date(start.getTime() - 14 * DAY)), endDate: iso(new Date(start.getTime() + 14 * DAY)), dimensions: ["page", "date"], rowLimit: 25000 });
    const byPath: Record<string, Record<string, number>> = {};
    for (const r of rows as Array<{ keys?: string[]; impressions: number }>) {
      const [rawPage, date] = r.keys ?? [];
      if (!rawPage || !date) continue;
      const path = rawPage.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "") || "/";
      (byPath[path] ??= {})[date] = (byPath[path][date] ?? 0) + r.impressions;
    }
    const beforeFrom = iso(new Date(start.getTime() - 14 * DAY)), beforeTo = iso(new Date(start.getTime() - DAY));
    const afterFrom = iso(new Date(start.getTime() + DAY)), afterTo = iso(new Date(start.getTime() + 14 * DAY));

    const pages: ExperimentPageRead[] = [];
    for (const [group, paths] of [["treatment", REINDEX_EXPERIMENT.treatment], ["control", REINDEX_EXPERIMENT.control]] as const) {
      for (const path of paths) {
        let coverageState: string | null = null, verdict: string | null = null, lastCrawlTime: string | null = null;
        try {
          const r = await inspectUrl({ accessToken: token, siteUrl: site, inspectionUrl: origin + path });
          coverageState = r.coverageState; verdict = r.indexStatus; lastCrawlTime = r.lastCrawlTime;
        } catch { /* leave nulls: an inspection failure must not sink the readout */ }
        pages.push({
          path, group, coverageState, verdict, lastCrawlTime,
          recrawledSinceStart: !!lastCrawlTime && Date.parse(lastCrawlTime) > start.getTime(),
          impressionsBefore: sumWindow(byPath[path], beforeFrom, beforeTo),
          impressionsAfter: sumWindow(byPath[path], afterFrom, afterTo),
        });
      }
    }
    return { phase: "read", startedAt, pages, ...concludeExperiment(pages) };
  } catch (err) {
    console.error("[SEO] experiment readout failed:", (err as Error).message);
    return null;
  }
}
