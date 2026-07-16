/**
 * Marketing dashboard — "Which spend actually produces revenue?"
 *
 * Composed entirely from EXISTING routers: `attribution` (confirmed, honest-unknown
 * revenue attribution) + `googleAds`/`metaAds` (live ad spend & leads). Cost-per-lead,
 * cost-per-appointment and ROAS need an ad connection; without one they render
 * "Coming Soon" rather than a fabricated number.
 *
 * Note: attribution revenue is confirmed & lifetime — the global date filter does
 * not scope it (surfaced in the tile footnotes).
 */
import { DollarSign, UserPlus, CalendarCheck, Gauge, Megaphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  KpiTile, ComingSoonTile, ChartCard, BarList,
  ErrorBanner, DashboardSkeleton,
  fmtMoney, fmtMult, type DrillTarget, type DrillColumn,
} from "./execShared";

const CHANNEL_LABEL: Record<string, string> = {
  organic: "Organic / SEO", paid: "Paid", direct: "Direct", referral: "Referral",
  social: "Social", email: "Email", unknown: "Unknown", all: "All channels",
};

export default function MarketingDashboard({
  channel, openDrill,
}: { channel: string; openDrill: (t: DrillTarget) => void }) {
  const overview = trpc.attribution.getOverview.useQuery({});
  const bySource = trpc.attribution.getBySource.useQuery({});
  const funnel = trpc.attribution.getFunnel.useQuery({ channel: channel as never });

  const gStatus = trpc.googleAds.getConnectionStatus.useQuery();
  const gSummary = trpc.googleAds.getAccountSummary.useQuery(undefined, { enabled: !!gStatus.data?.connected });
  const mStatus = trpc.metaAds.getConnectionStatus.useQuery();
  const mPerf = trpc.metaAds.getCampaignPerformance.useQuery(undefined, { enabled: !!mStatus.data?.connected });

  // Gate on the attribution queries only. Ad-platform queries degrade gracefully
  // to "Coming Soon" tiles, so their loading/failure must not blank the dashboard.
  if (overview.isError || bySource.isError || funnel.isError)
    return <ErrorBanner onRetry={() => { overview.refetch(); bySource.refetch(); funnel.refetch(); }} />;
  if (overview.isLoading || bySource.isLoading || funnel.isLoading || !overview.data || !bySource.data || !funnel.data)
    return <DashboardSkeleton />;

  const adConnected = !!gStatus.data?.connected || !!mStatus.data?.connected;
  const googleSpend = gSummary.data?.summary?.cost ?? 0;
  const googleLeads = gSummary.data?.summary?.conversions ?? 0;
  const metaCampaigns: Array<{ spend?: number; conversions?: number }> = mPerf.data?.campaigns ?? [];
  const metaSpend = metaCampaigns.reduce((a, c) => a + Number(c.spend ?? 0), 0);
  const metaLeads = metaCampaigns.reduce((a, c) => a + Number(c.conversions ?? 0), 0);
  const totalSpend = googleSpend + metaSpend;
  const totalAdLeads = googleLeads + metaLeads;

  const campaignRevenue = overview.data?.confirmedAttributedRevenue ?? 0;
  const appointments = overview.data?.appointments ?? 0;
  const cpl = adConnected && totalAdLeads > 0 && totalSpend > 0 ? totalSpend / totalAdLeads : null;
  const cpa = adConnected && appointments > 0 && totalSpend > 0 ? totalSpend / appointments : null;
  const roas = adConnected && totalSpend > 0 ? campaignRevenue / totalSpend : null;

  const channelRows = (bySource.data?.rows ?? [])
    .map(r => ({ label: CHANNEL_LABEL[r.key] ?? r.key, value: Number(r.confirmedRevenue ?? 0), hint: `· ${r.leads} leads` }))
    .filter(r => r.value > 0 || true)
    .sort((a, b) => b.value - a.value);

  const channelDrillCols: DrillColumn[] = [
    { key: "channel", label: "Channel", type: "text" },
    { key: "leads", label: "Leads", type: "number" },
    { key: "confirmedWon", label: "Won", type: "number" },
    { key: "confirmedRevenue", label: "Confirmed revenue", type: "money" },
  ];
  const channelDrillRows = (bySource.data?.rows ?? []).map(r => ({
    channel: CHANNEL_LABEL[r.key] ?? r.key,
    leads: r.leads, confirmedWon: r.confirmedWon, confirmedRevenue: Number(r.confirmedRevenue ?? 0),
  }));

  const adReason = "Connect Google Ads or Meta Ads (Marketing → integrations) to compute cost metrics. No ad-spend source is connected, so this stays blank rather than showing an invented figure.";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Campaign Revenue" icon={DollarSign} accent="#1e3a5f"
          value={fmtMoney(campaignRevenue, true)}
          sub={overview.data ? `${overview.data.wonJobs} attributed won` : undefined}
          footnote="Confirmed attribution · lifetime"
          onOpen={() => openDrill({ mode: "static", title: "Campaign revenue by channel", columns: channelDrillCols, rows: channelDrillRows, description: "Confirmed attributed revenue grouped by channel (honest-unknown model)." })}
        />
        {cpl == null ? (
          <ComingSoonTile label="Cost per Lead" icon={UserPlus} reason={adReason} />
        ) : (
          <KpiTile label="Cost per Lead" icon={UserPlus} accent="#ff6b35" lowerBetter
            value={fmtMoney(cpl)} sub={`${totalAdLeads} ad leads`} footnote="Ad spend ÷ ad-reported leads" />
        )}
        {cpa == null ? (
          <ComingSoonTile label="Cost per Appointment" icon={CalendarCheck} reason={adReason} />
        ) : (
          <KpiTile label="Cost per Appointment" icon={CalendarCheck} accent="#ff6b35" lowerBetter
            value={fmtMoney(cpa)} sub={`${appointments} appointments`} footnote="Ad spend ÷ attributed appointments" />
        )}
        {roas == null ? (
          <ComingSoonTile label="Return on Ad Spend" icon={Gauge} reason={adReason} />
        ) : (
          <KpiTile label="Return on Ad Spend" icon={Gauge} accent="#1e3a5f"
            value={fmtMult(roas)} sub={`${fmtMoney(totalSpend, true)} spend`} footnote="Attributed revenue ÷ spend" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Attributed revenue by channel"
          subtitle="Confirmed revenue · honest-unknown bucket included"
          action={<Megaphone className="h-4 w-4 text-muted-foreground/40" />}
        >
          <BarList rows={channelRows} color="#1e3a5f" valueFormat={n => fmtMoney(n, true)} />
        </ChartCard>
        <ChartCard title={`Conversion funnel — ${CHANNEL_LABEL[channel] ?? channel}`} subtitle="Cohort leads → appointments → estimates → won">
          <BarList
            color="#ff6b35"
            valueFormat={n => String(n)}
            rows={funnel.data ? [
              { label: "Leads", value: funnel.data.leads },
              { label: "Appointments", value: funnel.data.appointments },
              { label: "Estimates", value: funnel.data.estimates },
              { label: "Won jobs", value: funnel.data.wonJobs },
            ] : []}
          />
          {funnel.data && (
            <p className="text-[11px] text-muted-foreground mt-3">
              Invoiced revenue for this cohort: <span className="font-medium text-[#1e3a5f]">{fmtMoney(funnel.data.invoicedRevenue, true)}</span>
            </p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
