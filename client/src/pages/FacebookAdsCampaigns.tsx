import { useState } from "react";
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
  Info, Settings, Facebook,
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
}

const CAMPAIGNS: FbCampaignDef[] = [
  {
    id: "rebate-hunter",
    name: "ME — Rebate Hunter (FB)",
    tagline: "Homeowners who qualify for NJ heat pump rebates",
    objective: "OUTCOME_LEADS",
    dailyBudget: 18,
    color: "bg-emerald-500",
    ageMin: 30,
    ageMax: 65,
    headline: "Up to $16,000 in NJ Heat Pump Rebates",
    primaryText:
      "Essex County homeowners — did you know you may qualify for up to $16,000 in NJ Clean Heat rebates? Mechanical Enterprise makes it easy. Get your free estimate in 2 minutes, no commitment required.",
    description: "Free rebate estimate · No obligation · WMBE-certified local HVAC",
    callToAction: "LEARN_MORE",
    websiteUrl: "https://mechanicalenterprise.com/rebate-calculator",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
      { id: "6003397425735", name: "Energy conservation" },
    ],
    audienceSummary: "Homeowners 30–65 · Essex County NJ · Home improvement interests",
  },
  {
    id: "oil-replacement",
    name: "ME — Oil Replacement (FB)",
    tagline: "Oil heat homeowners ready to switch to a heat pump",
    objective: "OUTCOME_LEADS",
    dailyBudget: 14,
    color: "bg-orange-500",
    ageMin: 35,
    ageMax: 65,
    headline: "Ditch Oil Heat — Get Up to $16K Back",
    primaryText:
      "Still heating with oil? Switch to a modern heat pump and qualify for up to $16,000 in NJ rebates. Mechanical Enterprise handles everything — installation, permits, and rebate paperwork. Serving Essex County.",
    description: "0% financing available · Up to $16K in rebates · Local WMBE contractor",
    callToAction: "GET_QUOTE",
    websiteUrl: "https://mechanicalenterprise.com/oil-to-heat-pump",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
      { id: "6003269798979", name: "Heating, ventilation, and air conditioning" },
    ],
    audienceSummary: "Homeowners 35–65 · Essex County NJ · HVAC & home improvement interests",
  },
  {
    id: "hvac-replacement",
    name: "ME — HVAC Replacement (FB)",
    tagline: "General HVAC replacement awareness in Essex County",
    objective: "OUTCOME_LEADS",
    dailyBudget: 8,
    color: "bg-blue-500",
    ageMin: 28,
    ageMax: 65,
    headline: "New HVAC System — Essex County NJ",
    primaryText:
      "Is your HVAC system over 10 years old? Mechanical Enterprise installs high-efficiency systems for Essex County homes and businesses. Get a free quote today — financing available, rebates may apply.",
    description: "Free quote · Financing available · WMBE/SBE certified · 20+ years experience",
    callToAction: "GET_QUOTE",
    websiteUrl: "https://mechanicalenterprise.com/contact",
    interests: [
      { id: "6003349442621", name: "Home improvement" },
      { id: "6003269798979", name: "Heating, ventilation, and air conditioning" },
      { id: "6003384750085", name: "Real estate" },
    ],
    audienceSummary: "Homeowners 28–65 · Essex County NJ · HVAC, home improvement & real estate",
  },
];

