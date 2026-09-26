/**
 * §2.2/§3b competitor watchlist fetch + diff (docs/market-intel-spec.md).
 *
 * fetchCompetitorSnapshot(): a plain server-side `fetch` (this codebase's
 * existing pattern for external calls — see server/services/seo/github.ts's
 * own header) — no headless browser / anti-bot handling, per the task's own
 * "straightforward fetch+diff... it's fine" allowance. Respects robots.txt
 * (best-effort parse, disallow-all or an exact-path disallow), identifies
 * itself via User-Agent, and only ever targets a `domainVerified` entry from
 * shared/competitorWatchlist.ts (see that file's header for why).
 *
 * classifyCompetitorDiff() is pure and fixture-testable (§7 "cosmetic vs
 * material on fixture snapshots") — the real fetch/diff/persist path is a
 * thin I/O wrapper around it, same split as searchDemand.ts.
 */
import { and, desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "../../../db";
import { seoIntelCompetitorSnapshots, type SeoIntelCompetitorSnapshotRow } from "../../../../drizzle/schema";
import { COMPETITOR_WATCHLIST, fetchableCompetitors, type WatchedCompetitor } from "../../../../shared/competitorWatchlist";
import type { CompetitorDiffFinding, CompetitorDiffKind } from "../../../../shared/marketIntelTypes";

const USER_AGENT = "Mechanical Enterprise Market Intel Bot (+https://mechanicalenterprise.com)";
const DAILY_PAGE_CAP = 60; // §4 cost cap

export type PageSnapshotText = {
  title: string | null;
  meta: string | null;
  headings: string[];
  /** Normalized visible offer/price/warranty/CTA lines. */
  offers: string[];
};

/* ── Pure HTML normalization ─────────────────────────────────────────────── */

function extractTag(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? decodeEntities(m[1]).trim() : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

const OFFER_LINE_RE = /(\$[\d,]+(?:\.\d+)?\s?[kK]?|warranty|guarantee|financing|% off|free\b|rebate|year[s]?\s+(parts|labor|coverage))/i;

/** Pure — extracts a comparable, normalized shape from raw HTML. No fetch, no DB. */
export function normalizeCompetitorHtml(html: string): PageSnapshotText {
  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);

  const headings: string[] = [];
  const headingRe = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(html))) {
    const text = stripTags(hm[1]);
    if (text) headings.push(text);
  }

  // Visible-text lines that look like an offer/price/warranty/CTA claim.
  const bodyText = stripTags(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, ""));
  const sentences = bodyText.split(/(?<=[.!?])\s+/);
  const offers = Array.from(new Set(sentences.filter((s) => OFFER_LINE_RE.test(s) && s.length < 300).map((s) => s.trim())));

  return { title, meta, headings, offers };
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function snapshotHash(snap: PageSnapshotText): string {
  return sha256(JSON.stringify([snap.title, snap.meta, snap.headings, snap.offers]));
}

/* ── Pure diff classification (§7 fixture test target) ───────────────────── */

function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const DOLLAR_RE = /\$[\d,]+(?:\.\d+)?\s?[kK]?/g;
const WARRANTY_RE = /\b(warrant(y|ies)|guarantee)\b/i;
const SERVICE_AREA_RE = /\b(now serving|proudly serving|service area|counties?|essex|hudson|bergen|passaic|union|middlesex|morris|sussex|somerset)\b/i;

function classifyTextChange(before: string, after: string): CompetitorDiffKind {
  if (normalizeForCompare(before) === normalizeForCompare(after)) return "cosmetic";
  const beforeDollars = (before.match(DOLLAR_RE) ?? []).join(",");
  const afterDollars = (after.match(DOLLAR_RE) ?? []).join(",");
  if (beforeDollars !== afterDollars && (beforeDollars || afterDollars)) return "price_change";
  if (WARRANTY_RE.test(before) !== WARRANTY_RE.test(after) || (WARRANTY_RE.test(after) && before !== after && /\d+[\s-]?year/i.test(after))) return "warranty_change";
  if (SERVICE_AREA_RE.test(after) && !SERVICE_AREA_RE.test(before)) return "service_area_change";
  return "messaging_change";
}

/**
 * Pure diff between yesterday's and today's normalized snapshot for one
 * watched page. `before === null` means this page/competitor is new to the
 * watchlist (or never captured before) — every non-empty field is `new_page`.
 */
export function classifyCompetitorDiff(
  competitor: Pick<WatchedCompetitor, "name" | "domain">,
  pagePath: string,
  before: PageSnapshotText | null,
  after: PageSnapshotText,
): CompetitorDiffFinding[] {
  const findings: CompetitorDiffFinding[] = [];
  const base = { competitor: competitor.name, domain: competitor.domain, pagePath };

  if (before === null) {
    if (after.title) findings.push({ ...base, kind: "new_page", before: null, after: after.title, field: "title" });
    return findings;
  }

  if (before.title !== after.title && (before.title || after.title)) {
    const kind = classifyTextChange(before.title ?? "", after.title ?? "");
    findings.push({ ...base, kind, before: before.title, after: after.title, field: "title" });
  }
  if (before.meta !== after.meta && (before.meta || after.meta)) {
    const kind = classifyTextChange(before.meta ?? "", after.meta ?? "");
    findings.push({ ...base, kind, before: before.meta, after: after.meta, field: "meta" });
  }

  const beforeHeadingSet = new Set(before.headings.map(normalizeForCompare));
  const newHeadings = after.headings.filter((h) => !beforeHeadingSet.has(normalizeForCompare(h)));
  for (const h of newHeadings) {
    findings.push({ ...base, kind: classifyTextChange("", h), before: null, after: h, field: "heading" });
  }

  const beforeOfferSet = new Set(before.offers.map(normalizeForCompare));
  const newOffers = after.offers.filter((o) => !beforeOfferSet.has(normalizeForCompare(o)));
  for (const o of newOffers) {
    // A brand-new offer/price/warranty sentence that wasn't there yesterday — "new_offer" per spec's own vocabulary,
    // unless it's clearly a price or warranty change to an EXISTING line (already caught above via title/meta).
    findings.push({ ...base, kind: "new_offer", before: null, after: o, field: "offer" });
  }

  return findings;
}

