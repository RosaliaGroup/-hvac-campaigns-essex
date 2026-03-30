import { useState, useMemo } from "react";
import InternalNav from "@/components/InternalNav";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Phone, Mail, Clock, TrendingUp, Filter, Search,
  RefreshCw, CheckCircle, XCircle, Star, Calendar, MessageSquare,
  ChevronRight, BarChart3, Flame, Zap, Snowflake, ExternalLink,
  PhoneCall, Globe, Facebook, AlertCircle, Eye, ClipboardCheck, Handshake
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Source label mapping
const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  exit_popup: { label: "Exit Popup", icon: <Globe className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  inline_form: { label: "Inline Form", icon: <Globe className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  newsletter: { label: "Newsletter", icon: <Mail className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  download_gate: { label: "Download", icon: <Globe className="h-3 w-3" />, color: "bg-yellow-100 text-yellow-700" },
  quick_quote: { label: "Quick Quote", icon: <Globe className="h-3 w-3" />, color: "bg-orange-100 text-orange-700" },
  qualify_form: { label: "Qualify Form", icon: <Zap className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  exit_popup_residential: { label: "Residential Popup", icon: <Globe className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  exit_popup_commercial: { label: "Commercial Popup", icon: <Globe className="h-3 w-3" />, color: "bg-indigo-100 text-indigo-700" },
  scroll_popup_residential: { label: "Residential Scroll", icon: <Globe className="h-3 w-3" />, color: "bg-pink-100 text-pink-700" },
  scroll_popup_commercial: { label: "Commercial Scroll", icon: <Globe className="h-3 w-3" />, color: "bg-rose-100 text-rose-700" },
  lp_heat_pump: { label: "Heat Pump LP", icon: <Zap className="h-3 w-3" />, color: "bg-amber-100 text-amber-700" },
  lp_commercial_vrv: { label: "Commercial VRV LP", icon: <BarChart3 className="h-3 w-3" />, color: "bg-cyan-100 text-cyan-700" },
  lp_emergency: { label: "Emergency LP", icon: <AlertCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  lp_fb_residential: { label: "FB Residential LP", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  lp_fb_commercial: { label: "FB Commercial LP", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  lp_rebate_guide: { label: "Rebate Guide LP", icon: <Star className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  lp_maintenance: { label: "Maintenance LP", icon: <CheckCircle className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  career_application: { label: "Career Application", icon: <ClipboardCheck className="h-3 w-3" />, color: "bg-emerald-100 text-emerald-700" },
  partnership_inquiry: { label: "Partnership Inquiry", icon: <Handshake className="h-3 w-3" />, color: "bg-violet-100 text-violet-700" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "text-blue-700", bg: "bg-blue-100" },
  contacted: { label: "Contacted", color: "text-yellow-700", bg: "bg-yellow-100" },
  qualified: { label: "Qualified", color: "text-purple-700", bg: "bg-purple-100" },
  booked: { label: "Booked", color: "text-green-700", bg: "bg-green-100" },
  lost: { label: "Lost", color: "text-red-700", bg: "bg-red-100" },
};

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatDateShort(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function getLeadName(lead: any) {
  if (lead.firstName || lead.lastName) {
    return [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  }
  if (lead.name) return lead.name;
  if (lead.email) return lead.email.split("@")[0];
  if (lead.phone) return lead.phone;
  return "Anonymous";
}

type LeadCapture = {
  id: number;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  captureType: string;
  pageUrl?: string | null;
  message?: string | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function LeadDetailModal({
  lead,
  onClose,
  onStatusUpdate,
  onNoteUpdate,
}: {
  lead: LeadCapture;
  onClose: () => void;
  onStatusUpdate: (id: number, status: string) => void;
  onNoteUpdate: (id: number, notes: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const sourceInfo = SOURCE_LABELS[lead.captureType] || { label: lead.captureType, icon: <Globe className="h-3 w-3" />, color: "bg-gray-100 text-gray-700" };
  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onNoteUpdate(lead.id, notes);
      toast({ title: "Notes saved", description: "Lead notes updated successfully." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-[#1e3a5f]" />
            {getLeadName(lead)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Information</h3>
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#1e3a5f]" />
                  <a href={`mailto:${lead.email}`} className="text-sm text-[#1e3a5f] hover:underline">{lead.email}</a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-[#ff6b35]" />
                  <a href={`tel:${lead.phone}`} className="text-sm font-medium text-[#ff6b35] hover:underline">{lead.phone}</a>
                </div>
              )}
              {lead.message && (
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground italic">"{lead.message}"</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lead Details</h3>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sourceInfo.color}`}>
                  {sourceInfo.icon} {sourceInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{formatDate(lead.createdAt)}</span>
              </div>
              {lead.pageUrl && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <a href={lead.pageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[180px]">
                    {lead.pageUrl.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Status Update */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Update Status</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={lead.status === key ? "default" : "outline"}
                  className={lead.status === key ? "bg-[#1e3a5f] text-white" : ""}
                  onClick={() => onStatusUpdate(lead.id, key)}
                >
                  {config.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Internal Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this lead, follow-up actions, etc..."
              rows={4}
              className="resize-none"
            />
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={saving}
              className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90"
            >
              {saving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadCard({ lead, onView }: { lead: LeadCapture; onView: () => void }) {
  const sourceInfo = SOURCE_LABELS[lead.captureType] || { label: lead.captureType, icon: <Globe className="h-3 w-3" />, color: "bg-gray-100 text-gray-700" };
  const statusInfo = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const name = getLeadName(lead);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors group"
      onClick={onView}
    >
      <div className="w-9 h-9 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-[#1e3a5f]">{name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{name}</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {lead.phone && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {lead.phone}
            </span>
          )}
          {lead.email && !lead.phone && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> {lead.email}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${sourceInfo.color}`}>
            {sourceInfo.icon} {sourceInfo.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{formatDateShort(lead.createdAt)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </div>
  );
}

export default function LeadDashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<LeadCapture | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch stats
  const { data: stats, refetch: refetchStats } = trpc.leadCaptures.stats.useQuery();

  // Fetch leads with filters
  const { data: leads = [], isLoading, refetch: refetchLeads } = trpc.leadCaptures.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    captureType: sourceFilter !== "all" ? sourceFilter : undefined,
    search: searchQuery || undefined,
    limit: 200,
  });

  const updateStatus = trpc.leadCaptures.updateStatus.useMutation({
    onSuccess: () => {
      refetchLeads();
      refetchStats();
      if (selectedLead) {
        setSelectedLead(prev => prev ? { ...prev, status: updateStatus.variables?.status || prev.status } : null);
      }
      toast({ title: "Status updated", description: "Lead status has been updated." });
    },
  });

  const addNote = trpc.leadCaptures.addNote.useMutation({
    onSuccess: () => {
      refetchLeads();
    },
  });

  const handleStatusUpdate = (id: number, status: string) => {
    updateStatus.mutate({ id, status: status as any });
    if (selectedLead?.id === id) {
      setSelectedLead(prev => prev ? { ...prev, status } : null);
    }
  };

  const handleNoteUpdate = async (id: number, notes: string) => {
    await addNote.mutateAsync({ id, notes });
  };

  const handleRefresh = () => {
    refetchLeads();
    refetchStats();
    toast({ title: "Refreshed", description: "Lead data has been refreshed." });
  };

  // Filter leads by tab
  const filteredLeads = useMemo(() => {
    if (activeTab === "all") return leads;
    return leads.filter((l: any) => l.status === activeTab);
  }, [leads, activeTab]);

  // Categorize by source type
  const googleAdsLeads = leads.filter((l: any) => ["lp_heat_pump", "lp_commercial_vrv", "lp_emergency"].includes(l.captureType));
  const facebookLeads = leads.filter((l: any) => ["lp_fb_residential", "lp_fb_commercial"].includes(l.captureType));
  const websiteLeads = leads.filter((l: any) => ["exit_popup", "inline_form", "quick_quote", "exit_popup_residential", "exit_popup_commercial", "scroll_popup_residential", "scroll_popup_commercial"].includes(l.captureType));
  const emailSmsLeads = leads.filter((l: any) => ["lp_rebate_guide", "lp_maintenance", "newsletter", "download_gate"].includes(l.captureType));

  const newCount = leads.filter((l: any) => l.status === "new").length;
  const contactedCount = leads.filter((l: any) => l.status === "contacted").length;
  const qualifiedCount = leads.filter((l: any) => l.status === "qualified").length;
  const bookedCount = leads.filter((l: any) => l.status === "booked").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <InternalNav />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Lead Management Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time tracking of all incoming leads from every channel</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-t-4 border-t-[#1e3a5f]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats?.total ?? 0}</p>
                </div>
                <Users className="h-8 w-8 text-[#1e3a5f]/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="text-2xl font-bold text-blue-600">{newCount}</p>
                </div>
                <Star className="h-8 w-8 text-blue-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Contacted</p>
                  <p className="text-2xl font-bold text-yellow-600">{contactedCount}</p>
                </div>
                <Phone className="h-8 w-8 text-yellow-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Qualified</p>
                  <p className="text-2xl font-bold text-purple-600">{qualifiedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Booked</p>
                  <p className="text-2xl font-bold text-green-600">{bookedCount}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-[#ff6b35]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Conversion</p>
                  <p className="text-2xl font-bold text-[#ff6b35]">
                    {stats?.total ? Math.round((bookedCount / stats.total) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-[#ff6b35]/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-blue-800">Google Ads</span>
              </div>
              <p className="text-2xl font-bold text-blue-700">{googleAdsLeads.length}</p>
              <p className="text-xs text-blue-600 mt-1">Heat Pump, VRV, Emergency</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                  <Facebook className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-indigo-800">Facebook/IG</span>
              </div>
              <p className="text-2xl font-bold text-indigo-700">{facebookLeads.length}</p>
              <p className="text-xs text-indigo-600 mt-1">Residential, Commercial</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                  <Globe className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-orange-800">Website</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{websiteLeads.length}</p>
              <p className="text-xs text-orange-600 mt-1">Exit popups, Forms</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                  <Mail className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-green-800">Email/SMS</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{emailSmsLeads.length}</p>
              <p className="text-xs text-green-600 mt-1">Rebate guide, Maintenance</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="lp_heat_pump">Heat Pump LP</SelectItem>
              <SelectItem value="lp_commercial_vrv">Commercial VRV LP</SelectItem>
              <SelectItem value="lp_emergency">Emergency LP</SelectItem>
              <SelectItem value="lp_fb_residential">FB Residential LP</SelectItem>
              <SelectItem value="lp_fb_commercial">FB Commercial LP</SelectItem>
              <SelectItem value="lp_rebate_guide">Rebate Guide LP</SelectItem>
              <SelectItem value="lp_maintenance">Maintenance LP</SelectItem>
              <SelectItem value="exit_popup">Exit Popup (Home)</SelectItem>
              <SelectItem value="exit_popup_residential">Exit Popup (Residential)</SelectItem>
              <SelectItem value="exit_popup_commercial">Exit Popup (Commercial)</SelectItem>
              <SelectItem value="inline_form">Inline Form</SelectItem>
              <SelectItem value="quick_quote">Quick Quote</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lead List with Tabs */}
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full max-w-lg">
                <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
                <TabsTrigger value="new">New ({newCount})</TabsTrigger>
                <TabsTrigger value="contacted">Contacted ({contactedCount})</TabsTrigger>
                <TabsTrigger value="qualified">Qualified ({qualifiedCount})</TabsTrigger>
                <TabsTrigger value="booked">Booked ({bookedCount})</TabsTrigger>
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
                  {searchQuery || sourceFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Leads will appear here when visitors submit forms on your landing pages"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((lead: any) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onView={() => setSelectedLead(lead)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown Table */}
        {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#1e3a5f]" />
                Leads by Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.bySource as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const sourceInfo = SOURCE_LABELS[source] || { label: source, color: "bg-gray-100 text-gray-700" };
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-44 ${sourceInfo.color}`}>
                          {sourceInfo.label}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-[#1e3a5f] h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
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

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={handleStatusUpdate}
          onNoteUpdate={handleNoteUpdate}
        />
      )}
    </DashboardLayout>
  );
}