export default function FacebookAdsCampaigns() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmCampaign, setConfirmCampaign] = useState<FbCampaignDef | null>(null);
  const [launched, setLaunched] = useState<Record<string, { campaignId: string }>>({});
  const [showSetup, setShowSetup] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");

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
    },
  });

  function handleConfirm() {
    if (!confirmCampaign) return;
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

  const isLaunching = createCampaign.isPending;
  const totalBudget = CAMPAIGNS.reduce((s, c) => s + c.dailyBudget, 0);
  const isConnected = connStatus?.connected === true;

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
                <h1 className="text-2xl font-bold text-[#1e3a5f]">Facebook Ads Campaigns</h1>
              </div>
              <p className="text-muted-foreground">
                3 campaigns pre-configured for Essex County, NJ · ${totalBudget}/day total
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
                onClick={() => setShowSetup(true)}
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
                You need a <strong>Meta access token</strong>, your <strong>Ad Account ID</strong>, and your{" "}
                <strong>Facebook Page ID</strong>. Click <strong>Configure</strong> above to enter these.
              </p>
              <ol className="mt-2 space-y-1 text-blue-800 list-decimal list-inside">
                <li>
                  Get a long-lived access token from{" "}
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Meta Graph API Explorer
                  </a>{" "}
                  with <code className="bg-blue-100 px-1 rounded text-xs">ads_management</code> permission
                </li>
                <li>
                  Find your Ad Account ID in{" "}
                  <a
                    href="https://adsmanager.facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    Meta Ads Manager
                  </a>{" "}
                  (format: <code className="bg-blue-100 px-1 rounded text-xs">act_XXXXXXXXXX</code> — enter just the numbers)
                </li>
                <li>
                  Find your Page ID in your Facebook Page settings under <strong>About → Page ID</strong>
                </li>
              </ol>
            </div>
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
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            <strong className="text-[#1e3a5f]">${camp.dailyBudget}/day</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            Essex County, NJ
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Ages {camp.ageMin}–{camp.ageMax}
                          </span>
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
                          <><ChevronDown className="h-4 w-4" /> Preview</>
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
                          <><Rocket className="h-4 w-4" /> Launch Campaign</>
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
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                          Objective
                        </p>
                        <p className="text-slate-700">{camp.objective.replace("OUTCOME_", "")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                          Audience
                        </p>
                        <p className="text-slate-700">{camp.audienceSummary}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                        Ad Headline
                      </p>
                      <p className="font-semibold text-slate-800">{camp.headline}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                        Primary Text
                      </p>
                      <p className="text-slate-700 leading-relaxed">{camp.primaryText}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                        Description
                      </p>
                      <p className="text-slate-700">{camp.description}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                          Call to Action
                        </p>
                        <p className="text-slate-700">{camp.callToAction.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-2">
                          Interests Targeted
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {camp.interests.map((i) => (
                            <span key={i.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                              {i.name}
                            </span>
                          ))}
                        </div>
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

        {/* Budget summary */}
        <div className="mt-6 bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-[#1e3a5f] mb-3">Budget Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {CAMPAIGNS.map((c) => (
              <div key={c.id}>
                <p className="text-xs text-muted-foreground">{c.name.replace("ME — ", "").replace(" (FB)", "")}</p>
                <p className="text-lg font-bold text-[#1e3a5f]">
                  ${c.dailyBudget}
                  <span className="text-xs font-normal text-muted-foreground">/day</span>
                </p>
                <p className="text-xs text-muted-foreground">${(c.dailyBudget * 30).toFixed(0)}/mo</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Facebook Ads spend</span>
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
              After clicking Launch, each campaign is created in your Meta Ads Manager in{" "}
              <strong>paused</strong> status. Open Meta Ads Manager, review the campaign, then click{" "}
              <strong>Publish</strong> to go live.
            </p>
          </div>
        </div>
      </div>

      {/* Setup / Configure Dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-[#1877F2]" />
              Configure Meta Ads Connection
            </DialogTitle>
            <DialogDescription>
              Enter your Meta Ads credentials. These are stored securely on the server.
            </DialogDescription>
          </DialogHeader>
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
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Access Token:</strong> A long-lived token with <code>ads_management</code> permission
              must be set by your administrator via the server environment variable{" "}
              <code>META_ACCESS_TOKEN</code>. If you have the token, contact your admin to add it.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSetup(false)}>
              Cancel
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
                  <span className="font-semibold">${(confirmCampaign.dailyBudget * 30).toFixed(0)}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Objective</span>
                  <span className="font-semibold">{confirmCampaign.objective.replace("OUTCOME_", "")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audience ages</span>
                  <span className="font-semibold">{confirmCampaign.ageMin}–{confirmCampaign.ageMax}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geo target</span>
                  <span className="font-semibold">Essex County, NJ (25 mi radius)</span>
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
