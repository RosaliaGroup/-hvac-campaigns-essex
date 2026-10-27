import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, User, Calendar, TrendingUp, Download, Plus, Bell, UserPlus, UserRound } from "lucide-react";
import InternalNav from "@/components/InternalNav";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatDisplayName } from "@shared/nameFormat";
import { toast } from "sonner";

export default function LeadTracker() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [reviewAssignee, setReviewAssignee] = useState("");
  const [outreachOwnerId, setOutreachOwnerId] = useState("");
  const [outreachTeamMemberId, setOutreachTeamMemberId] = useState("");
  const [assignmentHint, setAssignmentHint] = useState("");
  const utils = trpc.useUtils();
  const assignWebsiteLead = trpc.leadCaptures.assignWebsiteLead.useMutation({
    onSuccess: (res) => { toast.success(res.followUpDue ? "Lead assigned — human follow-up due now" : "Lead assigned — existing follow-up preserved"); utils.leadCaptures.followUpAudit.invalidate(); utils.leadCaptures.marketingBaseline.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const outreachOwners = trpc.leadCaptures.outreachOwnerCandidates.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const reconcileOutreach = trpc.leadCaptures.reconcileOutreachOwner.useMutation({
    onSuccess: (result) => toast.success(`Assigned ${result.assigned} outreach tasks; ${result.remainingUnassigned} remain unassigned.`),
    onError: e => toast.error(e.message),
  });
  const selfAssignOutreach = trpc.leadCaptures.reconcileOutreachToSelf.useMutation({
    onSuccess: result => toast.success(`Assigned ${result.assigned} open outreach tasks to your login; ${result.remainingUnassigned} remain unassigned.`),
    onError: e => toast.error(e.message),
  });
  const commercialAudienceAudit = trpc.leadCaptures.commercialAudienceAudit.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const baseline = trpc.leadCaptures.marketingBaseline.useQuery(undefined, { enabled: isAuthenticated });
  const followUpAudit = trpc.leadCaptures.followUpAudit.useQuery(undefined, { enabled: isAuthenticated });

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    contactType: "phone" as "phone" | "email",
    source: "",
    service: "",
    status: "new" as "new" | "contacted" | "quoted" | "won" | "lost",
    notes: "",
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  // Fetch leads from database
  const { data: leads = [], refetch } = trpc.leads.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead logged successfully! Email notification sent.");
      refetch();
      setFormData({
        name: "",
        contact: "",
        contactType: "phone",
        source: "",
        service: "",
        status: "new",
        notes: "",
      });
      setShowForm(false);
    },
    onError: (error) => {
      toast.error(`Failed to log lead: ${error.message}`);
    },
  });

  const convertLead = trpc.customers.convertFromLead.useMutation({
    onSuccess: res => {
      toast.success(res.merged ? "Linked to existing customer" : "Customer created");
      refetch();
      setLocation(`/customers/${res.customerId}`);
    },
    onError: err => toast.error(`Conversion failed: ${err.message}`),
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Lead status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLead.mutate(formData);
  };

  const handleStatusChange = (leadId: number, newStatus: "new" | "contacted" | "quoted" | "won" | "lost") => {
    updateStatus.mutate({ leadId, status: newStatus });
  };

  const exportToCSV = () => {
    const headers = ["Date", "Name", "Contact", "Source", "Service", "Status", "Notes"];
    const rows = leads.map(lead => [
      new Date(lead.createdAt).toLocaleDateString(),
      lead.name,
      lead.contact,
      lead.source,
      lead.service,
      lead.status,
      lead.notes || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hvac-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "new":
        return "default";
      case "contacted":
        return "secondary";
      case "quoted":
        return "outline";
      case "won":
        return "default";
      case "lost":
        return "destructive";
      default:
        return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "contacted":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "quoted":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "won":
        return "bg-green-100 text-green-800 border-green-300";
      case "lost":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "";
    }
  };

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
      <InternalNav />
      
      <div className="container py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Marketing lead baseline — last 30 days</CardTitle>
            <CardDescription>Website lead captures only. Qualified means an advanced CRM pipeline stage, not independently verified sales quality.</CardDescription>
          </CardHeader>
          <CardContent>
            {baseline.isLoading ? <p>Loading lead baseline…</p> : baseline.isError ? <p>Unable to load marketing baseline.</p> : baseline.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Website captures", baseline.data.totalCaptures],
                    ["Advanced-stage leads", baseline.data.qualifiedStage],
                    ["New, unassigned", baseline.data.newUnassigned],
                    ["Overdue follow-ups", baseline.data.followUpOverdue],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded border p-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="text-2xl font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-sm font-medium">Sources</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(baseline.data.byChannel).sort((a,b) => b[1]-a[1]).map(([channel,count]) =>
                    <Badge key={channel} variant="outline">{channel}: {count}</Badge>)}
                </div>
                <p className="text-xs text-muted-foreground">Does not include separate manually entered CRM leads. Unknown sources remain unknown.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Website lead follow-up audit — last 30 days</CardTitle>
            <CardDescription>Checks actual cadence enrollment and outbound attempts; a sent record does not prove delivery or human contact.</CardDescription>
          </CardHeader>
          <CardContent>
            {followUpAudit.isLoading ? <p>Checking follow-up records…</p> : followUpAudit.isError ? <p>Follow-up audit unavailable.</p> : followUpAudit.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["New unassigned", followUpAudit.data.unassigned],
                    ["No cadence record", followUpAudit.data.withoutCadence],
                    ["No recorded sent touch", followUpAudit.data.withoutRecordedSentTouch],
                    ["Cadences enrolled", followUpAudit.data.cadenceCount],
                  ].map(([label, value]) => <div key={String(label)} className="rounded border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-2xl font-semibold">{value}</div>
                  </div>)}
                </div>
                <div className="text-sm">Outbound touch outcomes</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(followUpAudit.data.byTouchOutcome).map(([key, count]) => <Badge variant="outline" key={key}>{key}: {count}</Badge>)}
                </div>
                {followUpAudit.data.missingCadenceDetails.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Leads without an automated cadence — review individually</div>
                    <p className="text-xs text-muted-foreground">Unknown consent is not permission for automated SMS/calls. Form-version status helps diagnose missing or outdated disclosures; it does not prove why enrollment was skipped.</p>
                    {followUpAudit.data.missingCadenceDetails.map(row => (
                      <div key={row.leadId} className="flex flex-wrap gap-2 items-center rounded border p-2 text-xs">
                        <span className="font-semibold">Lead #{row.leadId}</span>
                        <Badge variant="outline">{row.captureType.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline">Consent: {row.consentStatus}</Badge>
                        <Badge variant="outline">{row.currentFormVersion ? "Current form version" : row.formVersionPresent ? "Older form version" : "No form version"}</Badge>
                        <span>{row.assigned ? "Assigned" : "Needs owner"}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-sm">Cadence task statuses</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(followUpAudit.data.byTaskStatus).map(([key, count]) => <Badge variant="outline" key={key}>{key}: {count}</Badge>)}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Website leads requiring human follow-up</CardTitle>
            <CardDescription>Assign to a verified active team member. Assignment does not send SMS, change consent, or claim contact was completed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUpAudit.isLoading && <p className="text-sm">Loading team members and leads…</p>}
            {followUpAudit.isError && <p role="alert" className="text-sm text-red-700">Could not load active team members: {followUpAudit.error.message}</p>}
            {followUpAudit.data && (
              <>
                {followUpAudit.data.activeTeam.length === 0 && <p role="alert" className="text-sm text-amber-700">No active team members are available for assignment. Activate a team member in CRM Team settings first.</p>}
                <select aria-label="Select active team member" value={reviewAssignee}
                  onChange={e => { setReviewAssignee(e.target.value); setAssignmentHint(""); }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select active team member before assigning</option>
                  {followUpAudit.data.activeTeam.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                </select>
                {!reviewAssignee && followUpAudit.data.activeTeam.length > 0 && <p className="text-xs text-muted-foreground">Choose a team member above to enable the Assign buttons.</p>}
                {assignmentHint && <p role="alert" className="text-sm text-amber-700">{assignmentHint}</p>}
                {assignWebsiteLead.isError && <p role="alert" className="text-sm text-red-700">Assignment failed: {assignWebsiteLead.error.message}</p>}
                {followUpAudit.data.leadReview.map(row => (
                  <div key={row.leadId} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
                    <span className="font-semibold">Lead #{row.leadId}</span>
                    <Badge variant="outline">{row.captureType.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline">Consent: {row.consentStatus}</Badge>
                    <Badge variant="outline">{row.currentFormVersion ? "Current form" : row.formVersionPresent ? "Older form" : "Form version missing"}</Badge>
                    <span>{row.hasCadence ? "Cadence active/recorded" : "No cadence"}</span>
                    <span>{row.hasRecordedSentTouch ? "Sent touch recorded" : "No sent touch recorded"}</span>
                    {row.assignedTo ? <span>Owner: {row.assignedTo}</span> :
                      <Button size="sm" variant="outline" disabled={assignWebsiteLead.isPending}
                        onClick={() => {
                          const members = followUpAudit.data.activeTeam;
                          const selected = reviewAssignee || (members.length === 1 ? String(members[0].id) : "");
                          if (!selected) {
                            setAssignmentHint(members.length === 0
                              ? "No active CRM team member is available. Activate one in Team settings."
                              : "Choose an active team member in the dropdown above before assigning.");
                            return;
                          }
                          setAssignmentHint("");
                          assignWebsiteLead.mutate({ leadId: row.leadId, teamMemberId: Number(selected) });
                        }}>
                        Assign
                      </Button>}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
        {user?.role === "admin" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Outreach follow-up ownership</CardTitle>
              <CardDescription>Select a verified CRM administrator whose login email matches an active team member. This assigns unowned 30-day outreach tasks only; it does not send messages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {outreachOwners.isError && <p role="alert" className="text-sm text-red-700">Cannot load verified owners: {outreachOwners.error.message}</p>}
              {outreachOwners.isLoading && <p className="text-sm">Loading verified owners…</p>}
              {outreachOwners.data && <>
                <select aria-label="Verified outreach owner" value={outreachOwnerId} onChange={e => setOutreachOwnerId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select verified CRM owner</option>
                  {outreachOwners.data.filter(u => u.activeTeamMatch).map(u => <option key={u.id} value={u.id}>{u.name || u.email} — {u.email}</option>)}
                </select>
                {outreachOwners.data.filter(u => u.activeTeamMatch).length === 0 && <p role="status" className="text-sm text-amber-700">No exact login/team email match. You can explicitly assign unowned tasks to your currently signed-in administrator account below.</p>}
                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">Take ownership using my signed-in admin account</p>
                  <p className="text-xs text-muted-foreground">This assigns only unowned outreach tasks to your authenticated login. Choose the active CRM team profile for the displayed owner name. No emails or texts are sent.</p>
                  <select aria-label="Team profile for my outreach tasks" value={outreachTeamMemberId} onChange={e => setOutreachTeamMemberId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose active team profile</option>
                    {followUpAudit.data?.activeTeam.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                  </select>
                  <Button disabled={!outreachTeamMemberId || selfAssignOutreach.isPending} onClick={() => selfAssignOutreach.mutate({teamMemberId:Number(outreachTeamMemberId)})}>
                    {selfAssignOutreach.isPending ? "Assigning…" : "Assign unowned tasks to my login"}
                  </Button>
                </div>
                <Button disabled={!outreachOwnerId || reconcileOutreach.isPending} onClick={() => reconcileOutreach.mutate({userId:Number(outreachOwnerId)})}>
                  {reconcileOutreach.isPending ? "Assigning…" : "Assign unowned outreach tasks"}
                </Button>
              </>}
            </CardContent>
          </Card>
        )}
        {user?.role === "admin" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Commercial landing-page SEO and conversion audit</CardTitle>
              <CardDescription>Live Google Search Console URL Inspection and real website captures from the last 30 days. No test leads are created.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button size="sm" variant="outline" disabled={commercialAudienceAudit.isFetching}
                onClick={() => commercialAudienceAudit.refetch()}>
                {commercialAudienceAudit.isFetching ? "Checking Google and CRM…" : "Refresh Google indexing and CRM counts"}
              </Button>
              {commercialAudienceAudit.isError && <p role="alert" className="text-sm text-red-700">{commercialAudienceAudit.error.message}</p>}
              {commercialAudienceAudit.data?.results.map(item => (
                <div key={item.path} className="rounded border p-3 space-y-1 text-sm">
                  <a href={item.path} className="font-semibold text-blue-700 underline">{item.path}</a>
                  <p>Google coverage: {item.inspection?.coverageState || (item.inspectionError ? "Unavailable" : "Unknown")}</p>
                  {item.inspectionError && <p className="text-xs text-amber-700">Inspection error: {item.inspectionError}</p>}
                  <p>Last Google crawl: {item.inspection?.lastCrawlTime || "Not reported"}</p>
                  <p>CRM captures (30 days): <strong>{item.captures30d}</strong></p>
                  <p className="text-xs text-muted-foreground">Channels: {JSON.stringify(item.byChannel)} | Stages: {JSON.stringify(item.byStage)}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Counts represent CRM capture records, not deduplicated qualified leads. Google inspection does not guarantee search rankings.</p>
            </CardContent>
          </Card>
        )}
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#1e3a5f] mb-2">Lead Tracker</h1>
              <p className="text-muted-foreground">
                Track and manage all incoming leads from your marketing campaigns
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={exportToCSV}
                disabled={leads.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => setShowForm(!showForm)}
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Log New Lead
              </Button>
            </div>
          </div>
        </div>

        {/* Email Notification Info */}
        <Card className="mb-6 border-[#ff6b35]/30 bg-[#ff6b35]/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-[#ff6b35] mt-0.5" />
              <div>
                <p className="font-semibold text-[#1e3a5f]">Automated Email Notifications Enabled</p>
                <p className="text-sm text-muted-foreground">
                  You'll receive an email notification every time a new lead is logged in the tracker, so you never miss an inquiry.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lead Form */}
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Log New Lead</CardTitle>
              <CardDescription>
                Enter lead information from phone calls, website forms, or other sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Smith"
                      required
                    />
                  </div>

                  {/* Contact */}
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.contactType}
                        onValueChange={(value: "phone" | "email") =>
                          setFormData({ ...formData, contactType: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="contact"
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        placeholder={formData.contactType === "phone" ? "(862) 555-1234" : "john@example.com"}
                        required
                      />
                    </div>
                  </div>

                  {/* Lead Source */}
                  <div className="space-y-2">
                    <Label htmlFor="source">Lead Source / Campaign *</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Google Ads - Emergency Repair">Google Ads - Emergency Repair</SelectItem>
                        <SelectItem value="Google Ads - Heat Pump Installation">Google Ads - Heat Pump Installation</SelectItem>
                        <SelectItem value="Google Ads - Commercial HVAC">Google Ads - Commercial HVAC</SelectItem>
                        <SelectItem value="Facebook - Residential Rebates">Facebook - Residential Rebates</SelectItem>
                        <SelectItem value="Facebook - Maintenance Subscription">Facebook - Maintenance Subscription</SelectItem>
                        <SelectItem value="Instagram - Brand Awareness">Instagram - Brand Awareness</SelectItem>
                        <SelectItem value="YouTube - Educational Content">YouTube - Educational Content</SelectItem>
                        <SelectItem value="Google Business Profile">Google Business Profile</SelectItem>
                        <SelectItem value="Nextdoor">Nextdoor</SelectItem>
                        <SelectItem value="Referral - Partner">Referral - Partner</SelectItem>
                        <SelectItem value="Referral - Customer">Referral - Customer</SelectItem>
                        <SelectItem value="Website - Direct">Website - Direct</SelectItem>
                        <SelectItem value="Phone Call - Direct">Phone Call - Direct</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Service Type */}
                  <div className="space-y-2">
                    <Label htmlFor="service">Service Interested In *</Label>
                    <Select
                      value={formData.service}
                      onValueChange={(value) => setFormData({ ...formData, service: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Emergency Repair">Emergency Repair</SelectItem>
                        <SelectItem value="Heat Pump Installation">Heat Pump Installation</SelectItem>
                        <SelectItem value="AC Installation">AC Installation</SelectItem>
                        <SelectItem value="Heating Installation">Heating Installation</SelectItem>
                        <SelectItem value="VRF/VRV System">VRF/VRV System</SelectItem>
                        <SelectItem value="Maintenance Subscription">Maintenance Subscription</SelectItem>
                        <SelectItem value="Commercial HVAC">Commercial HVAC</SelectItem>
                        <SelectItem value="Residential HVAC">Residential HVAC</SelectItem>
                        <SelectItem value="Rebate Consultation">Rebate Consultation</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: "new" | "contacted" | "quoted" | "won" | "lost") =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="quoted">Quoted</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional details about the lead, conversation notes, follow-up required, etc."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                    disabled={createLead.isPending}
                  >
                    {createLead.isPending ? "Logging Lead..." : "Log Lead & Send Notification"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Leads ({leads.length})</CardTitle>
            <CardDescription>
              View and manage all logged leads from your marketing campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-semibold">No leads logged yet</p>
                <p className="text-sm">Click "Log New Lead" to start tracking your marketing campaign results</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Customer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatDisplayName(lead.name)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            {lead.contactType === "phone" ? (
                              <Phone className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            )}
                            {lead.contact}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{lead.source}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{lead.service}</span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={lead.status}
                            onValueChange={(value: "new" | "contacted" | "quoted" | "won" | "lost") =>
                              handleStatusChange(lead.id, value)
                            }
                          >
                            <SelectTrigger className={`w-32 text-xs border ${getStatusColor(lead.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="quoted">Quoted</SelectItem>
                              <SelectItem value="won">Won</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm text-muted-foreground truncate block">
                            {lead.notes || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="mb-1 mr-2" onClick={() => setLocation(`/contacts/communications?leadId=${lead.id}`)}><Mail className="h-3.5 w-3.5 mr-1" /> Communications</Button>
                          {lead.customerId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#1e3a5f] text-[#1e3a5f] whitespace-nowrap"
                              onClick={() => setLocation(`/customers/${lead.customerId}`)}
                            >
                              <UserRound className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-[#1e3a5f] hover:bg-[#16304f] whitespace-nowrap"
                              disabled={convertLead.isPending}
                              onClick={() => convertLead.mutate({ leadId: lead.id })}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" /> Convert
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Summary */}
        {leads.length > 0 && (
          <div className="grid md:grid-cols-5 gap-4 mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {leads.filter(l => l.status === "new").length}
                  </p>
                  <p className="text-sm text-muted-foreground">New</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {leads.filter(l => l.status === "contacted").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Contacted</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {leads.filter(l => l.status === "quoted").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Quoted</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {leads.filter(l => l.status === "won").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Won</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {leads.filter(l => l.status === "lost").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Lost</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <DashboardFooter />
    </div>
  );
}
