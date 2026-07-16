/** Operations dashboard — "Are we delivering quality work efficiently?" */
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Wrench, RotateCcw, FileSignature, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  KpiTile, ComingSoonTile, ChartCard, BarList, isComingSoon,
  ErrorBanner, DashboardSkeleton,
  fmtMoney, monthShort, type ExecFilters, type DrillTarget,
} from "./execShared";

export default function OperationsDashboard({
  filters, openDrill,
}: { filters: ExecFilters; openDrill: (t: DrillTarget) => void }) {
  const q = trpc.executiveDashboards.operations.useQuery(filters);
  if (q.isError) return <ErrorBanner onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <DashboardSkeleton />;
  const d = q.data;
  const trend = d.throughputTrend.map(r => r.completed);

  const techRows = (d?.technicians ?? [])
    .slice(0, 8)
    .map(t => ({ label: t.name, value: t.revenue, hint: `· ${t.jobCount}` }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Technician Revenue" icon={Wrench} accent="#1e3a5f"
          value={fmtMoney(d?.totalTechnicianRevenue ?? 0, true)}
          sub={d ? `${d.technicians.length} technicians` : undefined}
          footnote="Completed job line totals"
          onOpen={() => openDrill({ mode: "server", metric: "technician_revenue", title: "Technician revenue — completed jobs" })}
        />
        <KpiTile
          label="Jobs Completed" icon={CheckCircle2} accent="#ff6b35"
          value={String(d?.jobsCompleted ?? 0)}
          sub="Terminal-status jobs"
          trend={trend} footnote="Jobs module"
          onOpen={() => openDrill({ mode: "server", metric: "jobs_completed", title: "Completed jobs" })}
        />
        {isComingSoon(d?.callbackRate) ? (
          <ComingSoonTile label="Callback Rate" icon={RotateCcw} reason={d!.callbackRate.reason} />
        ) : (
          <ComingSoonTile label="Callback Rate" icon={RotateCcw} reason="No callback flag on jobs yet." />
        )}
        {isComingSoon(d?.activeAgreements) ? (
          <ComingSoonTile label="Active Agreements" icon={FileSignature} reason={d!.activeAgreements.reason} />
        ) : (
          <ComingSoonTile label="Active Agreements" icon={FileSignature} reason="Awaiting Agreements module." />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Revenue by technician" subtitle="Completed jobs · job count shown">
          <BarList rows={techRows} color="#1e3a5f" valueFormat={n => fmtMoney(n, true)} />
        </ChartCard>
        <ChartCard title="Throughput" subtitle="Jobs completed by month · last 12 months">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d?.throughputTrend ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="opsThru" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="month" tickFormatter={monthShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip labelFormatter={monthShort} />
                <Area type="monotone" dataKey="completed" stroke="#ff6b35" strokeWidth={2} fill="url(#opsThru)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
