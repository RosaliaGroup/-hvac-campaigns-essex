import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, FileText, Globe, ExternalLink, Search, Download,
  TrendingUp, Users, Calendar, RefreshCw, CheckCircle, Clock,
  Megaphone, Mail, Link2, ArrowUpRight, AlertCircle, Zap
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { blogPosts } from "@/data/blogPosts";
import { directInstallIndustries } from "@/data/directInstallIndustries";
import { campaignTemplates } from "@/data/campaignTemplates";
import { directInstallCampaigns } from "@/data/directInstallCampaigns";

// ── Constants ──────────────────────────────────────────────────────────────

const SITE = "https://mechanicalenterprise.com";
const GSC_BASE = "https://search.google.com/search-console";
const GSC_INSPECT = (url: string) =>
  `${GSC_BASE}/inspect?resource_id=${encodeURIComponent(SITE)}&id=${encodeURIComponent(url)}`;

type SectionTab = "leads" | "seo" | "campaigns" | "indexing";

// ── SEO Page List Builder ──────────────────────────────────────────────────

type PageEntry = {
  title: string;
  url: string;
  type: "Blog" | "Direct Install" | "City" | "Core";
  indexed: boolean;
};

function buildPageList(): PageEntry[] {
  const pages: PageEntry[] = [];

  // Blog posts
  blogPosts.forEach(p => {
    pages.push({
      title: p.title,
      url: `${SITE}/blog/${p.slug}`,
      type: "Blog",
      indexed: true,
    });
  });

  // Direct install industries
  directInstallIndustries.forEach(ind => {
    pages.push({
      title: `${ind.industry} — Direct Install NJ`,
      url: `${SITE}/direct-install/${ind.slug}`,
      type: "Direct Install",
      indexed: true,
    });
  });

  // Core pages
  const corePages = [
    { title: "Home", path: "/" },
    { title: "Residential", path: "/residential" },
    { title: "Commercial", path: "/commercial" },
    { title: "Rebate Calculator", path: "/rebate-calculator" },
    { title: "Services", path: "/services" },
    { title: "About", path: "/about" },
    { title: "Contact", path: "/contact" },
    { title: "Careers", path: "/careers" },
    { title: "Maintenance", path: "/maintenance" },
    { title: "Partnerships", path: "/partnerships" },
    { title: "Testimonials", path: "/testimonials" },
    { title: "Rebate Guide", path: "/rebate-guide" },
    { title: "Blog Index", path: "/blog" },
    { title: "Direct Install Index", path: "/direct-install" },
  ];
  corePages.forEach(p => {
    pages.push({ title: p.title, url: `${SITE}${p.path}`, type: "Core", indexed: true });
  });

  return pages;
}

// ── Campaign List Builder ──────────────────────────────────────────────────

type CampaignEntry = {
  name: string;
  platform: string;
  type: string;
  status: string;
  budget: string;
  landingPage: string;
};

function buildCampaignList(): CampaignEntry[] {
  const campaigns: CampaignEntry[] = [];

  campaignTemplates.forEach(c => {
    campaigns.push({
      name: c.name,
      platform: c.platform.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      type: c.category,
      status: "ready",
      budget: c.estimatedBudget || "—",
      landingPage: "",
    });
  });

  directInstallCampaigns.forEach(c => {
    campaigns.push({
      name: c.name,
      platform: c.platform.join(", "),
      type: c.type,
      status: c.status,
      budget: `$${c.budget_monthly}/mo`,
      landingPage: c.landing_page ? `${SITE}${c.landing_page}` : "",
    });
  });

  return campaigns;
}

