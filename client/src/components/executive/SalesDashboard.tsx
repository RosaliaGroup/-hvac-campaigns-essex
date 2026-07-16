/** Sales dashboard — "Are we winning enough of the right work?" */
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Target, TrendingUp, FileSignature } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  KpiTile, ComingSoonTile, ChartCard, BarList, isComingSoon,
  ErrorBanner, DashboardSkeleton,
  fmtMoney, fmtPct, monthShort, type ExecFilters, type DrillTarget,
} from "./execShared";

const STAGE_LABEL: Record<string, string> = {
  new: "New", proposal_sent: "Proposal sent", pending: "Pending", won: "Won", lost: "Lost",
};
const OPEN_ORDER = ["new", "proposal_sent", "pending"];

export default function SalesDashboard({
  filters, openDrill,
}: { filters: ExecFilters; openDrill: (t: DrillTarget) => void }) {
  const q = trpc.executiveDashboards.sales.useQuery(filters);
  if (q.isError) return <ErrorBanner onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <DashboardSkeleton />;
  const d = q.data;
  const trend = d.revenueTrend.map(r => r.revenue);

  const funnelRows = OPEN_ORDER
    .map(stage => d?.pipelineByStage.find(s => s.stage === stage))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map(s => ({ label: STAGE_LABEL[s.stage] ?? s.stage, value: s.value, hint: `· ${s.count}` }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Booked Revenue" icon={DollarSign} accent="#1e3a5f"
          value={fmtMoney(d?.bookedRevenue ?? 0, true)}
          sub={d ? `${d.wonCount} won · avg ${fmtMoney(d.averageTicket, true)}` : undefined}
          trend={trend} footnote="Won opportunities · CRM"
          onOpen={() => openDrill({ mode: "server", metric: "booked_revenue", title: "Booked revenue — won opportunities" })}
        />
        <KpiTile
          label="Close Rate" icon={Target} accent="#ff6b35"
          value={fmtPct(d?.closeRate ?? 0)}
          sub={d ? `${d.wonCount} won / ${d.wonCount + d.lostCount} closed` : undefined}
          footnote="Won ÷ (won + lost)"
          onOpen={() => openDrill({ mode: "server", metric: "close_rate", title: "Close rate — closed opportunities" })}
        />
        <KpiTile
          label="Weighted Pipeline" icon={TrendingUp} accent="#1e3a5f"
          value={fmtMoney(d?.weightedPipeline ?? 0, true)}
          sub={d ? `${fmtMoney(d.openPipeline, true)} open` : undefined}
          footnote="Open value × stage probability"
          onOpen={() => openDrill({ mode: "server", metric: "pipeline", title: "Open pipeline — opportunities" })}
        />
        {isComingSoon(d?.newMaintenanceAgreements) ? (
          <ComingSoonTile label="New Maintenance Agreements" icon={FileSignature} reason={d!.newMaintenanceAgreements.reason} />
        ) : (
          <ComingSoonTile label="New Maintenance Agreements" icon={FileSignature} reason="Awaiting Agreements module." />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Open pipeline funnel" subtitle="Open stages by value · count shown">
          <BarList rows={funnelRows} color="#1e3a5f" valueFormat={n => fmtMoney(n, true)} />
        </ChartCard>
        <ChartCard title="Booked revenue" subtitle="Won revenue by month · last 12 months">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d?.revenueTrend ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="month" tickFormatter={monthShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={n => fmtMoney(Number(n), true)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={monthShort} />
                <Area type="monotone" dataKey="revenue" stroke="#1e3a5f" strokeWidth={2} fill="url(#salesRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
