import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { LEAD_CHANNELS, filterLeadsByChannel, type LeadChannel } from "@/lib/leadChannels";
import DashboardLayout from "@/components/DashboardLayout";
import AppointmentDialog from "@/components/AppointmentDialog";
import { leadAppointmentDefaults } from "@/lib/appointmentDefaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Phone, Mail, TrendingUp, Filter, Search, RefreshCw, CheckCircle,
  Star, Calendar, MessageSquare, ChevronRight, BarChart3, ExternalLink,
  PhoneCall, Globe, Facebook, AlertCircle, ClipboardCheck, Handshake,
  Trophy, CalendarPlus, Wrench, Clock, FileText, Pencil, CalendarClock, User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LEAD_STAGES, PIPELINE_ORDER, normalizeStage, stageLabel, stageIndex,
  isWon, isLost, deriveContactRelationship, relationshipLabel, leadAgeLabel,
  type Relationship,
} from "@shared/leadPipeline";

// Source label mapping
const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  exit_popup: { label: "Exit Popup", icon: <Globe className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  inline_form: { label: "Inline Form", icon: <Globe className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  newsletter: { label: "Newsletter", icon: <Mail className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  download_gate: { label: "Download", icon: <Globe className="h-3 w-3" />, color: "bg-yellow-100 text-yellow-700" },
  quick_quote: { label: "Quick Quote", icon: <Globe className="h-3 w-3" />, color: "bg-orange-100 text-orange-700" },
  qualify_form: { label: "Qualify Form", icon: <ClipboardCheck className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  exit_popup_residential: { label: "Residential Popup", icon: <Globe className="h-3 w-3" />, color: "bg-purple-100 text-purple-700" },
  exit_popup_commercial: { label: "Commercial Popup", icon: <Globe className="h-3 w-3" />, color: "bg-indigo-100 text-indigo-700" },
  scroll_popup_residential: { label: "Residential Scroll", icon: <Globe className="h-3 w-3" />, color: "bg-pink-100 text-pink-700" },
  scroll_popup_commercial: { label: "Commercial Scroll", icon: <Globe className="h-3 w-3" />, color: "bg-rose-100 text-rose-700" },
  lp_heat_pump: { label: "Heat Pump LP", icon: <Wrench className="h-3 w-3" />, color: "bg-amber-100 text-amber-700" },
  lp_commercial_vrv: { label: "Commercial VRV LP", icon: <BarChart3 className="h-3 w-3" />, color: "bg-cyan-100 text-cyan-700" },
  lp_emergency: { label: "Emergency LP", icon: <AlertCircle className="h-3 w-3" />, color: "bg-red-100 text-red-700" },
  lp_fb_residential: { label: "FB Residential LP", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  lp_fb_commercial: { label: "FB Commercial LP", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
  lp_rebate_guide: { label: "Rebate Guide LP", icon: <Star className="h-3 w-3" />, color: "bg-green-100 text-green-700" },
  lp_maintenance: { label: "Maintenance LP", icon: <CheckCircle className="h-3 w-3" />, color: "bg-teal-100 text-teal-700" },
  career_application: { label: "Career Application", icon: <ClipboardCheck className="h-3 w-3" />, color: "bg-emerald-100 text-emerald-700" },
  partnership_inquiry: { label: "Partnership Inquiry", icon: <Handshake className="h-3 w-3" />, color: "bg-violet-100 text-violet-700" },
  meta_lead_ad: { label: "Meta Lead Ad", icon: <Facebook className="h-3 w-3" />, color: "bg-blue-100 text-blue-700" },
};

// Stage → badge styles (keyed by the NORMALIZED stage value).
const STAGE_STYLES: Record<string, { color: string; bg: string }> = {
  new: { color: "text-blue-700", bg: "bg-blue-100" },
  contacted: { color: "text-amber-700", bg: "bg-amber-100" },
  assessment_scheduled: { color: "text-indigo-700", bg: "bg-indigo-100" },
  assessment_completed: { color: "text-cyan-700", bg: "bg-cyan-100" },
  proposal_sent: { color: "text-purple-700", bg: "bg-purple-100" },
  follow_up: { color: "text-orange-700", bg: "bg-orange-100" },
  won: { color: "text-green-700", bg: "bg-green-100" },
  lost: { color: "text-red-700", bg: "bg-red-100" },
};
function stageStyle(status?: string | null) {
  return STAGE_STYLES[normalizeStage(status)] ?? STAGE_STYLES.new;
}

const RELATIONSHIP_STYLE: Record<Relationship, string> = {
  lead: "bg-slate-100 text-slate-700",
  prospect: "bg-amber-100 text-amber-800",
  customer: "bg-green-100 text-green-800",
};

const APPOINTMENT_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  arrived: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rescheduled: "bg-purple-100 text-purple-700",
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
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function getLeadName(lead: any) {
  if (lead.firstName || lead.lastName) return [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  if (lead.name) return lead.name;
  if (lead.email) return lead.email.split("@")[0];
  if (lead.phone) return lead.phone;
  return "Anonymous";
}
function leadRelationship(lead: LeadCapture): Relationship {
  // Use the SERVER-derived relationship — the exact same signals the Contacts
  // page uses (stage + appointments + jobs), so a lead never reads as Lead in
  // one screen and Prospect in another. Fall back to stage-only if the server
  // hasn't supplied it (e.g. an older cached row).
  return lead.relationship ?? deriveContactRelationship({ leadStages: [lead.status] });
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
  assignedTo?: string | null;
  customerId?: number | null;
  /** Server-derived Lead/Prospect/Customer (unified with the Contacts page). */
  relationship?: Relationship;
  createdAt: Date;
  updatedAt: Date;
};

/** Horizontal, clickable pipeline stepper + Won/Lost outcomes. */
function PipelineStage({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const current = stageIndex(status); // -1 when won/lost
  const won = isWon(status);
  const lost = isLost(status);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PIPELINE_ORDER.map((stage, i) => {
          const done = current >= 0 && i < current;
          const active = current === i;
          return (
            <div key={stage} className="flex items-center">
              <button
                type="button"
                onClick={() => onChange(stage)}
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "bg-[#1e3a5f] text-white"
                  : done ? "bg-[#1e3a5f]/15 text-[#1e3a5f]"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {stageLabel(stage)}
              </button>
              {i < PIPELINE_ORDER.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button" size="sm"
          variant={won ? "default" : "outline"}
          className={won ? "bg-green-600 hover:bg-green-700 text-white" : "border-green-600 text-green-700"}
          onClick={() => onChange("won")}
        >
          <Trophy className="h-3.5 w-3.5 mr-1" /> Won
        </Button>
        <Button
          type="button" size="sm"
          variant={lost ? "default" : "outline"}
          className={lost ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-500 text-red-600"}
          onClick={() => onChange("lost")}
        >
          Lost
        </Button>
      </div>
    </div>
  );
}

function LeadDetailModal({
  lead,
  onClose,
  onStatusUpdate,
  onNoteUpdate,
  onSaved,
}: {
  lead: LeadCapture;
  onClose: () => void;
  onStatusUpdate: (id: number, status: string) => void;
  onNoteUpdate: (id: number, notes: string) => void;
  onSaved: (patch: Partial<LeadCapture>) => void;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();

  // Editable lead fields (name/phone/email/service/source/assignee).
  const [form, setForm] = useState({
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    phone: lead.phone || "",
    email: lead.email || "",
    message: lead.message || "",
    captureType: lead.captureType,
    assignedTo: lead.assignedTo || "",
  });

  const sourceInfo = SOURCE_LABELS[lead.captureType] || { label: lead.captureType, icon: <Globe className="h-3 w-3" />, color: "bg-gray-100 text-gray-700" };
  const rel = leadRelationship(lead);
  const requestedService = (lead.message && lead.message.trim()) || sourceInfo.label;

  const { data: appointments = [] } = trpc.leadCaptures.appointments.useQuery({ id: lead.id });
  const updateLead = trpc.leadCaptures.update.useMutation({
    onSuccess: () => {
      toast({ title: "Lead updated", description: "Lead details saved." });
      setEditing(false);
      // Keep the open modal in sync so the header/name reflect the edit
      // immediately (the modal holds a snapshot, not the live query row).
      onSaved({
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        phone: form.phone || null,
        email: form.email || null,
        message: form.message || null,
        captureType: form.captureType,
        assignedTo: form.assignedTo || null,
      });
    },
    onError: err => toast({ title: "Could not save", description: err.message, variant: "destructive" }),
  });

  const handleSaveDetails = () => {
    updateLead.mutate({
      id: lead.id,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      phone: form.phone || null,
      email: form.email || null,
      message: form.message || null,
      captureType: form.captureType,
      assignedTo: form.assignedTo || null,
    });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await onNoteUpdate(lead.id, notes);
      toast({ title: "Notes saved", description: "Lead notes updated." });
    } finally {
      setSaving(false);
    }
  };

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right min-w-0 break-words">{value}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl pr-10">
            <Users className="h-5 w-5 text-[#1e3a5f] shrink-0" />
            <span className="min-w-0 break-words">{getLeadName(lead)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${RELATIONSHIP_STYLE[rel]}`}>
              {relationshipLabel(rel)}
            </span>
            {!editing && (
              <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 min-w-0">
          {editing ? (
            /* ── Edit lead details ─────────────────────────────── */
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Lead</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>First name</Label>
                  <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Requested service</Label>
                  <Input value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="e.g. Heat pump install estimate" />
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={form.captureType} onValueChange={v => setForm(f => ({ ...f, captureType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_LABELS).map(([value, info]) => (
                        <SelectItem key={value} value={value}>{info.label}</SelectItem>
                      ))}
                      {!SOURCE_LABELS[form.captureType] && (
                        <SelectItem value={form.captureType}>{form.captureType}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assigned to</Label>
                  <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Team member" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={updateLead.isPending}>Cancel</Button>
                <Button size="sm" onClick={handleSaveDetails} disabled={updateLead.isPending} className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90">
                  {updateLead.isPending ? "Saving…" : "Save Details"}
                </Button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div className="space-y-3 min-w-0">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Information</h3>
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-[#ff6b35]" />
                  <a href={`tel:${lead.phone}`} className="text-sm font-medium text-[#ff6b35] hover:underline">{lead.phone}</a>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#1e3a5f]" />
                  <a href={`mailto:${lead.email}`} className="text-sm text-[#1e3a5f] hover:underline break-all">{lead.email}</a>
                </div>
              )}
              {lead.pageUrl && (
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={lead.pageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate min-w-0">
                    {lead.pageUrl.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>

            {/* Lead Information */}
            <div className="space-y-2 min-w-0">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead Information</h3>
              {infoRow("Source", <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${sourceInfo.color}`}>{sourceInfo.icon} {sourceInfo.label}</span>)}
              {infoRow("Requested Service", <span className="break-words">{requestedService}</span>)}
              {infoRow("Submitted", formatDate(lead.createdAt))}
              {infoRow("Assigned To", lead.assignedTo || "Unassigned")}
              {infoRow("Lead Age", leadAgeLabel(lead.createdAt, new Date()))}
            </div>
          </div>
          )}

          {/* Pipeline Stage */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline Stage</h3>
            <PipelineStage status={lead.status} onChange={(s) => onStatusUpdate(lead.id, s)} />
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" disabled={!lead.phone}>
                <a href={lead.phone ? `tel:${lead.phone}` : undefined}><Phone className="h-3.5 w-3.5 mr-1" /> Call</a>
              </Button>
              <Button asChild size="sm" variant="outline" disabled={!lead.phone}>
                <a href={lead.phone ? `sms:${lead.phone}` : undefined}><MessageSquare className="h-3.5 w-3.5 mr-1" /> Text</a>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Schedule Assessment
              </Button>
              <Button asChild size="sm" variant="outline" disabled={!lead.email}>
                <a href={lead.email ? `mailto:${lead.email}` : undefined}><Mail className="h-3.5 w-3.5 mr-1" /> Email</a>
              </Button>
            </div>
          </div>

          {/* Appointments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Appointments ({appointments.length})</h3>
              <a href="/calendar" className="text-xs text-[#1e3a5f] hover:underline inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Open Calendar
              </a>
            </div>
            {appointments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1 py-2">
                No appointments yet. Use “Schedule Assessment” to book one — it will appear here.
              </p>
            ) : (
              <div className="rounded-lg border divide-y">
                {appointments.map((appt: any) => {
                  const when = appt.scheduledAt
                    ? formatDate(appt.scheduledAt)
                    : [appt.preferredDate, appt.preferredTime].filter(Boolean).join(" · ") || "Unscheduled";
                  const st = APPOINTMENT_STATUS_STYLE[appt.status] || "bg-gray-100 text-gray-700";
                  return (
                    <a
                      key={appt.id}
                      href="/calendar"
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors"
                    >
                      <CalendarClock className="h-4 w-4 text-[#1e3a5f] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize break-words">{String(appt.appointmentType).replace(/_/g, " ")}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium capitalize ${st}`}>{appt.status}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 min-w-0"><Clock className="h-3 w-3 shrink-0" /> <span className="break-words">{when}</span></span>
                          <span className="flex items-center gap-1 min-w-0"><User className="h-3 w-3 shrink-0" /> <span className="break-words">{appt.assigneeName || "Unassigned"}</span></span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Notes</h3>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Follow-up actions, context, etc." rows={3} className="resize-none" />
            <Button size="sm" onClick={handleSaveNotes} disabled={saving} className="bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90">
              {saving ? "Saving…" : "Save Notes"}
            </Button>
          </div>

          {/* Recent Activity */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</h3>
            <div className="rounded-lg border divide-y">
              <ActivityRow icon={<Globe className="h-4 w-4 text-blue-600" />} label="Website Submitted" when={formatDate(lead.createdAt)} detail={sourceInfo.label} />
              {isWon(lead.status) && <ActivityRow icon={<Trophy className="h-4 w-4 text-green-600" />} label="Won" when="—" detail="Proposal accepted" />}
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                Appointments, proposals, calls, texts &amp; emails will appear here as they're logged to this contact.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>

        {scheduleOpen && (
          <AppointmentDialog
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            onSaved={() => { onStatusUpdate(lead.id, "assessment_scheduled"); setScheduleOpen(false); }}
            defaults={leadAppointmentDefaults({
              fullName: getLeadName(lead),
              phone: lead.phone,
              email: lead.email,
              requestedService,
              customerId: lead.customerId,
            })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivityRow({ icon, label, when, detail }: { icon: React.ReactNode; label: string; when: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{when}</span>
    </div>
  );
}

function LeadCard({ lead, onView }: { lead: LeadCapture; onView: () => void }) {
  const sourceInfo = SOURCE_LABELS[lead.captureType] || { label: lead.captureType, icon: <Globe className="h-3 w-3" />, color: "bg-gray-100 text-gray-700" };
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
        <span className="text-xs text-muted-foreground">{formatDateShort(lead.createdAt)}</span>
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
const TAB_LABELS: Record<string, string> = {
  all: "All", new: "New", contacted: "Contacted", assessment: "Assessment",
  proposal_sent: "Proposal Sent", follow_up: "Follow Up", won: "Won", lost: "Lost",
};

export default function LeadDashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<LeadChannel>("all");
  const [selectedLead, setSelectedLead] = useState<LeadCapture | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: stats, refetch: refetchStats } = trpc.leadCaptures.stats.useQuery();
  const { data: leads = [], isLoading, refetch: refetchLeads } = trpc.leadCaptures.list.useQuery({
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
      toast({ title: "Stage updated", description: "Lead pipeline stage saved." });
    },
  });
  const addNote = trpc.leadCaptures.addNote.useMutation({ onSuccess: () => refetchLeads() });

  const handleStatusUpdate = (id: number, status: string) => {
    updateStatus.mutate({ id, status: status as any });
    if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : null);
  };
  const handleNoteUpdate = async (id: number, notes: string) => { await addNote.mutateAsync({ id, notes }); };
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
                  <LeadCard key={lead.id} lead={lead} onView={() => setSelectedLead(lead)} />
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

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={handleStatusUpdate}
          onNoteUpdate={handleNoteUpdate}
          onSaved={patch => { setSelectedLead(prev => prev ? { ...prev, ...patch } : prev); refetchLeads(); refetchStats(); }}
        />
      )}
    </DashboardLayout>
  );
}

