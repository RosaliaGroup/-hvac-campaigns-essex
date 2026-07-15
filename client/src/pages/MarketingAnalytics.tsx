import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Users,
  MousePointerClick,
  Eye,
  Target,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  DownloadCloud,
  CloudOff,
  Clock,
  ShieldAlert,
  Megaphone,
  FileText,
  Leaf,
} from "lucide-react";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  GA4_RANGES,
  GA4_RANGE_LABELS,
  GA4_TRAFFIC_TYPE_LABELS,
  DEFAULT_GA4_RANGE,
  type Ga4Range,
  type Ga4TrafficType,
} from "@shared/ga4";

/* ── Formatting helpers ─────────────────────────────────────────────────── */

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtDelta = (fraction: number) => `${fraction >= 0 ? "+" : ""}${(fraction * 100).toFixed(1)}%`;
const shortDate = (iso: string) => iso.slice(5); // MM-DD

/* ── Brand palette ──────────────────────────────────────────────────────── */

const NAVY = "#1e3a5f";
const ORANGE = "#ff6b35";
const TEAL = "#0ea5a3";

const TRAFFIC_COLORS: Record<Ga4TrafficType, string> = {
  organic: "#16a34a",
  paid: ORANGE,
  other: "#94a3b8",
};

/* ── Delta pill ─────────────────────────────────────────────────────────── */

function DeltaPill({ value }: { value: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" />
      {fmtDelta(value)}
    </span>
  );
}

