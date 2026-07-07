/**
 * Shows the people invited to an appointment and the invite / Google Calendar
 * sync status (Task 8). Self-contained: fetches attendees by appointment id.
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarCheck, CalendarX, Mail } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  organizer: "Organizer",
  team_member: "Coworker",
  customer: "Customer",
  guest: "Guest",
};

const INVITE_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  tentative: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

export default function AppointmentAttendees({
  appointmentId,
  googleSyncStatus,
  googleCalendarEventId,
  inviteStatus,
}: {
  appointmentId: number;
  googleSyncStatus?: string | null;
  googleCalendarEventId?: string | null;
  inviteStatus?: string | null;
}) {
  const { data: attendees = [] } = trpc.appointments.attendees.useQuery({ appointmentId });

  if (attendees.length === 0) {
    return <p className="text-xs text-muted-foreground">No one invited to this appointment.</p>;
  }

  const synced = googleSyncStatus === "synced" && googleCalendarEventId;
  const syncError = googleSyncStatus === "error";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-[#1e3a5f]">
        <Users className="h-4 w-4" /> Invited ({attendees.length})
        {synced ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
            <CalendarCheck className="h-3 w-3" /> Google Calendar
          </Badge>
        ) : syncError ? (
          <Badge variant="secondary" className="bg-red-100 text-red-700 gap-1">
            <CalendarX className="h-3 w-3" /> Sync error
          </Badge>
        ) : inviteStatus && inviteStatus !== "none" ? (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 gap-1">
            <Mail className="h-3 w-3" /> Email invite
          </Badge>
        ) : null}
      </div>
      <ul className="space-y-1">
        {attendees.map(a => (
          <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">
              <span className="font-medium">{a.name || a.email}</span>
              {a.name && <span className="text-muted-foreground"> · {a.email}</span>}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground">{ROLE_LABEL[a.role] ?? a.role}</span>
              <Badge variant="secondary" className={INVITE_BADGE[a.inviteStatus] ?? ""}>{a.inviteStatus}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
