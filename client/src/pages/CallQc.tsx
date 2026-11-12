/**
 * Call QC — admin view of every scored rep call (shared/callQc.ts).
 * Summary per rep on top, then each call with its score, outcome and flags;
 * clicking a row opens the full review with the transcript.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { QcReportDialog } from "@/components/calls/ClickToCall";
import { QC_FLAG_LABEL, QC_VERDICT_LABEL, type QcVerdict } from "@shared/callQc";

const VERDICT_CLASS: Record<string, string> = {
  pass: "text-emerald-700 dark:text-emerald-400",
  coach: "text-amber-700 dark:text-amber-400",
  fail: "text-red-700 dark:text-red-400",
};

export default function CallQc() {
  const [days, setDays] = useState(7);
  const [agent, setAgent] = useState<number | "all">("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const q = trpc.calls.qcList.useQuery({ days });
  const rows = q.data ?? [];

  const reps = useMemo(() => {
    const m = new Map<number, { id: number; name: string; calls: number; scored: number; total: number; booked: number; fails: number; flags: number }>();
    for (const r of rows) {
      if (!r.agentTeamMemberId) continue;
      const e = m.get(r.agentTeamMemberId) ?? { id: r.agentTeamMemberId, name: r.agentName ?? "Rep", calls: 0, scored: 0, total: 0, booked: 0, fails: 0, flags: 0 };
      e.calls++;
      if (r.status === "done" && r.score !== null) {
        e.scored++;
        e.total += r.score;
      }
      if (r.appointmentBooked) e.booked++;
      if (r.verdict === "fail") e.fails++;
      e.flags += r.flags.length;
      m.set(e.id, e);
    }
    return Array.from(m.values());
  }, [rows]);

  const shown = agent === "all" ? rows : rows.filter((r) => r.agentTeamMemberId === agent);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Call QC</h1>
            <p className="text-sm text-muted-foreground">Every recorded rep call is transcribed and scored against the call playbook. Pass is 80+; any rule flag fails the call.</p>
          </div>
          <div className="flex gap-2">
            {[1, 7, 30].map((d) => (
              <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
                {d === 1 ? "Today" : `${d} days`}
              </Button>
            ))}
          </div>
        </div>

        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}

        {!q.isLoading && rows.length === 0 && (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No scored calls in this period. Calls show up here a few minutes after they end, once the recording is transcribed and reviewed.
            </CardContent>
          </Card>
        )}

        {reps.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reps.map((r) => (
              <Card
                key={r.id}
                className={`cursor-pointer ${agent === r.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setAgent(agent === r.id ? "all" : r.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <CardDescription>{agent === r.id ? "Showing only this rep — click to show all" : "Click to filter"}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-sm tabular-nums">
                  <div><div className="text-2xl font-semibold">{r.scored ? Math.round(r.total / r.scored) : "–"}</div><div className="text-muted-foreground">avg score</div></div>
                  <div><div className="text-2xl font-semibold">{r.calls}</div><div className="text-muted-foreground">calls</div></div>
                  <div><div className="text-2xl font-semibold">{r.booked}</div><div className="text-muted-foreground">booked</div></div>
                  <div className="col-span-3 text-muted-foreground">{r.fails} failed QC · {r.flags} rule flags</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {shown.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">When (ET)</th>
                  <th className="p-2">Rep</th>
                  <th className="p-2">Called</th>
                  <th className="p-2">Length</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Outcome</th>
                  <th className="p-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.callLogId} className="border-t hover:bg-muted/40 cursor-pointer align-top" onClick={() => setOpenId(r.callLogId)}>
                    <td className="p-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="p-2">{r.agentName ?? "–"}</td>
                    <td className="p-2">
                      {r.leadCaptureId ? (
                        <Link href={`/lead-dashboard?lead=${r.leadCaptureId}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                          {r.phoneNumber}
                        </Link>
                      ) : r.customerId ? (
                        <Link href={`/customers/${r.customerId}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                          {r.phoneNumber}
                        </Link>
                      ) : (
                        r.phoneNumber
                      )}
                      {r.summary && <div className="text-muted-foreground max-w-md">{r.summary}</div>}
                    </td>
                    <td className="p-2 tabular-nums">{r.duration ? `${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, "0")}` : "–"}</td>
                    <td className={`p-2 tabular-nums font-medium ${VERDICT_CLASS[r.verdict ?? ""] ?? ""}`}>
                      {r.status === "done" ? `${r.score ?? "–"} · ${QC_VERDICT_LABEL[(r.verdict ?? "not_scored") as QcVerdict]}` : r.status}
                    </td>
                    <td className="p-2">{(r.outcome ?? "").replace(/_/g, " ")}</td>
                    <td className="p-2 text-red-700 dark:text-red-400">{r.flags.map((f) => QC_FLAG_LABEL[f.code]).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {openId !== null && <QcReportDialog callLogId={openId} open onOpenChange={(v) => !v && setOpenId(null)} />}
    </div>
  );
}
