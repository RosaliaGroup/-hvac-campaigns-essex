import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import InternalNav from "@/components/InternalNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Rocket, DollarSign, MapPin, Users, CheckCircle2, AlertCircle,
  Loader2, ExternalLink, RefreshCw, Eye, ChevronDown, ChevronUp,
  Info, Settings, Facebook, LogIn, Clock, Target, TrendingUp, Building2, Star,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface FbCampaignDef {
  id: string;
  name: string;
  tagline: string;
  objective: "OUTCOME_LEADS" | "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS";
  dailyBudget: number;
  color: string;
  ageMin: number;
  ageMax: number;
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
  websiteUrl: string;
  interests: Array<{ id: string; name: string }>;
  audienceSummary: string;
  recommended?: boolean;
  estimatedCpl: string;
  projectedLeads: string;
}

const CAMPAIGNS: FbCampaignDef[] = [
  {
    id: "no-catch",
    name: "ME — No Catch | NJ Homeowners",
    tagline: "High-trust PSE&G rebate awareness — zero friction CTA",
    objective: "OUTCOME_LEADS",
    dailyBudget: 5,
    color: "bg-emerald-500",
    ageMin: 35,
    ageMax: 65,
    headline: "PSE&G Is Paying Up to $20,000 to Replace Your Furnace.",
    primaryText:
      "No catch. No salesperson. Just a free 20-minute assessment that tells you exactly what your home qualifies for. We handle all the PSE&G paperwork — you don't fill out a single form.",
    description: "Free assessment. Real numbers. Zero obligation.",
    callToAction: "LEARN_MORE",
    websiteUrl: "https://mechanicalenterprise.com/rebate-calculator",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
      { id: "6003397425735", name: "Energy conservation" },
    ],
    audienceSummary: "NJ statewide · Homeowners 35–65 · Home improvement interests",
    recommended: true,
    estimatedCpl: "$8–12",
    projectedLeads: "12–18",
  },
  {
    id: "do-the-math",
    name: "ME — Do The Math | NJ Homeowners",
    tagline: "Cost comparison hook — gas vs heat pump savings",
    objective: "OUTCOME_LEADS",
    dailyBudget: 3,
    color: "bg-blue-500",
    ageMin: 38,
    ageMax: 62,
    headline: "Gas Bill $300/mo. Heat Pump Bill $80/mo.",
    primaryText:
      "PSE&G covers up to $18,000. We add up to $2,000 for qualifying clients. Monthly payment as low as $0 with on-bill repayment. Free 20-min assessment — no obligation.",
    description: "See your actual savings. Free assessment.",
    callToAction: "GET_QUOTE",
    websiteUrl: "https://mechanicalenterprise.com/rebate-calculator",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
      { id: "6003397425735", name: "Energy conservation" },
      { id: "6003107902433", name: "Saving money" },
    ],
    audienceSummary: "Essex, Hudson, Bergen, Passaic counties · 38–62 · Savings & utility interests",
    estimatedCpl: "$10–15",
    projectedLeads: "6–9",
  },
  {
    id: "neighbors-did-it",
    name: "ME — Neighbors Did It | Essex County",
    tagline: "Social proof — real local family success story",
    objective: "OUTCOME_LEADS",
    dailyBudget: 2,
    color: "bg-purple-500",
    ageMin: 35,
    ageMax: 65,
    headline: "West Orange Family Replaced Their Furnace for $0.",
    primaryText:
      "PSE&G covered $18,000. We added $2,000. They paid nothing and we handled every form. If your system is 8+ years old you likely qualify too. Free 20-minute assessment.",
    description: "Free assessment. We handle the paperwork.",
    callToAction: "LEARN_MORE",
    websiteUrl: "https://mechanicalenterprise.com/rebate-calculator",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
    ],
    audienceSummary: "Essex County only (Newark, Montclair, West Orange, Bloomfield, Maplewood, Livingston) · 35–65",
    estimatedCpl: "$7–11",
    projectedLeads: "5–8",
  },
  {
    id: "pseg-rebate-help",
    name: "ME — PSE&G Rebate Help | NJ",
    tagline: "Capture people researching PSE&G rebates right now",
    objective: "OUTCOME_LEADS",
    dailyBudget: 2,
    color: "bg-orange-500",
    ageMin: 35,
    ageMax: 65,
    headline: "Researching PSE&G Rebates? We Handle the Whole Application.",
    primaryText:
      "Most people visit PSE&G's website, get overwhelmed, and never claim their rebate. We are a certified PSE&G contractor. We assess your home free and file every form. Up to $20,000 combined.",
    description: "Certified PSE&G contractor. Free assessment.",
    callToAction: "LEARN_MORE",
    websiteUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
      { id: "6003397425735", name: "Energy conservation" },
    ],
    audienceSummary: "NJ statewide · 35–70 · PSE&G, utility company & government rebate interests",
    estimatedCpl: "$6–10",
    projectedLeads: "6–10",
  },
  {
    id: "commercial-80-off",
    name: "ME — Commercial 80% Off | NJ Business Owners",
    tagline: "NJ Direct Install Program — commercial HVAC & lighting",
    objective: "OUTCOME_LEADS",
    dailyBudget: 3,
    color: "bg-slate-700",
    ageMin: 30,
    ageMax: 65,
    headline: "NJ Direct Install: 80% of Commercial HVAC Covered. Lighting 100% Free.",
    primaryText:
      "If you own a commercial building in NJ, the Direct Install Program covers up to 80% of HVAC replacement and 100% of lighting — no upfront cost. Free 30-minute commercial assessment. We handle all applications.",
    description: "Free commercial assessment. No paperwork for you.",
    callToAction: "LEARN_MORE",
    websiteUrl: "https://mechanicalenterprise.com/commercial",
    interests: [
      { id: "6003384750085", name: "Real estate" },
      { id: "6003269798979", name: "Heating, ventilation, and air conditioning" },
    ],
    audienceSummary: "NJ statewide · 30–65 · Business owners, property managers, facilities managers",
    estimatedCpl: "$12–20",
    projectedLeads: "4–7",
  },
];

