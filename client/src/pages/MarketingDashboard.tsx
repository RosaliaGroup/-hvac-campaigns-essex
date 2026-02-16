import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Facebook, 
  Instagram, 
  Youtube, 
  Globe, 
  TrendingUp,
  Calendar,
  MessageSquare,
  Settings,
  Plus,
  ExternalLink
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CampaignLibrary from "@/components/CampaignLibrary";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function MarketingDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

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

  return (
    <div className="min-h-screen bg-secondary/30">
      <Navigation />
      
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">Marketing Dashboard</h1>
          <p className="text-muted-foreground">Manage your campaigns and social media from one place</p>
        </div>

        {/* Platform Connection Status */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Globe className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Google Business</p>
              <p className="text-xs text-muted-foreground">Manage your profile</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Google Ads</p>
              <p className="text-xs text-muted-foreground">Campaign management</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Facebook className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Facebook</p>
              <p className="text-xs text-muted-foreground">Post & manage ads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Instagram className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold">Instagram</p>
              <p className="text-xs text-muted-foreground">Share content</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                  <CardDescription>Last 30 days performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Impressions</p>
                      <p className="text-2xl font-bold">--</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Click-Through Rate</p>
                      <p className="text-2xl font-bold">--</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-[#ff6b35]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Leads Generated</p>
                      <p className="text-2xl font-bold">--</p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest campaign updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No recent activity</p>
                    <p className="text-sm">Connect your platforms to see updates</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>Connect your marketing platforms to begin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <Globe className="h-8 w-8 text-[#ff6b35] mb-3" />
                    <h3 className="font-semibold mb-2">Google Business Profile</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Manage your business listing, respond to reviews, and post updates
                    </p>
                    <Button 
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                      onClick={() => window.open('https://business.google.com', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Google Business
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <BarChart3 className="h-8 w-8 text-[#ff6b35] mb-3" />
                    <h3 className="font-semibold mb-2">Google Ads</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create and manage search, display, and YouTube advertising campaigns
                    </p>
                    <Button 
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                      onClick={() => window.open('https://ads.google.com', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Google Ads
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <Facebook className="h-8 w-8 text-[#ff6b35] mb-3" />
                    <h3 className="font-semibold mb-2">Facebook</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Post content, run ads, and engage with your audience on Facebook
                    </p>
                    <Button 
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                      onClick={() => window.open('https://business.facebook.com', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Meta Business Suite
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <Instagram className="h-8 w-8 text-[#ff6b35] mb-3" />
                    <h3 className="font-semibold mb-2">Instagram</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Share photos, stories, and reels to showcase your HVAC work
                    </p>
                    <Button 
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                      onClick={() => window.open('https://business.facebook.com/instagram', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Instagram Business
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Templates</CardTitle>
                <CardDescription>Ready-to-use ad copy and campaign templates based on your marketing strategy</CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignLibrary />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Social Media Posts</CardTitle>
                    <CardDescription>Schedule and manage your content</CardDescription>
                  </div>
                  <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Post
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-semibold mb-2">No posts scheduled</p>
                  <p className="text-sm">Connect your social media accounts to start posting</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>Track your marketing performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-semibold mb-2">No analytics data</p>
                  <p className="text-sm">Connect your platforms to view performance metrics</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Settings</CardTitle>
                <CardDescription>Configure your marketing dashboard</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Connected Platforms</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Google Business Profile</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Connect</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Google Ads</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Connect</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Facebook className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Facebook</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Connect</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Instagram className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Instagram</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Connect</Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Notification Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Campaign alerts</p>
                        <p className="text-sm text-muted-foreground">Get notified about campaign performance</p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Lead notifications</p>
                        <p className="text-sm text-muted-foreground">Receive alerts for new leads</p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}
