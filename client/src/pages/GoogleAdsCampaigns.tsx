import { useState, useEffect } from "react";
import InternalNav from "@/components/InternalNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Rocket, DollarSign, Target, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, RefreshCw, TrendingUp, Eye, Zap,
  ChevronDown, ChevronUp, Info, Link2
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CampaignDef {
  id: string;
  name: string;
  tagline: string;
  dailyBudget: number;
  color: string;
  keywords: string[];
  negativeKeywords: string[];
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  geoTargetIds: number[];
  strategy: string;
}

const CAMPAIGNS: CampaignDef[] = [
  {
    id: "rebate-hunter",
    name: "ME — Rebate Hunter",
    tagline: "Targets homeowners actively searching for NJ heat pump rebates",
    dailyBudget: 18,
    color: "bg-emerald-500",
    strategy: "Maximize Conversions → Target CPA $60 after 20 conversions",
    keywords: [
      "[nj heat pump rebate]",
      "[new jersey heat pump rebate]",
      "[nj clean heat rebate]",
      "[heat pump rebate essex county]",
      "[heat pump rebate 2025 nj]",
      '"nj heat pump rebate"',
      '"new jersey heat pump rebate 2025"',
      '"nj clean heat program rebate"',
      '"heat pump incentive new jersey"',
      '"heat pump rebate essex county nj"',
    ],
    negativeKeywords: ["diy", "youtube", "how to", "repair", "fix", "used", "rental", "apartment", "commercial"],
    headlines: [
      "Up to $16,000 NJ Heat Pump Rebate",
      "See Your Rebate in 2 Minutes",
      "NJ Clean Heat Rebate — Apply Now",
      "Heat Pump Rebates Essex County NJ",
      "Free Rebate Estimate — No Obligation",
      "$16K Back on Heat Pump Upgrades",
      "Mechanical Enterprise — Local HVAC",
      "WMBE Certified HVAC Contractor NJ",
      "0% Financing + Rebates Available",
      "Replace Oil Heat — Get $16K Back",
      "Heat Pump Installation New Jersey",
      "Check Your Rebate Eligibility Now",
      "NJ Homeowners — Big Rebates Available",
      "No Money Down Heat Pump Options",
      "Free 2-Min Rebate Calculator",
    ],
    descriptions: [
      "Essex County homeowners qualify for up to $16,000 in rebates and incentives on a new heat pump. See your estimate in 2 minutes — no commitment required.",
      "Mechanical Enterprise is a WMBE-certified local HVAC contractor serving Essex County. 0% financing, no money down options, and up to $16,000 in program rebates.",
      "Replace your oil, gas, or electric system with a high-efficiency heat pump. NJ Clean Heat program covers up to $16,000. Free assessment — book online today.",
      "Check what rebates and incentives you qualify for in 2 minutes. Serving all of Essex County NJ. WMBE/SBE certified. Call (862) 423-9396 or get your estimate online.",
    ],
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    geoTargetIds: [1023191],
  },
  {
    id: "oil-replacement",
    name: "ME — Oil Replacement",
    tagline: "Targets oil heat homeowners ready to switch to a heat pump",
    dailyBudget: 14,
    color: "bg-orange-500",
    strategy: "Maximize Conversions",
    keywords: [
      "[oil to heat pump new jersey]",
      "[replace oil furnace heat pump nj]",
      "[oil heating alternative new jersey]",
      "[oil boiler replacement nj]",
      "[switch from oil heat nj]",
      '"oil to heat pump conversion nj"',
      '"replace oil heat with heat pump new jersey"',
      '"oil furnace replacement new jersey"',
      '"oil boiler to heat pump nj"',
      '"convert oil heat to electric nj"',
    ],
    negativeKeywords: ["diy", "repair", "service", "oil change", "car", "motor oil", "cooking oil"],
    headlines: [
      "Switch From Oil — Get Up to $16K Back",
      "Oil to Heat Pump Conversion NJ",
      "Replace Oil Heat — Big Rebates Available",
      "NJ Clean Heat — Oil Replacement Rebates",
      "Free Oil Replacement Estimate",
      "Ditch Oil Heat — Save Every Month",
      "Oil Boiler Replacement Essex County",
      "Heat Pump Replaces Oil — 0% Financing",
      "Up to $16,000 Oil Conversion Rebate",
      "Mechanical Enterprise — Oil Conversion",
      "No Money Down Oil Replacement",
      "Oil Tank Decommission Included",
      "Switch to Heat Pump — Lower Bills",
      "NJ Homeowners — Drop Oil This Year",
      "Free 2-Min Rebate Calculator",
    ],
    descriptions: [
      "Switching from oil to a heat pump in New Jersey qualifies for up to $16,000 in rebates and incentives. Oil tank decommissioning included. Free estimate in 2 minutes.",
      "Mechanical Enterprise handles the full oil-to-heat pump conversion — decommissioning, installation, and rebate paperwork. Serving Essex County NJ. Call (862) 423-9396.",
      "Stop paying high oil prices. A new heat pump costs less to run and qualifies for up to $16,000 in NJ Clean Heat rebates. 0% financing, no money down options available.",
      "Essex County homeowners: replace your oil system and get up to $16,000 back through the NJ Clean Heat program. WMBE-certified local contractor. Book your free assessment today.",
    ],
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    geoTargetIds: [1023191],
  },
  {
    id: "hvac-replacement",
    name: "ME — HVAC Replacement",
    tagline: "Captures general HVAC replacement searches in Essex County",
    dailyBudget: 8,
    color: "bg-blue-500",
    strategy: "Maximize Clicks (switch to Maximize Conversions after week 1)",
    keywords: [
      "[hvac replacement essex county nj]",
      "[new hvac system new jersey]",
      "[heat pump installation new jersey]",
      "[central air installation nj]",
      "[hvac contractor essex county]",
      '"hvac replacement essex county"',
      '"new hvac system nj"',
      '"heat pump installation essex county nj"',
      '"central ac installation new jersey"',
      '"hvac company essex county nj"',
    ],
    negativeKeywords: ["repair", "service", "maintenance", "diy", "rental", "commercial", "apartment", "how to"],
    headlines: [
      "HVAC Replacement Essex County NJ",
      "New Heat Pump Installation NJ",
      "Central AC Installation New Jersey",
      "Local HVAC Contractor — Free Quote",
      "Mechanical Enterprise — Essex County",
      "WMBE Certified HVAC Contractor",
      "Heat Pump + AC — One System",
      "0% Financing on New HVAC Systems",
      "Up to $16,000 in Rebates Available",
      "Free HVAC Assessment — Book Online",
      "High-Efficiency Heat Pumps NJ",
      "Full System Replacement — No Money Down",
      "Serving All of Essex County NJ",
      "VRV/VRF Specialists",
      "Call (862) 423-9396 — Free Estimate",
    ],
    descriptions: [
      "Mechanical Enterprise installs high-efficiency heat pumps and central AC systems throughout Essex County NJ. Up to $16,000 in rebates available. Free assessment — book online.",
      "Local WMBE-certified HVAC contractor serving Essex County. New heat pump systems starting with 0% financing and no money down. Check your rebate eligibility in 2 minutes.",
      "Replace your old HVAC system with a high-efficiency heat pump. Heating and cooling in one unit. Up to $16,000 in NJ Clean Heat rebates. Call (862) 423-9396 today.",
      "Mechanical Enterprise handles full HVAC replacements for Essex County homeowners. VRV/VRF specialists. Free assessment, no obligation. See your rebate estimate online now.",
    ],
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    geoTargetIds: [1023191],
  },
];

