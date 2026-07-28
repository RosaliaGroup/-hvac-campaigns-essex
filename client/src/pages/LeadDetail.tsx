/**
 * Full-page Lead detail (Task 8B). Layout parity with CustomerDetail: a full-width
 * header + stat cards + tabs (Summary / Property / Appointments / Estimates /
 * Timeline), replacing the old single-column modal. All lead functionality is
 * preserved — pipeline stage, SMS conversation, quick actions (incl. Create
 * Estimate), notes, appointments, activity, property linkage, and edit.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import AppointmentDialog from "@/components/AppointmentDialog";
import PropertyLinkSection from "@/components/PropertyLinkSection";
import ConversationPreview from "@/components/sms/ConversationPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { leadAppointmentDefaults } from "@/lib/appointmentDefaults";
import { internalSmsConversationPath } from "@/lib/internalSms";
import { StartEstimateButton, TieredEstimateList } from "@/components/estimates/estimateEntry";
import {
  SOURCE_LABELS, sourceInfoFor, stageStyle, RELATIONSHIP_STYLE, APPOINTMENT_STATUS_STYLE,
  formatLeadDate, getLeadName, leadRelationship, PipelineStage, ActivityRow, type LeadCapture,
} from "@/lib/leadPresentation";
import { stageLabel, leadAgeLabel, isWon, relationshipLabel } from "@shared/leadPipeline";
import {
  ArrowLeft, Users, Phone, PhoneCall, Mail, MessageSquare, CalendarPlus, Calendar, CalendarClock,
  Clock, User, ChevronRight, ExternalLink, Pencil, Globe, Trophy, Target, FileText, ClipboardList, MapPin,
} from "lucide-react";

export default function LeadDetail() {
  const params = useParams<{ id: string }>();
  const leadId = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: lead, isLoading, refetch } = trpc.leadCaptures.getById.useQuery(
    { id: leadId },
    { enabled: leadId > 0, retry: false },
  );
  const { data: appointments = [], refetch: refetchAppts } = trpc.leadCaptures.appointments.useQuery(
    { id: leadId },
    { enabled: leadId > 0 },
  );

  const [tab, setTab] = useState("summary");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => { if (lead) setNotes(lead.notes || ""); }, [lead?.id]);

  const updateStatus = trpc.leadCaptures.updateStatus.useMutation({
    onSuccess: () => { toast({ title: "Stage updated" }); refetch(); },
    onError: e => toast({ title: "Could not update stage", description: e.message, variant: "destructive" }),
  });
  const addNote = trpc.leadCaptures.addNote.useMutation({
    onSuccess: () => { toast({ title: "Notes saved" }); refetch(); },
    onError: e => toast({ title: "Could not save notes", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <DashboardLayout><InternalNav /><p className="p-8 text-sm text-muted-foreground">Loading lead…</p></DashboardLayout>;
  }
  if (!lead) {
    return (
      <DashboardLayout><InternalNav />
        <div className="p-8 space-y-3">
          <p className="text-sm text-muted-foreground">Lead not found.</p>
          <Button variant="outline" onClick={() => navigate("/lead-dashboard")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Leads</Button>
        </div>
      </DashboardLayout>
    );
  }

  const cap = lead as unknown as LeadCapture;
  const name = getLeadName(cap);
  const rel = leadRelationship(cap);
  const source = sourceInfoFor(cap.captureType);
  const st = stageStyle(cap.status);
  const requestedService = (cap.message && cap.message.trim()) || source.label;

  const setStage = (s: string) => updateStatus.mutate({ id: leadId, status: s as never });

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/lead-dashboard")} className="-ml-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Leads
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-[#1e3a5f]" /> {name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className={`${st.bg} ${st.color}`}>{stageLabel(cap.status)}</Badge>
              <Badge variant="secondary" className={RELATIONSHIP_STYLE[rel]}>{relationshipLabel(rel)}</Badge>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${source.color}`}>{source.icon} {source.label}</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
        </div>

        {/* Stat cards */}
        <StatCards
          stage={stageLabel(cap.status)}
          relationship={relationshipLabel(rel)}
          age={leadAgeLabel(cap.createdAt, new Date())}
          appointments={appointments.length}
          source={source.label}
          onSelectTab={setTab}
        />

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="property">Property</TabsTrigger>
            <TabsTrigger value="appointments">Appointments ({appointments.length})</TabsTrigger>
            <TabsTrigger value="estimates">Estimates</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* ── Summary ── */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Contact</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {cap.phone
                    ? <div className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-[#ff6b35]" /><a href={`tel:${cap.phone}`} className="font-medium text-[#ff6b35] hover:underline">{cap.phone}</a></div>
                    : <div className="text-muted-foreground">No phone</div>}
                  {cap.email
                    ? <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#1e3a5f]" /><a href={`mailto:${cap.email}`} className="text-[#1e3a5f] hover:underline break-all">{cap.email}</a></div>
                    : <div className="text-muted-foreground">No email</div>}
                  {cap.pageUrl && (
                    <div className="flex items-center gap-2 min-w-0"><ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={cap.pageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">{cap.pageUrl.replace(/^https?:\/\//, "")}</a>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Lead Information</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <InfoRow label="Requested Service" value={requestedService} />
                  <InfoRow label="Submitted" value={formatLeadDate(cap.createdAt)} />
                  <InfoRow label="Assigned To" value={cap.assignedTo || "Unassigned"} />
                  <InfoRow label="Lead Age" value={leadAgeLabel(cap.createdAt, new Date())} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-[#1e3a5f]" /> Pipeline Stage</CardTitle></CardHeader>
              <CardContent><PipelineStage status={cap.status} onChange={setStage} /></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" disabled={!cap.phone}>
                  <a href={cap.phone ? `tel:${cap.phone}` : undefined}><Phone className="h-3.5 w-3.5 mr-1" /> Call</a>
                </Button>
                <Button size="sm" variant="outline" disabled={!cap.phone} onClick={() => cap.phone && navigate(internalSmsConversationPath(cap.phone))}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Text
                </Button>
                <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Schedule Assessment
                </Button>
                <Button asChild size="sm" variant="outline" disabled={!cap.email}>
                  <a href={cap.email ? `mailto:${cap.email}` : undefined}><Mail className="h-3.5 w-3.5 mr-1" /> Email</a>
                </Button>
                {/* Task 8B — Create Estimate is available at ANY stage. Converts the lead
                    to a customer (dedupe) if needed, then opens the Good/Better/Best builder. */}
                {cap.customerId
                  ? <StartEstimateButton variant="outline" customerId={cap.customerId} defaultTitle={`Estimate for ${name}`} label="Create Estimate" />
                  : <StartEstimateButton variant="outline" captureId={leadId} defaultTitle={`Estimate for ${name}`} label="Create Estimate" />}
              </CardContent>
            </Card>

            <ConversationPreview phone={cap.phone} />

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Follow-up actions, context, etc." rows={3} className="resize-none" />
                <Button size="sm" onClick={() => addNote.mutate({ id: leadId, notes })} disabled={addNote.isPending} className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90">
                  {addNote.isPending ? "Saving…" : "Save Notes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Property ── */}
          <TabsContent value="property">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-[#1e3a5f]" /> Property</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {appointments.length === 0
                  ? <p className="text-sm text-muted-foreground">No property linkage yet. Schedule an assessment, then link its address to a property here.</p>
                  : appointments.map(a => (
                      <PropertyLinkSection key={a.id} appointment={a} customerId={cap.customerId ?? null} onChanged={() => refetchAppts()} hideHeading />
                    ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Appointments ── */}
          <TabsContent value="appointments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-[#1e3a5f]" /> Appointments ({appointments.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}><CalendarPlus className="h-4 w-4 mr-1" /> Schedule Assessment</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments yet. Use “Schedule Assessment” to book one.</p>
                ) : appointments.map((appt: any) => {
                  const when = appt.scheduledAt ? formatLeadDate(appt.scheduledAt) : [appt.preferredDate, appt.preferredTime].filter(Boolean).join(" · ") || "Unscheduled";
                  const badge = APPOINTMENT_STATUS_STYLE[appt.status] || "bg-gray-100 text-gray-700";
                  return (
                    <a key={appt.id} href="/calendar" className="flex items-center gap-3 border rounded-lg px-3 py-2 hover:bg-muted/40 transition-colors">
                      <CalendarClock className="h-4 w-4 text-[#1e3a5f] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">{String(appt.appointmentType).replace(/_/g, " ")}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium capitalize ${badge}`}>{appt.status}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {when}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {appt.assigneeName || "Unassigned"}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Estimates ── */}
          <TabsContent value="estimates">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[#1e3a5f]" /> Tiered Estimates</CardTitle>
                {cap.customerId
                  ? <StartEstimateButton customerId={cap.customerId} defaultTitle={`Estimate for ${name}`} />
                  : <StartEstimateButton captureId={leadId} defaultTitle={`Estimate for ${name}`} label="Create Estimate" />}
              </CardHeader>
              <CardContent>
                {cap.customerId
                  ? <TieredEstimateList customerId={cap.customerId} onOpen={id => navigate(`/opportunities/${id}`)} />
                  : <p className="text-sm text-muted-foreground">No estimates yet. Creating one converts this lead to a customer (matching an existing customer by phone/email when possible), then opens the Good/Better/Best builder.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Timeline ── */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  <ActivityRow icon={<Globe className="h-4 w-4 text-blue-600" />} label="Website Submitted" when={formatLeadDate(cap.createdAt)} detail={source.label} />
                  {isWon(cap.status) && <ActivityRow icon={<Trophy className="h-4 w-4 text-green-600" />} label="Won" when="—" detail="Proposal accepted" />}
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">Appointments, proposals, calls, texts &amp; emails will appear here as they're logged to this contact.</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editOpen && <EditLeadDialog lead={cap} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); refetch(); }} />}

      {scheduleOpen && (
        <AppointmentDialog
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          onSaved={() => { updateStatus.mutate({ id: leadId, status: "assessment_scheduled" as never }); setScheduleOpen(false); refetchAppts(); }}
          defaults={leadAppointmentDefaults({
            fullName: name,
            phone: cap.phone,
            email: cap.email,
            requestedService: cap.message?.trim() || "",
            customerId: cap.customerId,
          })}
        />
      )}
    </DashboardLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

function StatCards({
  stage, relationship, age, appointments, source, onSelectTab,
}: {
  stage: string; relationship: string; age: string; appointments: number; source: string; onSelectTab: (t: string) => void;
}) {
  const cards: Array<{ label: string; value: string; icon: ReactNode; tab?: string }> = [
    { label: "Stage", value: stage, icon: <Target className="h-4 w-4" /> },
    { label: "Relationship", value: relationship, icon: <Users className="h-4 w-4" /> },
    { label: "Lead Age", value: age, icon: <Clock className="h-4 w-4" /> },
    { label: "Appointments", value: String(appointments), icon: <Calendar className="h-4 w-4" />, tab: "appointments" },
    { label: "Source", value: source, icon: <Globe className="h-4 w-4" /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(c => {
        const clickable = !!c.tab;
        return (
          <Card
            key={c.label}
            className={clickable ? "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]" : ""}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onSelectTab(c.tab!) : undefined}
            onKeyDown={clickable ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectTab(c.tab!); } } : undefined}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.icon}<span className="truncate">{c.label}</span></div>
              <div className="mt-1 text-lg font-bold text-[#1e3a5f] truncate">{c.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EditLeadDialog({ lead, onClose, onSaved }: { lead: LeadCapture; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    phone: lead.phone || "",
    email: lead.email || "",
    message: lead.message || "",
    captureType: lead.captureType,
    assignedTo: lead.assignedTo || "",
  });
  const update = trpc.leadCaptures.update.useMutation({
    onSuccess: () => { toast({ title: "Lead updated" }); onSaved(); },
    onError: e => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>First name</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
          <div><Label>Last name</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Requested service</Label><Input value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="e.g. Heat pump install estimate" /></div>
          <div>
            <Label>Source</Label>
            <Select value={form.captureType} onValueChange={v => setForm(f => ({ ...f, captureType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}
                {!SOURCE_LABELS[form.captureType] && <SelectItem value={form.captureType}>{form.captureType}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Assigned to</Label><Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Team member" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button
            className="bg-[#1e3a5f] hover:bg-[#16304f]"
            disabled={update.isPending}
            onClick={() => update.mutate({
              id: lead.id,
              firstName: form.firstName || null,
              lastName: form.lastName || null,
              phone: form.phone || null,
              email: form.email || null,
              message: form.message || null,
              captureType: form.captureType,
              assignedTo: form.assignedTo || null,
            })}
          >
            {update.isPending ? "Saving…" : "Save Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
