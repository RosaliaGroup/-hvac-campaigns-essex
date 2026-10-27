import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  RefreshCw, ArrowRight, Calendar, BarChart3, Loader2, Bot, Rocket,
  DollarSign, Users, Clock, ChevronRight
} from "lucide-react";
import { getLoginUrl } from "@/const";
import InternalNav from "@/components/InternalNav";

const WEEKLY_GOAL = 20;

const trendColors = {
  exceeding: "text-green-600",
  on_track: "text-blue-600",
  behind: "text-amber-600",
  critical: "text-red-600",
};

const trendBg = {
  exceeding: "bg-green-50 border-green-200",
  on_track: "bg-blue-50 border-blue-200",
  behind: "bg-amber-50 border-amber-200",
  critical: "bg-red-50 border-red-200",
};

const trendLabels = {
  exceeding: "Exceeding Goal",
  on_track: "On Track",
  behind: "Behind Goal",
  critical: "Critical — Action Required",
};

const priorityColors = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
};

const categoryIcons: Record<string, React.ReactNode> = {
  budget: <DollarSign className="h-4 w-4" />,
  targeting: <Target className="h-4 w-4" />,
  creative: <Zap className="h-4 w-4" />,
  new_campaign: <Rocket className="h-4 w-4" />,
  jessica: <Bot className="h-4 w-4" />,
  seo: <TrendingUp className="h-4 w-4" />,
};

const apptTypeLabels: Record<string, string> = {
  free_consultation: "Free Consultation",
  technician_dispatch: "Technician Dispatch",
  maintenance_plan: "Maintenance Plan",
  commercial_assessment: "Commercial Assessment",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  rescheduled: "bg-purple-100 text-purple-800",
};

