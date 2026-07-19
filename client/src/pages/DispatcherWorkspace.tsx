/**
 * Dispatch Board (M1) — admin-only, READ-ONLY, single-day.
 *
 * Two panels: a Technician Workload Board (one lane per active technician + an
 * Unassigned lane) for one selected day, and the Unscheduled queue. View-only —
 * assignment, rescheduling, and drag-and-drop arrive in a later milestone.
 * Server enforcement is authoritative (adminProcedure); this page also gates on
 * `canAccessDispatch` as defense-in-depth.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessDispatch } from "@shared/dispatchPermissions";
import { todayInTimeZone, shiftDay } from "@shared/dispatchBoard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VisitCard from "@/components/dispatch/VisitCard";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

const BROWSER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; }
  catch { return "America/New_York"; }
})();

function prettyDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function DispatcherWorkspace() {
  const { user } = useAuth();
  const allowed = canAccessDispatch(user);
  const [day, setDay] = useState(() => todayInTimeZone(new Date(), BROWSER_TZ));
  const today = todayInTimeZone(new Date(), BROWSER_TZ);

  const board = trpc.dispatch.board.useQuery({ day, timeZone: BROWSER_TZ }, { enabled: allowed, refetchOnWindowFocus: false });
  const unscheduled = trpc.dispatch.unscheduled.useQuery({ limit: 50 }, { enabled: allowed, refetchOnWindowFocus: false });

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Dispatch</h1>
        <p className="mt-2 text-muted-foreground">This board is available to administrators only.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">Single-day technician workload — read-only.</p>
        </div>
        {/* Date bar */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDay(d => shiftDay(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)}
            aria-label="Select day"
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setDay(d => shiftDay(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant={day === today ? "default" : "outline"} size="sm" onClick={() => setDay(today)}>Today</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Read-only view — assigning and rescheduling arrive in a later update. Live status reflects the technician’s work status.
      </div>

      {/* Workload board */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Technician workload — {prettyDate(day)}</h2>
        </div>
        {board.isLoading ? (
          <div className="flex gap-3 overflow-x-auto">
            {[0, 1, 2].map(i => <div key={i} className="h-40 w-72 shrink-0 animate-pulse rounded-xl border bg-muted/40" />)}
          </div>
        ) : board.error ? (
          <ErrorBox message="Couldn’t load the board." onRetry={() => board.refetch()} />
        ) : board.data && board.data.lanes.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {board.data.lanes.map(lane => (
              <div key={lane.technicianId ?? "unassigned"} className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-sm font-semibold">{lane.technicianName}</span>
                  <Badge variant="secondary" className="tabular-nums">{lane.count}</Badge>
                </div>
                <div className="flex flex-col gap-2 p-2">
                  {lane.visits.length === 0
                    ? <p className="px-1 py-3 text-center text-xs text-muted-foreground">No visits</p>
                    : lane.visits.map(v => <VisitCard key={v.appointmentId} visit={v} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBox message={`No visits scheduled for ${prettyDate(day)}.`} />
        )}
      </section>

      {/* Unscheduled queue */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Unscheduled{unscheduled.data ? ` (${unscheduled.data.total}${unscheduled.data.truncated ? "+" : ""})` : ""}
        </h2>
        {unscheduled.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/40" />)}
          </div>
        ) : unscheduled.error ? (
          <ErrorBox message="Couldn’t load unscheduled appointments." onRetry={() => unscheduled.refetch()} />
        ) : unscheduled.data && unscheduled.data.visits.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.data.visits.map(v => <VisitCard key={v.appointmentId} visit={v} />)}
          </div>
        ) : (
          <EmptyBox message="No unscheduled appointments." />
        )}
      </section>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{message}</div>;
}
function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}
