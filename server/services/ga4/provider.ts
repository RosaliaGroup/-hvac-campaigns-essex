/**
 * Cache-backed GA4 Analytics provider.
 *
 * The tRPC analytics router talks ONLY to this class — it never knows the
 * numbers come from the MySQL cache that runGa4Sync populates from the Google
 * Analytics Data API (mirrors GoogleSearchConsoleProvider). Every read is
 * wrapped so a missing DB / empty cache degrades to safe, empty data instead of
 * throwing: the dashboard must never break.
 *
 * All aggregation happens in-process over the day-level cache rows (modest
 * cardinality for an SMB property); no GA4 call is ever on the request path.
 */
import { and, between, desc, eq } from "drizzle-orm";
import {
  addMetrics,
  deriveTrafficType,
  emptyChannelSplit,
  EMPTY_METRICS,
  GA4_RANGE_DAYS,
  GA4_RANGE_LABELS,
  pctChange,
  type Ga4CampaignRow,
  type Ga4ChannelSplit,
  type Ga4ConversionPoint,
  type Ga4LandingPageRow,
  type Ga4Metrics,
  type Ga4Overview,
  type Ga4Range,
  type Ga4TopPageRow,
  type Ga4TrafficPoint,
} from "@shared/ga4";
import { getDb } from "../../db";
import { ga4DailyMetrics, type Ga4DailyMetricRow } from "../../../drizzle/schema";
import { getGa4PropertyId } from "../../integrations/ga4";

const DEFAULT_TOP_N = 20;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

type Window = { start: string; end: string };

/** Current + immediately-preceding window of equal length, ending today (UTC). */
function windowsFor(range: Ga4Range, now: Date): { current: Window; previous: Window } {
  const days = GA4_RANGE_DAYS[range];
  const end = now;
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return {
    current: { start: fmtDate(start), end: fmtDate(end) },
    previous: { start: fmtDate(prevStart), end: fmtDate(prevEnd) },
  };
}

function rowMetrics(r: Ga4DailyMetricRow): Ga4Metrics {
  return {
    pageViews: r.pageViews,
    sessions: r.sessions,
    users: r.users,
    conversions: Number(r.conversions),
    events: r.events,
  };
}

function sumMetrics(rows: Ga4DailyMetricRow[]): Ga4Metrics {
  return rows.reduce<Ga4Metrics>((acc, r) => addMetrics(acc, rowMetrics(r)), { ...EMPTY_METRICS });
}

export class Ga4AnalyticsProvider {
  private propertyId(): string {
    return getGa4PropertyId();
  }

  /** Rows for the property inside [start, end] (inclusive). Never throws. */
  private async rowsInWindow(win: Window): Promise<Ga4DailyMetricRow[]> {
    const propertyId = this.propertyId();
    if (!propertyId) return [];
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(ga4DailyMetrics)
      .where(
        and(
          eq(ga4DailyMetrics.propertyId, propertyId),
          between(ga4DailyMetrics.date, win.start, win.end),
        ),
      );
  }

  async getOverview(range: Ga4Range): Promise<Ga4Overview> {
    const emptyOverview: Ga4Overview = {
      range,
      rangeLabel: GA4_RANGE_LABELS[range],
      totals: { ...EMPTY_METRICS },
      deltas: { pageViews: 0, sessions: 0, users: 0, conversions: 0, events: 0 },
      channels: emptyChannelSplit(),
      empty: true,
    };
    try {
      const { current, previous } = windowsFor(range, new Date());
      const [curRows, prevRows] = await Promise.all([
        this.rowsInWindow(current),
        this.rowsInWindow(previous),
      ]);

      const totals = sumMetrics(curRows);
      const prevTotals = sumMetrics(prevRows);

      const channels: Ga4ChannelSplit = emptyChannelSplit();
      for (const r of curRows) {
        const type = r.trafficType ?? deriveTrafficType(r.source, r.medium, r.channelGroup);
        addMetrics(channels[type], rowMetrics(r));
      }

      return {
        range,
        rangeLabel: GA4_RANGE_LABELS[range],
        totals,
        deltas: {
          pageViews: pctChange(totals.pageViews, prevTotals.pageViews),
          sessions: pctChange(totals.sessions, prevTotals.sessions),
          users: pctChange(totals.users, prevTotals.users),
          conversions: pctChange(totals.conversions, prevTotals.conversions),
          events: pctChange(totals.events, prevTotals.events),
        },
        channels,
        empty: curRows.length === 0,
      };
    } catch (err) {
      console.warn("[GA4] getOverview failed, serving empty:", (err as Error).message);
      return emptyOverview;
    }
  }

