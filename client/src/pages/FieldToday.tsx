/**
 * /field/today — Field App (mobile)
 *
 * A phone-first view of the logged-in technician/salesperson's appointments for
 * TODAY. Card-based, large tap targets, compact sticky header, no desktop table,
 * no horizontal scroll. Each card carries the visit details, a self-contained map
 * preview (no map API key, so it can never render a broken tile), and one-tap
 * actions:
 *   Call · Text · Directions · View Customer · View Job · Mark Arrived ·
 *   Mark Completed · Add Note
 *
 * Notes are APPEND-ONLY: prior notes render as read-only history and "Add Note"
 * appends a new timestamped, authored entry — it never edits or overwrites.
 *
 * Safety: Text opens the phone's SMS composer (never auto-sends). Add Note uses
 * appointments.update with sendInvites/sendConfirmation = false, so it never
 * re-syncs Google Calendar or fires an SMS. Nothing here touches QuickBooks.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  appointmentTypeLabel,
  serviceTypeLabel,
} from "@shared/appointmentTypes";
import {
  buildDirectionsUrl,
  hasServiceAddress,
  appendNote,
  buildFieldNotesUpdate,
} from "@shared/fieldApp";
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
  ArrowLeft,
  RefreshCw,
} from "lucide-react";

// ── Status presentation (includes the new "arrived" status) ──────────────────
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

type FieldAppt = {
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

function timeLabel(d: Date | string | null): string {
  if (!d) return "Unscheduled";
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Strip a phone string down to a tel:/sms:-safe value. */
function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

/** Back: return to the previous page if history exists, else /calendar. */
function goBack(navigate: (to: string) => void) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
  } else {
    navigate("/calendar");
  }
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
      <div className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground">
        <CalendarX2 className="h-5 w-5 shrink-0" />
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
      className="group relative block h-24 w-full overflow-hidden rounded-xl border border-border"
      style={{
        backgroundColor: "#e8efe6",
        backgroundImage:
          "linear-gradient(0deg, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(120deg, #dce7f0 0%, #e8efe6 55%, #f0ece2 100%)",
        backgroundSize: "22px 22px, 22px 22px, 100% 100%",
      }}
    >
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
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-black/55 px-3 py-1.5 text-white">
        <Navigation className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-xs font-medium">{address}</span>
      </div>
    </a>
  );
}