export default function MarketingAutopilot() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = trpc.autopilot.analyze.useQuery(undefined, {
    // Each analysis calls a paid AI model; refreshing every five minutes while
    // a dashboard is open burned credits without verifying new qualified leads.
    // Keep a periodic six-hour read-only review and a manual refresh button.
    staleTime: 6 * 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: appointments, isLoading: apptLoading, refetch: refetchAppts } = trpc.appointments.list.useQuery({ limit: 50 });
  const { data: apptStats } = trpc.appointments.stats.useQuery();
  // Real CRM capture data, not Google Ads clicks, appointments, or AI estimates.
  // The server intentionally labels advanced stages as unverified for lead quality.
  const {
    data: crmBaseline,
    error: crmBaselineError,
    isLoading: crmBaselineLoading,
    refetch: refetchCrmBaseline,
  } = trpc.leadCaptures.marketingBaseline.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const refreshMutation = trpc.autopilot.refresh.useMutation({
    onSuccess: () => {
      refetchAnalysis();
      refetchCrmBaseline();
      toast({ title: "Analysis refreshed", description: "Appointment recommendations and read-only CRM intake data refreshed. Lead qualification still requires review." });
    },
  });

  const updateApptStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      refetchAppts();
      toast({ title: "Status updated" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Sign in to access Marketing Autopilot</h2>
          <Button onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
        </div>
      </div>
    );
  }

  const trend = analysis?.trend ?? "critical";
  const thisWeek = analysis?.thisWeekCount ?? 0;
  const gap = analysis?.gapToGoal ?? WEEKLY_GOAL;
  const pct = analysis?.percentToGoal ?? 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <InternalNav />
      <div className="flex-1 overflow-y-auto">
      <div className="container py-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-6 w-6 text-[#ff6b35]" />
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Marketing Autopilot</h1>
            </div>
            <p className="text-muted-foreground">Business goal: <strong>80 unique qualified HVAC leads/month</strong>. Appointments and website capture records are tracked separately.</p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
          >
            {refreshMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh Analysis
          </Button>
        </div>

        {/* Lead goal is not measured by this appointment-only dataset. */}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-5">
          <div className="font-semibold text-amber-900">Qualified HVAC leads: UNKNOWN / {analysis?.qualifiedLeadGoalMonthly ?? 80} monthly goal</div>
          <p className="text-sm text-amber-900 mt-1">The complete cross-channel, geographically eligible and deduplicated CRM lead total has not been verified. Website captures and advanced CRM stages are shown separately below, not added to the 80-lead count.</p>
          <div className="flex flex-wrap gap-4 mt-2">
            <a href="/lead-dashboard" className="text-sm font-semibold underline text-blue-700">Review incoming CRM leads</a>
            <a href="/campaign-performance" className="text-sm font-semibold underline text-blue-700">Review advertising diagnostics</a>
          </div>
        </div>

        {/* Authenticated, read-only web lead intake. This is a 30-day
            operational sample, NOT the deduplicated monthly 80-lead KPI. */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>CRM website lead intake — last 30 days</CardTitle>
            <p className="text-sm text-muted-foreground">
              Actual stored form submissions and their current pipeline stages. Not all are genuine, unique, geographically eligible or qualified.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {crmBaselineLoading ? (
              <p className="text-sm text-muted-foreground">Reading CRM intake records…</p>
            ) : crmBaselineError ? (
              <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                CRM intake unavailable: {crmBaselineError.message}. Counts are unknown, not zero.
              </div>
            ) : crmBaseline ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Website capture records</p>
                    <p className="text-2xl font-semibold">{crmBaseline.totalCaptures}</p>
                    <p className="text-xs text-muted-foreground">Raw records; duplicates may exist</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Advanced-stage records</p>
                    <p className="text-2xl font-semibold">{crmBaseline.qualifiedStage}</p>
                    <p className="text-xs text-muted-foreground">Not independently qualified or deduplicated</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">New, unassigned</p>
                    <p className="text-2xl font-semibold">{crmBaseline.newUnassigned}</p>
                    <p className="text-xs text-muted-foreground">Needs owner review</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Overdue follow-ups</p>
                    <p className="text-2xl font-semibold">{crmBaseline.followUpOverdue}</p>
                    <p className="text-xs text-muted-foreground">CRM due dates; not proof of delivery</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(crmBaseline.byChannel).sort((a,b) => b[1] - a[1]).map(([channel,count]) => (
                    <Badge variant="outline" key={channel}>{channel}: {count} records</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Scope: website capture table only, rolling 30 days. This does not include every call, email reply, external ad lead or bid opportunity. An advanced stage is not proof of a unique qualified HVAC inquiry.
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <a href="/lead-dashboard" className="text-sm font-semibold text-blue-700 underline">Open CRM lead review</a>
                  <Button variant="outline" size="sm" onClick={() => refetchCrmBaseline()}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh CRM counts
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">CRM intake data unavailable — no count has been inferred.</p>
            )}
          </CardContent>
        </Card>

        {/* Appointment-only progress — not the monthly lead KPI. */}
        <div className={`rounded-xl border-2 p-6 mb-8 ${trendBg[trend]}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {trend === "exceeding" ? (
                <CheckCircle2 className="h-12 w-12 text-green-600 flex-shrink-0" />
              ) : trend === "on_track" ? (
                <TrendingUp className="h-12 w-12 text-blue-600 flex-shrink-0" />
              ) : trend === "behind" ? (
                <TrendingDown className="h-12 w-12 text-amber-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-red-600 flex-shrink-0" />
              )}
              <div>
                <div className={`text-2xl font-bold ${trendColors[trend]}`}>Appointment pace: {trend === "critical" ? "Below weekly appointment goal" : trendLabels[trend]}</div>
                <div className="text-gray-700 mt-1">
                  <span className="text-3xl font-bold">{thisWeek}</span>
                  <span className="text-lg"> / {WEEKLY_GOAL} appointments this week</span>
                  {gap > 0 && (
                    <span className="ml-2 text-sm font-medium text-gray-600">— need {gap} more</span>
                  )}
                </div>
              </div>
            </div>
            <div className="md:w-64">
              <div className="flex justify-between text-sm font-medium mb-2">
                <span>Weekly appointment progress</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-4" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>Goal: 20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-[#ff6b35]" />
                <div>
                  <div className="text-2xl font-bold text-[#1e3a5f]">{apptStats?.thisWeek ?? 0}</div>
                  <div className="text-xs text-muted-foreground">This Week</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <div className="text-2xl font-bold text-[#1e3a5f]">{apptStats?.pending ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-[#1e3a5f]">{apptStats?.confirmed ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Confirmed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-[#1e3a5f]" />
                <div>
                  <div className="text-2xl font-bold text-[#1e3a5f]">{apptStats?.total ?? 0}</div>
                  <div className="text-xs text-muted-foreground">All Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Trend Chart */}
        {analysis?.weeklyTrend && analysis.weeklyTrend.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#ff6b35]" />
                Weekly Appointment Trend (Last 8 Weeks)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {analysis.weeklyTrend.map((week, i) => {
                  const heightPct = Math.max(0, Math.min(100, (week.count / WEEKLY_GOAL) * 100));
                  const isGoalMet = week.count >= WEEKLY_GOAL;
                  const isCurrentWeek = i === analysis.weeklyTrend.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs font-bold text-gray-700">{week.count}</div>
                      <div className="w-full relative" style={{ height: "80px" }}>
                        {/* Goal line */}
                        <div className="absolute w-full border-t-2 border-dashed border-gray-300" style={{ top: "0%" }} />
                        {/* Bar */}
                        <div
                          className={`absolute bottom-0 w-full rounded-t transition-all ${isGoalMet ? "bg-green-500" : isCurrentWeek ? "bg-[#ff6b35]" : "bg-[#1e3a5f]/60"}`}
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 text-center leading-tight">{week.week}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Goal met</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ff6b35] inline-block" /> This week</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#1e3a5f]/60 inline-block" /> Previous weeks</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-dashed border-gray-300 inline-block" /> 20/week goal</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="recommendations" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="recommendations">Action recommendations</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
          </TabsList>

          {/* AI Recommendations Tab */}
          <TabsContent value="recommendations">
            {analysisLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#ff6b35] mx-auto mb-3" />
                  <p className="text-muted-foreground">Preparing read-only recommendations from available data…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {analysis?.recommendations?.map((rec) => (
                  <Card key={rec.id} className="border-l-4 border-l-[#ff6b35]">
                    <CardContent className="pt-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className={`text-xs ${priorityColors[rec.priority as keyof typeof priorityColors]}`}>
                              {rec.priority.toUpperCase()}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                              {categoryIcons[rec.category]}
                              <span className="capitalize">{rec.category.replace("_", " ")}</span>
                            </div>
                            <span className="text-xs font-semibold text-green-700 bg-green-50 rounded px-2 py-0.5">
                              {rec.expectedImpact}
                            </span>
                          </div>
                          <h3 className="font-bold text-[#1e3a5f] text-lg mb-1">{rec.title}</h3>
                          <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                          <div className="bg-gray-50 rounded-lg p-3 border">
                            <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                              <ChevronRight className="h-3 w-3" /> ACTION
                            </div>
                            <p className="text-sm text-gray-800">{rec.action}</p>
                          </div>
                          {rec.campaignData && (
                            <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <div className="text-xs font-semibold text-blue-700 mb-2">Draft only — NOT activated or budget-approved</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{rec.campaignData.name}</span></div>
                                <div><span className="text-gray-500">Budget:</span> <span className="font-medium">${rec.campaignData.budget}/day</span></div>
                                <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{rec.campaignData.type.replace("_", " ")}</span></div>
                                <div><span className="text-gray-500">Keywords:</span> <span className="font-medium">{rec.campaignData.keywords?.length ?? 0}</span></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 md:min-w-36">
                          <Badge variant="outline" className="text-xs justify-center">
                            Review recommendation — no automatic paid change
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!analysis?.recommendations || analysis.recommendations.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Click "Refresh Analysis" to generate AI recommendations</p>
                  </div>
                )}
                {analysis?.generatedAt && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Last analyzed: {new Date(analysis.generatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments">
            {apptLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
              </div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No appointments yet</p>
                <p className="text-sm mt-1">Appointments booked by Jessica will appear here automatically</p>
                <div className="mt-4 text-sm bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto text-left">
                  <p className="font-semibold text-amber-800 mb-2">To start receiving appointments:</p>
                  <ol className="text-amber-700 space-y-1 list-decimal list-inside">
                    <li>Open Vapi Dashboard → your assistant</li>
                    <li>Go to Tools → Add Tool → Server URL</li>
                    <li>Set URL to: <code className="bg-white rounded px-1">https://mechanicalenterprise.com/api/trpc/webhooks.vapiTools</code></li>
                    <li>Add the 3 tools: bookAppointment, rescheduleAppointment, getCallerInfo</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <Card key={appt.id}>
                    <CardContent className="pt-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-[#1e3a5f]">{appt.fullName}</span>
                            <Badge className={`text-xs ${statusColors[appt.status]}`}>{appt.status}</Badge>
                            <Badge variant="outline" className="text-xs">
                              {apptTypeLabels[appt.appointmentType] ?? appt.appointmentType}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 space-y-0.5">
                            <div className="flex items-center gap-4">
                              <span>📞 {appt.phone}</span>
                              {appt.email && <span>✉️ {appt.email}</span>}
                            </div>
                            <div className="flex items-center gap-4">
                              <span>📅 {appt.preferredDate} at {appt.preferredTime}</span>
                              {appt.propertyType && <span className="capitalize">🏠 {appt.propertyType}</span>}
                            </div>
                            {appt.propertyAddress && <div>📍 {appt.propertyAddress}</div>}
                            {appt.issueDescription && <div className="text-gray-500 italic">"{appt.issueDescription}"</div>}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Booked by Jessica · {new Date(appt.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {appt.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => updateApptStatus.mutate({ id: appt.id, status: "confirmed" })}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => updateApptStatus.mutate({ id: appt.id, status: "cancelled" })}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {appt.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-700 border-blue-300 hover:bg-blue-50"
                              onClick={() => updateApptStatus.mutate({ id: appt.id, status: "completed" })}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  );
}
