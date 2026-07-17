/**
 * OfficeFieldSummary (PR #41) — read-only office view of the technician's field
 * completion data (time entries, parts, signature, completion summary). Rendered
 * inside the office Job Detail. No editing; assembled by jobs.jobCompletionSummary.
 */
import { trpc } from "@/lib/trpc";
import { formatDuration } from "@shared/jobTime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, Package, PenLine, ClipboardCheck } from "lucide-react";

export function OfficeFieldSummary({ jobId }: { jobId: number }) {
  const { data } = trpc.jobs.jobCompletionSummary.useQuery({ jobId }, { enabled: jobId > 0, retry: false });
  if (!data) return null;
  const { time, parts, signature, completion } = data;
  const nothing = (time?.elapsedMs ?? 0) === 0 && (parts?.length ?? 0) === 0 && !signature?.hasSignature && !completion;
  if (nothing) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-[#1e3a5f]" /> Field Completion
          {completion ? <Badge variant="secondary">Completed</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Time totals */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 py-1.5"><div className="text-[11px] text-muted-foreground">Travel</div><div className="font-semibold">{formatDuration(time?.travelMs ?? 0)}</div></div>
          <div className="rounded-lg bg-muted/50 py-1.5"><div className="text-[11px] text-muted-foreground">Labor</div><div className="font-semibold">{formatDuration(time?.laborMs ?? 0)}</div></div>
          <div className="rounded-lg bg-muted/50 py-1.5"><div className="text-[11px] text-muted-foreground">Elapsed</div><div className="font-semibold">{formatDuration(time?.elapsedMs ?? 0)}</div></div>
        </div>

        {/* Parts */}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Package className="h-3.5 w-3.5" /> Parts Used ({parts?.length ?? 0})</div>
          {(parts?.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">None recorded.</p> : (
            <ul className="space-y-0.5">
              {parts.map((p: any) => (
                <li key={p.id} className="text-xs">• {p.description} × {Number(p.quantity)}{p.unit ? ` ${p.unit}` : ""}{p.partNumber ? ` (Part #${p.partNumber})` : ""}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Signature */}
        <div className="flex items-center gap-1.5 text-xs">
          <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
          {signature?.hasSignature ? <span className="text-green-700">Signature captured{signature.signedAt ? ` · ${new Date(signature.signedAt).toLocaleString()}` : ""}</span> : <span className="text-muted-foreground">No signature.</span>}
        </div>

        {completion ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Completed {new Date(completion.completedAt).toLocaleString()} · note: {completion.noteMode === "note" ? "customer note" : "no note"}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default OfficeFieldSummary;