/** Full-width action button — large tap target; label truncates, never overflows. */
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
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
      ) : (
        <Icon className="h-5 w-5 shrink-0" />
      )}
      <span className="truncate text-sm font-semibold">{label}</span>
    </>
  );
  const cls = "flex h-12 w-full min-w-0 items-center justify-center gap-2 px-2";
  if (href && !disabled) {
    return (
      <Button asChild variant={variant} className={cls}>
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

function AppointmentCard({
  appt,
  authorName,
  onChanged,
}: {
  appt: FieldAppt;
  authorName: string;
  onChanged: () => void;
}) {
  const [, navigate] = useLocation();
  const [notesOpen, setNotesOpen] = useState(false);
  const [newNote, setNewNote] = useState("");

  const directionsUrl = buildDirectionsUrl(appt.propertyAddress);
  const customerName = appt.companyName || appt.customerDisplayName || appt.fullName;
  const showCompany = Boolean(appt.companyName) && appt.companyName !== customerName;

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => onChanged(),
    onError: e => toast.error(e.message || "Could not update status"),
  });
  const updateNotes = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      setNewNote("");
      setNotesOpen(false);
      onChanged();
    },
    onError: e => toast.error(e.message || "Could not save note"),
  });

  const markArrived = () => {
    updateStatus.mutate({ id: appt.id, status: "arrived" });
    toast.success("Marked arrived");
  };
  const markCompleted = () => {
    updateStatus.mutate({ id: appt.id, status: "completed" });
    toast.success("Marked completed");
  };
  const saveNote = () => {
    const text = newNote.trim();
    if (!text) return;
    // APPEND-ONLY: never overwrites prior notes. sendInvites/sendConfirmation
    // false → no Google Calendar re-sync, no SMS.
    const combined = appendNote(appt.notes, text, new Date(), authorName);
    updateNotes.mutate(buildFieldNotesUpdate(appt.id, combined));
  };

  const typeLine = [
    appointmentTypeLabel(appt.appointmentType),
    serviceTypeLabel(appt.serviceType),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="w-full overflow-hidden rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-4">
        {/* Header: time + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-lg font-bold">
            <Clock className="h-5 w-5 shrink-0 text-[#ff6b35]" />
            <span className="truncate">{timeLabel(appt.scheduledAt)}</span>
            {appt.durationMinutes ? (
              <span className="shrink-0 text-sm font-normal text-muted-foreground">
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
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-words">{typeLine || "Appointment"}</span>
          {appt.priority && appt.priority !== "normal" ? (
            <Badge className="shrink-0 bg-red-100 capitalize text-red-700">{appt.priority}</Badge>
          ) : null}
        </div>

        {/* Customer block */}
        <div className="space-y-1">
          <div className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{customerName}</span>
          </div>
          {showCompany ? (
            <div className="flex min-w-0 items-center gap-2 pl-6 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{appt.companyName}</span>
            </div>
          ) : null}
          <a
            href={`tel:${dialable(appt.phone)}`}
            className="flex min-w-0 items-center gap-2 pl-6 text-sm font-medium text-[#ff6b35]"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{appt.phone}</span>
          </a>
          <div className="flex items-start gap-2 pl-6 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">{appt.propertyAddress || "No service address"}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 pl-6 text-sm text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{appt.technicianName ? `Tech: ${appt.technicianName}` : "Unassigned"}</span>
          </div>
        </div>

        {/* Map preview → Google Maps directions */}
        <MapPreview address={appt.propertyAddress} />

        {/* Issue + notes history (READ-ONLY) */}
        {(appt.notes || appt.issueDescription) && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            {appt.issueDescription ? (
              <p className="break-words">
                <span className="font-semibold">Issue: </span>
                {appt.issueDescription}
              </p>
            ) : null}
            {appt.notes ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes history
                </p>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                  {appt.notes}
                </p>
              </div>
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
            label="Customer"
            onClick={() => navigate(`/customers/${appt.customerId}`)}
            disabled={!appt.customerId}
          />
          {appt.jobId ? (
            <ActionButton
              icon={Briefcase}
              label="View Job"
              onClick={() => navigate(`/jobs/${appt.jobId}`)}
            />
          ) : null}
          <ActionButton
            icon={StickyNote}
            label="Add Note"
            onClick={() => {
              setNewNote("");
              setNotesOpen(true);
            }}
          />
        </div>

        {/* Status actions — primary */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={CircleDot}
            label="Arrived"
            variant="secondary"
            onClick={markArrived}
            loading={updateStatus.isPending && updateStatus.variables?.status === "arrived"}
            disabled={appt.status === "arrived" || appt.status === "completed"}
          />
          <ActionButton
            icon={CheckCircle2}
            label="Completed"
            variant="default"
            onClick={markCompleted}
            loading={updateStatus.isPending && updateStatus.variables?.status === "completed"}
            disabled={appt.status === "completed"}
          />
        </div>
      </CardContent>

      {/* Add Note dialog — APPEND ONLY (starts empty; never prefilled with prior notes) */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a note</DialogTitle>
          </DialogHeader>
          {appt.notes ? (
            <div className="rounded-lg bg-muted/50 p-2.5 text-xs">
              <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Existing notes (read-only)
              </p>
              <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">
                {appt.notes}
              </p>
            </div>
          ) : null}
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a new note (appended with time + your name)…"
            rows={5}
            className="text-base"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNotesOpen(false)} className="h-11">
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={updateNotes.isPending || !newNote.trim()} className="h-11">
              {updateNotes.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Append note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function FieldToday() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const authorName = user?.name || user?.email || "Field";

  const { data, isLoading, isError, error, refetch, isRefetching } =
    trpc.appointments.fieldToday.useQuery(undefined, {
      refetchOnWindowFocus: true,
    });

  const appts = useMemo(() => (data?.appointments ?? []) as FieldAppt[], [data]);
  const notLinked = data != null && data.memberId == null;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-muted/30">
      {/* Compact sticky header — Back · title/date+count · Refresh (no overlap) */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goBack(navigate)}
            className="h-9 shrink-0 gap-1 px-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </Button>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-bold leading-tight">Today's Route</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {todayLabel()} · {appts.length} {appts.length === 1 ? "stop" : "stops"}
            </p>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => refetch()}
            aria-label="Refresh"
            className="h-9 w-9 shrink-0"
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-3 px-3 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
            <p className="text-sm">Loading your appointments…</p>
          </div>
        ) : isError ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-center text-sm text-red-600">
              Couldn't load appointments. {error?.message}
            </CardContent>
          </Card>
        ) : notLinked ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-6 text-center">
              <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Your account isn't linked to a technician profile.</p>
              <p className="text-xs text-muted-foreground">
                Appointments assigned to you will appear here once your team admin links your profile.
              </p>
            </CardContent>
          </Card>
        ) : appts.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <p className="text-base font-semibold">No appointments today</p>
              <p className="text-sm text-muted-foreground">
                You're all clear. New assignments for today will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          appts.map(appt => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              authorName={authorName}
              onChanged={() => refetch()}
            />
          ))
        )}
      </main>
    </div>
  );
}
