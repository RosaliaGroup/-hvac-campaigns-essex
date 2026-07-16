/** Finance dashboard — "Are we profitable, and is it durable?" */
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, PieChart, TrendingUp, Repeat, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  KpiTile, ComingSoonTile, ChartCard, isComingSoon,
  ErrorBanner, DashboardSkeleton,
  fmtMoney, monthShort, type ExecFilters, type DrillTarget,
} from "./execShared";

export default function FinanceDashboard({
  filters, openDrill,
}: { filters: ExecFilters; openDrill: (t: DrillTarget) => void }) {
  const q = trpc.executiveDashboards.finance.useQuery(filters);
  if (q.isError) return <ErrorBanner onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <DashboardSkeleton />;
  const d = q.data;
  const trend = d.revenueTrend.map(r => r.invoiced);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {d && !d.hasInvoiceData ? (
          <ComingSoonTile
            label="Revenue (recognized)" icon={DollarSign}
            reason="QuickBooks invoice sync is not enabled, so no recognized-revenue records exist yet. Enable invoice sync to populate this."
          />
        ) : (
          <KpiTile
            label="Revenue (recognized)" icon={DollarSign} accent="#1e3a5f"
            value={fmtMoney(d?.recognizedRevenue ?? 0, true)}
            sub={d ? `${d.invoiceCount} invoices` : undefined}
            trend={trend} footnote="Paid/issued invoices · QuickBooks"
            onOpen={() => openDrill({ mode: "server", metric: "recognized_revenue", title: "Recognized revenue — invoices" })}
          />
        )}

        {isComingSoon(d?.grossProfit) ? (
          <ComingSoonTile label="Gross Profit" icon={PieChart} reason={d!.grossProfit.reason} />
        ) : (
          <ComingSoonTile label="Gross Profit" icon={PieChart} reason="Awaiting cost data." />
        )}

        <KpiTile
          label="Weighted Forecast" icon={TrendingUp} accent="#ff6b35"
          value={fmtMoney(d?.weightedForecast ?? 0, true)}
          sub="Open pipeline (forward)"
          footnote="Probability-weighted open value"
          onOpen={() => openDrill({ mode: "server", metric: "pipeline", title: "Forecast — open pipeline" })}
        />

        {isComingSoon(d?.recurringRevenue) ? (
          <ComingSoonTile label="Recurring Revenue (MRR)" icon={Repeat} reason={d!.recurringRevenue.reason} />
        ) : (
          <ComingSoonTile label="Recurring Revenue (MRR)" icon={Repeat} reason="Awaiting Agreements module." />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-t-4 border-t-[#1e3a5f]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Estimates outstanding</p>
            <p className="text-2xl font-bold text-[#1e3a5f]">{fmtMoney(d?.estimatesOutstanding ?? 0, true)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{d?.estimateCount ?? 0} open estimates</p>
            <button
              className="text-[10px] text-[#ff6b35] font-medium mt-2"
              onClick={() => openDrill({ mode: "server", metric: "estimates", title: "Outstanding estimates" })}
            >View data →</button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <ChartCard title="Recognized revenue" subtitle="Invoiced by month · last 12 months">
            {d && !d.hasInvoiceData ? (
              <div className="h-56 flex items-center justify-center text-center text-sm text-muted-foreground px-6">
                No invoice data yet. Recognized-revenue trend appears once QuickBooks invoice sync is enabled.
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d?.revenueTrend ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="finRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="month" tickFormatter={monthShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={n => fmtMoney(Number(n), true)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={monthShort} />
                    <Area type="monotone" dataKey="invoiced" stroke="#1e3a5f" strokeWidth={2} fill="url(#finRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
