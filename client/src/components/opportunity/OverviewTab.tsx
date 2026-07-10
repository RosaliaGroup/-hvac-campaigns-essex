/** Overview view — headline KPIs, pipeline-by-stage, category totals, aging. */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { fmtMoney, STAGE_META, AGING_BADGE } from "./shared";
import { AGING_BUCKETS, type AgingBucket } from "@shared/opportunityDashboard";
import { workCategoryLabel, type WorkCategory } from "@shared/opportunityCategory";
import { DollarSign, Scale, Send, CalendarClock, Trophy, XCircle, Percent, Receipt, Timer } from "lucide-react";

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string; icon: React.ElementType; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Bar({ label, amount, max, className }: { label: string; amount: number; max: number; className: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((amount / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{fmtMoney(amount)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const { data: m, isLoading } = trpc.opportunities.overview.useQuery();

  if (isLoading || !m) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading overview…</p>;
  }

  const stageMax = Math.max(1, ...STAGE_META.map(s => (m.pipelineByStage as Record<string, number>)[s.value] ?? 0));
  const catEntries: [WorkCategory, number][] = [
    ["residential", m.categoryTotals.residential],
    ["commercial", m.categoryTotals.commercial],
    ["change_order", m.categoryTotals.change_order],
  ];
  const catMax = Math.max(1, ...catEntries.map(([, v]) => v));
  const agingMax = Math.max(1, ...AGING_BUCKETS.map(b => (m.agingBuckets as Record<string, { amount: number }>)[b].amount));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Open pipeline" value={fmtMoney(m.openPipeline)} icon={DollarSign} />
        <Kpi label="Weighted pipeline" value={fmtMoney(m.weightedPipeline)} icon={Scale} hint="value × probability" />
        <Kpi label="Estimates/proposals sent" value={String(m.sentCount)} icon={Send} />
        <Kpi label="Follow-ups due today" value={String(m.followUpsDueToday)} icon={CalendarClock} />
        <Kpi label="Close rate" value={`${Math.round(m.closeRate * 100)}%`} icon={Percent} />
        <Kpi label="Won this month" value={String(m.wonThisMonth)} icon={Trophy} hint={fmtMoney(m.wonValueThisMonth)} />
        <Kpi label="Lost this month" value={String(m.lostThisMonth)} icon={XCircle} />
        <Kpi label="Average ticket" value={fmtMoney(m.averageTicket)} icon={Receipt} />
        <Kpi label="Avg days to close" value={String(m.averageDaysToClose)} icon={Timer} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline dollars by stage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {STAGE_META.map(s => (
              <Bar key={s.value} label={s.label} amount={(m.pipelineByStage as Record<string, number>)[s.value] ?? 0} max={stageMax} className="bg-[#1e3a5f]" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open pipeline by work category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {catEntries.map(([cat, val]) => (
              <Bar key={cat} label={workCategoryLabel(cat)} amount={val} max={catMax} className="bg-violet-500" />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Aging (open, days pending)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {AGING_BUCKETS.map((b: AgingBucket) => {
              const bucket = (m.agingBuckets as Record<string, { count: number; amount: number }>)[b];
              return (
                <div key={b} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${AGING_BADGE[b]}`}>{b} days</span>
                    <span className="tabular-nums text-muted-foreground">{bucket.count} · {fmtMoney(bucket.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-orange-400" style={{ width: `${Math.max(2, Math.round((bucket.amount / agingMax) * 100))}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