// Summary projections
const TOTAL_BUDGET = CAMPAIGNS.reduce((s, c) => s + c.dailyBudget, 0);
const PROJECTED_LEADS_LOW = 33;
const PROJECTED_LEADS_HIGH = 52;
const PROJECTED_INSTALLS_LOW = Math.round(PROJECTED_LEADS_LOW * 0.25);
const PROJECTED_INSTALLS_HIGH = Math.round(PROJECTED_LEADS_HIGH * 0.25);

export default function FacebookAdsCampaigns() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmCampaign, setConfirmCampaign] = useState<FbCampaignDef | null>(null);
  const [launched, setLaunched] = useState<Record<string, { campaignId: string }>>({});
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [launchingAll, setLaunchingAll] = useState(false);
  const [launchCooldown, setLaunchCooldown] = useState(false);
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // Handle ?connected=1 or ?error= from OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("connected") === "1") {
      toast.success("Meta Ads connected successfully!", {
        description: "Now enter your Ad Account ID and Page ID to finish setup.",
        duration: 6000,
      });
      setShowSetup(true);
      setSetupStep(2);
      setLocation("/facebook-campaigns", { replace: true });
    } else if (params.get("error")) {
      toast.error("Meta Ads connection failed", {
        description: params.get("error") === "missing_code"
          ? "No authorization code received from Facebook."
          : "Authentication failed. Please try again.",
        duration: 8000,
      });
      setLocation("/facebook-campaigns", { replace: true });
    }
  }, [searchString, setLocation]);

  const { data: connStatus, isLoading: connLoading, refetch: refetchConn } =
    trpc.metaAds.getConnectionStatus.useQuery();

  const { data: perfData, isLoading: perfLoading, refetch: refetchPerf } =
    trpc.metaAds.getCampaignPerformance.useQuery(undefined, {
      enabled: connStatus?.connected === true,
      retry: false,
    });

  const saveConfig = trpc.metaAds.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration saved!");
      setShowSetup(false);
      refetchConn();
    },
    onError: (err) => toast.error("Failed to save config", { description: err.message }),
  });

  const createCampaign = trpc.metaAds.createCampaign.useMutation({
    onSuccess: (result, variables) => {
      const camp = CAMPAIGNS.find((c) => c.name === variables.name);
      if (camp) {
        setLaunched((prev) => ({ ...prev, [camp.id]: { campaignId: result.campaignId } }));
      }
      toast.success(`Campaign created! ID: ${result.campaignId}`, {
        description: "It's paused in Meta Ads Manager. Enable it when ready to go live.",
        duration: 8000,
      });
      setConfirmCampaign(null);
    },
    onError: (err) => {
      toast.error("Failed to create campaign", { description: err.message, duration: 10000 });
      setConfirmCampaign(null);
      setLaunchingAll(false);
    },
  });

  async function handleConfirm() {
    if (!confirmCampaign) return;
    // Check if campaign already exists in Meta
    try {
      const perf = await refetchPerf();
      const existing = perf.data?.campaigns?.find(
        (c: { name: string }) => c.name === confirmCampaign.name
      );
      if (existing) {
        const camp = CAMPAIGNS.find((c) => c.name === confirmCampaign.name);
        if (camp) setLaunched((prev) => ({ ...prev, [camp.id]: { campaignId: "existing" } }));
        toast.info(`"${confirmCampaign.name}" already exists in Meta Ads Manager`);
        setConfirmCampaign(null);
        return;
      }
    } catch {
      // If fetch fails, proceed with creation
    }
    createCampaign.mutate({
      name: confirmCampaign.name,
      objective: confirmCampaign.objective,
      dailyBudget: confirmCampaign.dailyBudget,
      headline: confirmCampaign.headline,
      primaryText: confirmCampaign.primaryText,
      description: confirmCampaign.description,
      callToAction: confirmCampaign.callToAction,
      websiteUrl: confirmCampaign.websiteUrl,
    });
  }

  async function handleLaunchAll() {
    if (!isConnected) {
      toast.error("Connect Meta Ads first.");
      return;
    }
    if (launchingAll || launchCooldown) return;
    setLaunchingAll(true);
    setLaunchCooldown(true);
    setTimeout(() => setLaunchCooldown(false), 30000);

    // Fetch existing campaigns from Meta to avoid duplicates
    let existingNames = new Set<string>();
    try {
      const perf = await refetchPerf();
      if (perf.data?.campaigns) {
        existingNames = new Set(perf.data.campaigns.map((c: { name: string }) => c.name));
      }
    } catch {
      // If fetch fails, proceed — createCampaign will just create them
    }

    const unlaunched = CAMPAIGNS.filter((c) => !launched[c.id]);
    for (const camp of unlaunched) {
      if (existingNames.has(camp.name)) {
        setLaunched((prev) => ({ ...prev, [camp.id]: { campaignId: "existing" } }));
        toast.info(`"${camp.name}" already exists — skipped`);
        continue;
      }
      try {
        await createCampaign.mutateAsync({
          name: camp.name,
          objective: camp.objective,
          dailyBudget: camp.dailyBudget,
          headline: camp.headline,
          primaryText: camp.primaryText,
          description: camp.description,
          callToAction: camp.callToAction,
          websiteUrl: camp.websiteUrl,
        });
      } catch {
        // Error toast already shown by onError
        break;
      }
    }
    setLaunchingAll(false);
  }

  const isLaunching = createCampaign.isPending;
  const isConnected = connStatus?.connected === true;
  const allLaunched = CAMPAIGNS.every((c) => !!launched[c.id]);

  // Token age for expiry warning (Meta tokens last ~60 days)
  const tokenAgeDays = connStatus?.tokenCreatedAt
    ? Math.floor((Date.now() - new Date(connStatus.tokenCreatedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const tokenExpiringSoon = tokenAgeDays !== null && tokenAgeDays >= 50;

  const authUrlQuery = trpc.metaAds.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/api/oauth/meta/callback` },
    { enabled: false }
  );

  async function handleConnectMeta() {
    setConnectingOAuth(true);
    try {
      const result = await authUrlQuery.refetch();
      if (result.data?.url) {
        window.location.href = result.data.url;
      } else {
        toast.error("Could not generate Facebook login URL. Check META_APP_ID is configured.");
        setConnectingOAuth(false);
      }
    } catch {
      toast.error("Failed to get Meta authorization URL.");
      setConnectingOAuth(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <InternalNav />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Facebook className="h-6 w-6 text-[#1877F2]" />
                <h1 className="text-2xl font-bold text-[#1e3a5f]">Meta Lead Gen Campaigns</h1>
              </div>
              <p className="text-muted-foreground">
                5 optimized campaigns · ${TOTAL_BUDGET}/day · PSE&G rebate + commercial
              </p>
            </div>
            <div className="flex items-center gap-3">
              {connLoading ? (
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                </Badge>
              ) : isConnected ? (
                <Badge className="bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/20 gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Meta Ads Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5">
                  <AlertCircle className="h-3 w-3" /> Setup Required
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSetupStep(connStatus?.hasToken ? 2 : 1);
                  setShowSetup(true);
                }}
              >
                <Settings className="h-4 w-4" /> Configure
              </Button>
              <a
                href="https://adsmanager.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:underline"
              >
                Open Meta Ads <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Setup notice */}
        {!connLoading && !isConnected && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900">Connect your Meta Ads account to launch campaigns</p>
              <p className="text-blue-800 mt-1">
                Click <strong>Configure</strong> above to connect with Facebook and enter your Ad Account ID and Page ID.
              </p>
            </div>
          </div>
        )}

        {/* Token expiry warning */}
        {!connLoading && isConnected && tokenExpiringSoon && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-amber-900">
                Your Meta token expires soon ({60 - (tokenAgeDays ?? 0)} days remaining)
              </p>
              <p className="text-amber-800 mt-1">
                Meta access tokens expire after 60 days. Reconnect now to avoid interruption.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 flex-shrink-0"
              onClick={handleConnectMeta}
              disabled={connectingOAuth}
            >
              {connectingOAuth ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Reconnect Now</>
              )}
            </Button>
          </div>
        )}

        {/* Live Performance */}
        {isConnected && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#1e3a5f]">Account Performance (Last 30 Days)</h2>
              <Button variant="ghost" size="sm" onClick={() => refetchPerf()} disabled={perfLoading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${perfLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            {perfLoading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-16 bg-white rounded-lg border animate-pulse" />
                ))}
              </div>
            ) : perfData?.campaigns && perfData.campaigns.length > 0 ? (
              <div className="space-y-3">
                {perfData.campaigns.map((c: typeof perfData.campaigns[0]) => (
                  <div key={c.id} className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-[#1e3a5f]">{c.name}</span>
                      <Badge
                        variant={c.status === "ACTIVE" ? "default" : "outline"}
                        className={c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Impressions</p>
                        <p className="font-semibold">{c.impressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Clicks</p>
                        <p className="font-semibold">{c.clicks.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Spend</p>
                        <p className="font-semibold">${c.spend.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Leads</p>
                        <p className="font-semibold">{c.conversions.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border rounded-lg p-6 text-center text-muted-foreground text-sm">
                No campaign data yet. Launch campaigns below and check back after they go live.
              </div>
            )}
          </div>
        )}

        {/* ── Summary Bar ──────────────────────────────────────────── */}
        <div className="mb-6 bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <h2 className="font-bold text-[#1e3a5f] text-lg">Campaign Overview</h2>
            <Button
              className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white gap-2"
              onClick={handleLaunchAll}
              disabled={!isConnected || allLaunched || launchingAll || launchCooldown || isLaunching}
            >
              {launchingAll ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Launching All…</>
              ) : allLaunched ? (
                <><CheckCircle2 className="h-4 w-4" /> All 5 Launched</>
              ) : (
                <><Rocket className="h-4 w-4" /> Launch All 5 Campaigns</>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Daily Budget</p>
              <p className="text-xl font-bold text-[#1e3a5f]">${TOTAL_BUDGET}/day</p>
              <p className="text-xs text-muted-foreground">${TOTAL_BUDGET * 30}/month</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected Leads</p>
              <p className="text-xl font-bold text-emerald-600">{PROJECTED_LEADS_LOW}–{PROJECTED_LEADS_HIGH}/mo</p>
              <p className="text-xs text-muted-foreground">across all 5 campaigns</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Est. CPL</p>
              <p className="text-xl font-bold text-[#1e3a5f]">$8–15</p>
              <p className="text-xs text-muted-foreground">cost per lead</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected Installs</p>
              <p className="text-xl font-bold text-blue-600">{PROJECTED_INSTALLS_LOW}–{PROJECTED_INSTALLS_HIGH}/mo</p>
              <p className="text-xs text-muted-foreground">at 25% close rate</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bid Strategy</p>
              <p className="text-sm font-bold text-[#1e3a5f] mt-1">Lowest Cost</p>
              <p className="text-xs text-muted-foreground">without cap</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Running all 5 at ${TOTAL_BUDGET}/day leaves budget for Google Search ads on PSE&G keywords — recommended split for $600/month.
            </p>
          </div>
        </div>

        {/* ── Campaign Cards ───────────────────────────────────────── */}
        <div className="space-y-4">
          {CAMPAIGNS.map((camp) => {
            const isExpanded = expandedId === camp.id;
            const wasLaunched = !!launched[camp.id];
            const truncatedText = camp.primaryText.length > 100
              ? camp.primaryText.slice(0, 100) + "…"
              : camp.primaryText;

            return (
              <div key={camp.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2 self-stretch rounded-full ${camp.color} flex-shrink-0`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#1e3a5f]">{camp.name}</h3>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs gap-1">
                            <Target className="h-3 w-3" /> LEAD GENERATION
                          </Badge>
                          {camp.recommended && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs gap-1">
                              <Star className="h-3 w-3" /> RECOMMENDED
                            </Badge>
                          )}
                          {wasLaunched ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" /> Created — ID {launched[camp.id].campaignId}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              PAUSED — Ready to Activate
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{camp.tagline}</p>

                        {/* Key metrics row */}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            <strong className="text-[#1e3a5f]">${camp.dailyBudget}/day</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Ages {camp.ageMin}–{camp.ageMax}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" />
                            CPL: {camp.estimatedCpl}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />
                            {camp.projectedLeads} leads/mo
                          </span>
                        </div>

                        {/* Headline preview */}
                        <p className="font-semibold text-slate-800 mt-2 text-sm">{camp.headline}</p>

                        {/* Truncated primary text */}
                        <p className="text-xs text-muted-foreground mt-1">{truncatedText}</p>

                        {/* Audience summary */}
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {camp.audienceSummary}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => setExpandedId(isExpanded ? null : camp.id)}
                      >
                        {isExpanded ? (
                          <><ChevronUp className="h-4 w-4" /> Hide</>
                        ) : (
                          <><Eye className="h-4 w-4" /> Preview Ad</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white gap-1.5"
                        onClick={() => setConfirmCampaign(camp)}
                        disabled={wasLaunched || !isConnected}
                      >
                        {wasLaunched ? (
                          <><CheckCircle2 className="h-4 w-4" /> Launched</>
                        ) : (
                          <><Rocket className="h-4 w-4" /> Activate in Meta Ads</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded preview */}
                {isExpanded && (
                  <div className="border-t bg-slate-50 p-5 space-y-4 text-sm">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Objective</p>
                        <p className="text-slate-700">Lead Generation</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Audience</p>
                        <p className="text-slate-700">{camp.audienceSummary}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Ad Headline</p>
                      <p className="font-semibold text-slate-800">{camp.headline}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Primary Text</p>
                      <p className="text-slate-700 leading-relaxed">{camp.primaryText}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Description</p>
                      <p className="text-slate-700">{camp.description}</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Call to Action</p>
                        <p className="text-slate-700">{camp.callToAction.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Interests Targeted</p>
                        <div className="flex flex-wrap gap-1.5">
                          {camp.interests.map((i) => (
                            <span key={i.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                              {i.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Bid Strategy</p>
                        <p className="text-slate-700">Lowest Cost Without Cap</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 bg-white rounded-lg p-3 border">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Est. CPL</p>
                        <p className="font-bold text-[#1e3a5f]">{camp.estimatedCpl}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Projected Leads/mo</p>
                        <p className="font-bold text-emerald-600">{camp.projectedLeads}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Monthly Spend</p>
                        <p className="font-bold text-[#1e3a5f]">${camp.dailyBudget * 30}/mo</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Landing page:</span>
                      <a
                        href={camp.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1e3a5f] hover:underline font-medium"
                      >
                        {camp.websiteUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Budget breakdown */}
        <div className="mt-6 bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-[#1e3a5f] mb-3">Budget Breakdown</h3>
          <div className="grid grid-cols-5 gap-3 text-center">
            {CAMPAIGNS.map((c) => (
              <div key={c.id}>
                <p className="text-xs text-muted-foreground truncate">{c.name.replace("ME — ", "").split("|")[0].trim()}</p>
                <p className="text-lg font-bold text-[#1e3a5f]">
                  ${c.dailyBudget}
                  <span className="text-xs font-normal text-muted-foreground">/day</span>
                </p>
                <p className="text-xs text-muted-foreground">${c.dailyBudget * 30}/mo</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Meta Ads spend</span>
            <span className="font-bold text-[#1e3a5f]">
              ${TOTAL_BUDGET}/day · ${TOTAL_BUDGET * 30}/month
            </span>
          </div>
        </div>

        {/* Info note */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">All campaigns launch as Paused</p>
            <p className="mt-1">
              After clicking Launch, each campaign is created in your Meta Ads Manager in{" "}
              <strong>paused</strong> status. Open Meta Ads Manager, review the campaign, then click{" "}
              <strong>Publish</strong> to go live. All campaigns use <strong>Lowest Cost</strong> bidding
              with <strong>Lead Generation</strong> optimization.
            </p>
          </div>
        </div>
      </div>

      {/* Setup / Configure Dialog */}
      <Dialog open={showSetup} onOpenChange={(open) => {
        setShowSetup(open);
        if (!open) { setSetupStep(connStatus?.hasToken ? 2 : 1); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-[#1877F2]" />
              {setupStep === 1 ? "Connect Meta Ads" : "Configure Ad Account"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 1
                ? "Sign in with Facebook to authorize ad management."
                : "Enter your Ad Account ID and Page ID to finish setup."}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 py-1">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              connStatus?.hasToken
                ? "bg-emerald-100 text-emerald-700"
                : setupStep === 1
                  ? "bg-[#1877F2] text-white"
                  : "bg-slate-200 text-slate-500"
            }`}>
              {connStatus?.hasToken ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
            </div>
            <span className={`text-xs ${setupStep === 1 ? "font-semibold" : "text-muted-foreground"}`}>
              Connect Facebook
            </span>
            <div className="flex-1 h-px bg-slate-200" />
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              connStatus?.hasAdAccount && connStatus?.hasPageId
                ? "bg-emerald-100 text-emerald-700"
                : setupStep === 2
                  ? "bg-[#1877F2] text-white"
                  : "bg-slate-200 text-slate-500"
            }`}>
              {connStatus?.hasAdAccount && connStatus?.hasPageId ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}
            </div>
            <span className={`text-xs ${setupStep === 2 ? "font-semibold" : "text-muted-foreground"}`}>
              Ad Account & Page
            </span>
          </div>

          {setupStep === 1 ? (
            <div className="space-y-4 py-2">
              {connStatus?.hasToken ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>Facebook account connected{tokenAgeDays !== null ? ` (${tokenAgeDays} days ago)` : ""}.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Click below to sign in with Facebook and authorize Mechanical Enterprise to manage ads.
                    You'll be redirected back here automatically.
                  </p>
                  <Button
                    className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white gap-2"
                    onClick={handleConnectMeta}
                    disabled={connectingOAuth}
                  >
                    {connectingOAuth ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting to Facebook…</>
                    ) : (
                      <><LogIn className="h-4 w-4" /> Connect with Facebook</>
                    )}
                  </Button>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowSetup(false)}>
                  Cancel
                </Button>
                {connStatus?.hasToken && (
                  <Button
                    className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                    onClick={() => setSetupStep(2)}
                  >
                    Next
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="adAccountId">Ad Account ID</Label>
                <Input
                  id="adAccountId"
                  placeholder="e.g. 123456789012345"
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in Meta Ads Manager → top-left account selector. Enter numbers only (no "act_" prefix).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pageId">Facebook Page ID</Label>
                <Input
                  id="pageId"
                  placeholder="e.g. 987654321"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Found in your Facebook Page → About → Page ID.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSetupStep(1)}>
                  Back
                </Button>
                <Button
                  className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                  onClick={() => saveConfig.mutate({ adAccountId, pageId })}
                  disabled={!adAccountId || !pageId || saveConfig.isPending}
                >
                  {saveConfig.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</>
                  ) : (
                    "Save Configuration"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Launch Dialog */}
      <Dialog open={!!confirmCampaign} onOpenChange={(open) => !open && setConfirmCampaign(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-[#1877F2]" />
              Launch {confirmCampaign?.name}?
            </DialogTitle>
            <DialogDescription>
              This will create the campaign in your Meta Ads account as <strong>paused</strong>.
              You enable it in Meta Ads Manager when ready to spend.
            </DialogDescription>
          </DialogHeader>
          {confirmCampaign && (
            <div className="space-y-3 py-2">
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily budget</span>
                  <span className="font-semibold">${confirmCampaign.dailyBudget}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly estimate</span>
                  <span className="font-semibold">${confirmCampaign.dailyBudget * 30}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objective</span>
                  <span className="font-semibold">Lead Generation</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audience ages</span>
                  <span className="font-semibold">{confirmCampaign.ageMin}–{confirmCampaign.ageMax}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. CPL</span>
                  <span className="font-semibold">{confirmCampaign.estimatedCpl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projected leads</span>
                  <span className="font-semibold">{confirmCampaign.projectedLeads}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bid strategy</span>
                  <span className="font-semibold">Lowest Cost Without Cap</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmCampaign(null)} disabled={isLaunching}>
              Cancel
            </Button>
            <Button
              className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white gap-2"
              onClick={handleConfirm}
              disabled={isLaunching}
            >
              {isLaunching ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating in Meta Ads…</>
              ) : (
                <><Rocket className="h-4 w-4" /> Yes, Create Campaign</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