/* ── KPI card ───────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: number;
  delta?: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-[#1e3a5f] tabular-nums">{fmtInt(value)}</p>
            {delta !== undefined && <div className="mt-1"><DeltaPill value={delta} /></div>}
          </div>
          <div className="rounded-lg bg-[#ff6b35]/10 p-2">
            <Icon className="h-5 w-5 text-[#ff6b35]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function MarketingAnalytics() {
  const { loading, isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [range, setRange] = useState<Ga4Range>(DEFAULT_GA4_RANGE);

  const isAdmin = user?.role === "admin";
  const enabled = isAuthenticated && isAdmin;

  const overview = trpc.analytics.overview.useQuery({ range }, { enabled });
  const traffic = trpc.analytics.traffic.useQuery({ range }, { enabled });
  const conversions = trpc.analytics.conversions.useQuery({ range }, { enabled });
  const campaigns = trpc.analytics.campaigns.useQuery({ range, limit: 20 }, { enabled });
  const landingPages = trpc.analytics.landingPages.useQuery({ range, limit: 20 }, { enabled });
  const syncStatus = trpc.analytics.syncStatus.useQuery(undefined, { enabled });

  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.href = getLoginUrl();
  }, [loading, isAuthenticated]);

  const invalidate = () => {
    utils.analytics.overview.invalidate();
    utils.analytics.traffic.invalidate();
    utils.analytics.conversions.invalidate();
    utils.analytics.campaigns.invalidate();
    utils.analytics.landingPages.invalidate();
    utils.analytics.syncStatus.invalidate();
  };

  const sync = trpc.analytics.sync.useMutation({
    onSuccess: (res) => {
      if (res.ok) toast.success(`Synced ${res.rowsSynced} rows from GA4`);
      else if (res.reason === "unavailable") toast.error("GA4 unavailable — reconnect Google in Integrations (needs Analytics scope)");
      else if (res.reason === "unconfigured") toast.error("Set GA4_PROPERTY_ID to enable the sync");
      else if (res.reason === "no_db") toast.error("Database not configured");
      else if (res.reason === "already_running") toast.message("A sync is already running");
      else toast.error(res.error ?? "Sync failed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRefresh = () => {
    invalidate();
    toast.success("Refreshing analytics…");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  // Admin-only guard (defense-in-depth; the tRPC endpoints are adminProcedure).
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <InternalNav />
        <div className="container py-16">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
                <ShieldAlert className="h-5 w-5 text-[#ff6b35]" />
                Admins only
              </CardTitle>
              <CardDescription>
                The GA4 Analytics dashboard is restricted to administrators. Ask an admin for access.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <DashboardFooter />
      </div>
    );
  }

  const o = overview.data;
  const status = syncStatus.data;

  const trafficSeries = (traffic.data ?? []).map((p) => ({ ...p, label: shortDate(p.date) }));
  const conversionSeries = (conversions.data ?? []).map((p) => ({ ...p, label: shortDate(p.date) }));

  const channelData = o
    ? (Object.keys(GA4_TRAFFIC_TYPE_LABELS) as Ga4TrafficType[]).map((t) => ({
        type: t,
        label: GA4_TRAFFIC_TYPE_LABELS[t],
        sessions: o.channels[t].sessions,
        users: o.channels[t].users,
        conversions: o.channels[t].conversions,
      }))
    : [];

  const totalChannelSessions = channelData.reduce((s, c) => s + c.sessions, 0);
  const isEmpty = !!o?.empty;

  return (
    <div className="min-h-screen bg-secondary/30">
      <InternalNav />

      <div className="container py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2 flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-[#ff6b35]" />
                Analytics
              </h1>
              <p className="text-muted-foreground">
                Website traffic, engagement and conversions from Google Analytics 4
                {o ? ` · ${o.rangeLabel}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Range selector */}
              <div className="inline-flex rounded-md border bg-background p-0.5">
                {GA4_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-sm rounded ${
                      range === r ? "bg-[#1e3a5f] text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {GA4_RANGE_LABELS[r].replace("Last ", "")}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DownloadCloud className="h-4 w-4 mr-2" />
                )}
                Sync from GA4
              </Button>
            </div>
          </div>

          {/* Freshness / staleness banner */}
          {status && status.stale && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <CloudOff className="h-4 w-4" />
              {status.lastError
                ? `Last GA4 sync failed: ${status.lastError}`
                : status.propertyId
                  ? "No successful GA4 sync yet — click “Sync from GA4”. (Google must be connected with the Analytics scope.)"
                  : "GA4 is not configured — set GA4_PROPERTY_ID to enable analytics."}
            </div>
          )}
          {status && !status.stale && status.lastSuccessAt && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last synced {new Date(status.lastSuccessAt).toLocaleString()} · {fmtInt(status.rowsSynced)} rows
            </p>
          )}
        </div>

        {isEmpty && !status?.stale && (
          <Card className="mb-6">
            <CardContent className="py-8 text-center text-muted-foreground">
              No analytics data for this window yet.
            </CardContent>
          </Card>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Sessions" value={o?.totals.sessions ?? 0} delta={o?.deltas.sessions} icon={MousePointerClick} />
          <KpiCard label="Users" value={o?.totals.users ?? 0} delta={o?.deltas.users} icon={Users} />
          <KpiCard label="Page Views" value={o?.totals.pageViews ?? 0} delta={o?.deltas.pageViews} icon={Eye} />
          <KpiCard label="Conversions" value={o?.totals.conversions ?? 0} delta={o?.deltas.conversions} icon={Target} />
        </div>

        {/* Traffic + Conversions charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#ff6b35]" />
                Traffic — Sessions &amp; Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ga4Sessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ORANGE} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ga4Users" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={NAVY} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={44} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="sessions" name="Sessions" stroke={ORANGE} fill="url(#ga4Sessions)" strokeWidth={2} />
                    <Area type="monotone" dataKey="users" name="Users" stroke={NAVY} fill="url(#ga4Users)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
                <Target className="h-5 w-5 text-[#ff6b35]" />
                Conversions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                    <Tooltip />
                    <Bar dataKey="conversions" name="Conversions" fill={TEAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organic vs Paid */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
              <Leaf className="h-5 w-5 text-[#ff6b35]" />
              Organic vs Paid
            </CardTitle>
            <CardDescription>Sessions by acquisition channel for {o?.rangeLabel.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {channelData.map((c) => {
                const pct = totalChannelSessions > 0 ? (c.sessions / totalChannelSessions) * 100 : 0;
                return (
                  <div key={c.type} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-[#1e3a5f]">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: TRAFFIC_COLORS[c.type] }} />
                        {c.label}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-[#1e3a5f]">{fmtInt(c.sessions)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtInt(c.users)} users · {fmtInt(c.conversions)} conversions
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TRAFFIC_COLORS[c.type] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Campaign performance */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#ff6b35]" />
              Campaign Performance
            </CardTitle>
            <CardDescription>Top campaigns by sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Campaign</th>
                    <th className="py-2 pr-4 font-medium">Source / Medium</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium text-right">Sessions</th>
                    <th className="py-2 pr-4 font-medium text-right">Users</th>
                    <th className="py-2 font-medium text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns.data ?? []).map((c, i) => (
                    <tr key={`${c.campaign}-${c.source}-${c.medium}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-[#1e3a5f] max-w-[220px] truncate">{c.campaign}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{c.source} / {c.medium}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant="outline"
                          className="capitalize"
                          style={{ borderColor: TRAFFIC_COLORS[c.trafficType], color: TRAFFIC_COLORS[c.trafficType] }}
                        >
                          {GA4_TRAFFIC_TYPE_LABELS[c.trafficType]}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtInt(c.sessions)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtInt(c.users)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(c.conversions)}</td>
                    </tr>
                  ))}
                  {(campaigns.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">No campaign data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top landing pages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#ff6b35]" />
              Top Landing Pages
            </CardTitle>
            <CardDescription>Where sessions start, by volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Landing page</th>
                    <th className="py-2 pr-4 font-medium text-right">Sessions</th>
                    <th className="py-2 pr-4 font-medium text-right">Users</th>
                    <th className="py-2 pr-4 font-medium text-right">Page Views</th>
                    <th className="py-2 font-medium text-right">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {(landingPages.data ?? []).map((p, i) => (
                    <tr key={`${p.landingPage}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-[#1e3a5f] max-w-[360px] truncate">{p.landingPage}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtInt(p.sessions)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtInt(p.users)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtInt(p.pageViews)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtInt(p.conversions)}</td>
                    </tr>
                  ))}
                  {(landingPages.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">No landing page data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <DashboardFooter />
    </div>
  );
}
