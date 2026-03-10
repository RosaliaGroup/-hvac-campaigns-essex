import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import Navigation from "@/components/Navigation";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function CampaignPerformance() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [facebookConnected] = useState(false);
  const [credentials, setCredentials] = useState({
    facebookAccessToken: "",
    facebookAdAccountId: "",
  });

  // Real Google Ads data via tRPC
  const { data: connectionStatus, refetch: refetchStatus } = trpc.googleAds.getConnectionStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const googleAdsConnected = connectionStatus?.connected ?? false;

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = trpc.googleAds.getAccountSummary.useQuery(
    undefined,
    { enabled: !!(isAuthenticated && googleAdsConnected) }
  );
  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = trpc.googleAds.getCampaignPerformance.useQuery(
    undefined,
    { enabled: !!(isAuthenticated && googleAdsConnected) }
  );
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
    toast.success("Refreshing live data...");
  };

  const saveCredentials = () => {
    toast.success("Facebook credentials saved (integration coming soon)");
    setShowSettings(false);
  };

  const fetchFacebookData = async () => {
    toast.info("Facebook API integration coming soon");
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

  const totalBudget = 10000; // From budget calculator default
  const googleAdsAllocated = totalBudget * 0.425;
  const facebookAllocated = totalBudget * 0.275;

  return (
    <div className="min-h-screen bg-secondary/30">
      <InternalNav />
      <Navigation />
      
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
                      <p className="font-medium text-green-800">Google Ads Connected</p>
                      <p className="text-sm text-green-600">Customer ID: 332-572-0049 — Live data is being pulled automatically.</p>
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

              {/* Facebook Settings */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center gap-2">
                  <Facebook className="h-5 w-5 text-[#ff6b35]" />
                  <h3 className="text-lg font-semibold">Facebook Marketing API</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="facebookAccessToken">Access Token</Label>
                    <Input
                      id="facebookAccessToken"
                      type="password"
                      value={credentials.facebookAccessToken}
                      onChange={(e) => setCredentials({ ...credentials, facebookAccessToken: e.target.value })}
                      placeholder="Enter your Facebook access token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebookAdAccountId">Ad Account ID</Label>
                    <Input
                      id="facebookAdAccountId"
                      value={credentials.facebookAdAccountId}
                      onChange={(e) => setCredentials({ ...credentials, facebookAdAccountId: e.target.value })}
                      placeholder="act_123456789"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">How to get Facebook API access:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">Facebook for Developers</a></li>
                    <li>Create an app and add "Marketing API" product</li>
                    <li>Generate a User Access Token with ads_read permissions</li>
                    <li>Find your Ad Account ID in Meta Business Suite → Settings → Ad Accounts</li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={saveCredentials}
                  className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  Save Credentials
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </Button>
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
                      {facebookConnected ? "Connected" : "Not Connected"}
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
                  onClick={() => setShowSettings(true)}
                >
                  Connect Facebook
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
                <p className="text-sm text-muted-foreground">Monthly Budget</p>
                <p className="text-2xl font-bold text-[#ff6b35]">${googleAdsAllocated.toLocaleString()}</p>
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
                      Conversions
                    </div>
                    <p className="text-3xl font-bold">{(liveGoogleAds?.conversions ?? 0).toFixed(1)}</p>
                    <p className="text-xs text-green-600">Last 30 days</p>
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
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh Data
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facebook Performance */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Facebook className="h-5 w-5 text-[#ff6b35]" />
                  Facebook / Instagram Performance
                </CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Monthly Budget</p>
                <p className="text-2xl font-bold text-[#ff6b35]">${facebookAllocated.toLocaleString()}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!facebookConnected ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-orange-500" />
                <p className="text-lg font-semibold mb-2">Facebook Not Connected</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect your Facebook account to see real campaign performance metrics
                </p>
                <Button
                  onClick={() => setShowSettings(true)}
                  className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  Connect Now
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    Impressions
                  </div>
                  <p className="text-3xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">Total ad views</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MousePointer className="h-4 w-4" />
                    Clicks
                  </div>
                  <p className="text-3xl font-bold">0</p>
                  <p className="text-xs text-green-600">—</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Cost
                  </div>
                  <p className="text-3xl font-bold">$0.00</p>
                  <p className="text-xs text-muted-foreground">—</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Conversions
                  </div>
                  <p className="text-3xl font-bold">0</p>
                  <p className="text-xs text-green-600">Last 30 days</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget vs Actual Spending */}
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual Spending</CardTitle>
            <CardDescription>Compare allocated budget against actual campaign spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Google Ads Budget */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Google Ads</span>
                  <span className="text-sm text-muted-foreground">
                    ${(liveGoogleAds?.cost ?? 0).toFixed(2)} / ${googleAdsAllocated.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#ff6b35]" 
                    style={{ 
                      width: `${Math.min(((liveGoogleAds?.cost ?? 0) / googleAdsAllocated) * 100, 100)}%` 
                    }} 
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {googleAdsConnected 
                    ? `${(((liveGoogleAds?.cost ?? 0) / googleAdsAllocated) * 100).toFixed(1)}% of budget used`
                    : "Connect to track spending"}
                </p>
              </div>

              {/* Facebook Budget */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Facebook / Instagram</span>
                  <span className="text-sm text-muted-foreground">
                    $0.00 / ${facebookAllocated.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: "0%" }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {facebookConnected ? "0% of budget used" : "Connect to track spending"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DashboardFooter />
    </div>
  );
}
