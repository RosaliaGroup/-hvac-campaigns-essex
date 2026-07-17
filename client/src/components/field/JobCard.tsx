/**
 * JobCard — the mobile job card shared by the Field App "My Jobs" dashboard
 * (client/src/pages/FieldMyJobs.tsx). Extracted from the original
 * FieldToday.tsx card so the sectioned dashboard and any future field views can
 * reuse one card with a single set of one-tap actions.
 *
 * Each card shows: customer, address, appointment time, job type, priority,
 * status and the assigned technician, plus large tap targets:
 *   Call · Text · Directions · View Customer · Open Job · Add Notes ·
 *   Mark Arrived · Mark Completed
 *
 * Safety (unchanged from the original): Text opens the phone's SMS composer
 * (never auto-sends). Add Notes uses appointments.update with
 * sendInvites/sendConfirmation = false, so it never re-syncs Google Calendar or
 * fires an SMS. Nothing here touches QuickBooks.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  appointmentTypeLabel,
  serviceTypeLabel,
} from "@shared/appointmentTypes";
import { buildDirectionsUrl, hasServiceAddress } from "@shared/fieldApp";
import { formatDisplayName, formatAddress } from "@shared/nameFormat";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  MessageSquare,
  Navigation,
  MapPin,
  UserRound,
  Briefcase,
  CheckCircle2,
  CircleDot,
  Clock,
  StickyNote,
  Loader2,
  Building2,
  Wrench,
  CalendarX2,
} from "lucide-react";

// ── Status presentation (includes the "arrived" status) ──────────────────────
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  arrived: "bg-indigo-100 text-indigo-700 border-indigo-200",
  completed: "bg-gray-200 text-gray-700 border-gray-300",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  rescheduled: "bg-blue-100 text-blue-700 border-blue-200",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

/** The appointment shape the field job card needs (matches appointments.fieldJobs rows). */
export type FieldAppt = {
  id: number;
  scheduledAt: Date | string | null;
  durationMinutes: number | null;
  appointmentType: string | null;
  serviceType: string | null;
  status: string;
  priority: string | null;
  fullName: string;
  phone: string;
  propertyAddress: string | null;
  notes: string | null;
  issueDescription: string | null;
  customerId: number | null;
  jobId: number | null;
  assignedToId: number | null;
  companyName: string | null;
  customerDisplayName: string | null;
  technicianName: string | null;
};

