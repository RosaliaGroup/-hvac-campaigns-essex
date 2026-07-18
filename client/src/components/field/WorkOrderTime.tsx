/**
 * WorkOrderTime (PR #41) — technician time clock on the work order. Six actions
 * (Start Travel → Finish Work) drive an append-only event log; travel / labor /
 * elapsed totals are computed by shared/jobTime. Legal next actions are gated by
 * the current state (server enforces too). Locked once the job is completed.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  TIME_ACTION_LABEL, nextTimeActions, computeTimeSummary, formatDuration,
  type TimeState,
} from "@shared/jobTime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Timer, Loader2, MapPin } from "lucide-react";

const STATE_LABEL: Record<TimeState, string> = {
  not_started: "Not started", traveling: "Traveling", arrived: "On site",
  working: "Working", paused: "Paused", finished: "Work finished",
};
function eventLabel(t: string): string {
  return (TIME_ACTION_LABEL as Record<string, string>)[t] ?? t;
}
function timeOf(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function WorkOrderTime({ jobId, locked }: { jobId: number; locked: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.jobs.fieldListTime.useQuery({ jobId }, { enabled: jobId > 0 });
  const add = trpc.jobs.fieldAddTimeEvent.useMutation();

  // Tick so open segments (traveling/working) update live.
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);

  const events = data?.events ?? [];
  const summary = computeTimeSummary(events as any, new Date());
  const actions = nextTimeActions(summary.state);

  const fire = async (eventType: any) => {
    try { await add.mutateAsync({ jobId, eventType }); utils.jobs.fieldListTime.invalidate({ jobId }); }
    catch (e: any) { toast.error(e?.message || "Could not record time"); }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Timer className="h-4 w-4" />
          <span className="uppercase tracking-wide">Time Tracking</span>
          <Badge variant="secondary" className="ml-auto">{STATE_LABEL[summary.state]}</Badge>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Travel", summary.travelMs, MapPin], ["Labor", summary.laborMs, Clock], ["Elapsed", summary.elapsedMs, Timer]].map(([label, ms, Icon]: any) => (
            <div key={label} className="rounded-xl bg-muted/50 py-2">
              <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
              <div className="text-base font-bold">{formatDuration(ms)}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {locked ? (
          <p className="text-xs text-muted-foreground">Time entries are locked (job completed).</p>
        ) : actions.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {actions.map(a => (
              <Button key={a} className="h-12 text-sm font-semibold" variant={a === "work_finish" ? "default" : "secondary"} disabled={add.isPending} onClick={() => fire(a)}>
                {add.isPending && add.variables?.eventType === a ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {TIME_ACTION_LABEL[a]}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Work finished.</p>
        )}

        {/* Timeline */}
        {isLoading ? null : events.length > 0 ? (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">Timeline</div>
            {events.map((e: any) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{eventLabel(e.eventType)}</span>
                <span className="ml-auto text-muted-foreground">{timeOf(e.occurredAt)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default WorkOrderTime;
