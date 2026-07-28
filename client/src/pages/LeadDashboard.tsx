import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { LEAD_CHANNELS, filterLeadsByChannel, type LeadChannel } from "@/lib/leadChannels";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Phone, Mail, TrendingUp, Filter, Search, RefreshCw, Star,
  ChevronRight, BarChart3, CalendarPlus, FileText, Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeStage, stageLabel, relationshipLabel } from "@shared/leadPipeline";
import {
  SOURCE_LABELS, sourceInfoFor, stageStyle, RELATIONSHIP_STYLE,
  getLeadName, leadRelationship, formatLeadDateShort, type LeadCapture,
} from "@/lib/leadPresentation";

/**
 * Lead Inbox — every lead from every channel in one pipeline. Clicking a lead
 * opens the full-page detail at /leads/:id (Task 8B; the old inline modal was
 * retired in favor of CustomerDetail-style layout parity). Shared lead styling
 * lives in @/lib/leadPresentation so this list and the detail page never diverge.
 */

function LeadCard({ lead, onView }: { lead: LeadCapture; onView: () => void }) {
  const sourceInfo = sourceInfoFor(lead.captureType);
  const st = stageStyle(lead.status);
  const rel = leadRelationship(lead);
  const name = getLeadName(lead);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors group" onClick={onView}>
      <div className="w-9 h-9 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-[#1e3a5f]">{name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{name}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>{stageLabel(lead.status)}</span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${RELATIONSHIP_STYLE[rel]}`}>{relationshipLabel(rel)}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {lead.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
          {lead.email && !lead.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</span>}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${sourceInfo.color}`}>{sourceInfo.icon} {sourceInfo.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{formatLeadDateShort(lead.createdAt)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </div>
  );
}

// Tabs → the normalized stages they include.
const TAB_STAGES: Record<string, string[]> = {
  new: ["new"],
  contacted: ["contacted"],
  assessment: ["assessment_scheduled", "assessment_completed"],
  proposal_sent: ["proposal_sent"],
  follow_up: ["follow_up"],
  won: ["won"],
  lost: ["lost"],
};

export default function LeadDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<LeadChannel>("all");
  const [activeTab, setActiveTab] = useState("all");

  const { data: stats, refetch: refetchStats } = trpc.leadCaptures.stats.useQuery();
  const { data: leads = [], isLoading, refetch: refetchLeads } = trpc.leadCaptures.list.useQuery({
    search: searchQuery || undefined,
    limit: 200,
  });

  const handleRefresh = () => { refetchLeads(); refetchStats(); toast({ title: "Refreshed", description: "Lead data refreshed." }); };

  // Stage counts (normalized so legacy booked/qualified rows land in the right bucket).
  const countOf = (stages: string[]) => leads.filter((l: any) => stages.includes(normalizeStage(l.status))).length;
  const newCount = countOf(["new"]);
  const contactedCount = countOf(["contacted"]);
  const assessmentCount = countOf(["assessment_scheduled", "assessment_completed"]);
  const proposalCount = countOf(["proposal_sent"]);
  const wonCount = countOf(["won"]);

  // Apply the source-channel filter, then the pipeline-stage tab (both client-side).
  const filteredLeads = useMemo(() => {
    let out = filterLeadsByChannel(leads as any[], channelFilter);
    if (activeTab !== "all") {
      const stages = TAB_STAGES[activeTab] ?? [];
      out = out.filter((l: any) => stages.includes(normalizeStage(l.status)));
    }
    return out;
  }, [leads, activeTab, channelFilter]);

  const conversion = stats?.total ? Math.round((wonCount / stats.total) * 100) : 0;

  const statCards = [
    { label: "Total Leads", value: stats?.total ?? 0, icon: Users, border: "border-t-[#1e3a5f]", color: "text-[#1e3a5f]" },
    { label: "New", value: newCount, icon: Star, border: "border-t-blue-500", color: "text-blue-600" },
    { label: "Contacted", value: contactedCount, icon: Phone, border: "border-t-amber-500", color: "text-amber-600" },
    { label: "Assessment", value: assessmentCount, icon: CalendarPlus, border: "border-t-indigo-500", color: "text-indigo-600" },
    { label: "Proposal Sent", value: proposalCount, icon: FileText, border: "border-t-purple-500", color: "text-purple-600" },
    { label: "Won", value: wonCount, icon: Trophy, border: "border-t-green-500", color: "text-green-600" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Lead Inbox</h1>
            <p className="text-sm text-muted-foreground mt-1">Every new lead from every channel, in one pipeline.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-4 w-4 text-[#ff6b35]" /> {conversion}% won</span>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(c => (
            <Card key={c.label} className={`border-t-4 ${c.border}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                  </div>
                  <c.icon className={`h-8 w-8 opacity-20 ${c.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter by Lead Source — compact, clickable source filters. */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filter by Lead Source
          </p>
          <div className="flex flex-wrap gap-2">
            {LEAD_CHANNELS.map((ch) => {
              const count = ch.id === "all" ? leads.length : filterLeadsByChannel(leads as any[], ch.id).length;
              const selected = channelFilter === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChannelFilter(ch.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35] ${
                    selected
                      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                      : "bg-white text-muted-foreground border-border hover:border-[#ff6b35] hover:text-[#1e3a5f]"
                  }`}
                >
                  {ch.label}
                  <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${selected ? "bg-white/20" : "bg-muted"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>

        {/* Lead List */}
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
                <TabsTrigger value="new">New ({newCount})</TabsTrigger>
                <TabsTrigger value="contacted">Contacted ({contactedCount})</TabsTrigger>
                <TabsTrigger value="assessment">Assessment ({assessmentCount})</TabsTrigger>
                <TabsTrigger value="proposal_sent">Proposal ({proposalCount})</TabsTrigger>
                <TabsTrigger value="won">Won ({wonCount})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading leads...</span>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">No leads found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery || channelFilter !== "all" || activeTab !== "all" ? "Try adjusting your filters" : "New submissions appear here immediately."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((lead: any) => (
                  <LeadCard key={lead.id} lead={lead} onView={() => navigate(`/leads/${lead.id}`)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#1e3a5f]" /> Leads by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.bySource as Record<string, number>).sort(([, a], [, b]) => b - a).map(([source, count]) => {
                  const info = SOURCE_LABELS[source] || { label: source, color: "bg-gray-100 text-gray-700" };
                  const pct = stats.total > 0 ? Math.max(0, Math.round((count / stats.total) * 100)) : 0;
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-44 ${info.color}`}>{info.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-2"><div className="bg-[#1e3a5f] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                      <span className="text-sm font-semibold w-8 text-right">{count}</span>
                      <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
