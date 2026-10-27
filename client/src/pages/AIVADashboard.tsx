import { useAuth } from "@/_core/hooks/useAuth";
import InternalNav from "@/components/InternalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Share2, TrendingUp, Settings, CheckCircle, Clock, AlertCircle, Target } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { OCTOBER_B2B_SOCIAL_POSTS, buildOctoberSocialContent } from "@/data/octoberB2BSocialCampaign";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

/**
 * AI Virtual Assistant Dashboard
 * Central command center for AI-powered lead generation and customer interaction
 */
export default function AIVADashboard() {
  const { user, loading, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AI VA Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-secondary/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white py-4 flex-shrink-0">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">AI Virtual Assistant</h1>
              <p className="text-white/90 text-lg">Automated lead generation & customer interaction system</p>
            </div>
            <div className="flex gap-2">
              <Link href="/lead-scoring">
                <Button variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20">
                  <Target className="mr-2 h-4 w-4" />
                  Lead Scoring
                </Button>
              </Link>
              <Link href="/ai-va-settings">
                <Button variant="outline" className="bg-white/10 text-white border-white hover:bg-white/20">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="container py-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calls">Voice Calls</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <WeeklyLeadGoal />
            <QuickStats />
            <RecentActivity />
          </TabsContent>

          {/* Voice Calls Tab */}
          <TabsContent value="calls" className="space-y-6">
            <CallLogs />
          </TabsContent>

          {/* SMS Tab */}
          <TabsContent value="sms" className="space-y-6">
            <SmsConversations />
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social" className="space-y-6">
            <SocialPosts />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  );
}

/**
 * Weekly Lead Goal Tracker
 */