  async getTraffic(range: Ga4Range): Promise<Ga4TrafficPoint[]> {
    try {
      const { current } = windowsFor(range, new Date());
      const rows = await this.rowsInWindow(current);
      const byDate = new Map<string, Ga4TrafficPoint>();
      for (const r of rows) {
        const p = byDate.get(r.date) ?? { date: r.date, sessions: 0, users: 0, pageViews: 0 };
        p.sessions += r.sessions;
        p.users += r.users;
        p.pageViews += r.pageViews;
        byDate.set(r.date, p);
      }
      return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      console.warn("[GA4] getTraffic failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async getConversions(range: Ga4Range): Promise<Ga4ConversionPoint[]> {
    try {
      const { current } = windowsFor(range, new Date());
      const rows = await this.rowsInWindow(current);
      const byDate = new Map<string, number>();
      for (const r of rows) {
        byDate.set(r.date, (byDate.get(r.date) ?? 0) + Number(r.conversions));
      }
      return Array.from(byDate.entries())
        .map(([date, conversions]) => ({ date, conversions }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      console.warn("[GA4] getConversions failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async getCampaigns(range: Ga4Range, limit = DEFAULT_TOP_N): Promise<Ga4CampaignRow[]> {
    try {
      const { current } = windowsFor(range, new Date());
      const rows = await this.rowsInWindow(current);
      const byKey = new Map<string, Ga4CampaignRow>();
      for (const r of rows) {
        const campaign = r.campaign || "(not set)";
        const key = `${campaign}\n${r.source}\n${r.medium}`;
        const row =
          byKey.get(key) ??
          ({
            campaign,
            source: r.source,
            medium: r.medium,
            trafficType: r.trafficType ?? deriveTrafficType(r.source, r.medium, r.channelGroup),
            sessions: 0,
            users: 0,
            conversions: 0,
            pageViews: 0,
          } as Ga4CampaignRow);
        row.sessions += r.sessions;
        row.users += r.users;
        row.conversions += Number(r.conversions);
        row.pageViews += r.pageViews;
        byKey.set(key, row);
      }
      return Array.from(byKey.values()).sort((a, b) => b.sessions - a.sessions).slice(0, limit);
    } catch (err) {
      console.warn("[GA4] getCampaigns failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async getLandingPages(range: Ga4Range, limit = DEFAULT_TOP_N): Promise<Ga4LandingPageRow[]> {
    try {
      const { current } = windowsFor(range, new Date());
      const rows = await this.rowsInWindow(current);
      const byPage = new Map<string, Ga4LandingPageRow>();
      for (const r of rows) {
        const landingPage = r.landingPage || "(not set)";
        const row =
          byPage.get(landingPage) ??
          ({ landingPage, sessions: 0, users: 0, conversions: 0, pageViews: 0 } as Ga4LandingPageRow);
        row.sessions += r.sessions;
        row.users += r.users;
        row.conversions += Number(r.conversions);
        row.pageViews += r.pageViews;
        byPage.set(landingPage, row);
      }
      return Array.from(byPage.values()).sort((a, b) => b.sessions - a.sessions).slice(0, limit);
    } catch (err) {
      console.warn("[GA4] getLandingPages failed, serving empty:", (err as Error).message);
      return [];
    }
  }

  async getTopPages(range: Ga4Range, limit = DEFAULT_TOP_N): Promise<Ga4TopPageRow[]> {
    try {
      const { current } = windowsFor(range, new Date());
      const rows = await this.rowsInWindow(current);
      const byPage = new Map<string, Ga4TopPageRow>();
      for (const r of rows) {
        const page = r.landingPage || "(not set)";
        const row = byPage.get(page) ?? ({ page, pageViews: 0, sessions: 0, users: 0 } as Ga4TopPageRow);
        row.pageViews += r.pageViews;
        row.sessions += r.sessions;
        row.users += r.users;
        byPage.set(page, row);
      }
      return Array.from(byPage.values()).sort((a, b) => b.pageViews - a.pageViews).slice(0, limit);
    } catch (err) {
      console.warn("[GA4] getTopPages failed, serving empty:", (err as Error).message);
      return [];
    }
  }
}

/** Process-wide singleton. */
let provider: Ga4AnalyticsProvider | null = null;

export function getGa4Provider(): Ga4AnalyticsProvider {
  if (!provider) provider = new Ga4AnalyticsProvider();
  return provider;
}
