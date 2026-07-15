import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { toast } from "sonner";
import {
  TrendingUp,
  Users,
  UserCheck,
  CalendarCheck,
  FileText,
  Trophy,
  DollarSign,
  HelpCircle,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Info,
} from "lucide-react";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat("en-US").format(n || 0);

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Icon className="h-4 w-4 text-[#ff6b35]" />
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-[#1e3a5f]">{value}</div>
        {sub ? <div className="text-xs text-muted-foreground mt-0.5">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function RevenueAttribution() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [showInferred, setShowInferred] = useState(false);
  const args = { inferenceWindowDays: showInferred ? 180 : 0, weeklyLeadGoal: 20 };

  const overview = trpc.attribution.getOverview.useQuery(args, { enabled: isAuthenticated });
  const bySource = trpc.attribution.getBySource.useQuery(args, { enabled: isAuthenticated });
  const byPage = trpc.attribution.getByLandingPage.useQuery(args, { enabled: isAuthenticated });
  const funnel = trpc.attribution.getFunnel.useQuery({ channel: "organic" }, { enabled: isAuthenticated });
  const unattributed = trpc.attribution.getUnattributed.useQuery(args, { enabled: isAuthenticated });
  const suggestions = trpc.attribution.getSuggestedMatches.useQuery(undefined, { enabled: isAuthenticated && isAdmin });

  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.href = getLoginUrl();
  }, [loading, isAuthenticated]);

  const invalidate = () => {
    utils.attribution.getOverview.invalidate();
    utils.attribution.getBySource.invalidate();
    utils.attribution.getByLandingPage.invalidate();
    utils.attribution.getUnattributed.invalidate();
    utils.attribution.getSuggestedMatches.invalidate();
  };

  const link = trpc.attribution.linkOpportunityToLeadCapture.useMutation({
    onSuccess: () => { toast.success("Attribution link saved"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const unlink = trpc.attribution.unlinkOpportunityAttribution.useMutation({
    onSuccess: () => { toast.success("Attribution link removed"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const o = overview.data;
  const weekly = o?.weekly;
  const weeklyPct = weekly ? Math.min(100, Math.round((weekly.qualifiedLeadsLast7Days / weekly.goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-secondary/30">
      <InternalNav />
      <div className="container py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-[#ff6b35]" />
              Revenue Attribution
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Does organic traffic turn into leads, estimates, won work, and revenue? Reporting is{" "}
              <strong>confirmed-only</strong> by default — revenue is credited to a page or source only when an explicit
              lead→deal link exists. Everything else is preserved honestly as <em>unattributed</em>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox checked={showInferred} onCheckedChange={(v) => setShowInferred(Boolean(v))} />
              Include inferred (low-confidence)
            </label>
            <Button variant="outline" size="sm" onClick={() => { overview.refetch(); bySource.refetch(); byPage.refetch(); funnel.refetch(); unattributed.refetch(); if (isAdmin) suggestions.refetch(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {showInferred && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            Inferred attribution is a low-confidence heuristic (customer + timing). It is shown separately and never
            merged into confirmed revenue.
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi icon={Users} label="Organic Leads" value={num(o?.organicLeads ?? 0)} />
          <Kpi icon={UserCheck} label="Qualified Organic" value={num(o?.qualifiedOrganicLeads ?? 0)} />
          <Kpi icon={CalendarCheck} label="Appointments" value={num(o?.appointments ?? 0)} sub="organic cohort" />
          <Kpi icon={FileText} label="Estimates" value={num(o?.estimates ?? 0)} sub="organic cohort" />
          <Kpi icon={Trophy} label="Won Jobs" value={num(o?.wonJobs ?? 0)} sub="organic cohort" />
          <Kpi icon={DollarSign} label="Invoiced Revenue" value={usd(o?.invoicedRevenue ?? 0)} sub="organic cohort" />
          <Kpi icon={ShieldCheck} label="Confirmed Attributed" value={usd(o?.confirmedAttributedRevenue ?? 0)} sub="explicit links only" />
          <Kpi icon={HelpCircle} label="Unattributed Leads" value={num(o?.unattributedLeads ?? 0)} sub={`${usd(o?.unattributedRevenue ?? 0)} won`} />
        </div>

        {/* Weekly goal */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#ff6b35]" /> Progress toward 20 qualified leads / week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekly ? (
              <div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold text-[#1e3a5f]">
                    {weekly.qualifiedLeadsLast7Days} <span className="text-base font-normal text-muted-foreground">/ {weekly.goal}</span>
                  </span>
                  <Badge className={weekly.metGoal ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                    {weekly.metGoal ? "Goal met" : `${weekly.goal - weekly.qualifiedLeadsLast7Days} to go`}
                  </Badge>
                </div>
                <Progress value={weeklyPct} />
                <p className="text-xs text-muted-foreground mt-1">Qualified leads captured in the last 7 days (all channels).</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue by Source */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Revenue by Source</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Channel</th><th className="py-2 px-2 text-right">Leads</th>
                    <th className="py-2 px-2 text-right">Confirmed</th><th className="py-2 pl-2 text-right">Inferred</th>
                  </tr>
                </thead>
                <tbody>
                  {(bySource.data?.rows ?? []).filter(r => r.leads || r.confirmedRevenue || r.inferredRevenue).map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2 pr-2 capitalize">{r.key}</td>
                      <td className="py-2 px-2 text-right">{num(r.leads)}</td>
                      <td className="py-2 px-2 text-right font-medium">{usd(r.confirmedRevenue)}</td>
                      <td className="py-2 pl-2 text-right text-muted-foreground">{usd(r.inferredRevenue)}</td>
                    </tr>
                  ))}
                  {!bySource.isLoading && !(bySource.data?.rows ?? []).some(r => r.leads || r.confirmedRevenue) && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No leads captured yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Revenue by Landing Page */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Revenue by Landing Page</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Page</th><th className="py-2 px-2 text-right">Organic Clicks</th>
                    <th className="py-2 px-2 text-right">Leads</th><th className="py-2 pl-2 text-right">Confirmed</th>
                  </tr>
                </thead>
                <tbody>
                  {(byPage.data?.rows ?? []).filter(r => r.leads || r.organicClicks || r.confirmedRevenue).slice(0, 25).map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2 pr-2 max-w-[220px] truncate" title={r.key}>{r.key}</td>
                      <td className="py-2 px-2 text-right">{num(r.organicClicks)}</td>
                      <td className="py-2 px-2 text-right">{num(r.leads)}</td>
                      <td className="py-2 pl-2 text-right font-medium">{usd(r.confirmedRevenue)}</td>
                    </tr>
                  ))}
                  {!byPage.isLoading && !(byPage.data?.rows ?? []).some(r => r.leads || r.organicClicks) && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No landing-page data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Funnel */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Organic Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">{funnel.data?.basis}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Leads", value: num(funnel.data?.leads ?? 0) },
                { label: "Appointments", value: num(funnel.data?.appointments ?? 0) },
                { label: "Estimates", value: num(funnel.data?.estimates ?? 0) },
                { label: "Won Jobs", value: num(funnel.data?.wonJobs ?? 0) },
                { label: "Invoiced", value: usd(funnel.data?.invoicedRevenue ?? 0) },
              ].map((s, i) => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <div className="text-xl font-bold text-[#1e3a5f]">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{i + 1}. {s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Admin: suggested matches */}
        {isAdmin && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#ff6b35]" /> Suggested Matches (admin)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Conservative suggestions from established identifiers + timing. Nothing is linked automatically — review
                confidence and rationale, then link manually. {suggestions.data ? `${suggestions.data.suggestions.length} suggested · ${suggestions.data.alreadyLinkedCount} already linked · ${suggestions.data.unmatchedCount} unmatched.` : ""}
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {suggestions.isLoading ? (
                <div className="py-6 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
              ) : (suggestions.data?.suggestions.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-sm">No conservative suggestions. Unmatched deals stay unattributed.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Opportunity</th><th className="py-2 px-2">Confidence</th>
                      <th className="py-2 px-2">Source</th><th className="py-2 px-2">Rationale</th>
                      <th className="py-2 px-2 text-right">Amount</th><th className="py-2 pl-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.data!.suggestions.map((s) => (
                      <tr key={s.opportunityId} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{s.opportunityTitle}</div>
                          <div className="text-xs text-muted-foreground">#{s.opportunityId} → capture #{s.leadCaptureId}</div>
                        </td>
                        <td className="py-2 px-2"><Badge variant="outline" className={CONFIDENCE_STYLE[s.confidence]}>{s.confidence}</Badge></td>
                        <td className="py-2 px-2 capitalize">{s.channel}<div className="text-xs text-muted-foreground truncate max-w-[140px]" title={s.landingPath ?? ""}>{s.landingPath}</div></td>
                        <td className="py-2 px-2 max-w-[280px]">
                          <ul className="text-xs text-muted-foreground list-disc pl-4">{s.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </td>
                        <td className="py-2 px-2 text-right">{usd(s.amount)}</td>
                        <td className="py-2 pl-2 text-right">
                          <Button size="sm" variant="outline" disabled={link.isPending}
                            onClick={() => link.mutate({ opportunityId: s.opportunityId, leadCaptureId: s.leadCaptureId })}>
                            <Link2 className="h-3.5 w-3.5 mr-1" /> Link
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Unattributed */}
        <Card className="mb-6">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4 text-muted-foreground" /> Unattributed</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div><div className="text-2xl font-bold text-[#1e3a5f]">{num(unattributed.data?.wonCount ?? 0)}</div><div className="text-xs text-muted-foreground">won deals with no honest link</div></div>
              <div><div className="text-2xl font-bold text-[#1e3a5f]">{usd(unattributed.data?.revenue ?? 0)}</div><div className="text-xs text-muted-foreground">unattributed won revenue</div></div>
              <div><div className="text-2xl font-bold text-[#1e3a5f]">{num(unattributed.data?.unknownChannelLeads ?? 0)}</div><div className="text-xs text-muted-foreground">leads with unknown channel</div></div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{unattributed.data?.note}</p>
            {isAdmin && (unattributed.data?.opportunityIds.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {unattributed.data!.opportunityIds.slice(0, 20).map((id) => (
                  <Button key={id} size="sm" variant="ghost" className="text-xs" disabled={unlink.isPending}
                    onClick={() => unlink.mutate({ opportunityId: id })} title="Clear any link (keep unattributed)">
                    <Unlink className="h-3 w-3 mr-1" /> #{id}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <DashboardFooter />
      </div>
    </div>
  );
}