export default function GoogleAdsCampaigns() {
  const [confirmCampaign, setConfirmCampaign] = useState<CampaignDef | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [launched, setLaunched] = useState<Record<string, { campaignId: string }>>({});
  const [oauthLoading, setOauthLoading] = useState(false);

  const { data: connStatus, isLoading: connLoading, refetch: refetchConn } = trpc.googleAds.getConnectionStatus.useQuery();
  const getAuthUrl = trpc.googleAds.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/api/oauth/google-ads/callback` },
    { enabled: false }
  );

  // Handle ?connected=1 URL param after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      toast.success("Google Ads connected successfully!", {
        description: "Your account is now linked. You can launch campaigns.",
        duration: 6000,
      });
      refetchConn();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      toast.error("Google Ads connection failed", {
        description: `Error: ${params.get("error")}. Please try again.`,
        duration: 8000,
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleConnectGoogle() {
    setOauthLoading(true);
    try {
      const result = await getAuthUrl.refetch();
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (err: any) {
      toast.error("Failed to start OAuth flow", { description: err.message });
      setOauthLoading(false);
    }
  }

  const { data: perfData, isLoading: perfLoading, refetch: refetchPerf } =
    trpc.googleAds.getCampaignPerformance.useQuery(undefined, {
      enabled: connStatus?.connected === true,
      retry: false,
    });

  const createCampaign = trpc.googleAds.createCampaign.useMutation({
    onSuccess: (result, variables) => {
      const camp = CAMPAIGNS.find((c) => c.name === variables.name);
      if (camp) {
        setLaunched((prev) => ({ ...prev, [camp.id]: { campaignId: result.campaignId } }));
      }
      toast.success(`Campaign created! ID: ${result.campaignId}`, {
        description: "It's paused in Google Ads. Enable it when ready to go live.",
        duration: 8000,
      });
      setConfirmCampaign(null);
    },
    onError: (err) => {
      const isDeveloperTokenError =
        err.message?.includes("DEVELOPER_TOKEN_NOT_APPROVED") ||
        err.message?.includes("developer token");
      if (isDeveloperTokenError) {
        toast.error("Google Ads API access required", {
          description:
            "Your developer token needs Standard Access approval before it can write to live accounts. See the banner on this page for instructions.",
          duration: 12000,
        });
      } else {
        toast.error("Failed to create campaign", { description: err.message, duration: 10000 });
      }
      setConfirmCampaign(null);
    },
  });

  function handleConfirm() {
    if (!confirmCampaign) return;
    createCampaign.mutate({
      name: confirmCampaign.name,
      dailyBudget: confirmCampaign.dailyBudget,
      keywords: confirmCampaign.keywords,
      negativeKeywords: confirmCampaign.negativeKeywords,
      headlines: confirmCampaign.headlines,
      descriptions: confirmCampaign.descriptions,
      finalUrl: confirmCampaign.finalUrl,
      geoTargetNames: ["Essex County, NJ"],
    });
  }

  const isLaunching = createCampaign.isPending;
  const totalBudget = CAMPAIGNS.reduce((s, c) => s + c.dailyBudget, 0);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <InternalNav />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Google Ads Campaigns</h1>
              <p className="text-muted-foreground mt-1">
                3 campaigns pre-configured for Essex County, NJ · ${totalBudget}/day total
              </p>
            </div>
            <div className="flex items-center gap-3">
              {connLoading ? (
                <Badge variant="outline" className="gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                </Badge>
              ) : connStatus?.connected ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Google Ads Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5">
                  <AlertCircle className="h-3 w-3" /> Not Connected
                </Badge>
              )}
              <a
                href="https://ads.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:underline"
              >
                Open Google Ads <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Developer token upgrade notice — shown only when connected (Test Access) */}
        {connStatus?.connected && <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Action required: Apply for Google Ads API Standard Access</p>
            <p className="text-amber-800 mt-1">
              Your developer token is currently at <strong>Test Access</strong> level, which only works with test accounts.
              To push campaigns to your live account (AW-17768263516), you need to apply for <strong>Standard Access</strong>.
            </p>
            <ol className="mt-2 space-y-1 text-amber-800 list-decimal list-inside">
              <li>Go to your Google Ads account → <strong>Tools &amp; Settings → API Center</strong></li>
              <li>Click <strong>"Apply for Standard Access"</strong> and fill out the form</li>
              <li>Describe use: <em>"Internal campaign management tool for our HVAC business"</em></li>
              <li>Google typically approves within <strong>1–2 business days</strong></li>
            </ol>
            <div className="mt-3 flex gap-3 flex-wrap">
              <a
                href="https://ads.google.com/aw/apicenter"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 underline hover:text-amber-700"
              >
                Open Google Ads API Center <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>}

        {/* Not connected — OAuth connect button */}
        {!connLoading && !connStatus?.connected && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Google Ads not connected</p>
              <p className="text-sm text-amber-700 mt-1">
                Connect your Google account to enable campaign management. This will authorize the app to manage your Google Ads campaigns.
              </p>
              <Button
                className="mt-3 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white gap-2"
                onClick={handleConnectGoogle}
                disabled={oauthLoading}
              >
                {oauthLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Connecting…</>
                ) : (
                  <><Link2 className="h-4 w-4" />Connect with Google</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Live Performance */}
        {connStatus?.connected && (
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
                {perfData.campaigns.map((c) => (
                  <div key={c.id} className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-[#1e3a5f]">{c.name}</span>
                      <Badge
                        variant={c.status === "ENABLED" ? "default" : "outline"}
                        className={c.status === "ENABLED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}
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
                        <p className="font-semibold">${c.cost.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Conversions</p>
                        <p className="font-semibold">{c.conversions.toFixed(1)}</p>
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

        {/* Campaign Cards */}
        <div className="space-y-4">
          <h2 className="font-semibold text-[#1e3a5f]">Ready-to-Launch Campaigns</h2>

          {CAMPAIGNS.map((camp) => {
            const isExpanded = expandedId === camp.id;
            const wasLaunched = !!launched[camp.id];

            return (
              <div key={camp.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2 self-stretch rounded-full ${camp.color} flex-shrink-0`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#1e3a5f]">{camp.name}</h3>
                          {wasLaunched && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" /> Created — ID {launched[camp.id].campaignId}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{camp.tagline}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-[#1e3a5f] font-semibold">
                            <DollarSign className="h-3.5 w-3.5" />${camp.dailyBudget}/day
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Target className="h-3.5 w-3.5" />Essex County, NJ
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Zap className="h-3.5 w-3.5" />{camp.keywords.length} keywords
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : camp.id)}
                        className="text-muted-foreground"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isExpanded ? "Hide" : "Preview"}
                      </Button>
                      {wasLaunched ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-emerald-700 border-emerald-300"
                          onClick={() =>
                            window.open(
                              `https://ads.google.com/aw/campaigns?campaignId=${launched[camp.id].campaignId}`,
                              "_blank"
                            )
                          }
                        >
                          <ExternalLink className="h-3.5 w-3.5" />View in Google Ads
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white gap-1.5"
                          onClick={() => setConfirmCampaign(camp)}
                          disabled={!connStatus?.connected || isLaunching}
                        >
                          {isLaunching && createCampaign.variables?.name === camp.name ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating…</>
                          ) : (
                            <><Rocket className="h-3.5 w-3.5" />Launch Campaign</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-[#f8f9fc] px-5 py-4 space-y-4">
                    <div className="flex items-start gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-[#ff6b35] flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-[#1e3a5f]">Bidding: </span>
                        <span className="text-muted-foreground">{camp.strategy}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                        Keywords ({camp.keywords.length}) — [ ] = exact match, " " = phrase match
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {camp.keywords.map((kw, i) => (
                          <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-700">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">Negative Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {camp.negativeKeywords.map((kw, i) => (
                          <span key={i} className="text-xs bg-red-50 border border-red-200 rounded px-2 py-0.5 font-mono text-red-700">
                            -{kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                        Headlines ({camp.headlines.length}/15)
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {camp.headlines.map((h, i) => (
                          <div key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                            <span className="text-xs text-muted-foreground w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                        Descriptions ({camp.descriptions.length}/4)
                      </p>
                      <div className="space-y-2">
                        {camp.descriptions.map((d, i) => (
                          <div key={i} className="text-sm text-slate-700 flex items-start gap-1.5">
                            <span className="text-xs text-muted-foreground w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Landing page:</span>
                      <a href={camp.finalUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[#1e3a5f] hover:underline font-medium">
                        {camp.finalUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Budget summary */}
        <div className="mt-6 bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-[#1e3a5f] mb-3">Budget Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {CAMPAIGNS.map((c) => (
              <div key={c.id}>
                <p className="text-xs text-muted-foreground">{c.name.replace("ME — ", "")}</p>
                <p className="text-lg font-bold text-[#1e3a5f]">${c.dailyBudget}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
                <p className="text-xs text-muted-foreground">${(c.dailyBudget * 30).toFixed(0)}/mo</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Google Ads spend</span>
            <span className="font-bold text-[#1e3a5f]">
              ${totalBudget}/day · ${(totalBudget * 30).toFixed(0)}/month
            </span>
          </div>
        </div>

        {/* Info note */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Campaigns launch as Paused</p>
            <p className="mt-1">
              After clicking Launch, each campaign is created in your Google Ads account in <strong>paused</strong> status.
              Open Google Ads, review the campaign, then click <strong>Enable</strong> to go live.
            </p>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmCampaign} onOpenChange={(open) => !open && setConfirmCampaign(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-[#ff6b35]" />
              Launch {confirmCampaign?.name}?
            </DialogTitle>
            <DialogDescription>
              This will create the campaign in your Google Ads account (AW-17768263516) as <strong>paused</strong>.
              You enable it in Google Ads when you are ready to spend.
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
                  <span className="font-semibold">${(confirmCampaign.dailyBudget * 30).toFixed(0)}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Keywords</span>
                  <span className="font-semibold">{confirmCampaign.keywords.length} (phrase + exact match)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geo target</span>
                  <span className="font-semibold">Essex County, NJ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Landing page</span>
                  <span className="font-semibold text-xs">/rebate-calculator</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmCampaign(null)} disabled={isLaunching}>
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white gap-2"
              onClick={handleConfirm}
              disabled={isLaunching}
            >
              {isLaunching ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Creating in Google Ads…</>
              ) : (
                <><Rocket className="h-4 w-4" />Yes, Create Campaign</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
