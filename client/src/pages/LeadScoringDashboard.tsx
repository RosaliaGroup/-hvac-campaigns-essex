import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, TrendingDown, Flame, Zap, Snowflake, 
  Phone, MessageSquare, Share2, Globe, ArrowLeft, RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * Lead Scoring Dashboard
 * Intelligent prioritization of leads based on interactions and engagement
 */
export default function LeadScoringDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedPriority, setSelectedPriority] = useState<'hot' | 'warm' | 'cold' | undefined>(undefined);

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
          <p className="text-muted-foreground">Loading lead scoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white py-8">
        <div className="container">
          <div className="flex items-center gap-4">
            <Link href="/ai-va-dashboard">
              <Button variant="outline" size="icon" className="bg-white/10 text-white border-white hover:bg-white/20">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold mb-2">Lead Scoring Dashboard</h1>
              <p className="text-white/90 text-lg">Intelligent prioritization based on engagement and interactions</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="space-y-6">
          {/* Score Statistics */}
          <ScoreStatistics />

          {/* Top Leads */}
          <TopLeads />

          {/* Leads by Priority */}
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" onClick={() => setSelectedPriority(undefined)}>
                All Leads
              </TabsTrigger>
              <TabsTrigger value="hot" onClick={() => setSelectedPriority('hot')}>
                <Flame className="mr-2 h-4 w-4" />
                Hot
              </TabsTrigger>
              <TabsTrigger value="warm" onClick={() => setSelectedPriority('warm')}>
                <Zap className="mr-2 h-4 w-4" />
                Warm
              </TabsTrigger>
              <TabsTrigger value="cold" onClick={() => setSelectedPriority('cold')}>
                <Snowflake className="mr-2 h-4 w-4" />
                Cold
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <LeadsList priority={undefined} />
            </TabsContent>
            <TabsContent value="hot">
              <LeadsList priority="hot" />
            </TabsContent>
            <TabsContent value="warm">
              <LeadsList priority="warm" />
            </TabsContent>
            <TabsContent value="cold">
              <LeadsList priority="cold" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/**
 * Score Statistics Component
 */
function ScoreStatistics() {
  const { data: stats, isLoading } = trpc.leadScoring.getScoreStats.useQuery();

  if (isLoading) {
    return <div>Loading statistics...</div>;
  }

  return (
    <div className="grid md:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.totalLeads || 0}</div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-green-600" />
            Hot Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">{stats?.hotLeads || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Score 80+</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-600" />
            Warm Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">{stats?.warmLeads || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Score 40-79</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-blue-600" />
            Cold Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{stats?.coldLeads || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Score 0-39</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.avgScore || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Across all leads</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Top Leads Component
 */
function TopLeads() {
  const { data: topLeads, isLoading } = trpc.leadScoring.getTopLeads.useQuery({ limit: 5 });

  if (isLoading) {
    return <div>Loading top leads...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Leads by Score</CardTitle>
        <CardDescription>Highest priority leads requiring immediate attention</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topLeads && topLeads.length > 0 ? (
            topLeads.map((lead: any, index: number) => (
              <div key={lead.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-muted-foreground">#{index + 1}</div>
                  <div>
                    <div className="font-semibold">{lead.name}</div>
                    <div className="text-sm text-muted-foreground">{lead.contact}</div>
                    <div className="text-xs text-muted-foreground mt-1">{lead.service}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ color: getScoreColor(lead.score) }}>
                      {lead.score}
                    </div>
                    <div className="text-xs text-muted-foreground">{lead.interactionCount} interactions</div>
                  </div>
                  <PriorityBadge priority={lead.priority} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No leads yet. Start capturing leads to see scoring.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Leads List Component
 */
function LeadsList({ priority }: { priority?: 'hot' | 'warm' | 'cold' }) {
  const { data: leads, isLoading, refetch } = trpc.leadScoring.getScoredLeads.useQuery({ 
    priority, 
    limit: 50 
  });
  const { toast } = useToast();
  const recalculateScore = trpc.leadScoring.recalculateScore.useMutation({
    onSuccess: () => {
      toast({
        title: "Score updated",
        description: "Lead score has been recalculated successfully.",
      });
      refetch();
    },
  });

  if (isLoading) {
    return <div>Loading leads...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {priority ? `${priority.charAt(0).toUpperCase() + priority.slice(1)} Leads` : 'All Leads'}
        </CardTitle>
        <CardDescription>
          Sorted by score and last interaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leads && leads.length > 0 ? (
            leads.map((lead: any) => (
              <div key={lead.id} className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{lead.name}</h3>
                      <PriorityBadge priority={lead.priority} />
                      <Badge variant="outline">{lead.status}</Badge>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                      <div>📞 {lead.contact}</div>
                      <div>🔧 {lead.service}</div>
                      <div>📍 {lead.source}</div>
                      <div>💬 {lead.interactionCount} interactions</div>
                    </div>

                    {lead.scoreBreakdown && (
                      <ScoreBreakdown breakdown={JSON.parse(lead.scoreBreakdown)} />
                    )}

                    {lead.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">"{lead.notes}"</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <div className="text-3xl font-bold" style={{ color: getScoreColor(lead.score) }}>
                        {lead.score}
                      </div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recalculateScore.mutate({ leadId: lead.id })}
                      disabled={recalculateScore.isPending}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Recalc
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No {priority} leads found. {!priority && "Start capturing leads to see them here."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Priority Badge Component
 */
function PriorityBadge({ priority }: { priority: 'hot' | 'warm' | 'cold' }) {
  const config = {
    hot: { icon: Flame, color: 'bg-green-100 text-green-700 border-green-300', label: 'Hot' },
    warm: { icon: Zap, color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Warm' },
    cold: { icon: Snowflake, color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Cold' },
  };

  const { icon: Icon, color, label } = config[priority];

  return (
    <Badge className={`${color} border`}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

/**
 * Score Breakdown Component
 */
function ScoreBreakdown({ breakdown }: { breakdown: any }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 mt-2">
      <div className="text-xs font-semibold mb-2">Score Breakdown:</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {breakdown.callScore > 0 && (
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3 text-[#ff6b35]" />
            <span>Calls: {breakdown.callScore}</span>
          </div>
        )}
        {breakdown.smsScore > 0 && (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-[#1e3a5f]" />
            <span>SMS: {breakdown.smsScore}</span>
          </div>
        )}
        {breakdown.socialScore > 0 && (
          <div className="flex items-center gap-1">
            <Share2 className="h-3 w-3 text-[#ff6b35]" />
            <span>Social: {breakdown.socialScore}</span>
          </div>
        )}
        {breakdown.websiteScore > 0 && (
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-[#1e3a5f]" />
            <span>Web: {breakdown.websiteScore}</span>
          </div>
        )}
        {breakdown.recencyBonus > 0 && (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span>Recency: {breakdown.recencyBonus}</span>
          </div>
        )}
        {breakdown.serviceBonus > 0 && (
          <div className="flex items-center gap-1">
            <span>Service: {breakdown.serviceBonus}</span>
          </div>
        )}
        {breakdown.budgetBonus > 0 && (
          <div className="flex items-center gap-1">
            <span>Budget: {breakdown.budgetBonus}</span>
          </div>
        )}
        {breakdown.timelineBonus > 0 && (
          <div className="flex items-center gap-1">
            <span>Timeline: {breakdown.timelineBonus}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}
