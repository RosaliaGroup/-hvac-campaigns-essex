/**
 * Executive Dashboards — Sales / Marketing / Operations / Finance.
 *
 * Admin-only. Composes existing QuickBooks, Opportunities, Revenue Attribution
 * and Jobs data via the `executiveDashboards` + `attribution`/`googleAds`/`metaAds`
 * routers. Every KPI tile opens its underlying records (drill-down Sheet + CSV);
 * charts are drill-capable; date/technician/campaign/customer filters apply per
 * dashboard. KPIs without a data source render "Coming Soon" — never fabricated.
 */
import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { useAuth } from "@/_core/hooks/useAuth";
import { resolveNavRole } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, ShieldAlert, RefreshCw, Printer, Calendar, Users, Wrench, Megaphone, AlertTriangle,
} from "lucide-react";
import {
  DrilldownSheet, resolveRange, DATE_PRESETS,
  type DatePreset, type ExecFilters, type DrillTarget,
} from "@/components/executive/execShared";
import SalesDashboard from "@/components/executive/SalesDashboard";
import MarketingDashboard from "@/components/executive/MarketingDashboard";
import OperationsDashboard from "@/components/executive/OperationsDashboard";
import FinanceDashboard from "@/components/executive/FinanceDashboard";

type TabKey = "sales" | "marketing" | "operations" | "finance";
const TABS: { key: TabKey; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "marketing", label: "Marketing" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance" },
];
const CHANNELS = ["organic", "paid", "direct", "referral", "social", "email", "unknown"];
const CHANNEL_LABEL: Record<string, string> = {
  organic: "Organic / SEO", paid: "Paid", direct: "Direct", referral: "Referral",
  social: "Social", email: "Email", unknown: "Unknown",
};

const ALL = "__all__";

export default function ExecutiveDashboards() {
  const { loading, isAuthenticated, user } = useAuth();
  const isAdmin = resolveNavRole(user) === "admin";

  const [tab, setTab] = useState<TabKey>("sales");
  const [preset, setPreset] = useState<DatePreset>("last_90d");
  const [customerId, setCustomerId] = useState<number | undefined>();
  const [technicianId, setTechnicianId] = useState<number | undefined>();
  const [channel, setChannel] = useState<string>("organic");
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  const options = trpc.executiveDashboards.filterOptions.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });

  const range = useMemo(() => resolveRange(preset), [preset]);
  const filters: ExecFilters = useMemo(
    () => ({ ...range, customerId, technicianId: tab === "operations" ? technicianId : undefined }),
    [range, customerId, technicianId, tab],
  );

  // ── guards ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#ff6b35]" />
      </div>
    );
  }
  if (!isAuthenticated) return null;
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
                Executive dashboards are restricted to administrators. Ask an admin for access.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <DashboardFooter />
      </div>
    );
  }

  const showTechFilter = tab === "operations";
  const showChannelFilter = tab === "marketing";
  const dateApplies = tab !== "marketing"; // attribution revenue is lifetime/confirmed

  return (
    <DashboardLayout>
      <style>{`@media print {
        .exec-no-print { display: none !important; }
        .exec-print-area { padding: 0 !important; }
        body { background: #fff !important; }
      }`}</style>
      <div className="p-6 space-y-6 max-w-7xl mx-auto exec-print-area">
        <div className="exec-no-print"><InternalNav /></div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-[#ff6b35]" />
              Executive Dashboards
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sales, Marketing, Operations and Finance — from live QuickBooks, Opportunities, Attribution and Jobs data.
            </p>
          </div>
          <Button variant="outline" size="sm" className="exec-no-print" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Export PDF
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="exec-no-print">
          <TabsList>
            {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 exec-no-print">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={preset} onValueChange={v => setPreset(v as DatePreset)} disabled={!dateApplies}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={customerId ? String(customerId) : ALL}
              onValueChange={v => setCustomerId(v === ALL ? undefined : Number(v))}
            >
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue placeholder="All customers" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL}>All customers</SelectItem>
                {(options.data?.customers ?? []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showTechFilter && (
            <div className="flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={technicianId ? String(technicianId) : ALL}
                onValueChange={v => setTechnicianId(v === ALL ? undefined : Number(v))}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="All technicians" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>All technicians</SelectItem>
                  {(options.data?.technicians ?? []).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showChannelFilter && (
            <div className="flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c] ?? c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {!dateApplies && (
            <span className="text-[11px] text-muted-foreground italic">
              Attribution revenue is confirmed &amp; lifetime — date filter not applied here.
            </span>
          )}
          {options.isError && (
            <span className="text-[11px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Filter options failed to load — customer/technician lists may be incomplete.
            </span>
          )}
        </div>

        {/* Active dashboard */}
        <div>
          {tab === "sales" && <SalesDashboard filters={filters} openDrill={setDrill} />}
          {tab === "marketing" && <MarketingDashboard channel={channel} openDrill={setDrill} />}
          {tab === "operations" && <OperationsDashboard filters={filters} openDrill={setDrill} />}
          {tab === "finance" && <FinanceDashboard filters={filters} openDrill={setDrill} />}
        </div>
      </div>

      <DrilldownSheet target={drill} filters={filters} onClose={() => setDrill(null)} />
    </DashboardLayout>
  );
}