// ── Source labels for lead panel ────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  exit_popup: "Exit Popup",
  inline_form: "Inline Form",
  newsletter: "Newsletter",
  quick_quote: "Quick Quote",
  qualify_form: "Qualify Form",
  scroll_popup_residential: "Residential Scroll",
  scroll_popup_commercial: "Commercial Scroll",
  exit_popup_residential: "Residential Popup",
  exit_popup_commercial: "Commercial Popup",
  lp_heat_pump: "Heat Pump LP",
  lp_commercial_vrv: "Commercial VRV LP",
  lp_emergency: "Emergency LP",
  lp_fb_residential: "FB Residential LP",
  lp_fb_commercial: "FB Commercial LP",
  lp_rebate_guide: "Rebate Guide LP",
  lp_maintenance: "Maintenance LP",
  career_application: "Career Application",
  partnership_inquiry: "Partnership Inquiry",
};

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = "border-t-[#1e3a5f]",
  valueColor = "text-[#1e3a5f]",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  valueColor?: string;
}) {
  return (
    <Card className={`border-t-4 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/20" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Platform pill color helper ─────────────────────────────────────────────

function platformPill(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("google")) return "bg-blue-100 text-blue-700";
  if (p.includes("facebook") || p.includes("instagram") || p.includes("meta")) return "bg-indigo-100 text-indigo-700";
  if (p.includes("linkedin")) return "bg-sky-100 text-sky-700";
  if (p.includes("nextdoor")) return "bg-green-100 text-green-700";
  if (p.includes("email")) return "bg-amber-100 text-amber-700";
  if (p.includes("youtube")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function statusPill(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "ready") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL 1 — SEO & BLOG PERFORMANCE
// ════════════════════════════════════════════════════════════════════════════

function SEOPanel() {
  const [filter, setFilter] = useState<"all" | "Blog" | "Direct Install" | "City" | "Core">("all");
  const pages = useMemo(() => buildPageList(), []);

  const blogCount = blogPosts.length;
  const diCount = directInstallIndustries.length;
  const cityCount = 88;
  const totalIndexed = 193;

  const filtered = filter === "all" ? pages : pages.filter(p => p.type === filter);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Blog Posts" value={blogCount} icon={FileText} color="border-t-[#ff6b35]" valueColor="text-[#ff6b35]" />
        <StatCard label="Direct Install Pages" value={diCount} icon={Globe} color="border-t-blue-500" valueColor="text-blue-600" />
        <StatCard label="City Pages" value={cityCount} icon={Globe} color="border-t-purple-500" valueColor="text-purple-600" />
        <StatCard label="Total Indexed" value={totalIndexed} icon={CheckCircle} color="border-t-green-500" valueColor="text-green-600" />
        <Card className="border-t-4 border-t-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sitemap Status</p>
                <Badge className="bg-green-100 text-green-700 mt-1">Success</Badge>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({pages.length})</TabsTrigger>
          <TabsTrigger value="Blog">Blog ({blogCount})</TabsTrigger>
          <TabsTrigger value="Direct Install">Direct Install ({diCount})</TabsTrigger>
          <TabsTrigger value="City">City Pages</TabsTrigger>
          <TabsTrigger value="Core">Core Pages</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Page Title</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((page, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <div className="font-medium truncate max-w-xs">{page.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{page.url.replace(SITE, "")}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{page.type}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={page.indexed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                        {page.indexed ? "Indexed" : "Pending"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(GSC_INSPECT(page.url), "_blank")}
                        >
                          <Search className="h-3 w-3" /> Check GSC
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(page.url, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" /> View Live
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 50 && (
            <div className="p-3 text-center text-sm text-muted-foreground border-t">
              Showing 50 of {filtered.length} pages
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL 2 — CAMPAIGN TRACKER
// ════════════════════════════════════════════════════════════════════════════

function CampaignsPanel() {
  const [filter, setFilter] = useState("all");
  const campaigns = useMemo(() => buildCampaignList(), []);

  const totalCampaigns = campaigns.length;
  const googleCount = campaigns.filter(c => c.platform.toLowerCase().includes("google")).length;
  const nonprofitCount = campaigns.filter(c => c.type === "nonprofit" || c.type === "lighting").length;
  const diCount = directInstallCampaigns.length;

  const filtered = useMemo(() => {
    if (filter === "all") return campaigns;
    if (filter === "google") return campaigns.filter(c => c.platform.toLowerCase().includes("google"));
    if (filter === "facebook") return campaigns.filter(c => c.platform.toLowerCase().includes("facebook") || c.platform.toLowerCase().includes("instagram"));
    if (filter === "linkedin") return campaigns.filter(c => c.platform.toLowerCase().includes("linkedin"));
    if (filter === "nonprofit") return campaigns.filter(c => c.type === "nonprofit");
    if (filter === "lighting") return campaigns.filter(c => c.type === "lighting");
    if (filter === "commercial") return campaigns.filter(c => c.type === "commercial");
    if (filter === "ready") return campaigns.filter(c => c.status === "ready");
    return campaigns;
  }, [campaigns, filter]);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Campaigns" value={totalCampaigns} icon={Megaphone} color="border-t-[#1e3a5f]" valueColor="text-[#1e3a5f]" />
        <StatCard label="Google Search" value={googleCount} icon={Search} color="border-t-blue-500" valueColor="text-blue-600" />
        <StatCard label="Nonprofit/Lighting" value={nonprofitCount} icon={Zap} color="border-t-purple-500" valueColor="text-purple-600" />
        <StatCard label="Direct Install" value={diCount} icon={Globe} color="border-t-green-500" valueColor="text-green-600" />
        <StatCard label="Currently Live" value="$0" icon={TrendingUp} color="border-t-[#ff6b35]" valueColor="text-[#ff6b35]" />
      </div>

      {/* Launch buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90 gap-2"
          onClick={() => window.open("https://ads.google.com", "_blank")}
        >
          <ArrowUpRight className="h-4 w-4" /> Launch Google Ads
        </Button>
        <Button
          variant="outline"
          className="gap-2 border-[#1e3a5f] text-[#1e3a5f]"
          onClick={() => window.open("/facebook-campaigns", "_self")}
        >
          <Link2 className="h-4 w-4" /> Connect Meta
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            const link = document.createElement("a");
            link.href = "/google-ads-import.csv";
            link.download = "google-ads-import.csv";
            link.click();
          }}
        >
          <Download className="h-4 w-4" /> Download Google Ads CSV
        </Button>
      </div>

      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            <strong>Import to Google Ads:</strong> Download CSV → Open Google Ads Editor → Account → Import → From CSV
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Pending Meta + Google credentials — $0 currently live spend
          </p>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({totalCampaigns})</TabsTrigger>
          <TabsTrigger value="google">Google</TabsTrigger>
          <TabsTrigger value="facebook">Facebook</TabsTrigger>
          <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
          <TabsTrigger value="nonprofit">Nonprofit</TabsTrigger>
          <TabsTrigger value="lighting">Lighting</TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="ready">Ready to Launch</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Platform</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Budget</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((c, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <span className="font-medium truncate max-w-xs block">{c.name}</span>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-xs ${platformPill(c.platform)}`}>{c.platform}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.type}</td>
                    <td className="p-3">
                      <Badge className={`text-xs ${statusPill(c.status)}`}>{c.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.budget}</td>
                    <td className="p-3 text-right">
                      {c.landingPage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => window.open(c.landingPage, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3" /> View Page
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 50 && (
            <div className="p-3 text-center text-sm text-muted-foreground border-t">
              Showing 50 of {filtered.length} campaigns
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL 3 — LEAD CAPTURE REPORT
// ════════════════════════════════════════════════════════════════════════════

function LeadsPanel() {
  const { data: analytics, isLoading, refetch } = trpc.leadCaptures.analytics.useQuery();

  const handleExportCSV = () => {
    if (!analytics?.recentLeads?.length) return;
    const headers = ["Name", "Phone", "Email", "Source", "Page URL", "Date"];
    const rows = analytics.recentLeads.map((l: any) => [
      l.name || [l.firstName, l.lastName].filter(Boolean).join(" ") || "",
      l.phone || "",
      l.email || "",
      l.captureType || "",
      l.pageUrl || "",
      new Date(l.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading lead data...</span>
      </div>
    );
  }

  const hasLeads = analytics && analytics.allTime > 0;

  return (
    <div className="space-y-6">
      {/* Time-based stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leads Today" value={analytics?.today ?? 0} icon={Zap} color="border-t-[#ff6b35]" valueColor="text-[#ff6b35]" />
        <StatCard label="This Week" value={analytics?.thisWeek ?? 0} icon={Calendar} color="border-t-blue-500" valueColor="text-blue-600" />
        <StatCard label="This Month" value={analytics?.thisMonth ?? 0} icon={TrendingUp} color="border-t-purple-500" valueColor="text-purple-600" />
        <StatCard label="All Time" value={analytics?.allTime ?? 0} icon={Users} color="border-t-[#1e3a5f]" valueColor="text-[#1e3a5f]" />
      </div>

      {!hasLeads ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-[#1e3a5f]">No leads yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Your first lead will appear here the moment someone submits a form.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bar chart — leads per day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#1e3a5f]" />
                Leads Per Day (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dailyCounts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d: string) => {
                        const dt = new Date(d + "T00:00:00");
                        return `${dt.getMonth() + 1}/${dt.getDate()}`;
                      }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Source breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#1e3a5f]" />
                Leads by Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(analytics.bySource as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const pct = analytics.allTime > 0 ? Math.max(0, Math.round((count / analytics.allTime) * 100)) : 0;
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-40 truncate text-muted-foreground">
                          {SOURCE_LABELS[source] || source}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className="bg-[#1e3a5f] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold w-8 text-right">{count}</span>
                        <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Recent leads table */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-[#1e3a5f]" />
                Recent Leads
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => refetch()}>
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={handleExportCSV}>
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Page</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.recentLeads ?? []).map((lead: any) => (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium">
                          {lead.name || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email?.split("@")[0] || "Anonymous"}
                        </td>
                        <td className="p-3">
                          {lead.phone ? (
                            <a href={`tel:${lead.phone}`} className="text-[#ff6b35] hover:underline">{lead.phone}</a>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          {lead.email ? (
                            <a href={`mailto:${lead.email}`} className="text-[#1e3a5f] hover:underline text-xs">{lead.email}</a>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[lead.captureType] || lead.captureType}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {lead.pageUrl ? (
                            <a href={lead.pageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[150px] block">
                              {lead.pageUrl.replace(/^https?:\/\/[^/]+/, "")}
                            </a>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PANEL 4 — SITEMAP & INDEXING STATUS
// ════════════════════════════════════════════════════════════════════════════

const PRIORITY_PAGES = [
  { title: "NJ Direct Install Program Commercial Guide", path: "/blog/nj-direct-install-program-commercial-guide" },
  { title: "Commercial Lighting 100% Free NJ", path: "/blog/commercial-lighting-100-percent-free-nj" },
  { title: "Nonprofit Direct Install Complete Guide NJ", path: "/blog/nonprofit-direct-install-complete-guide-nj" },
  { title: "Churches NJ — Direct Install", path: "/direct-install/churches-nj" },
  { title: "Warehouses NJ — Direct Install", path: "/direct-install/warehouses-nj" },
];

function IndexingPanel() {
  return (
    <div className="space-y-6">
      {/* Sitemap health cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total URLs in Sitemap" value={193} icon={Globe} color="border-t-[#1e3a5f]" valueColor="text-[#1e3a5f]" />
        <StatCard label="Last Updated" value="Apr 1, 2026" icon={Calendar} color="border-t-blue-500" valueColor="text-blue-600" />
        <Card className="border-t-4 border-t-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">GSC Status</p>
                <Badge className="bg-green-100 text-green-700 mt-1">Success</Badge>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <StatCard label="Discovered Pages" value={193} icon={Search} color="border-t-purple-500" valueColor="text-purple-600" />
      </div>

      {/* Quick action buttons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`${SITE}/sitemap.xml`, "_blank")}
            >
              <FileText className="h-4 w-4" /> View Sitemap XML
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(GSC_BASE, "_blank")}
            >
              <Search className="h-4 w-4" /> Open Search Console
            </Button>
            <Button
              className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90 gap-2"
              onClick={() => window.open(`${GSC_BASE}/sitemaps?resource_id=${encodeURIComponent(SITE)}`, "_blank")}
            >
              <RefreshCw className="h-4 w-4" /> Resubmit Sitemap
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Priority page inspector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#ff6b35]" />
            High-Priority URL Inspector
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {PRIORITY_PAGES.map((page, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                <div>
                  <p className="text-sm font-medium">{page.title}</p>
                  <p className="text-xs text-muted-foreground">mechanicalenterprise.com{page.path}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => window.open(GSC_INSPECT(`${SITE}${page.path}`), "_blank")}
                  >
                    <Search className="h-3 w-3" /> Inspect URL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => window.open(`${SITE}${page.path}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" /> View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function AnalyticsReports() {
  const [activeSection, setActiveSection] = useState<SectionTab>("leads");

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <InternalNav />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            SEO performance, campaign tracking, lead capture analytics, and indexing status
          </p>
        </div>

        {/* Section tabs */}
        <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as SectionTab)}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="leads" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Leads
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> SEO & Blogs
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="h-3.5 w-3.5" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="indexing" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Indexing
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Panel content */}
        {activeSection === "leads" && <LeadsPanel />}
        {activeSection === "seo" && <SEOPanel />}
        {activeSection === "campaigns" && <CampaignsPanel />}
        {activeSection === "indexing" && <IndexingPanel />}
      </div>
    </DashboardLayout>
  );
}
