/**
 * /field/today (and /field/my-jobs) — Field App (mobile) "My Jobs" dashboard.
 *
 * Replaces the old single-list "Today's Route" screen with a sectioned, phone-
 * first board of the logged-in technician's work:
 *   Overdue · Today · Upcoming · Completed Today
 *
 * Each job renders as a shared <JobCard> (customer, address, time, job type,
 * priority, status, assigned technician + one-tap Call / Directions / Open Job
 * and record actions). Permissions: a technician sees only their own assigned
 * work; an admin can preview another technician via the admin-only filter (the
 * server enforces the scoping — see appointments.fieldJobs). Read-only for the
 * feed; the only writes are the existing Mark Arrived/Completed/Add Notes
 * actions, which never touch QuickBooks, Google Calendar sync, or SMS.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { JobCard, type FieldAppt } from "@/components/field/JobCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserRound,
  UserCog,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  CalendarClock,
  CalendarCheck2,
  Sun,
  Eye,
} from "lucide-react";

type SectionKey = "overdue" | "today" | "upcoming" | "completedToday";

// Urgency order: problems first, then the day, then what's ahead, then done.
const SECTIONS: {
  key: SectionKey;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Header accent classes (icon + count badge) for at-a-glance triage. */
  accent: string;
  /** Muted line shown when the section is empty. */
  empty: string;
}[] = [
  {
    key: "overdue",
    title: "Overdue",
    icon: AlertTriangle,
    accent: "text-red-600",
    empty: "Nothing overdue — you're caught up.",
  },
  {
    key: "today",
    title: "Today",
    icon: Sun,
    accent: "text-[#ff6b35]",
    empty: "No jobs scheduled for today.",
  },
  {
    key: "upcoming",
    title: "Upcoming",
    icon: CalendarClock,
    accent: "text-blue-600",
    empty: "Nothing scheduled ahead.",
  },
  {
    key: "completedToday",
    title: "Completed Today",
    icon: CalendarCheck2,
    accent: "text-green-600",
    empty: "No jobs completed yet today.",
  },
];

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function SectionBlock({
  title,
  icon: Icon,
  accent,
  empty,
  appts,
  readOnly,
  onChanged,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  empty: string;
  appts: FieldAppt[];
  readOnly: boolean;
  onChanged: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Icon className={`h-5 w-5 ${accent}`} />
        <h2 className="text-base font-bold">{title}</h2>
        <Badge variant="secondary" className="ml-auto text-sm">
          {appts.length}
        </Badge>
      </div>
      {appts.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-4">
          {appts.map(appt => (
            <JobCard key={appt.id} appt={appt} onChanged={onChanged} readOnly={readOnly} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function FieldMyJobs() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Admin-only technician preview. `undefined` = view my own jobs.
  const [previewTechId, setPreviewTechId] = useState<number | undefined>(undefined);

  const { data, isLoading, isError, error, refetch, isRefetching } =
    trpc.appointments.fieldJobs.useQuery(
      isAdmin && previewTechId ? { technicianId: previewTechId } : undefined,
      { refetchOnWindowFocus: true },
    );

  // Roster for the admin picker (active team members only).
  const rosterQuery = trpc.appointments.teamRoster.useQuery(undefined, {
    enabled: isAdmin,
  });
  const roster = rosterQuery.data ?? [];

  const sections = data?.sections;
  const total = useMemo(
    () =>
      sections
        ? sections.overdue.length +
          sections.today.length +
          sections.upcoming.length +
          sections.completedToday.length
        : 0,
    [sections],
  );

  // The server tells us who we're actually viewing. Previewing another tech →
  // cards are read-only (an admin shouldn't mutate someone else's visit here).
  const isPreviewing =
    Boolean(data?.isAdmin) &&
    data?.viewingMemberId != null &&
    data.viewingMemberId !== data.memberId;

  const notLinked = data != null && data.viewingMemberId == null && !data.isAdmin;
  const adminNoSelection = data != null && data.viewingMemberId == null && data.isAdmin;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold leading-tight">My Jobs</h1>
              <p className="text-xs text-muted-foreground">{todayLabel()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {total} {total === 1 ? "job" : "jobs"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => navigate("/field/profile")}
                aria-label="My Profile"
                className="h-9 w-9"
              >
                <UserCog className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => refetch()}
                aria-label="Refresh"
                className="h-9 w-9"
              >
                {isRefetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Admin-only technician preview */}
          {isAdmin ? (
            <div className="mt-3 flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              <label htmlFor="preview-technician" className="shrink-0 text-sm font-medium text-muted-foreground">
                Preview technician:
              </label>
              <Select
                value={previewTechId ? String(previewTechId) : "me"}
                onValueChange={v => setPreviewTechId(v === "me" ? undefined : Number(v))}
              >
                <SelectTrigger id="preview-technician" className="h-9" aria-label="Preview technician">
                  <SelectValue placeholder="My jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">My jobs</SelectItem>
                  {roster.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Preview banner — makes it unmistakable you're viewing someone else. */}
          {isPreviewing ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <Eye className="h-3.5 w-3.5" />
              Previewing {data?.technicianName ?? "technician"}'s jobs (read-only)
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-3 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
            <p className="text-sm">Loading your jobs…</p>
          </div>
        ) : isError ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-center text-sm text-red-600">
              Couldn't load jobs. {error?.message}
            </CardContent>
          </Card>
        ) : notLinked ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-6 text-center">
              <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Your account isn't linked to a technician profile.</p>
              <p className="text-xs text-muted-foreground">
                Work assigned to you will appear here once your team admin links your profile.
              </p>
            </CardContent>
          </Card>
        ) : adminNoSelection ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-6 text-center">
              <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Choose a technician to preview.</p>
              <p className="text-xs text-muted-foreground">
                Your admin account has no field assignments of its own. Use the filter above to view a
                technician's board.
              </p>
            </CardContent>
          </Card>
        ) : total === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
              <p className="text-base font-semibold">No jobs to show</p>
              <p className="text-sm text-muted-foreground">
                Nothing overdue, today, or upcoming. New assignments will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          SECTIONS.map(s => (
            <SectionBlock
              key={s.key}
              title={s.title}
              icon={s.icon}
              accent={s.accent}
              empty={s.empty}
              appts={(sections?.[s.key] ?? []) as FieldAppt[]}
              readOnly={isPreviewing}
              onChanged={() => refetch()}
            />
          ))
        )}
      </main>
    </div>
  );
}