/* ── Real I/O: fetch, robots.txt, persist, diff against yesterday ───────── */

const robotsCache = new Map<string, { disallowAll: boolean; disallowedPaths: string[] }>();

async function robotsAllows(domain: string, path: string): Promise<boolean> {
  let rules = robotsCache.get(domain);
  if (!rules) {
    rules = { disallowAll: false, disallowedPaths: [] };
    try {
      const res = await fetch(`https://${domain}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) {
        const text = await res.text();
        for (const line of text.split("\n")) {
          const m = /^\s*disallow:\s*(\S*)\s*$/i.exec(line);
          if (!m) continue;
          if (m[1] === "/") rules.disallowAll = true;
          else if (m[1]) rules.disallowedPaths.push(m[1]);
        }
      }
    } catch {
      // No robots.txt / fetch failed — treat as allowed (most sites have none).
    }
    robotsCache.set(domain, rules);
  }
  if (rules.disallowAll) return false;
  return !rules.disallowedPaths.some((p) => path.startsWith(p));
}

export type CompetitorPageResult = { pagePath: string; diffs: CompetitorDiffFinding[]; skipped?: string };

/** One competitor's watched pages: fetch (if not already captured today, and under the daily cap), snapshot, diff against yesterday. */
export async function watchCompetitor(competitor: WatchedCompetitor, remainingBudget: { count: number }, now: Date = new Date()): Promise<CompetitorPageResult[]> {
  const db = await getDb();
  if (!db) return [];
  const results: CompetitorPageResult[] = [];
  const today = now.toISOString().slice(0, 10);

  for (const pagePath of competitor.pages) {
    if (remainingBudget.count <= 0) {
      results.push({ pagePath, diffs: [], skipped: "daily competitor-page cost cap reached" });
      continue;
    }

    const already = await db
      .select()
      .from(seoIntelCompetitorSnapshots)
      .where(and(eq(seoIntelCompetitorSnapshots.domain, competitor.domain), eq(seoIntelCompetitorSnapshots.pagePath, pagePath)))
      .orderBy(desc(seoIntelCompetitorSnapshots.capturedAt))
      .limit(2);
    const latest = already[0];
    if (latest && latest.capturedAt.toISOString().slice(0, 10) === today) {
      results.push({ pagePath, diffs: [], skipped: "already captured today (one request/page/day)" });
      continue;
    }

    if (!(await robotsAllows(competitor.domain, pagePath))) {
      results.push({ pagePath, diffs: [], skipped: "robots.txt disallows this path" });
      continue;
    }

    let html: string;
    try {
      const url = `https://${competitor.domain}${pagePath}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
      remainingBudget.count--;
      if (!res.ok) {
        results.push({ pagePath, diffs: [], skipped: `HTTP ${res.status}` });
        continue;
      }
      html = await res.text();
    } catch (err) {
      results.push({ pagePath, diffs: [], skipped: `fetch failed: ${(err as Error).message}` });
      continue;
    }

    const after = normalizeCompetitorHtml(html);
    const beforeSnap = latest ? { title: latest.title, meta: latest.metaDescription, headings: (latest.headings as string[]) ?? [], offers: (latest.offers as string[]) ?? [] } : null;
    const diffs = classifyCompetitorDiff(competitor, pagePath, beforeSnap, after).filter((d) => d.kind !== "cosmetic"); // "cosmetic is logged, not reported" (§3b)

    await db.insert(seoIntelCompetitorSnapshots).values({
      domain: competitor.domain, pagePath, contentHash: snapshotHash(after),
      title: after.title, metaDescription: after.meta, headings: after.headings, offers: after.offers,
    });

    results.push({ pagePath, diffs });
  }

  return results;
}

/** Real I/O: watch every domain-verified competitor, respecting the daily page cap. */
export async function collectCompetitorDiffs(now: Date = new Date()): Promise<{ diffs: CompetitorDiffFinding[]; skippedDomains: string[] }> {
  const watchable = fetchableCompetitors();
  const budget = { count: DAILY_PAGE_CAP };
  const diffs: CompetitorDiffFinding[] = [];
  const skippedDomains: string[] = [];
  for (const competitor of watchable) {
    const results = await watchCompetitor(competitor, budget, now);
    for (const r of results) diffs.push(...r.diffs);
  }
  // Every non-verified seed entry is effectively "skipped" — surfaced so the report can say why the list looks thin.
  for (const c of COMPETITOR_WATCHLIST) if (!c.domainVerified) skippedDomains.push(c.name);
  return { diffs, skippedDomains };
}
