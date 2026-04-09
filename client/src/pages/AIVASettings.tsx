import { useState, useEffect } from "react";
import InternalNav from "@/components/InternalNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, MessageSquare, Share2, CheckCircle2, AlertCircle, Loader2, FileText, Target, Link2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/const";

export default function AIVASettings() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Vapi credentials
  const [vapiApiKey, setVapiApiKey] = useState("");
  const [vapiAssistantId, setVapiAssistantId] = useState("");

  // Twilio credentials
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");

  // Facebook/Instagram credentials
  const [facebookAppId, setFacebookAppId] = useState("");
  const [facebookAppSecret, setFacebookAppSecret] = useState("");
  const [facebookAccessToken, setFacebookAccessToken] = useState("");

  // Google Business credentials
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");

  // Google Ads credentials
  const [gadsCustomerId, setGadsCustomerId] = useState("");
  const [gadsDeveloperToken, setGadsDeveloperToken] = useState("");
  const [gadsClientId, setGadsClientId] = useState("");
  const [gadsClientSecret, setGadsClientSecret] = useState("");

  const [activeTab, setActiveTab] = useState("vapi");
  const [gadsOauthLoading, setGadsOauthLoading] = useState(false);

  // Google Ads connection status
  const { data: gadsConnStatus, refetch: refetchGadsConn } = trpc.googleAds.getConnectionStatus.useQuery();
  const getGadsAuthUrl = trpc.googleAds.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/api/oauth/google-ads/callback` },
    { enabled: false }
  );

  // Handle ?connected=1 from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gads_connected") === "1") {
      toast({ title: "Google Ads Connected", description: "OAuth linked successfully. You can now launch campaigns." });
      refetchGadsConn();
      setActiveTab("google-ads");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Load existing credentials
  const { data: credentials, refetch: refetchCredentials } = trpc.aiVa.getAllCredentials.useQuery();

  // Populate form fields when credentials are loaded
  useEffect(() => {
    if (credentials) {
      // Load Vapi credentials
      const vapiCreds = credentials.find((c: any) => c.service === 'vapi');
      if (vapiCreds && vapiCreds.credentials) {
        setVapiApiKey(vapiCreds.credentials.apiKey || "");
        setVapiAssistantId(vapiCreds.credentials.assistantId || "");
      }

      // Load Twilio credentials
      const twilioCreds = credentials.find((c: any) => c.service === 'twilio');
      if (twilioCreds && twilioCreds.credentials) {
        setTwilioAccountSid(twilioCreds.credentials.accountSid || "");
        setTwilioAuthToken(twilioCreds.credentials.authToken || "");
        setTwilioPhoneNumber(twilioCreds.credentials.phoneNumber || "");
      }

      // Load Facebook credentials
      const facebookCreds = credentials.find((c: any) => c.service === 'facebook');
      if (facebookCreds && facebookCreds.credentials) {
        setFacebookAppId(facebookCreds.credentials.appId || "");
        setFacebookAppSecret(facebookCreds.credentials.appSecret || "");
        setFacebookAccessToken(facebookCreds.credentials.accessToken || "");
      }

      // Load Google credentials
      const googleCreds = credentials.find((c: any) => c.service === 'google_business');
      if (googleCreds && googleCreds.credentials) {
        setGoogleApiKey(googleCreds.credentials.apiKey || "");
        setGoogleClientId(googleCreds.credentials.clientId || "");
        setGoogleClientSecret(googleCreds.credentials.clientSecret || "");
      }

      // Load Google Ads credentials
      const gadsCreds = credentials.find((c: any) => c.service === 'google_ads_config');
      if (gadsCreds && gadsCreds.credentials) {
        setGadsCustomerId(gadsCreds.credentials.customerId || "");
        setGadsDeveloperToken(gadsCreds.credentials.developerToken || "");
        setGadsClientId(gadsCreds.credentials.clientId || "");
        setGadsClientSecret(gadsCreds.credentials.clientSecret || "");
      }
    }
  }, [credentials]);

  const saveCredentialsMutation = trpc.aiVa.saveCredentials.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Credentials saved securely",
      });
      // Reload credentials after successful save
      refetchCredentials();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveVapi = () => {
    if (!vapiApiKey || !vapiAssistantId) {
      toast({
        title: "Missing fields",
        description: "Please fill in all Vapi credentials",
        variant: "destructive",
      });
      return;
    }

    saveCredentialsMutation.mutate({
      service: "vapi",
      credentials: {
        apiKey: vapiApiKey,
        assistantId: vapiAssistantId,
      },
    });
  };

  const handleSaveTwilio = () => {
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      toast({
        title: "Missing fields",
        description: "Please fill in all Twilio credentials",
        variant: "destructive",
      });
      return;
    }

    saveCredentialsMutation.mutate({
      service: "twilio",
      credentials: {
        accountSid: twilioAccountSid,
        authToken: twilioAuthToken,
        phoneNumber: twilioPhoneNumber,
      },
    });
  };

  const handleSaveFacebook = () => {
    if (!facebookAppId || !facebookAppSecret || !facebookAccessToken) {
      toast({
        title: "Missing fields",
        description: "Please fill in all Facebook/Instagram credentials",
        variant: "destructive",
      });
      return;
    }

    saveCredentialsMutation.mutate({
      service: "facebook",
      credentials: {
        appId: facebookAppId,
        appSecret: facebookAppSecret,
        accessToken: facebookAccessToken,
      },
    });
  };

  const handleSaveGoogle = () => {
    if (!googleApiKey || !googleClientId || !googleClientSecret) {
      toast({
        title: "Missing fields",
        description: "Please fill in all Google Business credentials",
        variant: "destructive",
      });
      return;
    }

    saveCredentialsMutation.mutate({
      service: "google_business",
      credentials: {
        apiKey: googleApiKey,
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    });
  };

  const handleSaveGoogleAds = () => {
    if (!gadsCustomerId || !gadsDeveloperToken || !gadsClientId || !gadsClientSecret) {
      toast({
        title: "Missing fields",
        description: "Please fill in all Google Ads credentials",
        variant: "destructive",
      });
      return;
    }

    saveCredentialsMutation.mutate({
      service: "google_ads_config",
      credentials: {
        customerId: gadsCustomerId,
        developerToken: gadsDeveloperToken,
        clientId: gadsClientId,
        clientSecret: gadsClientSecret,
      },
    });
  };

  async function handleConnectGoogleAds() {
    setGadsOauthLoading(true);
    try {
      const result = await getGadsAuthUrl.refetch();
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (err: any) {
      toast({ title: "OAuth Error", description: err.message, variant: "destructive" });
      setGadsOauthLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-8">
      <InternalNav />
      <div className="container max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">AI VA Settings</h1>
              <p className="text-muted-foreground">
                Configure your AI Virtual Assistant integrations for voice calls, SMS, and social media posting
              </p>
            </div>
            <Link href="/ai-assistant-prompts">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                View AI Prompts
              </Button>
            </Link>
          </div>
        </div>

        <Alert className="mb-6 border-[#ff6b35] bg-[#ff6b35]/10">
          <AlertCircle className="h-4 w-4 text-[#ff6b35]" />
          <AlertDescription className="text-sm">
            All credentials are encrypted and stored securely. Never share your API keys publicly.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="vapi">
              <Phone className="h-4 w-4 mr-2" />
              Vapi (Voice)
            </TabsTrigger>
            <TabsTrigger value="twilio">
              <MessageSquare className="h-4 w-4 mr-2" />
              Twilio (SMS)
            </TabsTrigger>
            <TabsTrigger value="facebook">
              <Share2 className="h-4 w-4 mr-2" />
              Facebook/IG
            </TabsTrigger>
            <TabsTrigger value="google">
              <Share2 className="h-4 w-4 mr-2" />
              Google Business
            </TabsTrigger>
            <TabsTrigger value="google-ads">
              <Target className="h-4 w-4 mr-2" />
              Google Ads
            </TabsTrigger>
          </TabsList>

          {/* Vapi Tab */}
          <TabsContent value="vapi">
            <Card>
              <CardHeader>
                <CardTitle>Vapi Voice AI Configuration</CardTitle>
                <CardDescription>
                  Configure Vapi for AI-powered voice calls. Your AI VA will answer calls 24/7, qualify leads, and transfer hot leads to you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vapi-api-key">Vapi API Key</Label>
                  <Input
                    id="vapi-api-key"
                    type="password"
                    placeholder="Enter your Vapi API key"
                    value={vapiApiKey}
                    onChange={(e) => setVapiApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key from{" "}
                    <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">
                      Vapi Dashboard
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vapi-assistant-id">Assistant ID</Label>
                  <Input
                    id="vapi-assistant-id"
                    placeholder="Enter your Vapi Assistant ID"
                    value={vapiAssistantId}
                    onChange={(e) => setVapiAssistantId(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Find your Assistant ID in the Vapi Dashboard under Assistants
                  </p>
                </div>

                <Button
                  onClick={handleSaveVapi}
                  disabled={saveCredentialsMutation.isPending}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  {saveCredentialsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Vapi Credentials
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Setup Guide:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Create a Vapi account at vapi.ai</li>
                      <li>Create a new Assistant with HVAC lead qualification prompts</li>
                      <li>Copy your API key and Assistant ID here</li>
                      <li>Configure your phone number in Vapi to forward to this system</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Twilio Tab */}
          <TabsContent value="twilio">
            <Card>
              <CardHeader>
                <CardTitle>Twilio SMS Configuration</CardTitle>
                <CardDescription>
                  Configure Twilio for two-way SMS conversations. Your AI VA will respond to texts instantly and send automated follow-ups.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="twilio-account-sid">Account SID</Label>
                  <Input
                    id="twilio-account-sid"
                    placeholder="Enter your Twilio Account SID"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twilio-auth-token">Auth Token</Label>
                  <Input
                    id="twilio-auth-token"
                    type="password"
                    placeholder="Enter your Twilio Auth Token"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twilio-phone">Phone Number</Label>
                  <Input
                    id="twilio-phone"
                    placeholder="+1234567890"
                    value={twilioPhoneNumber}
                    onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Include country code (e.g., +1 for US)
                  </p>
                </div>

                <Button
                  onClick={handleSaveTwilio}
                  disabled={saveCredentialsMutation.isPending}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  {saveCredentialsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Twilio Credentials
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Setup Guide:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Log in to your Twilio Console at twilio.com/console</li>
                      <li>Find your Account SID and Auth Token on the dashboard</li>
                      <li>Purchase a phone number if you haven't already</li>
                      <li>Configure webhook URL in Twilio to point to this system</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Facebook/Instagram Tab */}
          <TabsContent value="facebook">
            <Card>
              <CardHeader>
                <CardTitle>Facebook & Instagram Configuration</CardTitle>
                <CardDescription>
                  Configure Meta Graph API for posting to Facebook Pages and Instagram Business accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook-app-id">App ID</Label>
                  <Input
                    id="facebook-app-id"
                    placeholder="Enter your Facebook App ID"
                    value={facebookAppId}
                    onChange={(e) => setFacebookAppId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook-app-secret">App Secret</Label>
                  <Input
                    id="facebook-app-secret"
                    type="password"
                    placeholder="Enter your Facebook App Secret"
                    value={facebookAppSecret}
                    onChange={(e) => setFacebookAppSecret(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook-access-token">Page Access Token</Label>
                  <Input
                    id="facebook-access-token"
                    type="password"
                    placeholder="Enter your Page Access Token"
                    value={facebookAccessToken}
                    onChange={(e) => setFacebookAccessToken(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Long-lived token with pages_manage_posts permission
                  </p>
                </div>

                <Button
                  onClick={handleSaveFacebook}
                  disabled={saveCredentialsMutation.isPending}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  {saveCredentialsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Facebook Credentials
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Setup Guide:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Go to developers.facebook.com and create a new app</li>
                      <li>Add "Instagram Basic Display" and "Pages" products</li>
                      <li>Generate a long-lived Page Access Token</li>
                      <li>Connect your Instagram Business account to your Facebook Page</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Google Ads Tab */}
          <TabsContent value="google-ads">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Google Ads Configuration</span>
                  {gadsConnStatus?.connected ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> OAuth Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Not Connected
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure Google Ads API credentials and connect your account via OAuth. Account: AW-17768263516.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OAuth Connect Section */}
                <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Google Ads OAuth Connection</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {gadsConnStatus?.connected
                          ? "Your Google account is linked. Refresh token is stored securely."
                          : "Link your Google account to enable campaign management via the API."}
                      </p>
                    </div>
                    <Button
                      variant={gadsConnStatus?.connected ? "outline" : "default"}
                      size="sm"
                      className={gadsConnStatus?.connected ? "gap-1.5" : "gap-1.5 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"}
                      onClick={handleConnectGoogleAds}
                      disabled={gadsOauthLoading}
                    >
                      {gadsOauthLoading ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting…</>
                      ) : gadsConnStatus?.connected ? (
                        <><Link2 className="h-3.5 w-3.5" />Reconnect</>
                      ) : (
                        <><Link2 className="h-3.5 w-3.5" />Connect with Google</>
                      )}
                    </Button>
                  </div>
                  {gadsConnStatus?.connected && (
                    <div className="flex gap-2">
                      <Link href="/google-ads-campaigns">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <ExternalLink className="h-3 w-3" />Go to Campaigns
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gads-customer-id">Google Ads Customer ID</Label>
                  <Input
                    id="gads-customer-id"
                    placeholder="e.g. 123-456-7890"
                    value={gadsCustomerId}
                    onChange={(e) => setGadsCustomerId(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Your Google Ads account ID (found in the top-right of Google Ads dashboard)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gads-developer-token">Developer Token</Label>
                  <Input
                    id="gads-developer-token"
                    type="password"
                    placeholder="Enter your Google Ads API Developer Token"
                    value={gadsDeveloperToken}
                    onChange={(e) => setGadsDeveloperToken(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Found in Google Ads → Tools & Settings → API Center
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gads-client-id">OAuth Client ID</Label>
                  <Input
                    id="gads-client-id"
                    placeholder="Enter your Google OAuth 2.0 Client ID"
                    value={gadsClientId}
                    onChange={(e) => setGadsClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gads-client-secret">OAuth Client Secret</Label>
                  <Input
                    id="gads-client-secret"
                    type="password"
                    placeholder="Enter your Google OAuth 2.0 Client Secret"
                    value={gadsClientSecret}
                    onChange={(e) => setGadsClientSecret(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleSaveGoogleAds}
                  disabled={saveCredentialsMutation.isPending}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  {saveCredentialsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Google Ads Credentials
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Setup Guide:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Go to console.cloud.google.com → Create/select a project</li>
                      <li>Enable the "Google Ads API"</li>
                      <li>Create OAuth 2.0 credentials (Web application type)</li>
                      <li>Add <code>{window.location.origin}/api/oauth/google-ads/callback</code> as an authorized redirect URI</li>
                      <li>Get your Developer Token from Google Ads → Tools & Settings → API Center</li>
                      <li>Apply for Standard Access if your token is still at Test level</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Google Business Tab */}
          <TabsContent value="google">
            <Card>
              <CardHeader>
                <CardTitle>Google Business Profile Configuration</CardTitle>
                <CardDescription>
                  Configure Google My Business API for posting updates to your business profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="google-api-key">API Key</Label>
                  <Input
                    id="google-api-key"
                    type="password"
                    placeholder="Enter your Google API Key"
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-client-id">Client ID</Label>
                  <Input
                    id="google-client-id"
                    placeholder="Enter your OAuth 2.0 Client ID"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-client-secret">Client Secret</Label>
                  <Input
                    id="google-client-secret"
                    type="password"
                    placeholder="Enter your OAuth 2.0 Client Secret"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleSaveGoogle}
                  disabled={saveCredentialsMutation.isPending}
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                >
                  {saveCredentialsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Google Credentials
                    </>
                  )}
                </Button>

                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Setup Guide:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Go to console.cloud.google.com and create a new project</li>
                      <li>Enable "Google My Business API"</li>
                      <li>Create OAuth 2.0 credentials</li>
                      <li>Add authorized redirect URIs for this application</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
