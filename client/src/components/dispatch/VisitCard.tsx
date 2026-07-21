/**
 * Dispatch VisitCard (M1 read + M2 assign). Renders one visit on the board or in
 * the unscheduled queue. When `canAssign` is set and a technician list is passed,
 * it shows the admin-only AssigneePicker (assign / reassign / unassign); otherwise
 * it is read-only. Live status reflects technicianWorkStatus when a job is linked,
 * otherwise the appointment status. No drag / reschedule (later milestones).
 */
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Clock } from "lucide-react";
import type { BoardVisit, Priority } from "@shared/dispatchBoard";
import AssigneePicker, { type PickerTechnician } from "@/components/dispatch/AssigneePicker";

const PRIORITY_STYLE: Record<Priority, string> = {
  normal: "bg-slate-100 text-slate-600 border-slate-200",
  urgent: "bg-amber-100 text-amber-700 border-amber-200",
  emergency: "bg-red-100 text-red-700 border-red-200",
};

// Covers both technicianWorkStatus and appointment status values.
const STATUS_STYLE: Record<string, string> = {
  assigned: "bg-slate-100 text-slate-700", accepted: "bg-sky-100 text-sky-700",
  en_route: "bg-violet-100 text-violet-700", arrived: "bg-indigo-100 text-indigo-700",
  working: "bg-amber-100 text-amber-700", waiting_parts: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  pending: "bg-slate-100 text-slate-700", confirmed: "bg-sky-100 text-sky-700",
  rescheduled: "bg-amber-100 text-amber-700",
};

const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

function formatTime(iso: string | null): string {
  if (!iso) return "Unscheduled";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch { return "—"; }
}

export default function VisitCard(
  { visit, technicians, canAssign }: { visit: BoardVisit; technicians?: PickerTechnician[]; canAssign?: boolean },
) {
  const showPicker = !!canAssign && Array.isArray(technicians);
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-medium tabular-nums">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {formatTime(visit.scheduledAt)}
          {visit.scheduledAt && <span className="text-xs font-normal text-muted-foreground">· {visit.durationMinutes}m</span>}
        </span>
        <div className="flex items-center gap-1">
          {visit.priority !== "normal" && (
            <Badge variant="outline" className={PRIORITY_STYLE[visit.priority]}>{titleCase(visit.priority)}</Badge>
          )}
          <Badge variant="outline" className={STATUS_STYLE[visit.liveStatus] ?? "bg-slate-100 text-slate-700"}>
            {titleCase(visit.liveStatus)}
          </Badge>
        </div>
      </div>

      <div className="mt-1.5 font-medium">{visit.customerName}</div>
      <div className="text-xs text-muted-foreground">{titleCase(visit.appointmentType)}</div>

      <div className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{visit.propertyAddress ?? "No service address"}</span>
      </div>

      {showPicker && (
        <div className="mt-2">
          <AssigneePicker visit={visit} technicians={technicians!} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {visit.jobNumber && visit.jobId != null ? (
          <Link href={`/jobs/${visit.jobId}`} className="text-xs font-medium text-primary hover:underline">
            {visit.jobNumber}
          </Link>
        ) : <span className="text-xs text-muted-foreground">No linked job</span>}
        {visit.phone && (
          <a href={`tel:${visit.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        )}
      </div>
    </div>
  );
}