function WeeklyLeadGoal() {
  const leadsThisWeek = 12; // TODO: Get from API
  const goalLeads = 20;
  const progress = (leadsThisWeek / goalLeads) * 100;

  return (
    <Card className="border-l-4 border-l-[#ff6b35]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Weekly Lead Goal</span>
          <Badge variant={leadsThisWeek >= goalLeads ? "default" : "secondary"} className="text-lg px-3 py-1">
            {leadsThisWeek} / {goalLeads}
          </Badge>
        </CardTitle>
        <CardDescription>Track progress toward your 20+ leads/week target</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="w-full bg-secondary rounded-full h-4">
            <div 
              className="bg-[#ff6b35] h-4 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {leadsThisWeek >= goalLeads 
              ? "🎉 Goal achieved! Keep up the great work!"
              : `${goalLeads - leadsThisWeek} more leads needed to reach your goal`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Quick Stats Cards
 */
function QuickStats() {
  return (
    <div className="grid md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Calls Today</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold">8</div>
            <Phone className="h-8 w-8 text-[#ff6b35]" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">5 inbound, 3 outbound</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">SMS Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold">15</div>
            <MessageSquare className="h-8 w-8 text-[#1e3a5f]" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">12 active threads</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Social Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold">6</div>
            <Share2 className="h-8 w-8 text-[#ff6b35]" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">3 platforms, 142 engagements</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Hot Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold">4</div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Requires immediate follow-up</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Recent Activity Feed
 */
function RecentActivity() {
  const activities = [
    { type: "call", icon: Phone, message: "Inbound call from (973) 555-0123 - Qualified as hot lead", time: "5 min ago", status: "success" },
    { type: "sms", icon: MessageSquare, message: "SMS conversation with John Smith - Interested in VRF system", time: "12 min ago", status: "success" },
    { type: "social", icon: Share2, message: "Posted HVAC tip to Facebook - 23 likes, 5 comments", time: "1 hour ago", status: "success" },
    { type: "call", icon: Phone, message: "Outbound follow-up call to Sarah Johnson - Voicemail left", time: "2 hours ago", status: "pending" },
    { type: "sms", icon: MessageSquare, message: "Automated follow-up SMS sent to 3 warm leads", time: "3 hours ago", status: "success" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Real-time feed of AI VA actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                <div className={`p-2 rounded-lg ${activity.status === 'success' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <Icon className={`h-5 w-5 ${activity.status === 'success' ? 'text-green-600' : 'text-yellow-600'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
                {activity.status === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-600" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Call Logs Component
 */
function CallLogs() {
  const { data: calls, isLoading } = trpc.aiVa.listCallLogs.useQuery({ limit: 50 });

  if (isLoading) {
    return <div>Loading call logs...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Call History</CardTitle>
        <CardDescription>All calls handled by Vapi AI</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {calls && calls.length > 0 ? (
            calls.map((call: any) => (
              <div key={call.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={call.direction === "inbound" ? "default" : "secondary"}>
                      {call.direction}
                    </Badge>
                    <span className="font-medium">{call.phoneNumber}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : "In progress"}
                  </span>
                </div>
                {call.transcript && (
                  <p className="text-sm text-muted-foreground mt-2">{call.transcript.substring(0, 150)}...</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No call logs yet. Configure Vapi credentials to start receiving calls.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SMS Conversations Component
 */
function SmsConversations() {
  const { data: conversations, isLoading } = trpc.aiVa.listSmsConversations.useQuery({ limit: 50 });

  if (isLoading) {
    return <div>Loading SMS conversations...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMS Conversations</CardTitle>
        <CardDescription>Two-way text message threads</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {conversations && conversations.length > 0 ? (
            conversations.map((sms: any) => (
              <div key={sms.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={sms.direction === "inbound" ? "default" : "secondary"}>
                      {sms.direction}
                    </Badge>
                    <span className="font-medium">{sms.phoneNumber}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(sms.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">{sms.message}</p>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No SMS conversations yet. Inbound texts appear here once the Telnyx SMS webhook is receiving messages.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Social Posts Component
 */
function SocialPosts() {
  const utils = trpc.useUtils();
  const { data: posts, isLoading, error } = trpc.aiVa.listSocialPosts.useQuery({ limit: 50 });
  const { data: lane } = trpc.aiVa.socialLane.status.useQuery();
  const [gbpDiscoveryRequested, setGbpDiscoveryRequested] = useState(false);
  const [selectedGbp, setSelectedGbp] = useState("");
  const gbpDiscovery = trpc.aiVa.socialLane.discoverGoogleBusinessLocations.useQuery(undefined, { enabled: gbpDiscoveryRequested, retry: false });
  const gbpSelect = trpc.aiVa.socialLane.selectGoogleBusinessLocation.useMutation({
    onSuccess: r => { toast.success(`Business Profile selected: ${r.title}`); utils.aiVa.socialLane.status.invalidate(); gbpCheck.refetch(); },
    onError: e => toast.error(e.message),
  });
  const [gbpCheckRequested, setGbpCheckRequested] = useState(false);
  const gbpCheck = trpc.aiVa.socialLane.verifyGoogleBusinessPosting.useQuery(undefined, { enabled: gbpCheckRequested, retry: false });

  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [content, setContent] = useState("");
  const [campaignKey, setCampaignKey] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkStart, setBulkStart] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  const refresh = () => utils.aiVa.listSocialPosts.invalidate();
  const schedule = trpc.aiVa.schedulePost.useMutation({
    onSuccess: () => { toast.success("Post scheduled"); setContent(""); setCampaignKey(""); setImageUrl(""); refresh(); },
    onError: e => toast.error(e.message),
  });
  const publish = trpc.aiVa.publishPost.useMutation({
    onSuccess: result => { toast.success(result.success ? "Publishing request completed" : "Publishing request returned an error"); refresh(); setBusyId(null); },
    onError: e => { toast.error(e.message); setBusyId(null); refresh(); },
  });
  const bulkSchedule = async () => {
    if (!lane?.platforms?.facebook?.connected || bulkBusy) return;
    const start = new Date(bulkStart);
    if (!bulkStart || Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
      toast.error("Choose a future start date and time."); return;
    }
    const existing = new Set((posts ?? []).filter(p => p.platform === "facebook" && p.status !== "failed").map(p => p.content));
    const pending = OCTOBER_B2B_SOCIAL_POSTS.slice(1).filter(p => !existing.has(buildOctoberSocialContent(p, "facebook")));
    if (!pending.length) { toast.info("All seven remaining Facebook posts are already saved."); return; }
    setBulkBusy(true);
    let saved = 0;
    try {
      for (const post of pending) {
        // Twice weekly, starting at the user-selected local time.
        const at = new Date(start.getTime() + saved * 4 * 86400000);
        setBulkProgress(`Scheduling ${saved + 1} of ${pending.length}: ${post.label}`);
        await utils.client.aiVa.schedulePost.mutate({
          platform: "facebook", content: buildOctoberSocialContent(post, "facebook"),
          contentType: "commercial_campaign", scheduledAt: at.toISOString(),
        });
        saved++;
      }
      toast.success(`Scheduled ${saved} Facebook campaign posts`);
      await refresh();
    } catch (err) {
      toast.error(`Saved ${saved} posts; scheduling stopped: ${err instanceof Error ? err.message : String(err)}`);
      await refresh();
    } finally { setBulkBusy(false); setBulkProgress(""); }
  };
  const connected = lane?.platforms?.[platform]?.connected === true;
  const validDate = scheduledAt && !Number.isNaN(Date.parse(scheduledAt)) && Date.parse(scheduledAt) > Date.now();
  return <Card>
    <CardHeader>
      <CardTitle>Social Media Posts</CardTitle>
      <CardDescription>Schedule approved Facebook and Instagram content using your existing connected accounts.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-lg border p-4 space-y-2">
        <p className="font-medium text-sm">Google Business Profile — existing location</p>
        <p className="text-xs text-muted-foreground">Check whether the existing business profile has separate organic posting authorization. Google Ads, Search Console and a public Business Profile do not automatically authorize posting.</p>
        <Button size="sm" variant="outline" onClick={() => { setGbpCheckRequested(true); if (gbpCheckRequested) gbpCheck.refetch(); }} disabled={gbpCheck.isFetching}>
          {gbpCheck.isFetching ? "Checking…" : "Verify Google Business Profile Connection"}
        </Button>
        {gbpCheck.data && <p role="status" className="text-sm">{gbpCheck.data.ready ? "Location verified: " + (gbpCheck.data.locationName ?? "Connected location") : "Not ready: "}{gbpCheck.data.reason}</p>}
        {gbpCheck.data && !gbpCheck.data.ready && <div className="text-xs space-y-2">
          {"missing" in gbpCheck.data && Array.isArray(gbpCheck.data.missing) && <p>Missing posting authorization fields: {gbpCheck.data.missing.join(", ")}. Secret values are never displayed.</p>}
          <p>The existing Local SEO Google connection is separate from the legacy posting credentials. Do not create another Business Profile or assume Google Ads authorization grants posting access.</p>
          <a className="text-blue-700 underline" href="/settings/integrations">Review existing Google integrations</a>
          <span className="mx-2">·</span>
          <a className="text-blue-700 underline" href="/ai-va-settings">Review posting settings</a>
        </div>}
        {gbpCheck.error && <p role="alert" className="text-sm text-red-700">Connection check failed: {gbpCheck.error.message}</p>}
        <div className="space-y-2 border-t pt-3">
          <Button size="sm" variant="outline" onClick={() => { setGbpDiscoveryRequested(true); if (gbpDiscoveryRequested) gbpDiscovery.refetch(); }} disabled={gbpDiscovery.isFetching}>Find My Existing Google Business Profiles</Button>
          {gbpDiscovery.error && <p role="alert" className="text-xs text-red-700">{gbpDiscovery.error.message}</p>}
          {gbpDiscovery.data && <p className="text-xs">{gbpDiscovery.data.locations.length} accessible locations found across {gbpDiscovery.data.accountsFound} accounts.</p>}
          {!!gbpDiscovery.data?.locations.length && <>
            <select aria-label="Choose existing Google Business Profile" className="w-full rounded-md border bg-background p-2 text-sm" value={selectedGbp} onChange={e => setSelectedGbp(e.target.value)}>
              <option value="">Select your existing business location</option>
              {gbpDiscovery.data.locations.map(loc => <option key={loc.accountId + ":" + loc.locationId} value={loc.accountId + ":" + loc.locationId}>{loc.title} — {loc.address || loc.accountName}</option>)}
            </select>
            <Button size="sm" disabled={!selectedGbp || gbpSelect.isPending} onClick={() => {
              const [accountId, locationId] = selectedGbp.split(":");
              gbpSelect.mutate({ accountId, locationId });
            }}>Save Selected Business Profile</Button>
          </>}
        </div>
        <p className="text-xs text-muted-foreground">Automatic Google Business Profile posting stays disabled until a controlled test succeeds. Configure credentials in AI Settings if this check reports missing access.</p>
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["facebook", "instagram"] as const).map(p => <Button key={p} size="sm" variant={platform === p ? "default" : "outline"} onClick={() => { setPlatform(p); const selected = OCTOBER_B2B_SOCIAL_POSTS.find(post => post.key === campaignKey); if (selected) setContent(buildOctoberSocialContent(selected, p)); }}>{p === "facebook" ? "Facebook" : "Instagram"}</Button>)}
        </div>
        <p className="text-xs text-muted-foreground">{connected ? `${platform} connected` : `${platform} not connected — check AI Settings`}. Scheduled publishing uses the existing automation.</p>
        <label className="block text-sm">Load October commercial campaign post
          <select aria-label="Select prepared campaign post" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={campaignKey}
            onChange={e => {
              const key = e.target.value;
              setCampaignKey(key);
              const selected = OCTOBER_B2B_SOCIAL_POSTS.find(p => p.key === key);
              if (selected) setContent(buildOctoberSocialContent(selected, platform));
            }}>
            <option value="">Choose one of eight prepared posts</option>
            {OCTOBER_B2B_SOCIAL_POSTS.map(post => <option key={post.key} value={post.key}>{post.label}</option>)}
          </select>
        </label>
        <Textarea aria-label="Post content" value={content} onChange={e => setContent(e.target.value)} placeholder="Write an approved HVAC campaign post..." rows={5} />
        {platform === "instagram" && <label className="block text-sm">Public image URL (required for Instagram)
          <Input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://mechanicalenterprise.com/images/campaign.jpg" className="mt-1" />
          <span className="block text-xs text-muted-foreground mt-1">Use an image hosted at a publicly accessible HTTPS URL. Uploading local files is not supported in this form.</span>
        </label>}
        <label className="block text-sm">Schedule date and time (local)
          <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-1" />
        </label>
        <Button disabled={!connected || !content.trim() || !validDate || schedule.isPending || (platform === "instagram" && !/^https:\/\/[^\s]+\.[a-z0-9]+(?:\?[^\s]*)?$/i.test(imageUrl.trim()))} onClick={() => schedule.mutate({ platform, content: content.trim(), scheduledAt: new Date(scheduledAt).toISOString(), contentType: "commercial_campaign", mediaUrls: platform === "instagram" ? [imageUrl.trim()] : undefined })}>
          {schedule.isPending ? "Scheduling…" : "Schedule Post"}
        </Button>
        {platform === "facebook" && <div className="rounded-md border p-3 space-y-2">
          <p className="font-medium text-sm">Schedule remaining seven October B2B posts</p>
          <p className="text-xs text-muted-foreground">Uses the seven posts after the verified property-manager test. Twice-weekly spacing, existing saved posts skipped. Review each caption in the campaign selector above before scheduling.</p>
          <label className="block text-sm">First post date and time (local)
            <Input type="datetime-local" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="mt-1" />
          </label>
          <Button variant="outline" disabled={!lane?.platforms?.facebook?.connected || !bulkStart || bulkBusy || isLoading} onClick={bulkSchedule}>
            {bulkBusy ? "Scheduling…" : "Schedule Remaining 7 Facebook Posts"}
          </Button>
          {bulkProgress && <p role="status" className="text-xs">{bulkProgress}</p>}
          <p className="text-xs text-amber-700">These are saved as scheduled posts. Verify that the production due-post worker is running before relying on unattended publishing.</p>
        </div>}
        {platform === "instagram" && <p className="text-xs text-amber-700">Instagram publishing requires a public image URL. Schedule one test post and confirm it appears on the connected Instagram account before bulk scheduling.</p>}
      </div>
      {isLoading ? <p>Loading social posts...</p> : error ? <p role="alert" className="text-red-700">Unable to load social posts: {error.message}</p> :
        !posts?.length ? <p className="text-sm text-muted-foreground">No social posts saved yet. Use the form above to schedule your first approved campaign post.</p> :
        <div className="space-y-3">{posts.map(post => <div key={post.id} className="p-4 border rounded-lg">
          <div className="flex items-center justify-between gap-2 mb-2"><Badge>{post.platform}</Badge><Badge variant={post.status === "posted" ? "default" : post.status === "failed" ? "destructive" : "secondary"}>{post.status}</Badge></div>
          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
          {post.scheduledAt && <p className="text-xs text-muted-foreground mt-2">Scheduled: {new Date(post.scheduledAt).toLocaleString()}</p>}
          {post.postedAt && <p className="text-xs text-muted-foreground">Posted: {new Date(post.postedAt).toLocaleString()}</p>}
          {post.errorMessage && <p role="alert" className="text-xs text-red-700 mt-2">{post.errorMessage}</p>}
          {post.status === "scheduled" && (post.platform === "facebook" || post.platform === "instagram") &&
            <Button className="mt-3" size="sm" variant="outline" disabled={publish.isPending} onClick={() => { setBusyId(post.id); publish.mutate({ id: post.id, platform: post.platform as "facebook" | "instagram", content: post.content, mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) as string[] : undefined, approved: true }); }}>
              {publish.isPending && busyId === post.id ? "Publishing…" : "Publish Now"}
            </Button>}
        </div>)}</div>}
    </CardContent>
  </Card>;
}

/**
 * Analytics Dashboard Component
 */
function AnalyticsDashboard() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <InternalNav />
      <Card>
        <CardHeader>
          <CardTitle>Lead Generation Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Total Interactions</span>
                <span className="text-sm font-medium">156</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-[#1e3a5f] h-2 rounded-full" style={{ width: "100%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Qualified Leads</span>
                <span className="text-sm font-medium">42</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-[#ff6b35] h-2 rounded-full" style={{ width: "27%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Hot Leads</span>
                <span className="text-sm font-medium">12</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: "8%" }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Response Time</span>
              <span className="text-sm font-medium">&lt; 30 seconds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Call Answer Rate</span>
              <span className="text-sm font-medium">98%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">SMS Response Rate</span>
              <span className="text-sm font-medium">95%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Social Engagement</span>
              <span className="text-sm font-medium">8.2% avg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Lead Conversion</span>
              <span className="text-sm font-medium">28%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