/** Render an appointment date as a weekday + date + time, or a fallback. */
export function whenLabel(d: Date | string | null): string {
  if (!d) return "Unscheduled";
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Time-only label used inside a card header. */
function timeLabel(d: Date | string | null): string {
  if (!d) return "Unscheduled";
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Strip a phone string down to a tel:/sms:-safe value. */
function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/**
 * Self-contained "map preview". We have no Google Maps API key, so instead of an
 * embed that could render a broken/blank tile, we draw a lightweight map-styled
 * tile (grid + pin) that links straight to Google Maps directions. When there is
 * no address we show an explicit "No service address" state — never a broken map.
 */
function MapPreview({ address }: { address: string | null }) {
  const url = buildDirectionsUrl(address);
  if (!hasServiceAddress(address) || !url) {
    return (
      <div className="flex h-28 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground">
        <CalendarX2 className="h-5 w-5" />
        <span className="text-sm font-medium">No service address</span>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open directions to ${address}`}
      className="group relative block h-28 w-full overflow-hidden rounded-xl border border-border"
      style={{
        backgroundColor: "#e8efe6",
        backgroundImage:
          "linear-gradient(0deg, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(120deg, #dce7f0 0%, #e8efe6 55%, #f0ece2 100%)",
        backgroundSize: "22px 22px, 22px 22px, 100% 100%",
      }}
    >
      {/* faux route line */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(45deg, transparent 46%, rgba(255,107,53,0.55) 46%, rgba(255,107,53,0.55) 54%, transparent 54%)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow">
        <MapPin className="h-8 w-8 fill-[#ff6b35] text-white" strokeWidth={1.5} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/55 px-3 py-2 text-white">
        <Navigation className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-xs font-medium">{address}</span>
      </div>
    </a>
  );
}

/** Full-width action button — large tap target for gloved field hands. */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  variant = "outline",
  disabled,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
  loading?: boolean;
}) {
  const content = (
    <>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span className="text-sm font-semibold">{label}</span>
    </>
  );
  const cls = "flex h-12 w-full items-center justify-center gap-2";
  if (href) {
    return (
      <Button asChild variant={variant} className={cls} disabled={disabled}>
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
          {content}
        </a>
      </Button>
    );
  }
  return (
    <Button variant={variant} className={cls} onClick={onClick} disabled={disabled || loading}>
      {content}
    </Button>
  );
}

/**
 * One job card. `onChanged` is invoked after a successful status/notes mutation
 * so the parent can refetch. `readOnly` (admin previewing another technician)
 * hides the mutating actions — an admin should not silently mark another tech's
 * visit arrived/completed from the preview.
 */
export function JobCard({
  appt,
  onChanged,
  readOnly = false,
}: {
  appt: FieldAppt;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [, navigate] = useLocation();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(appt.notes ?? "");

  const directionsUrl = buildDirectionsUrl(appt.propertyAddress);
  const customerName = appt.companyName || appt.customerDisplayName || appt.fullName;
  const showCompany = Boolean(appt.companyName) && appt.companyName !== customerName;

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => onChanged(),
    onError: e => toast.error(e.message || "Could not update status"),
  });
  const updateNotes = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      setNotesOpen(false);
      onChanged();
    },
    onError: e => toast.error(e.message || "Could not save notes"),
  });

  const markArrived = () => {
    updateStatus.mutate({ id: appt.id, status: "arrived" });
    toast.success("Marked arrived");
  };
  const markCompleted = () => {
    updateStatus.mutate({ id: appt.id, status: "completed" });
    toast.success("Marked completed");
  };
  const saveNotes = () => {
    // sendInvites/sendConfirmation false → never re-syncs Google Calendar or sends SMS.
    updateNotes.mutate({
      id: appt.id,
      notes: notesDraft,
      sendInvites: false,
      sendConfirmation: false,
    });
  };

  const typeLine = [
    appointmentTypeLabel(appt.appointmentType),
    serviceTypeLabel(appt.serviceType),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-4">
        {/* Header: time + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Clock className="h-5 w-5 text-[#ff6b35]" />
            {timeLabel(appt.scheduledAt)}
            {appt.durationMinutes ? (
              <span className="text-sm font-normal text-muted-foreground">
                · {appt.durationMinutes}m
              </span>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 border ${STATUS_STYLE[appt.status] ?? "bg-muted text-foreground"}`}
          >
            {STATUS_LABEL[appt.status] ?? appt.status}
          </Badge>
        </div>

        {/* Type / service */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span>{typeLine || "Appointment"}</span>
          {appt.priority && appt.priority !== "normal" ? (
            <Badge className="bg-red-100 text-red-700 capitalize">{appt.priority}</Badge>
          ) : null}
        </div>

        {/* Customer block */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            {formatDisplayName(customerName)}
          </div>
          {showCompany ? (
            <div className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {formatDisplayName(appt.companyName)}
            </div>
          ) : null}
          <a
            href={`tel:${dialable(appt.phone)}`}
            className="flex items-center gap-2 pl-6 text-sm font-medium text-[#ff6b35]"
          >
            <Phone className="h-3.5 w-3.5" />
            {appt.phone}
          </a>
          <div className="flex items-start gap-2 pl-6 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{appt.propertyAddress ? formatAddress(appt.propertyAddress) : "No service address"}</span>
          </div>
          <div className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            {appt.technicianName ? `Tech: ${appt.technicianName}` : "Unassigned"}
          </div>
        </div>

        {/* Map preview → Google Maps directions */}
        <MapPreview address={appt.propertyAddress} />

        {/* Notes / issue */}
        {(appt.notes || appt.issueDescription) && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {appt.issueDescription ? (
              <p className="mb-1">
                <span className="font-semibold">Issue: </span>
                {appt.issueDescription}
              </p>
            ) : null}
            {appt.notes ? (
              <p>
                <span className="font-semibold">Notes: </span>
                {appt.notes}
              </p>
            ) : null}
          </div>
        )}

        {/* Communication actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton icon={Phone} label="Call" href={`tel:${dialable(appt.phone)}`} />
          <ActionButton icon={MessageSquare} label="Text" href={`sms:${dialable(appt.phone)}`} />
        </div>

        {/* Navigation + record actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={Navigation}
            label="Directions"
            href={directionsUrl ?? undefined}
            disabled={!directionsUrl}
          />
          <ActionButton
            icon={UserRound}
            label="View Customer"
            onClick={() => navigate(`/customers/${appt.customerId}`)}
            disabled={!appt.customerId}
          />
          <ActionButton
            icon={Briefcase}
            label="Open Job"
            onClick={() => appt.jobId && navigate(`/jobs/${appt.jobId}`)}
            disabled={!appt.jobId}
          />
          {!readOnly ? (
            <ActionButton
              icon={StickyNote}
              label="Add Notes"
              onClick={() => {
                setNotesDraft(appt.notes ?? "");
                setNotesOpen(true);
              }}
            />
          ) : null}
        </div>

        {/* Status actions — primary. Hidden in admin read-only preview. */}
        {!readOnly ? (
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              icon={CircleDot}
              label="Mark Arrived"
              variant="secondary"
              onClick={markArrived}
              loading={updateStatus.isPending && updateStatus.variables?.status === "arrived"}
              disabled={appt.status === "arrived" || appt.status === "completed"}
            />
            <ActionButton
              icon={CheckCircle2}
              label="Mark Completed"
              variant="default"
              onClick={markCompleted}
              loading={updateStatus.isPending && updateStatus.variables?.status === "completed"}
              disabled={appt.status === "completed"}
            />
          </div>
        ) : null}
      </CardContent>

      {/* Add Notes dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add notes</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            placeholder="What happened on site, follow-ups, parts needed…"
            rows={6}
            className="text-base"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNotesOpen(false)} className="h-11">
              Cancel
            </Button>
            <Button onClick={saveNotes} disabled={updateNotes.isPending} className="h-11">
              {updateNotes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default JobCard;
