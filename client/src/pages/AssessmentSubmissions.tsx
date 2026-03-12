import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import {
  Home, MapPin, Phone, Mail, DollarSign, Calendar, CheckCircle,
  Clock, User, RefreshCw, ChevronDown, ChevronUp, Filter, Search,
  Zap, Shield, Gift, TrendingDown, Building2
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-orange-100 text-orange-800",
  scheduled: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

const PAYMENT_TIER_LABELS: Record<string, string> = {
  full_finance: "100% Finance",
  deposit_12pct: "12% Deposit",
  full_payment: "Full Payment",
};

const PAYMENT_TIER_COLORS: Record<string, string> = {
  full_finance: "bg-blue-100 text-blue-800",
  deposit_12pct: "bg-green-100 text-green-800",
  full_payment: "bg-purple-100 text-purple-800",
};

function fmt(cents: number | null | undefined) {
  if (!cents) return "$0";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AssessmentSubmissions() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assessmentFilter, setAssessmentFilter] = useState<string>("all");

  const { data: submissions = [], isLoading, refetch } = trpc.rebateCalculator.listSubmissions.useQuery({
    limit: 200,
  });

  const updateStatusMutation = trpc.rebateCalculator.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast({ title: "Status updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Filter submissions
  const filtered = submissions.filter((s) => {
    const matchesSearch = !searchQuery || [
      s.firstName, s.lastName, s.email, s.phone, s.address, s.city, s.zip
    ].some(v => v?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesAssessment = assessmentFilter === "all"
      || (assessmentFilter === "requested" && s.assessmentRequested)
      || (assessmentFilter === "not_requested" && !s.assessmentRequested)
      || s.assessmentStatus === assessmentFilter;
    return matchesSearch && matchesStatus && matchesAssessment;
  });

  // Stats
  const totalRequested = submissions.filter(s => s.assessmentRequested).length;
  const totalNew = submissions.filter(s => s.status === "new").length;
  const totalWon = submissions.filter(s => s.status === "won").length;
  const totalRevenueCents = submissions.filter(s => s.status === "won").reduce((sum, s) => sum + (s.projectCostCents ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <InternalNav />

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Assessment Submissions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Rebate calculator leads — homeowners who requested a free assessment
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              size="sm"
              className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 gap-2"
              onClick={() => window.open("/rebate-calculator", "_blank")}
            >
              <Home className="h-4 w-4" /> View Calculator
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Submissions", value: submissions.length, icon: User, color: "text-[#1e3a5f]" },
            { label: "Assessment Requested", value: totalRequested, icon: Calendar, color: "text-[#ff6b35]" },
            { label: "New Leads", value: totalNew, icon: Clock, color: "text-blue-600" },
            { label: "Won Revenue", value: fmt(totalRevenueCents), icon: DollarSign, color: "text-green-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${color} opacity-80`} />
                  <div>
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, address, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Lead Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assessmentFilter} onValueChange={setAssessmentFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Assessment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="requested">Assessment Requested</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="not_requested">No Assessment</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filtered.length} results</span>
            </div>
          </CardContent>
        </Card>

        {/* Submissions List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="animate-spin h-8 w-8 text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Home className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No submissions yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Homeowners who use the Rebate Calculator will appear here.
              </p>
              <Button
                className="mt-4 bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                onClick={() => window.open("/rebate-calculator", "_blank")}
              >
                View Rebate Calculator
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((sub) => {
              const isExpanded = expandedId === sub.id;
              const fullName = [sub.firstName, sub.lastName].filter(Boolean).join(" ");
              const fullAddress = [sub.address, sub.city, sub.state, sub.zip].filter(Boolean).join(", ");

              return (
                <Card key={sub.id} className={`transition-all ${sub.assessmentRequested ? "border-l-4 border-l-[#ff6b35]" : ""}`}>
                  {/* Summary Row */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  >
                    <div className="flex flex-wrap items-start gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#1e3a5f]">{fullName}</span>
                          {sub.assessmentRequested && (
                            <Badge className="bg-[#ff6b35] text-white text-xs">Assessment Requested</Badge>
                          )}
                          <Badge className={`text-xs ${STATUS_COLORS[sub.status ?? "new"]}`}>
                            {sub.status ?? "new"}
                          </Badge>
                          {sub.assessmentStatus && sub.assessmentRequested && (
                            <Badge className={`text-xs ${ASSESSMENT_STATUS_COLORS[sub.assessmentStatus]}`}>
                              {sub.assessmentStatus}
                            </Badge>
                          )}
                          {sub.selectedPaymentTier && (
                            <Badge className={`text-xs ${PAYMENT_TIER_COLORS[sub.selectedPaymentTier]}`}>
                              {PAYMENT_TIER_LABELS[sub.selectedPaymentTier]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{fullAddress || "No address"}</span>
                          {sub.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{sub.phone}</span>}
                          {sub.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{sub.email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-sm font-semibold text-green-700">{fmt(sub.totalRebateCents)}</div>
                          <div className="text-xs text-muted-foreground">Total Rebates</div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#1e3a5f]">{fmt(sub.outOfPocketCents)}</div>
                          <div className="text-xs text-muted-foreground">Out of Pocket</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-4 pt-4 bg-gray-50/50">
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Property Info */}
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Property</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{sub.propertyType?.replace(/_/g, " ") ?? "—"}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{sub.squareFootage ? `${sub.squareFootage.toLocaleString()} sq ft` : "—"}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Bedrooms</span><span>{sub.bedrooms ?? "—"}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Stories</span><span>{sub.stories ?? "—"}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Current System</span><span>{sub.currentSystem?.replace(/_/g, " ") ?? "—"}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">System Age</span><span>{sub.systemAge ? `${sub.systemAge} yrs` : "—"}</span></div>
                          </div>
                        </div>

                        {/* Financial Summary */}
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Financials</h3>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Project Cost</span><span className="font-medium">{fmt(sub.projectCostCents)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">PSEG Rebate</span><span className="font-medium text-green-700">-{fmt(sub.psegRebateCents)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Federal Credit</span><span className="font-medium text-green-700">-{fmt(sub.federalTaxCreditCents)}</span></div>
                            <Separator className="my-1" />
                            <div className="flex justify-between font-semibold"><span>Out of Pocket</span><span className="text-[#ff6b35]">{fmt(sub.outOfPocketCents)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Option</span><span>{sub.selectedOption === "high_efficiency" ? "⚡ High-Efficiency" : "Standard"}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Payment Tier</span><span>{PAYMENT_TIER_LABELS[sub.selectedPaymentTier ?? ""] ?? "—"}</span></div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</h3>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Lead Status</label>
                              <Select
                                value={sub.status ?? "new"}
                                onValueChange={(v) => updateStatusMutation.mutate({
                                  id: sub.id,
                                  status: v as any,
                                })}
                              >
                                <SelectTrigger className="mt-1 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="contacted">Contacted</SelectItem>
                                  <SelectItem value="scheduled">Scheduled</SelectItem>
                                  <SelectItem value="won">Won</SelectItem>
                                  <SelectItem value="lost">Lost</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {sub.assessmentRequested && (
                              <div>
                                <label className="text-xs text-muted-foreground">Assessment Status</label>
                                <Select
                                  value={sub.assessmentStatus ?? "pending"}
                                  onValueChange={(v) => updateStatusMutation.mutate({
                                    id: sub.id,
                                    assessmentStatus: v as any,
                                  })}
                                >
                                  <SelectTrigger className="mt-1 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="flex gap-2 pt-1">
                              {sub.phone && (
                                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" asChild>
                                  <a href={`tel:${sub.phone}`}><Phone className="h-3 w-3" /> Call</a>
                                </Button>
                              )}
                              {sub.email && (
                                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" asChild>
                                  <a href={`mailto:${sub.email}`}><Mail className="h-3 w-3" /> Email</a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Submitted at */}
                      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                        Submitted {new Date(sub.createdAt).toLocaleString()}
                        {sub.assignedTo && ` · Assigned to ${sub.assignedTo}`}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <DashboardFooter />
    </div>
  );
}
