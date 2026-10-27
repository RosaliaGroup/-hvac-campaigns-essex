import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Facebook, 
  TrendingUp, 
  DollarSign,
  MousePointer,
  Eye,
  Target,
  AlertCircle,
  Settings,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function CampaignPerformance() {
  const { user, loading, isAuthenticated } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  // Live Meta verification; a saved token alone is not a working Ads connection.
  const { data: metaStatus, error: metaStatusError } = trpc.metaAds.getConnectionStatus.useQuery(
    undefined, { enabled: isAuthenticated, retry: false }
  );
  const { data: metaCheck, error: metaCheckError } = trpc.metaAds.testConnection.useQuery(
    undefined, { enabled: isAuthenticated && metaStatus?.connected === true, retry: false }
  );
  const facebookConnected = metaStatus?.connected === true && metaCheck?.ok === true;

  // Real Google Ads data via tRPC
  const { data: connectionStatus, refetch: refetchStatus } = trpc.googleAds.getConnectionStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const googleAdsConnected = connectionStatus?.connected ?? false;

  const { data: summaryData, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = trpc.googleAds.getAccountSummary.useQuery(
    undefined,
    { enabled: !!(isAuthenticated && googleAdsConnected) }
  );
  const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError, refetch: refetchCampaigns } = trpc.googleAds.getCampaignPerformance.useQuery(
    undefined,
    { enabled: !!(isAuthenticated && googleAdsConnected) }
  );
  const { data: termsData, isLoading: termsLoading, error: termsError, refetch: refetchTerms } =
    trpc.googleAds.getSearchTermPerformance.useQuery(undefined, { enabled: !!(isAuthenticated && googleAdsConnected) });
  const { data: actionsData, isLoading: actionsLoading, error: actionsError, refetch: refetchActions } =
    trpc.googleAds.getConversionActionPerformance.useQuery(undefined, { enabled: !!(isAuthenticated && googleAdsConnected) });

  const getAuthUrl = trpc.googleAds.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/api/oauth/google-ads/callback` },
    { enabled: isAuthenticated }
  );

  const liveGoogleAds = summaryData?.summary ?? null;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const handleConnectGoogle = () => {
    if (getAuthUrl.data?.url) window.location.href = getAuthUrl.data.url;
  };

  const handleRefresh = () => {
    refetchStatus();
    refetchSummary();
    refetchCampaigns();
    refetchTerms();
    refetchActions();
    toast.success("Refreshing live data...");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const marketingMonthlyCeiling = 2000; // Owner planning ceiling across all marketing; not actual Google Ads budget.

  return (
    <div className="min-h-screen bg-secondary/30">
      <InternalNav />
      
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">Campaign Performance</h1>
              <p className="text-muted-foreground">
                Track real-time metrics from Google Ads and Facebook campaigns
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              API Settings
            </Button>
          </div>
        </div>

        {/* API Settings Panel */}
        {showSettings && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>API Connection Settings</CardTitle>
              <CardDescription>
                Connect your Google Ads and Facebook accounts to pull real campaign metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Google Ads Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#ff6b35]" />
                  <h3 className="text-lg font-semibold">Google Ads API</h3>
                </div>
                {googleAdsConnected ? (
                  <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Google Ads credentials saved</p>
                      <p className="text-sm text-green-700">Confirm the selected account and live campaign metrics below. Saved OAuth does not establish live ad delivery.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Google Ads credentials are configured server-side. Click the button below to authorize the connection.</p>
                    <Button onClick={handleConnectGoogle} className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                      Authorize Google Ads
                    </Button>
                  </div>
                )}
              </div>

              {/* Meta Ads is managed by the existing dedicated Facebook dashboard. */}
              <div className="space-y-3 pt-6 border-t">
                <h3 className="text-lg font-semibold">Facebook / Instagram Ads</h3>
                <p className="text-sm text-muted-foreground">Use the existing Meta Ads connection screen to authorize the correct account and verify live access. Do not paste tokens into this reporting page.</p>
                <a href="/facebook-campaigns" className="inline-flex rounded-md bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1565c0]">Open Meta Ads connection &amp; performance</a>
              </div>
              <div className="pt-3">
                <Button variant="outline" onClick={() => setShowSettings(false)}>Close settings</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Status */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className={googleAdsConnected ? "border-green-500/50" : "border-orange-500/50"}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-[#ff6b35]" />
                  <div>
                    <p className="font-semibold">Google Ads</p>
                    <p className="text-sm text-muted-foreground">
                      {googleAdsConnected ? "Connected" : "Not Connected"}
                    </p>
                  </div>
                </div>
                {googleAdsConnected ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                )}
              </div>
              {!googleAdsConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => setShowSettings(true)}
                >
                  Connect Google Ads
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className={facebookConnected ? "border-green-500/50" : "border-orange-500/50"}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Facebook className="h-8 w-8 text-[#ff6b35]" />
                  <div>
                    <p className="font-semibold">Facebook / Instagram</p>
                    <p className="text-sm text-muted-foreground">
                      {facebookConnected ? "Live account verified" : metaStatus?.connected ? "Saved credentials — verify or reconnect" : "Account not verified"}
                    </p>
                  </div>
                </div>
                {facebookConnected ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                )}
              </div>
              {!facebookConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => { window.location.href = "/facebook-campaigns"; }}
                >
                  Open Meta Ads Setup
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Google Ads Performance */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#ff6b35]" />
                  Google Ads Performance
                </CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total marketing ceiling (planning)</p>
                <p className="text-2xl font-bold text-[#ff6b35]">${marketingMonthlyCeiling.toLocaleString()}/month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
              {!googleAdsConnected ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-orange-500" />
                <p className="text-lg font-semibold mb-2">Google Ads Not Connected</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your Google Ads account to see real campaign performance metrics
                </p>
                <Button
                  onClick={handleConnectGoogle}
                  className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  Connect Now
                </Button>
              </div>
            ) : summaryLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading live data from Google Ads...
              </div>
            ) : summaryError || !liveGoogleAds ? (
              <div role="alert" className="py-8 text-sm text-orange-700">
                Live Google Ads metrics unavailable; missing data is not zero spend or zero conversions.
                {summaryError ? ` ${summaryError.message}` : " No account summary was returned."}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      Impressions
                    </div>
                    <p className="text-3xl font-bold">{(liveGoogleAds?.impressions ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total ad views</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MousePointer className="h-4 w-4" />
                      Clicks
                    </div>
                    <p className="text-3xl font-bold">{(liveGoogleAds?.clicks ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-green-600">
                      {liveGoogleAds && liveGoogleAds.ctr > 0 ? `${(liveGoogleAds.ctr * 100).toFixed(2)}% CTR` : "—"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Cost
                    </div>
                    <p className="text-3xl font-bold">${(liveGoogleAds?.cost ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {liveGoogleAds && liveGoogleAds.avgCpc > 0 ? `$${liveGoogleAds.avgCpc.toFixed(2)} CPC` : "—"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="h-4 w-4" />
                      Google Ads conversion events
                    </div>
                    <p className="text-3xl font-bold">{(liveGoogleAds?.conversions ?? 0).toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Not verified unique qualified HVAC leads</p>
                  </div>
                </div>
                {campaignsData?.campaigns && campaignsData.campaigns.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Campaign</th>
                          <th className="text-right p-3 font-medium">Status</th>
                          <th className="text-right p-3 font-medium">Impressions</th>
                          <th className="text-right p-3 font-medium">Clicks</th>
                          <th className="text-right p-3 font-medium">Spend</th>
                          <th className="text-right p-3 font-medium">Conversions</th>
                          <th className="text-right p-3 font-medium">CPC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignsData.campaigns.map(c => (
                          <tr key={c.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">{c.name}</td>
                            <td className="p-3 text-right">
                              <Badge variant={c.status === 2 ? "default" : "secondary"} className="text-xs">
                                {c.status === 2 ? "Active" : "Paused"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">{c.impressions.toLocaleString()}</td>
                            <td className="p-3 text-right">{c.clicks.toLocaleString()}</td>
                            <td className="p-3 text-right">${c.cost.toFixed(2)}</td>
                            <td className="p-3 text-right">{c.conversions.toFixed(1)}</td>
                            <td className="p-3 text-right">${c.avgCpc.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {campaignsError && <p role="alert" className="text-sm text-orange-700">Campaign details unavailable: {campaignsError.message}</p>}
                {campaignsLoading && <p className="text-sm text-muted-foreground">Loading campaign details…</p>}
                <section className="space-y-2">
                  <h3 className="font-semibold">Search terms by spend — last 30 days</h3>
                  <p className="text-xs text-muted-foreground">Read-only. Google may omit low-volume search terms; review relevance before adding negative keywords.</p>
                  {termsLoading ? <p className="text-sm text-muted-foreground">Loading search terms…</p> :
                    termsError ? <p role="alert" className="text-sm text-orange-700">Search terms unavailable: {termsError.message}</p> :
                    termsData?.terms.length ? (
                      <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-slate-50">
                            <th className="text-left p-2">Search term</th><th className="text-left p-2">Campaign</th>
                            <th className="text-right p-2">Clicks</th><th className="text-right p-2">Spend</th>
                            <th className="text-right p-2">Ad events</th>
                          </tr></thead>
                          <tbody>{termsData.terms.map((t, i) => (
                            <tr key={`${t.campaignId}-${t.searchTerm}-${i}`} className="border-b">
                              <td className="p-2">{t.searchTerm}</td><td className="p-2">{t.campaignName}</td>
                              <td className="p-2 text-right">{t.clicks}</td>
                              <td className="p-2 text-right">${t.cost.toFixed(2)}</td>
                              <td className="p-2 text-right">{t.conversions.toFixed(1)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No search-term rows returned; this does not prove zero traffic.</p>}
                </section>
                <section className="space-y-2">
                  <h3 className="font-semibold">Conversion actions — last 30 days</h3>
                  <p className="text-xs text-muted-foreground">Google Ads platform events are not deduplicated or verified qualified CRM leads. Verify forms and calls against real inquiries.</p>
                  {actionsLoading ? <p className="text-sm text-muted-foreground">Loading conversion actions…</p> :
                    actionsError ? <p role="alert" className="text-sm text-orange-700">Conversion actions unavailable: {actionsError.message}</p> :
                    actionsData?.actions.length ? (
                      <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-slate-50">
                            <th className="text-left p-2">Action</th><th className="text-left p-2">Campaign</th>
                            <th className="text-right p-2">Primary</th><th className="text-right p-2">All</th>
                          </tr></thead>
                          <tbody>{actionsData.actions.map((a, i) => (
                            <tr key={`${a.campaignId}-${a.actionName}-${i}`} className="border-b">
                              <td className="p-2">{a.actionName}</td><td className="p-2">{a.campaignName}</td>
                              <td className="p-2 text-right">{a.primaryConversions.toFixed(1)}</td>
                              <td className="p-2 text-right">{a.allConversions.toFixed(1)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No conversion-action rows returned. Tracking completeness remains unverified.</p>}
                </section>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meta results are read only in the dedicated dashboard; never render invented zero metrics. */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Facebook className="h-5 w-5 text-[#1877F2]" /> Facebook / Instagram performance</CardTitle>
            <CardDescription>Live Meta account verification is separate from saved credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Account: <strong>{facebookConnected ? "Verified via Meta API" : "Not verified"}</strong></p>
            {(metaStatusError || metaCheckError || metaCheck?.error) && <p role="alert" className="text-orange-700">Meta access issue: {metaStatusError?.message ?? metaCheckError?.message ?? metaCheck?.error}</p>}
            <p>Paid spend, campaign leads and cost per qualified inquiry: <strong>Unknown in this combined view</strong>. Use the dedicated Meta dashboard and reconcile genuine inquiries with CRM records.</p>
            <a href="/facebook-campaigns" className="inline-flex rounded-md border px-4 py-2 font-semibold text-[#1e3a5f] hover:bg-slate-50">Review Meta campaigns</a>
          </CardContent>
        </Card>

        {/* High-intent campaign review briefs — NOT new paid campaigns or a launch control. */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>80 qualified leads/month — priority campaign plays</CardTitle>
            <CardDescription>Review-ready targeting and landing-page plan. These are NOT live campaign statuses, additional budgets, or guaranteed lead forecasts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Commercial repair & maintenance", intent: "Property managers with service needs", href: "/commercial/for-property-management", blog: "/blog/commercial-rooftop-hvac-repair-request-nj", keyword: '"commercial hvac repair nj"' },
              { name: "Condo/PTAC replacement", intent: "Condo boards and multifamily owners", href: "/commercial/for-property-management", blog: "/blog/nj-condo-ptac-replacement-planning", keyword: '"ptac replacement nj"' },
              { name: "Residential system replacement", intent: "Owners seeking installation quotes", href: "/blog/central-ac-replacement-nj-cost", blog: "/blog/central-ac-replacement-nj-cost", keyword: '"hvac replacement nj"' },
            ].map(play => (
              <div key={play.name} className="rounded-lg border p-4 space-y-2">
                <p className="font-semibold text-[#1e3a5f]">{play.name}</p>
                <p className="text-sm text-muted-foreground">{play.intent} · Search theme: {play.keyword}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <a href={play.href} className="underline text-blue-700">Lead destination</a>
                  <a href={play.blog} className="underline text-blue-700">Supporting blog</a>
                </div>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">Before reallocating any existing Google or Meta spending, verify the selected Ads account, search terms, real CRM-qualified inquiries, live Netlify conversion events, and total calendar-month marketing cost. Never add a proposed budget on top of existing campaigns.</p>
          </CardContent>
        </Card>

        {/* Spend transparency: no fabricated allocation, no zero when unverified. */}
        <Card>
          <CardHeader>
            <CardTitle>Spend and lead quality</CardTitle>
            <CardDescription>
              Owner planning ceiling: ${marketingMonthlyCeiling.toLocaleString()} per calendar month across all marketing.
              Google Ads reports a rolling 30-day window, which may not match calendar-month billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Google Ads spend (last 30 days): <strong>{googleAdsConnected && liveGoogleAds ? `$${liveGoogleAds.cost.toFixed(2)}` : "Unknown"}</strong></p>
            <p>Other marketing and Facebook/Instagram paid spend: <strong>Unknown</strong> until separately verified.</p>
            <p>Monthly total marketing spend and remaining budget: <strong>Unknown</strong> until all actual costs are reconciled.</p>
            <p>Verified unique qualified HVAC leads from paid ads: <strong>Unknown</strong> until CRM and call/form attribution are reconciled.</p>
            <p className="text-muted-foreground">
              Never count outbound prospecting, clicks, tests, spam, duplicated contacts or Google Ads conversion events as qualified leads without verification.
              No automatic budget or bidding changes are made from this report.
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardFooter />
    </div>
  );
}
