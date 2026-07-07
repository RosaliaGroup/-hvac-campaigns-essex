/**
 * Staff appointment create/edit dialog.
 * Reused by CustomerDetail (Task 3) and the Calendar page (Task 4).
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  APPOINTMENT_TYPES,
  SERVICE_TYPES,
  REMINDER_OPTIONS,
  showsServiceType,
  normalizeAppointmentType,
  type AppointmentTypeValue,
} from "@shared/appointmentTypes";

export type EditableAppointment = {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  propertyAddress?: string | null;
  propertyType: "residential" | "commercial";
  appointmentType: string;
  serviceType?: string | null;
  jobType?: string | null;
  priority?: "normal" | "urgent" | "emergency" | null;
  source?: string | null;
  scheduledAt?: Date | string | null;
  durationMinutes?: number | null;
  assignedToId?: number | null;
  reminderMinutes?: number | null;
  googleMeetRequested?: boolean | null;
  status: string;
  issueDescription?: string | null;
  notes?: string | null;
};

export const JOB_TYPE_OPTIONS = [
  { value: "service_call", label: "Service Call" },
  { value: "diagnostic", label: "Diagnostic" },
  { value: "repair", label: "Repair" },
  { value: "maintenance", label: "Maintenance" },
  { value: "installation", label: "Installation" },
  { value: "replacement", label: "Replacement" },
  { value: "estimate", label: "Estimate" },
  { value: "commercial_hvac", label: "Commercial HVAC" },
  { value: "residential_hvac", label: "Residential HVAC" },
  { value: "boiler", label: "Boiler" },
  { value: "furnace", label: "Furnace" },
  { value: "ac", label: "AC" },
  { value: "heat_pump", label: "Heat Pump" },
  { value: "mini_split", label: "Mini Split" },
  { value: "rooftop_unit", label: "Rooftop Unit" },
  { value: "refrigeration", label: "Refrigeration" },
  { value: "other", label: "Other" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
] as const;

const SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "referral", label: "Referral" },
  { value: "partner", label: "Partner" },
  { value: "repeat_customer", label: "Repeat Customer" },
  { value: "other", label: "Other" },
] as const;

/** Convert a Date to the value expected by <input type="datetime-local"> in local time. */
function toLocalInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AppointmentDialog({
  open,
  onClose,
  onSaved,
  appointment,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** When set, dialog edits this appointment; otherwise creates a new one. */
  appointment?: EditableAppointment | null;
  /** Prefills for create mode (e.g. from a customer record or a calendar day). */
  defaults?: Partial<Pick<EditableAppointment, "fullName" | "phone" | "email" | "propertyAddress" | "propertyType">> & {
    customerId?: number;
    propertyId?: number;
    jobId?: number;
    scheduledAt?: Date;
  };
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const isEdit = Boolean(appointment);

  const { data: assignees = [] } = trpc.appointments.assignees.useQuery(undefined, { enabled: open });
  // Coworkers available to invite (with emails), and any attendees already on this appointment.
  const { data: roster = [] } = trpc.appointments.teamRoster.useQuery(undefined, { enabled: open });
  const { data: existingAttendees } = trpc.appointments.attendees.useQuery(
    { appointmentId: appointment?.id ?? 0 },
    { enabled: open && Boolean(appointment?.id) },
  );

  // Attendee/invite state (Task 8)
  const [inviteTeamIds, setInviteTeamIds] = useState<number[]>([]);
  const [externalEmails, setExternalEmails] = useState("");
  const [includeCustomer, setIncludeCustomer] = useState(true);
  const [sendInvites, setSendInvites] = useState(true);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    propertyAddress: "",
    propertyType: "residential" as "residential" | "commercial",
    appointmentType: "assessment",
    serviceType: "none",
    scheduledAt: "",
    durationMinutes: "60",
    assignedToId: "none",
    jobType: "none",
    priority: "normal" as "normal" | "urgent" | "emergency",
    source: "none",
    reminderMinutes: "none",
    googleMeet: false,
    issueDescription: "",
    notes: "",
    sendConfirmation: true,
  });

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setForm({
        fullName: appointment.fullName,
        phone: appointment.phone,
        email: appointment.email || "",
        propertyAddress: appointment.propertyAddress || "",
        propertyType: appointment.propertyType,
        // Backwards compat: legacy/blank types (e.g. free_consultation) map to a new value.
        appointmentType: normalizeAppointmentType(appointment.appointmentType),
        serviceType: appointment.serviceType || "none",
        scheduledAt: toLocalInputValue(appointment.scheduledAt),
        durationMinutes: String(appointment.durationMinutes ?? 60),
        assignedToId: appointment.assignedToId ? String(appointment.assignedToId) : "none",
        jobType: appointment.jobType || "none",
        priority: appointment.priority || "normal",
        source: appointment.source || "none",
        reminderMinutes: appointment.reminderMinutes != null ? String(appointment.reminderMinutes) : "none",
        googleMeet: Boolean(appointment.googleMeetRequested),
        issueDescription: appointment.issueDescription || "",
        notes: appointment.notes || "",
        sendConfirmation: true,
      });
    } else {
      setForm(f => ({
        ...f,
        fullName: defaults?.fullName || "",
        phone: defaults?.phone || "",
        email: defaults?.email || "",
        propertyAddress: defaults?.propertyAddress || "",
        propertyType: defaults?.propertyType || "residential",
        appointmentType: "assessment",
        serviceType: "none",
        scheduledAt: toLocalInputValue(defaults?.scheduledAt),
        durationMinutes: "60",
        assignedToId: "none",
        jobType: "none",
        priority: "normal",
        source: "none",
        reminderMinutes: "none",
        googleMeet: false,
        issueDescription: "",
        notes: "",
        sendConfirmation: true,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  // Prefill attendee controls (create → empty; edit → from stored attendees).
  useEffect(() => {
    if (!open) return;
    if (appointment && existingAttendees) {
      setInviteTeamIds(existingAttendees.filter(a => a.teamMemberId != null).map(a => a.teamMemberId as number));
      setExternalEmails(existingAttendees.filter(a => a.role === "guest").map(a => a.email).join(", "));
      setIncludeCustomer(existingAttendees.some(a => a.role === "customer"));
    } else if (!appointment) {
      setInviteTeamIds([]);
      setExternalEmails("");
      setIncludeCustomer(true);
    }
    setSendInvites(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id, existingAttendees]);

  const create = trpc.appointments.create.useMutation({
    onSuccess: res => {
      toast({
        title: "Appointment booked",
        description: res.smsSent ? "Confirmation SMS sent to the customer." : "No SMS sent (opted out, invalid number, or SMS disabled).",
      });
      // Refresh EVERY appointments.list consumer (calendar month + backlog),
      // not just the page that opened this dialog. Without this, an appointment
      // created from the customer 360 never appeared on a cached calendar.
      utils.appointments.list.invalidate();
      onSaved?.();
      onClose();
    },
    onError: err => toast({ title: "Booking failed", description: err.message, variant: "destructive" }),
  });

  const update = trpc.appointments.update.useMutation({
    onSuccess: res => {
      toast({
        title: "Appointment updated",
        description: res.rescheduled
          ? res.smsSent ? "Reschedule SMS sent to the customer." : "Rescheduled — no SMS sent."
          : undefined,
      });
      // Same reason as create: a reschedule must move the dot on the calendar
      // even when edited from another surface.
      utils.appointments.list.invalidate();
      onSaved?.();
      onClose();
    },
    onError: err => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const saving = create.isPending || update.isPending;

  const handleSave = () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    if (!form.scheduledAt) {
      toast({ title: "Pick a date and time", variant: "destructive" });
      return;
    }
    const iso = new Date(form.scheduledAt).toISOString();
    // Build the attendee list: selected coworkers + external guest emails.
    // (The customer is added server-side from the email field when includeCustomer is on.)
    const teamAttendees = inviteTeamIds
      .map(tid => roster.find(r => r.id === tid))
      .filter((r): r is (typeof roster)[number] => Boolean(r?.email))
      .map(r => ({ email: r.email, name: r.name, role: "team_member" as const, teamMemberId: r.id }));
    const guestAttendees = externalEmails
      .split(/[,\n;]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(email => ({ email, role: "guest" as const }));
    const attendees = [...teamAttendees, ...guestAttendees];

    const shared = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      propertyAddress: form.propertyAddress.trim() || null,
      propertyType: form.propertyType,
      appointmentType: form.appointmentType as AppointmentTypeValue,
      // Only persist Service Type for the types that show the dropdown.
      serviceType: showsServiceType(form.appointmentType) && form.serviceType !== "none" ? form.serviceType : null,
      scheduledAt: iso,
      durationMinutes: parseInt(form.durationMinutes) || 60,
      assignedToId: form.assignedToId === "none" ? null : parseInt(form.assignedToId),
      jobType: form.jobType === "none" ? null : (form.jobType as (typeof JOB_TYPE_OPTIONS)[number]["value"]),
      priority: form.priority,
      source: form.source === "none" ? null : (form.source as (typeof SOURCE_OPTIONS)[number]["value"]),
      reminderMinutes: form.reminderMinutes === "none" ? null : parseInt(form.reminderMinutes),
      googleMeetRequested: form.googleMeet,
      issueDescription: form.issueDescription.trim() || null,
      notes: form.notes.trim() || null,
      sendConfirmation: form.sendConfirmation,
      attendees,
      includeCustomer,
      sendInvites,
    };
    if (isEdit && appointment) {
      update.mutate({ id: appointment.id, ...shared });
    } else {
      create.mutate({ ...shared, customerId: defaults?.customerId ?? null, propertyId: defaults?.propertyId ?? null, jobId: defaults?.jobId ?? null });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Appointment" : "New Appointment"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Customer name *</Label>
            <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Property address</Label>
            <Input value={form.propertyAddress} onChange={e => setForm(f => ({ ...f, propertyAddress: e.target.value }))} />
          </div>
          <div>
            <Label>Property type</Label>
            <Select value={form.propertyType} onValueChange={v => setForm(f => ({ ...f, propertyType: v as typeof f.propertyType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Appointment type</Label>
            <Select value={form.appointmentType} onValueChange={v => setForm(f => ({ ...f, appointmentType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {showsServiceType(form.appointmentType) && (
            <div>
              <Label>Service type</Label>
              <Select value={form.serviceType} onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select service type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {SERVICE_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Job type</Label>
            <Select value={form.jobType} onValueChange={v => setForm(f => ({ ...f, jobType: v }))}>
              <SelectTrigger><SelectValue placeholder="Select job type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {JOB_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as typeof f.priority }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date & time *</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
            />
          </div>
          <div>
            <Label>Duration (min)</Label>
            <Select value={form.durationMinutes} onValueChange={v => setForm(f => ({ ...f, durationMinutes: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["30", "45", "60", "90", "120", "180", "240"].map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Source</Label>
            <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
              <SelectTrigger><SelectValue placeholder="How did they find us?" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Primary technician</Label>
            <Select value={form.assignedToId} onValueChange={v => setForm(f => ({ ...f, assignedToId: v }))}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reminder</Label>
            <Select value={form.reminderMinutes} onValueChange={v => setForm(f => ({ ...f, reminderMinutes: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(o => (
                  <SelectItem key={o.label} value={o.value == null ? "none" : String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Job description</Label>
            <Textarea rows={2} value={form.issueDescription} onChange={e => setForm(f => ({ ...f, issueDescription: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Internal notes</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {/* ── Attendees & calendar invites (Task 8) ── */}
          <div className="col-span-2 border-t pt-3 mt-1">
            <Label className="text-sm font-semibold text-[#1e3a5f]">Invite people</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Coworkers, the customer, and external guests get a calendar invite (Google Calendar when connected,
              otherwise an .ics email).
            </p>
          </div>
          <div className="col-span-2">
            <Label>Additional technicians</Label>
            {roster.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active team members to invite.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto rounded border p-2">
                {roster.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={inviteTeamIds.includes(r.id)}
                      onChange={e =>
                        setInviteTeamIds(ids =>
                          e.target.checked ? [...ids, r.id] : ids.filter(x => x !== r.id),
                        )
                      }
                    />
                    <span className="truncate" title={r.email}>{r.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <Label>External guests (emails)</Label>
            <Textarea
              rows={2}
              placeholder="alex@example.com, sam@partner.com"
              value={externalEmails}
              onChange={e => setExternalEmails(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="appt-invite-customer"
              type="checkbox"
              className="h-4 w-4"
              checked={includeCustomer}
              onChange={e => setIncludeCustomer(e.target.checked)}
            />
            <Label htmlFor="appt-invite-customer">
              Invite the customer{form.email ? ` (${form.email})` : " (add an email above)"}
            </Label>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="appt-send-invites"
              type="checkbox"
              className="h-4 w-4"
              checked={sendInvites}
              onChange={e => setSendInvites(e.target.checked)}
            />
            <Label htmlFor="appt-send-invites">Create calendar event & send invites</Label>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="appt-google-meet"
              type="checkbox"
              className="h-4 w-4"
              checked={form.googleMeet}
              onChange={e => setForm(f => ({ ...f, googleMeet: e.target.checked }))}
            />
            <Label htmlFor="appt-google-meet">Create Google Meet link</Label>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="appt-sms"
              type="checkbox"
              className="h-4 w-4"
              checked={form.sendConfirmation}
              onChange={e => setForm(f => ({ ...f, sendConfirmation: e.target.checked }))}
            />
            <Label htmlFor="appt-sms">Text the customer a confirmation</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#1e3a5f] hover:bg-[#16304f]" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Book Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
