import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, ExternalLink, Search, DollarSign, Target, Zap,
  Home, Building2, Wrench, AlertTriangle, CheckCircle, TrendingUp,
  RefreshCw, Send, BarChart3, Wifi, WifiOff, Loader2
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

interface AdGroup {
  name: string;
  keywords: string[];
  negativeKeywords: string[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  bid: string;
}

interface Campaign {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  budget: string;
  goal: string;
  targetCPA: string;
  geoTarget: string;
  adGroups: AdGroup[];
}

const campaigns: Campaign[] = [
  {
    id: "residential-rebates",
    name: "Residential Rebates & Heat Pumps",
    icon: Home,
    color: "bg-green-500",
    budget: "$50–$80/day",
    goal: "Lead form submissions",
    targetCPA: "$80–$120",
    geoTarget: "Essex, Morris, Union, Bergen, Passaic, Hudson Counties NJ",
    adGroups: [
      {
        name: "Heat Pump Rebates",
        keywords: [
          "heat pump rebates NJ",
          "NJ heat pump incentive",
          "heat pump installation Essex County NJ",
          "PSE&G heat pump rebate",
          "NJ clean energy heat pump",
          "heat pump rebate 2025 New Jersey",
          "heat pump rebates near me",
          "heat pump installation near me NJ",
        ],
        negativeKeywords: ["DIY", "how to", "YouTube", "manual", "parts only", "used", "cheap"],
        headlines: [
          "Up to $16K in Heat Pump Incentives",
          "NJ Heat Pump Rebates Available Now",
          "Free Quote – Heat Pump Installation",
          "PSE&G + Federal Incentives Stacked",
          "Essex County HVAC Specialists",
          "WMBE Certified HVAC Contractor",
          "20+ Years HVAC Experience NJ",
          "Heat Pump Install – Same Week",
          "Get Your Rebate Guide Free",
          "Serving 15 NJ Counties",
          "Licensed & Insured HVAC Pros",
          "VRV/VRF System Experts",
        ],
        descriptions: [
          "Stack PSE&G, NJ Clean Energy & federal incentives for up to $16K back. Free in-home estimate. Call (862) 419-1763.",
          "WMBE/SBE certified HVAC contractor. Over 4,000 residential installations. Get your free quote today.",
          "Authorized dealer for top HVAC brands. Expert heat pump installation across 15 NJ counties. Book now.",
          "Don't leave money on the table. Our team handles all rebate paperwork for you. Free consultation.",
        ],
        finalUrl: "https://mechanicalenterprise.com/residential",
        bid: "$8–$14 CPC",
      },
      {
        name: "AC Installation & Replacement",
        keywords: [
          "AC installation Essex County NJ",
          "central air conditioning installation NJ",
          "new AC unit installation NJ",
          "air conditioner replacement NJ",
          "HVAC installation near me",
          "central air install cost NJ",
          "AC replacement near me Essex County",
        ],
        negativeKeywords: ["repair", "fix", "broken", "not working", "DIY", "window unit"],
        headlines: [
          "New AC Installation – Free Quote",
          "Central Air Install Essex County NJ",
          "Energy-Efficient AC Systems",
          "AC Replacement – Same Week Service",
          "Top HVAC Brands – Best Prices",
          "Licensed AC Installers NJ",
          "Financing Available – 0% Interest",
          "Free In-Home AC Assessment",
        ],
        descriptions: [
          "Expert central air conditioning installation across Essex County and 14 other NJ counties. Free estimates.",
          "Energy-efficient systems with available financing. WMBE certified. Over 20 years experience. Call today.",
          "Authorized dealer for premium HVAC brands. Professional installation with full warranty. Get a quote.",
          "Beat the summer heat. Fast installation, competitive pricing, and rebate assistance. Book your free visit.",
        ],
        finalUrl: "https://mechanicalenterprise.com/residential",
        bid: "$7–$12 CPC",
      },
      {
        name: "Emergency HVAC Service",
        keywords: [
          "emergency HVAC repair NJ",
          "24/7 HVAC repair Essex County",
          "furnace not working NJ",
          "AC not working emergency NJ",
          "HVAC emergency service near me",
          "heating emergency NJ",
          "no heat NJ emergency",
        ],
        negativeKeywords: ["DIY", "how to fix", "YouTube", "parts"],
        headlines: [
          "24/7 Emergency HVAC Service NJ",
          "Furnace Not Working? Call Now",
          "Same-Day HVAC Repair Essex County",
          "Emergency AC Repair – Fast Response",
          "No Heat? We Fix It Today",
          "HVAC Emergency – (862) 419-1763",
        ],
        descriptions: [
          "24/7 emergency HVAC service across Essex County and surrounding NJ areas. Fast response. Call (862) 419-1763.",
          "Furnace or AC emergency? Our licensed technicians are on call. Same-day service available. Call now.",
        ],
        finalUrl: "https://mechanicalenterprise.com/contact",
        bid: "$12–$20 CPC",
      },
    ],
  },
  {
    id: "commercial-hvac",
    name: "Commercial HVAC & VRV/VRF Systems",
    icon: Building2,
    color: "bg-blue-500",
    budget: "$60–$100/day",
    goal: "Lead form submissions + calls",
    targetCPA: "$120–$200",
    geoTarget: "All 15 NJ Counties + NYC Metro",
    adGroups: [
      {
        name: "Commercial HVAC Installation",
        keywords: [
          "commercial HVAC installation NJ",
          "commercial air conditioning NJ",
          "commercial HVAC contractor Essex County",
          "office building HVAC NJ",
          "commercial heating cooling NJ",
          "commercial HVAC company New Jersey",
          "industrial HVAC NJ",
          "hotel HVAC system NJ",
        ],
        negativeKeywords: ["residential", "home", "house", "DIY", "repair parts"],
        headlines: [
          "Commercial HVAC – Up to 80% Rebates",
          "VRV/VRF System Specialists NJ",
          "Commercial HVAC Installation NJ",
          "2.6M Sq Ft Commercial Experience",
          "Hotels, Offices, Retail HVAC NJ",
          "WMBE Certified Commercial HVAC",
          "BMS Integration Specialists",
          "Free Commercial HVAC Assessment",
          "JCP&L Commercial Rebates Available",
        ],
        descriptions: [
          "Commercial HVAC incentives up to 80% available. VRV/VRF specialists with BMS integration expertise. Free assessment.",
          "2.6 million sq ft of commercial space served. Hotels, restaurants, healthcare, office buildings. Call (862) 419-1763.",
          "WMBE/SBE certified. Authorized commercial HVAC dealer. JCP&L and utility incentives available. Get a quote.",
          "Expert commercial HVAC design, installation, and commissioning. BIM technology. Serving all 15 NJ counties.",
        ],
        finalUrl: "https://mechanicalenterprise.com/commercial",
        bid: "$10–$18 CPC",
      },
      {
        name: "VRV/VRF Systems",
        keywords: [
          "VRV system installation NJ",
          "VRF system NJ",
          "variable refrigerant flow NJ",
          "Daikin VRV NJ",
          "multi-zone HVAC NJ",
          "VRF heat pump NJ",
          "VRV HVAC contractor New Jersey",
        ],
        negativeKeywords: ["DIY", "repair", "parts", "used"],
        headlines: [
          "VRV/VRF System Specialists NJ",
          "Multi-Zone HVAC – Expert Install",
          "Daikin VRV Authorized Dealer NJ",
          "Energy-Efficient VRF Systems",
          "VRV Install – Free Site Survey",
          "Smart Building HVAC Integration",
        ],
        descriptions: [
          "VRV/VRF system specialists with BMS and BIM technology expertise. Multi-zone climate control for commercial properties.",
          "Authorized VRV/VRF dealer and installer. Energy-efficient solutions with up to 80% commercial incentives available.",
        ],
        finalUrl: "https://mechanicalenterprise.com/commercial",
        bid: "$9–$16 CPC",
      },
      {
        name: "HVAC Maintenance Contracts",
        keywords: [
          "commercial HVAC maintenance contract NJ",
          "HVAC preventive maintenance NJ",
          "HVAC service contract Essex County",
          "commercial HVAC service plan NJ",
          "HVAC maintenance company NJ",
        ],
        negativeKeywords: ["residential", "home", "DIY"],
        headlines: [
          "Commercial HVAC Maintenance Plans",
          "Preventive HVAC Service NJ",
          "HVAC Service Contracts – Save Money",
          "Keep Systems Running Efficiently",
          "Annual HVAC Maintenance NJ",
        ],
        descriptions: [
          "Commercial HVAC maintenance contracts that prevent costly breakdowns. Serving NJ businesses for 20+ years.",
          "Preventive maintenance programs, emergency priority service, and running tests. Protect your HVAC investment.",
        ],
        finalUrl: "https://mechanicalenterprise.com/maintenance",
        bid: "$7–$12 CPC",
      },
    ],
  },
  {
    id: "brand-awareness",
    name: "Brand & Local Awareness",
    icon: TrendingUp,
    color: "bg-orange-500",
    budget: "$20–$40/day",
    goal: "Website visits + brand recall",
    targetCPA: "$30–$60",
    geoTarget: "Essex County + 10-mile radius",
    adGroups: [
      {
        name: "Mechanical Enterprise Brand",
        keywords: [
          "Mechanical Enterprise HVAC NJ",
          "mechanical enterprise essex county",
          "HVAC contractor Essex County NJ",
          "best HVAC company NJ",
          "top rated HVAC NJ",
          "HVAC company near me Essex County",
          "local HVAC contractor NJ",
        ],
        negativeKeywords: ["cheap", "free", "DIY"],
        headlines: [
          "Mechanical Enterprise – HVAC NJ",
          "Essex County's Trusted HVAC Pros",
          "WMBE Certified – 20+ Years NJ",
          "Top Rated HVAC Company NJ",
          "Local HVAC Experts – Free Quote",
        ],
        descriptions: [
          "Mechanical Enterprise – WMBE/SBE certified HVAC specialists serving Essex County and 14 other NJ counties.",
          "20+ years of HVAC excellence. 4,000+ residential installs. 2.6M sq ft commercial. Call (862) 419-1763.",
        ],
        finalUrl: "https://mechanicalenterprise.com",
        bid: "$4–$8 CPC",
      },
    ],
  },
];

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard!`);
}

function AdGroupCard({ group }: { group: AdGroup }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-[#1e3a5f]">{group.name}</CardTitle>
          <Badge variant="outline" className="text-xs">{group.bid}</Badge>
        </div>
        <CardDescription>Final URL: <span className="font-mono text-xs">{group.finalUrl}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Keywords */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-green-700">Keywords ({group.keywords.length})</p>
            <Button
              size="sm" variant="ghost" className="h-6 text-xs"
              onClick={() => copyToClipboard(group.keywords.join("\n"), "Keywords")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy All
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {group.keywords.map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-green-50 text-green-800 text-xs rounded border border-green-200">{kw}</span>
            ))}
          </div>
        </div>

        {/* Negative Keywords */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-red-700">Negative Keywords</p>
            <Button
              size="sm" variant="ghost" className="h-6 text-xs"
              onClick={() => copyToClipboard(group.negativeKeywords.join("\n"), "Negative Keywords")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {group.negativeKeywords.map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-50 text-red-800 text-xs rounded border border-red-200">{kw}</span>
            ))}
          </div>
        </div>

        {/* Headlines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-blue-700">Headlines ({group.headlines.length}/15 max)</p>
            <Button
              size="sm" variant="ghost" className="h-6 text-xs"
              onClick={() => copyToClipboard(group.headlines.join("\n"), "Headlines")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy All
            </Button>
          </div>
          <div className="space-y-1">
            {group.headlines.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-blue-50 px-3 py-1.5 rounded text-sm">
                <span className="text-blue-900">{h}</span>
                <span className="text-xs text-blue-400 ml-2">{h.length}/30</span>
              </div>
            ))}
          </div>
        </div>

        {/* Descriptions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-purple-700">Descriptions ({group.descriptions.length}/4 max)</p>
            <Button
              size="sm" variant="ghost" className="h-6 text-xs"
              onClick={() => copyToClipboard(group.descriptions.join("\n\n"), "Descriptions")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy All
            </Button>
          </div>
          <div className="space-y-2">
            {group.descriptions.map((d, i) => (
              <div key={i} className="flex items-start justify-between bg-purple-50 px-3 py-2 rounded text-sm">
                <span className="text-purple-900 flex-1">{d}</span>
                <span className="text-xs text-purple-400 ml-2 whitespace-nowrap">{d.length}/90</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoogleAdsCampaigns() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(campaigns[0].id);
  const [pushingCampaign, setPushingCampaign] = useState<string | null>(null);
  // Budget dialog state
  const [budgetDialog, setBudgetDialog] = useState<{ open: boolean; campaign: Campaign | null }>({ open: false, campaign: null });
  const [dailyBudget, setDailyBudget] = useState<string>("50");

  // Google Ads API hooks
  const { data: connectionStatus, refetch: refetchStatus } = trpc.googleAds.getConnectionStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: performanceData, isLoading: perfLoading, refetch: refetchPerf } = trpc.googleAds.getCampaignPerformance.useQuery(
    undefined,
    { enabled: !!(isAuthenticated && connectionStatus?.connected) }
  );
  const { data: summaryData } = trpc.googleAds.getAccountSummary.useQuery(
    undefined,
    { enabled: !!(isAuthenticated && connectionStatus?.connected) }
  );
  const getAuthUrl = trpc.googleAds.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/api/oauth/google-ads/callback` },
    { enabled: isAuthenticated }
  );

  // Handle redirect back from Google OAuth
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const connectedParam = searchParams.get("connected");
  const errorParam = searchParams.get("error");
  useState(() => {
    if (connectedParam === "1") {
      toast.success("Google Ads connected successfully! Live data will appear shortly.");
      refetchStatus();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (errorParam) {
      toast.error(`Google Ads connection failed: ${errorParam}. Please try again.`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  });

  const createCampaign = trpc.googleAds.createCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`Campaign pushed to Google Ads! ID: ${data.campaignId}. It is paused — enable it in Google Ads when ready.`);
      setPushingCampaign(null);
    },
    onError: (err) => {
      toast.error(`Failed to push campaign: ${err.message}`);
      setPushingCampaign(null);
    },
  });

  const handleConnect = () => {
    if (getAuthUrl.data?.url) {
      window.location.href = getAuthUrl.data.url;
    }
  };

  const handlePushCampaign = (campaign: Campaign) => {
    // Open budget dialog first so user can set/adjust budget before pushing
    setBudgetDialog({ open: true, campaign });
    setDailyBudget("50");
  };

  const handleConfirmPush = () => {
    const campaign = budgetDialog.campaign;
    if (!campaign) return;
    const budget = parseFloat(dailyBudget);
    if (isNaN(budget) || budget < 0) {
      toast.error("Please enter a valid daily budget ($0 or more)");
      return;
    }
    const firstGroup = campaign.adGroups[0];
    setBudgetDialog({ open: false, campaign: null });
    setPushingCampaign(campaign.id);
    createCampaign.mutate({
      name: `ME - ${campaign.name}`,
      dailyBudget: budget,
      keywords: firstGroup.keywords,
      headlines: firstGroup.headlines,
      descriptions: firstGroup.descriptions,
      finalUrl: firstGroup.finalUrl.startsWith("http") ? firstGroup.finalUrl : `https://mechanicalenterprise.com${firstGroup.finalUrl}`,
      geoTargetNames: ["New Jersey"],
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const activeCampaign = campaigns.find(c => c.id === activeTab)!;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm flex-shrink-0">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Admin Portal
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
                  <Search className="h-6 w-6 text-[#ff6b35]" />
                  Google Ads Campaigns
                </h1>
                <p className="text-sm text-muted-foreground">Ready-to-launch campaigns for Mechanical Enterprise</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {connectionStatus?.connected ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                  <Wifi className="h-3 w-3" /> Google Ads Connected
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  className="border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35]/10"
                  onClick={handleConnect}
                >
                  <WifiOff className="h-4 w-4 mr-2" /> Connect Google Ads
                </Button>
              )}
              <Button
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                onClick={() => window.open("https://ads.google.com/aw/campaigns?ocid=332572004900", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Open Google Ads
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="container py-4">
        {/* Live Performance Panel */}
        {connectionStatus?.connected && (
          <Card className="mb-6 border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Live Google Ads Performance (Last 30 Days)
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { refetchPerf(); refetchStatus(); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {perfLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading live data...
                </div>
              ) : summaryData?.summary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {[
                      { label: "Impressions", value: summaryData.summary.impressions.toLocaleString(), color: "text-blue-600" },
                      { label: "Clicks", value: summaryData.summary.clicks.toLocaleString(), color: "text-[#ff6b35]" },
                      { label: "Spend", value: `$${summaryData.summary.cost.toFixed(2)}`, color: "text-red-600" },
                      { label: "Conversions", value: summaryData.summary.conversions.toFixed(1), color: "text-green-600" },
                      { label: "CTR", value: `${(summaryData.summary.ctr * 100).toFixed(2)}%`, color: "text-purple-600" },
                      { label: "Avg CPC", value: `$${summaryData.summary.avgCpc.toFixed(2)}`, color: "text-[#1e3a5f]" },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-3 bg-white rounded-lg border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  {performanceData?.campaigns && performanceData.campaigns.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium text-muted-foreground">Campaign</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Status</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Impressions</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Clicks</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Spend</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">Conversions</th>
                            <th className="text-right py-2 font-medium text-muted-foreground">CPC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performanceData.campaigns.map(c => (
                            <tr key={c.id} className="border-b hover:bg-white/50">
                              <td className="py-2 font-medium">{c.name}</td>
                              <td className="py-2 text-right">
                                <Badge variant={c.status === 2 ? "default" : "secondary"} className="text-xs">
                                  {c.status === 2 ? "Active" : "Paused"}
                                </Badge>
                              </td>
                              <td className="py-2 text-right">{c.impressions.toLocaleString()}</td>
                              <td className="py-2 text-right">{c.clicks.toLocaleString()}</td>
                              <td className="py-2 text-right">${c.cost.toFixed(2)}</td>
                              <td className="py-2 text-right">{c.conversions.toFixed(1)}</td>
                              <td className="py-2 text-right">${c.avgCpc.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No performance data available for the last 30 days.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Campaign Overview Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {campaigns.map(campaign => (
            <Card
              key={campaign.id}
              className={`cursor-pointer transition-all ${activeTab === campaign.id ? "ring-2 ring-[#ff6b35] shadow-lg" : "hover:shadow-md"}`}
              onClick={() => setActiveTab(campaign.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`${campaign.color} p-2 rounded-lg`}>
                    <campaign.icon className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-base">{campaign.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span><strong>Budget:</strong> {campaign.budget}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span><strong>Target CPA:</strong> {campaign.targetCPA}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <span><strong>Ad Groups:</strong> {campaign.adGroups.length}</span>
                </div>
                {connectionStatus?.connected && (
                  <Button
                    size="sm"
                    className="w-full mt-2 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
                    disabled={pushingCampaign === campaign.id}
                    onClick={(e) => { e.stopPropagation(); handlePushCampaign(campaign); }}
                  >
                    {pushingCampaign === campaign.id ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pushing...</>
                    ) : (
                      <><Send className="h-3 w-3 mr-1" /> Push to Google Ads</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign Detail */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`${activeCampaign.color} p-2 rounded-lg`}>
                <activeCampaign.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">{activeCampaign.name}</CardTitle>
                <CardDescription>{activeCampaign.geoTarget}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg mb-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Daily Budget</p>
                <p className="text-lg font-bold text-[#1e3a5f]">{activeCampaign.budget}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Campaign Goal</p>
                <p className="text-sm font-semibold text-[#1e3a5f]">{activeCampaign.goal}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Target CPA</p>
                <p className="text-lg font-bold text-green-600">{activeCampaign.targetCPA}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ad Groups</p>
                <p className="text-lg font-bold text-blue-600">{activeCampaign.adGroups.length}</p>
              </div>
            </div>

            {/* Ad Groups */}
            <Tabs defaultValue={activeCampaign.adGroups[0].name}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                {activeCampaign.adGroups.map(group => (
                  <TabsTrigger key={group.name} value={group.name} className="text-xs">
                    {group.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {activeCampaign.adGroups.map(group => (
                <TabsContent key={group.name} value={group.name}>
                  <AdGroupCard group={group} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Setup Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Google Ads Setup Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3">Before You Launch</h3>
                <div className="space-y-2 text-sm">
                  {[
                    "Create Google Ads account at ads.google.com",
                    "Link to Google Analytics for conversion tracking",
                    "Add conversion tracking tag (AW-17768263516) — already on site",
                    "Set up billing with credit card",
                    "Verify business address for location extensions",
                    "Add phone number (862) 419-1763 as call extension",
                    "Upload logo for responsive display ads",
                    "Set geo-targeting to Essex + surrounding NJ counties",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded border-2 border-slate-300 flex-shrink-0 mt-0.5"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#1e3a5f] mb-3">Ad Extensions to Add</h3>
                <div className="space-y-2 text-sm">
                  {[
                    "Call extension: (862) 419-1763",
                    "Location extension: Essex County, NJ service area",
                    "Sitelink: Residential Rebates → /residential",
                    "Sitelink: Commercial HVAC → /commercial",
                    "Sitelink: Get a Free Quote → /contact",
                    "Sitelink: Rebate Guide → /rebate-guide",
                    "Callout: WMBE/SBE Certified",
                    "Callout: 20+ Years Experience",
                    "Callout: 24/7 Emergency Service",
                    "Callout: Free In-Home Estimates",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded border-2 border-slate-300 flex-shrink-0 mt-0.5"></div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800">Recommended Starting Budget</p>
                  <p className="text-amber-700 mt-1">
                    Start with <strong>$100–$150/day total</strong> across all three campaigns for the first 2 weeks to gather data.
                    At $9–$12 average CPC, expect 10–15 clicks/day per campaign and 3–5 leads/week initially.
                    Scale up campaigns that show cost-per-lead under $120.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Confirmation Dialog */}
      <Dialog open={budgetDialog.open} onOpenChange={(open) => setBudgetDialog({ open, campaign: budgetDialog.campaign })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#ff6b35]" />
              Set Daily Budget
            </DialogTitle>
            <DialogDescription>
              Set the daily budget for <strong>{budgetDialog.campaign?.name}</strong> before pushing to Google Ads.
              The campaign will be created as <strong>paused</strong> — you enable it in Google Ads when ready.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="daily-budget">Daily Budget (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  id="daily-budget"
                  type="number"
                  min="1"
                  step="5"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className="pl-7"
                  placeholder="50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: <strong>$50–$100/day</strong> for search campaigns. At $9–$12 avg CPC, expect 5–10 clicks/day.
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0, 25, 50, 75, 100].map(amt => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setDailyBudget(String(amt))}
                  className={dailyBudget === String(amt) ? "border-[#ff6b35] text-[#ff6b35]" : ""}
                >
                  ${amt}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBudgetDialog({ open: false, campaign: null })}>
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
              onClick={handleConfirmPush}
            >
              <Send className="h-4 w-4 mr-2" />
              Push to Google Ads — ${dailyBudget}/day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
