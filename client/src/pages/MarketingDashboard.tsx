import { Button } from "@/components/ui/button";
import InternalNav from "@/components/InternalNav";
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
  ExternalLink,
  DollarSign,
  Download,
  CheckSquare
} from "lucide-react";
import Navigation from "@/components/Navigation";
import DashboardFooter from "@/components/DashboardFooter";
import CampaignLibrary from "@/components/CampaignLibrary";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Trash2, Send, Sparkles } from "lucide-react";

const CONTENT_TYPES = [
  { value: "hvac_tip", label: "HVAC Tip" },
  { value: "rebate_alert", label: "Rebate Alert" },
  { value: "seasonal_advice", label: "Seasonal Advice" },
  { value: "energy_savings", label: "Energy Savings" },
  { value: "faq", label: "FAQ" },
  { value: "customer_testimonial", label: "Customer Testimonial" },
  { value: "maintenance_reminder", label: "Maintenance Reminder" },
  { value: "before_after", label: "Before & After" },
];

const PLATFORMS = [
  { value: "google_business", label: "Google Business Profile" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "nextdoor", label: "Nextdoor" },
];

function SocialPostManager() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [platform, setPlatform] = useState<"google_business" | "facebook" | "instagram" | "nextdoor">("google_business");
  const [contentType, setContentType] = useState<string>("hvac_tip");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: posts, isLoading: postsLoading } = trpc.aiVa.listSocialPosts.useQuery({ limit: 50 });

  const generateContent = trpc.aiVa.generatePostContent.useMutation({
    onSuccess: (data: any) => {
      const hashtags = data.hashtags?.join(" ") || "";
      setContent(`${data.content}\n\n${hashtags}`);
      toast({ title: "Content generated!", description: "Review and edit before posting." });
    },
    onError: (err: any) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const schedulePost = trpc.aiVa.schedulePost.useMutation({
    onSuccess: () => {
      toast({ title: "Post scheduled!", description: "Your post has been added to the queue." });
      setContent("");
      setScheduledAt("");
      setIsDialogOpen(false);
      utils.aiVa.listSocialPosts.invalidate();
    },
    onError: (err: any) => toast({ title: "Failed to schedule", description: err.message, variant: "destructive" }),
  });

  const deletePost = trpc.aiVa.deletePost.useMutation({
    onSuccess: () => {
      toast({ title: "Post deleted" });
      utils.aiVa.listSocialPosts.invalidate();
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const handleSchedule = () => {
    if (!content.trim()) { toast({ title: "Please enter or generate content", variant: "destructive" }); return; }
    if (!scheduledAt) { toast({ title: "Please select a scheduled date/time", variant: "destructive" }); return; }
    schedulePost.mutate({ platform, content, contentType, scheduledAt: new Date(scheduledAt).toISOString() });
  };

  const platformBadgeColor = (p: string) => {
    if (p === "google_business") return "bg-blue-100 text-blue-800";
    if (p === "facebook") return "bg-indigo-100 text-indigo-800";
    if (p === "instagram") return "bg-pink-100 text-pink-800";
    if (p === "nextdoor") return "bg-green-100 text-green-800";
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Create Post Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI-Powered Social Posts</CardTitle>
              <CardDescription>Generate, schedule, and manage posts for Google Business, Facebook & Instagram</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                  <Plus className="h-4 w-4 mr-2" /> Create Post
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create & Schedule Post</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Platform</label>
                      <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Content Type</label>
                      <Select value={contentType} onValueChange={setContentType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTENT_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium">Post Content</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateContent.mutate({ platform, contentType: contentType as any })}
                        disabled={generateContent.isPending}
                      >
                        {generateContent.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        AI Generate
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Write your post content here, or use AI Generate above..."
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{content.length} characters</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Schedule Date & Time</label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <strong>Note:</strong> To auto-publish posts, connect your Google Business Profile, Facebook, or Instagram credentials in the AI VA Settings page.
                  </div>

                  <Button
                    className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
                    onClick={handleSchedule}
                    disabled={schedulePost.isPending}
                  >
                    {schedulePost.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
                    Schedule Post
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {postsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-3">
              {posts.map((post: any) => (
                <div key={post.id} className="p-4 border rounded-lg flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${platformBadgeColor(post.platform)}`}>
                        {PLATFORMS.find(p => p.value === post.platform)?.label || post.platform}
                      </span>
                      <Badge variant={
                        post.status === "posted" ? "default" :
                        post.status === "scheduled" ? "secondary" :
                        post.status === "failed" ? "destructive" : "outline"
                      }>
                        {post.status}
                      </Badge>
                      {post.scheduledAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.scheduledAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-3">{post.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => deletePost.mutate({ id: post.id })}
                    disabled={deletePost.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No posts yet</p>
              <p className="text-sm mb-4">Use the AI generator to create and schedule your first post</p>
              <Button
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                onClick={() => setIsDialogOpen(true)}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Generate First Post
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Publish Setup</CardTitle>
          <CardDescription>Connect your accounts to publish posts automatically when scheduled</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Google Business Profile</p>
                  <p className="text-xs text-muted-foreground">Connect via AI VA Settings to auto-publish posts</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open('/ai-va', '_blank')}>
                Configure
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Facebook className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-sm">Facebook Page</p>
                  <p className="text-xs text-muted-foreground">Business ID: 25087499474212997 · Asset: 844109052114327</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}>
                Open FB
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Instagram className="h-5 w-5 text-pink-600" />
                <div>
                  <p className="font-medium text-sm">Instagram</p>
                  <p className="text-xs text-muted-foreground">Connected via Facebook Business Manager</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}>
                Open IG
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MarketingDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [monthlyBudget, setMonthlyBudget] = useState([10000]);

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
    <div className="h-screen flex flex-col bg-secondary/30">
      <InternalNav />
      <Navigation />
      
      <div className="flex-1 overflow-y-auto">
      <div className="container py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">Marketing Dashboard</h1>
          <p className="text-muted-foreground">Manage your campaigns and social media from one place</p>
        </div>

        {/* Platform Connection Status */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Globe className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Manual</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold mb-1">Google Business</p>
              <p className="text-xs text-muted-foreground mb-3">Manage your profile</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => window.open('https://business.google.com/dashboard', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Manual</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold mb-1">Google Ads</p>
              <p className="text-xs text-muted-foreground mb-3">Campaign management</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => window.open('https://ads.google.com/aw/campaigns', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Facebook className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Manual</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold mb-1">Facebook</p>
              <p className="text-xs text-muted-foreground mb-3">Post & manage ads</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Instagram className="h-5 w-5 text-[#ff6b35]" />
                <Badge variant="outline" className="text-xs">Manual</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-semibold mb-1">Instagram</p>
              <p className="text-xs text-muted-foreground mb-3">Share content</p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
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

            {/* Budget Calculator */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-[#ff6b35]" />
                      Monthly Budget Calculator
                    </CardTitle>
                    <CardDescription>Recommended allocation across platforms ($8K-15K strategy)</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('/campaign-launch-checklist.pdf', '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Campaign Checklist
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Budget Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Total Monthly Budget</label>
                    <span className="text-2xl font-bold text-[#ff6b35]">
                      ${monthlyBudget[0].toLocaleString()}
                    </span>
                  </div>
                  <Slider
                    value={monthlyBudget}
                    onValueChange={setMonthlyBudget}
                    min={8000}
                    max={15000}
                    step={500}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$8,000</span>
                    <span>$15,000</span>
                  </div>
                </div>

                {/* Platform Allocation */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Recommended Platform Allocation</h3>
                  
                  {/* Google Ads */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-[#ff6b35]" />
                        <span className="text-sm font-medium">Google Ads (Search)</span>
                      </div>
                      <span className="text-sm font-bold">
                        ${Math.round(monthlyBudget[0] * 0.425).toLocaleString()} <span className="text-xs text-muted-foreground">(42.5%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-[#ff6b35]" style={{ width: '42.5%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">High-intent searches, emergency repairs, installations</p>
                  </div>

                  {/* Facebook/Instagram */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Facebook className="h-4 w-4 text-[#ff6b35]" />
                        <span className="text-sm font-medium">Facebook/Instagram</span>
                      </div>
                      <span className="text-sm font-bold">
                        ${Math.round(monthlyBudget[0] * 0.275).toLocaleString()} <span className="text-xs text-muted-foreground">(27.5%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: '27.5%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Brand awareness, lead generation, retargeting</p>
                  </div>

                  {/* YouTube */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Youtube className="h-4 w-4 text-[#ff6b35]" />
                        <span className="text-sm font-medium">YouTube</span>
                      </div>
                      <span className="text-sm font-bold">
                        ${Math.round(monthlyBudget[0] * 0.15).toLocaleString()} <span className="text-xs text-muted-foreground">(15%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-red-600" style={{ width: '15%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Educational content, system demonstrations</p>
                  </div>

                  {/* Display Network */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[#ff6b35]" />
                        <span className="text-sm font-medium">Display Network</span>
                      </div>
                      <span className="text-sm font-bold">
                        ${Math.round(monthlyBudget[0] * 0.10).toLocaleString()} <span className="text-xs text-muted-foreground">(10%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-green-600" style={{ width: '10%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Banner ads, remarketing campaigns</p>
                  </div>

                  {/* Nextdoor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[#ff6b35]" />
                        <span className="text-sm font-medium">Nextdoor</span>
                      </div>
                      <span className="text-sm font-bold">
                        ${Math.round(monthlyBudget[0] * 0.05).toLocaleString()} <span className="text-xs text-muted-foreground">(5%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600" style={{ width: '5%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Hyper-local neighborhood targeting</p>
                  </div>
                </div>

                {/* Daily Budget Breakdown */}
                <div className="pt-4 border-t">
                  <h3 className="font-semibold text-sm mb-3">Daily Budget Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Google Ads/day</p>
                      <p className="text-lg font-bold">${Math.round(monthlyBudget[0] * 0.425 / 30)}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Facebook/day</p>
                      <p className="text-lg font-bold">${Math.round(monthlyBudget[0] * 0.275 / 30)}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">YouTube/day</p>
                      <p className="text-lg font-bold">${Math.round(monthlyBudget[0] * 0.15 / 30)}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <Button
                    className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                    onClick={() => window.open('/campaign-launch-checklist.pdf', '_blank')}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checklist
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/leads')}
                  >
                    Lead Tracker
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/campaign-performance')}
                  >
                    Performance
                  </Button>
                </div>
              </CardContent>
            </Card>

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
onClick={() => window.open('https://business.google.com/dashboard', '_blank')}
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
onClick={() => window.open('https://ads.google.com/aw/campaigns', '_blank')}
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
onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}
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
onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}
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
            <SocialPostManager />
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
                      <Button variant="outline" size="sm" onClick={() => window.open('https://business.google.com/dashboard', '_blank')}>Open</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Google Ads</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open('https://ads.google.com/aw/campaigns', '_blank')}>Open</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Facebook className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Facebook</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}>Open</Button>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Instagram className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Instagram</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open('https://business.facebook.com/latest/home?nav_ref=bm_home_redirect&business_id=25087499474212997&asset_id=844109052114327', '_blank')}>Open</Button>
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
      </div>
      <DashboardFooter />
    </div>
  );
}
