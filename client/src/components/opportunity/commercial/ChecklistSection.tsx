/**
 * Checklist tab — progress, required-item indicators, complete/uncomplete,
 * assignee/due/notes, completed-by/at, and a conversion-blocking warning when
 * required items remain incomplete.
 */
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { checklistProgress, fmtDate } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

type ChecklistItem = CommercialDetail["checklist"][number];

export default function ChecklistSection({ opportunityId, items }: { opportunityId: number; items: ChecklistItem[] }) {
  const utils = trpc.useUtils();
  const { canWrite } = useCommercialPerms();
  const setComplete = trpc.opportunities.commercial.checklist.setComplete.useMutation({
    onSuccess: () => utils.opportunities.commercial.get.invalidate({ id: opportunityId }),
  });

  const progress = checklistProgress(items.map(i => ({ isComplete: !!i.isComplete, requiredForConversion: !!i.requiredForConversion })));

  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">No checklist items.</p>;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{progress.done} / {progress.total} complete</span>
          <span className="text-muted-foreground">{progress.pct}%</span>
        </div>
        <Progress value={progress.pct} />
      </div>

      {!progress.conversionReady ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{progress.requiredIncomplete} required item(s) must be completed before this opportunity can be converted to a Job.</span>
        </div>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {items.map(item => (
          <li key={item.id} className="flex items-start gap-2 p-2.5">
            <Checkbox
              className="mt-0.5"
              checked={!!item.isComplete}
              disabled={!canWrite || setComplete.isPending}
              onCheckedChange={c => setComplete.mutate({ itemId: item.id, isComplete: c === true })}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm ${item.isComplete ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
                {item.requiredForConversion ? <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300">required</Badge> : null}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                {item.dueAt ? <span>Due {fmtDate(item.dueAt)}</span> : null}
                {item.isComplete && item.completedAt ? <span>Completed {fmtDate(item.completedAt)}</span> : null}
                {item.notes ? <span className="truncate">{item.notes}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
