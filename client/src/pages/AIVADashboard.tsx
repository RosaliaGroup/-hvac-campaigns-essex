import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Share2, TrendingUp, Settings, CheckCircle, Clock, AlertCircle, Target } from "lucide-react";
import { Link } from "wouter";
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
              style={{ width: `${Math.min(progress, 100)}%` }}
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
            <p className="text-center text-muted-foreground py-8">No SMS conversations yet. Configure Twilio credentials to start texting.</p>
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
  const { data: posts, isLoading } = trpc.aiVa.listSocialPosts.useQuery({ limit: 50 });

  if (isLoading) {
    return <div>Loading social posts...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Posts</CardTitle>
        <CardDescription>AI-generated content across all platforms</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {posts && posts.length > 0 ? (
            posts.map((post: any) => (
              <div key={post.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge>{post.platform}</Badge>
                  <Badge variant={
                    post.status === "posted" ? "default" :
                    post.status === "scheduled" ? "secondary" :
                    post.status === "failed" ? "destructive" : "outline"
                  }>
                    {post.status}
                  </Badge>
                </div>
                <p className="text-sm">{post.content}</p>
                {post.postedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Posted {new Date(post.postedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No social posts yet. Configure social media credentials to start posting.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Analytics Dashboard Component
 */
function AnalyticsDashboard() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
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
