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
  ExternalLink
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CampaignPerformance() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  
  // API Connection State
  const [googleAdsConnected, setGoogleAdsConnected] = useState(false);
  const [facebookConnected, setFacebookConnected] = useState(false);
  
  // API Credentials (stored in localStorage for demo)
  const [credentials, setCredentials] = useState({
    googleAdsApiKey: "",
    googleAdsCustomerId: "",
    facebookAccessToken: "",
    facebookAdAccountId: "",
  });

  // Mock performance data (replace with real API calls when connected)
  const [performanceData, setPerformanceData] = useState({
    googleAds: {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      conversionRate: 0,
    },
    facebook: {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      conversionRate: 0,
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  // Load credentials from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("hvac-api-credentials");
    if (saved) {
      const parsed = JSON.parse(saved);
      setCredentials(parsed);
      setGoogleAdsConnected(!!(parsed.googleAdsApiKey && parsed.googleAdsCustomerId));
      setFacebookConnected(!!(parsed.facebookAccessToken && parsed.facebookAdAccountId));
    }
  }, []);

  const saveCredentials = () => {
    localStorage.setItem("hvac-api-credentials", JSON.stringify(credentials));
    setGoogleAdsConnected(!!(credentials.googleAdsApiKey && credentials.googleAdsCustomerId));
    setFacebookConnected(!!(credentials.facebookAccessToken && credentials.facebookAdAccountId));
    toast.success("API credentials saved successfully");
    setShowSettings(false);
  };

  const fetchGoogleAdsData = async () => {
    // TODO: Implement actual Google Ads API call
    // For now, show placeholder data
    toast.info("Google Ads API integration coming soon");
  };

  const fetchFacebookData = async () => {
    // TODO: Implement actual Facebook API call
    // For now, show placeholder data
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
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="googleAdsApiKey">Developer Token / API Key</Label>
                    <Input
                      id="googleAdsApiKey"
                      type="password"
                      value={credentials.googleAdsApiKey}
                      onChange={(e) => setCredentials({ ...credentials, googleAdsApiKey: e.target.value })}
                      placeholder="Enter your Google Ads developer token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="googleAdsCustomerId">Customer ID</Label>
                    <Input
                      id="googleAdsCustomerId"
                      value={credentials.googleAdsCustomerId}
                      onChange={(e) => setCredentials({ ...credentials, googleAdsCustomerId: e.target.value })}
                      placeholder="123-456-7890"
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">How to get Google Ads API access:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://ads.google.com/home/tools/manager-accounts/" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">Google Ads Manager Account</a></li>
                    <li>Navigate to Tools & Settings → Setup → API Center</li>
                    <li>Apply for a developer token (approval may take 24-48 hours)</li>
                    <li>Find your Customer ID in the top right corner of Google Ads dashboard</li>
                  </ol>
                </div>
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
                  <p className="text-3xl font-bold">{performanceData.googleAds.impressions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total ad views</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MousePointer className="h-4 w-4" />
                    Clicks
                  </div>
                  <p className="text-3xl font-bold">{performanceData.googleAds.clicks.toLocaleString()}</p>
                  <p className="text-xs text-green-600">
                    {performanceData.googleAds.ctr > 0 ? `${performanceData.googleAds.ctr.toFixed(2)}% CTR` : "—"}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Cost
                  </div>
                  <p className="text-3xl font-bold">${performanceData.googleAds.cost.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {performanceData.googleAds.cpc > 0 ? `$${performanceData.googleAds.cpc.toFixed(2)} CPC` : "—"}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Conversions
                  </div>
                  <p className="text-3xl font-bold">{performanceData.googleAds.conversions}</p>
                  <p className="text-xs text-green-600">
                    {performanceData.googleAds.conversionRate > 0 
                      ? `${performanceData.googleAds.conversionRate.toFixed(2)}% rate` 
                      : "—"}
                  </p>
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
                  <p className="text-3xl font-bold">{performanceData.facebook.impressions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total ad views</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MousePointer className="h-4 w-4" />
                    Clicks
                  </div>
                  <p className="text-3xl font-bold">{performanceData.facebook.clicks.toLocaleString()}</p>
                  <p className="text-xs text-green-600">
                    {performanceData.facebook.ctr > 0 ? `${performanceData.facebook.ctr.toFixed(2)}% CTR` : "—"}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Cost
                  </div>
                  <p className="text-3xl font-bold">${performanceData.facebook.cost.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {performanceData.facebook.cpc > 0 ? `$${performanceData.facebook.cpc.toFixed(2)} CPC` : "—"}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Conversions
                  </div>
                  <p className="text-3xl font-bold">{performanceData.facebook.conversions}</p>
                  <p className="text-xs text-green-600">
                    {performanceData.facebook.conversionRate > 0 
                      ? `${performanceData.facebook.conversionRate.toFixed(2)}% rate` 
                      : "—"}
                  </p>
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
                    ${performanceData.googleAds.cost.toLocaleString()} / ${googleAdsAllocated.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#ff6b35]" 
                    style={{ 
                      width: `${Math.min((performanceData.googleAds.cost / googleAdsAllocated) * 100, 100)}%` 
                    }} 
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {googleAdsConnected 
                    ? `${((performanceData.googleAds.cost / googleAdsAllocated) * 100).toFixed(1)}% of budget used`
                    : "Connect to track spending"}
                </p>
              </div>

              {/* Facebook Budget */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Facebook / Instagram</span>
                  <span className="text-sm text-muted-foreground">
                    ${performanceData.facebook.cost.toLocaleString()} / ${facebookAllocated.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600" 
                    style={{ 
                      width: `${Math.min((performanceData.facebook.cost / facebookAllocated) * 100, 100)}%` 
                    }} 
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {facebookConnected 
                    ? `${((performanceData.facebook.cost / facebookAllocated) * 100).toFixed(1)}% of budget used`
                    : "Connect to track spending"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
