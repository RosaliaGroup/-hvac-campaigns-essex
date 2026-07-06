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

export type EditableAppointment = {
  id: number;
  fullName: string;
  phone: string;
  email?: string | null;
  propertyAddress?: string | null;
  propertyType: "residential" | "commercial";
  appointmentType: "free_consultation" | "technician_dispatch" | "maintenance_plan" | "commercial_assessment";
  jobType?: string | null;
  priority?: "normal" | "urgent" | "emergency" | null;
  source?: string | null;
  scheduledAt?: Date | string | null;
  durationMinutes?: number | null;
  assignedToId?: number | null;
  status: string;
  issueDescription?: string | null;
  notes?: string | null;
};

const TYPE_OPTIONS = [
  { value: "free_consultation", label: "Free Consultation" },
  { value: "technician_dispatch", label: "Service Visit (Technician)" },
  { value: "maintenance_plan", label: "Maintenance Visit" },
  { value: "commercial_assessment", label: "Commercial Assessment" },
] as const;

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
    scheduledAt?: Date;
  };
}) {
  const { toast } = useToast();
  const isEdit = Boolean(appointment);

  const { data: assignees = [] } = trpc.appointments.assignees.useQuery(undefined, { enabled: open });

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    propertyAddress: "",
    propertyType: "residential" as "residential" | "commercial",
    appointmentType: "free_consultation" as EditableAppointment["appointmentType"],
    scheduledAt: "",
    durationMinutes: "60",
    assignedToId: "none",
    jobType: "none",
    priority: "normal" as "normal" | "urgent" | "emergency",
    source: "none",
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
        appointmentType: appointment.appointmentType,
        scheduledAt: toLocalInputValue(appointment.scheduledAt),
        durationMinutes: String(appointment.durationMinutes ?? 60),
        assignedToId: appointment.assignedToId ? String(appointment.assignedToId) : "none",
        jobType: appointment.jobType || "none",
        priority: appointment.priority || "normal",
        source: appointment.source || "none",
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
        appointmentType: "free_consultation",
        scheduledAt: toLocalInputValue(defaults?.scheduledAt),
        durationMinutes: "60",
        assignedToId: "none",
        jobType: "none",
        priority: "normal",
        source: "none",
        issueDescription: "",
        notes: "",
        sendConfirmation: true,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment?.id]);

  const create = trpc.appointments.create.useMutation({
    onSuccess: res => {
      toast({
        title: "Appointment booked",
        description: res.smsSent ? "Confirmation SMS sent to the customer." : "No SMS sent (opted out, invalid number, or SMS disabled).",
      });
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
    const shared = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      propertyAddress: form.propertyAddress.trim() || null,
      propertyType: form.propertyType,
      appointmentType: form.appointmentType,
      scheduledAt: iso,
      durationMinutes: parseInt(form.durationMinutes) || 60,
      assignedToId: form.assignedToId === "none" ? null : parseInt(form.assignedToId),
      jobType: form.jobType === "none" ? null : (form.jobType as (typeof JOB_TYPE_OPTIONS)[number]["value"]),
      priority: form.priority,
      source: form.source === "none" ? null : (form.source as (typeof SOURCE_OPTIONS)[number]["value"]),
      issueDescription: form.issueDescription.trim() || null,
      notes: form.notes.trim() || null,
      sendConfirmation: form.sendConfirmation,
    };
    if (isEdit && appointment) {
      update.mutate({ id: appointment.id, ...shared });
    } else {
      create.mutate({ ...shared, customerId: defaults?.customerId ?? null, propertyId: defaults?.propertyId ?? null });
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
            <Select value={form.appointmentType} onValueChange={v => setForm(f => ({ ...f, appointmentType: v as typeof f.appointmentType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
            <Label>Assigned to</Label>
            <Select value={form.assignedToId} onValueChange={v => setForm(f => ({ ...f, assignedToId: v }))}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignees.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
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
