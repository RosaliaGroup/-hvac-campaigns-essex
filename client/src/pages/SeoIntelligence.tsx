import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MousePointerClick,
  Eye,
  Percent,
  ArrowUpDown,
  FileCheck2,
  FileX2,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  Info,
} from "lucide-react";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/* ── Formatting helpers ─────────────────────────────────────────────────── */

const fmtInt = (n: number) => n.toLocaleString();
const fmtPct = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;
const fmtPos = (n: number) => (n > 0 ? n.toFixed(1) : "—");

/** A signed percentage-point / count delta with direction + colour. */
function DeltaPill({
  value,
  kind,
}: {
  value: number;
  /** `higher-better` = up is green; `lower-better` (position) = down is green. */
  kind: "higher-better" | "lower-better";
}) {
  if (!value) {
    return <span className="text-xs text-muted-foreground">No change</span>;
  }
  const isUp = value > 0;
  const good = kind === "higher-better" ? isUp : !isUp;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const magnitude = Math.abs(value);
  const label = kind === "lower-better" ? magnitude.toFixed(1) : fmtPct(magnitude);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/* ── KPI card ───────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="h-5 w-5 text-[#ff6b35]" />
        </div>
        <p className="text-3xl font-bold text-[#1e3a5f]">{value}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{hint}</span>
          {delta}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Priority badge ─────────────────────────────────────────────────────── */

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles: Record<typeof priority, string> = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    low: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${styles[priority]}`}>
      {priority}
    </span>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function SeoIntelligence() {
  const { loading, isAuthenticated } = useAuth();

  const overview = trpc.seo.getOverview.useQuery(undefined, { enabled: isAuthenticated });
  const opportunities = trpc.seo.getOpportunities.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const handleRefresh = () => {
    overview.refetch();
    opportunities.refetch();
    toast.success("Refreshing SEO data…");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const o = overview.data;
  const rows = opportunities.data ?? [];

  return (
    <div className="min-h-screen bg-secondary/30">
      <InternalNav />

      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2 flex items-center gap-3">
                <Search className="h-8 w-8 text-[#ff6b35]" />
                SEO Intelligence
              </h1>
              <p className="text-muted-foreground">
                Organic search performance and prioritized optimization opportunities
                {o ? ` · ${o.rangeLabel}` : ""}
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Placeholder-data notice */}
        <div className="mb-8 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <strong>Preview data.</strong> These figures are placeholders. Connect Google Search
            Console to populate this dashboard with live organic search metrics.
          </p>
        </div>

        {/* KPI cards */}
        {overview.isLoading || !o ? (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading SEO metrics…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
            <KpiCard
              label="Organic Clicks"
              value={fmtInt(o.organicClicks)}
              hint="vs prev. 28 days"
              icon={MousePointerClick}
              delta={<DeltaPill value={o.deltas.organicClicks} kind="higher-better" />}
            />
            <KpiCard
              label="Impressions"
              value={fmtInt(o.impressions)}
              hint="vs prev. 28 days"
              icon={Eye}
              delta={<DeltaPill value={o.deltas.impressions} kind="higher-better" />}
            />
            <KpiCard
              label="CTR"
              value={fmtPct(o.ctr, 2)}
              hint="Click-through rate"
              icon={Percent}
              delta={<DeltaPill value={o.deltas.ctr} kind="higher-better" />}
            />
            <KpiCard
              label="Average Position"
              value={o.averagePosition.toFixed(1)}
              hint="Lower is better"
              icon={ArrowUpDown}
              delta={<DeltaPill value={o.deltas.averagePosition} kind="lower-better" />}
            />
            <KpiCard
              label="Indexed Pages"
              value={fmtInt(o.indexedPages)}
              hint="In Google's index"
              icon={FileCheck2}
            />
            <KpiCard
              label="Not Indexed Pages"
              value={fmtInt(o.notIndexedPages)}
              hint="Excluded / pending"
              icon={FileX2}
            />
          </div>
        )}

        {/* SEO Opportunities table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#ff6b35]" />
                  SEO Opportunities
                </CardTitle>
                <CardDescription>
                  Pages with the highest upside, ranked by priority
                </CardDescription>
              </div>
              {rows.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {rows.length} opportunities
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {opportunities.isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading opportunities…
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-semibold mb-1">No opportunities found</p>
                <p className="text-sm">Great — no outstanding SEO issues detected.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Priority</th>
                      <th className="text-left p-3 font-medium">Page</th>
                      <th className="text-left p-3 font-medium">Issue</th>
                      <th className="text-right p-3 font-medium">Clicks</th>
                      <th className="text-right p-3 font-medium">Impressions</th>
                      <th className="text-right p-3 font-medium">CTR</th>
                      <th className="text-right p-3 font-medium">Position</th>
                      <th className="text-right p-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50 align-top">
                        <td className="p-3">
                          <PriorityBadge priority={r.priority} />
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-[#1e3a5f] whitespace-nowrap">{r.page}</span>
                        </td>
                        <td className="p-3 text-muted-foreground max-w-xs">{r.issue}</td>
                        <td className="p-3 text-right tabular-nums">{fmtInt(r.clicks)}</td>
                        <td className="p-3 text-right tabular-nums">{fmtInt(r.impressions)}</td>
                        <td className="p-3 text-right tabular-nums">{fmtPct(r.ctr, 2)}</td>
                        <td className="p-3 text-right tabular-nums">{fmtPos(r.position)}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#ff6b35] hover:text-[#ff6b35] hover:bg-[#ff6b35]/10 whitespace-nowrap"
                            onClick={() => toast.info(`"${r.action}" — action workflows coming soon`)}
                          >
                            {r.action}
                            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DashboardFooter />
    </div>
  );
}
