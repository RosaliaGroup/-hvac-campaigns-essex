/**
 * WorkOrderCompletion (PR #41) — finalizes a service call. Shows the completion
 * requirements (work finished · customer note or "no note" · signature if the
 * company requires it), a sticky Complete Job bar with a confirmation step, and a
 * clear locked banner once completed. Validation mirrors the server
 * (validateJobCompletion); the server is the source of truth.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { validateJobCompletion, COMPLETION_BLOCK_MESSAGE } from "@shared/jobCompletion";
import type { TechnicianWorkStatus } from "@shared/workStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, Lock, Loader2, ClipboardCheck } from "lucide-react";

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export function WorkOrderCompletion({ jobId, workStatus, onCompleted }: {
  jobId: number; workStatus: TechnicianWorkStatus; onCompleted: () => void;
}) {
  const utils = trpc.useUtils();
  const notes = trpc.jobs.fieldListNotes.useQuery({ jobId }, { enabled: jobId > 0 });
  const settings = trpc.jobs.getCompletionSettings.useQuery();
  const sig = trpc.jobs.fieldGetSignature.useQuery({ jobId }, { enabled: jobId > 0 });
  const complete = trpc.jobs.completeJob.useMutation();

  const [noNote, setNoNote] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const completed = workStatus === "completed";
  const hasCustomerNote = (notes.data?.notes ?? []).some((n: any) => n.visibility === "customer");
  const requireSignature = settings.data?.requireCompletionSignature ?? false;
  const hasSignature = sig.data?.hasSignature ?? false;

  const validation = validateJobCompletion({ currentWorkStatus: workStatus, hasCustomerNote, noCompletionNote: noNote, requireSignature, hasSignature });

  const doComplete = async () => {
    try {
      await complete.mutateAsync({ jobId, noCompletionNote: noNote });
      setConfirmOpen(false);
      utils.jobs.fieldWorkOrder.invalidate({ id: jobId });
      onCompleted();
      toast.success("Job completed");
    } catch (e: any) { toast.error(e?.message || "Could not complete job"); }
  };

  if (completed) {
    return (
      <Card className="rounded-2xl border-green-200 shadow-sm">
        <CardContent className="flex items-center gap-2 p-4 text-sm font-semibold text-green-700">
          <Lock className="h-4 w-4" /> Job completed — notes, parts, time and status are locked.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <ClipboardCheck className="h-4 w-4" />
            <span className="uppercase tracking-wide">Complete Job</span>
          </div>
          <div className="space-y-1.5">
            <Req ok={workStatus === "working" || workStatus === "waiting_parts"} label="Work finished (status Working / Waiting for Parts)" />
            <Req ok={hasCustomerNote || noNote} label="Customer note added (or “No completion note”)" />
            {requireSignature ? <Req ok={hasSignature} label="Customer signature captured" /> : null}
          </div>
          {!hasCustomerNote ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={noNote} onCheckedChange={v => setNoNote(!!v)} /> No completion note
            </label>
          ) : null}
          {!validation.ok ? (
            <p className="text-xs text-amber-700">{COMPLETION_BLOCK_MESSAGE[validation.reason]}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Sticky completion bar (above the quick-action bar) */}
      <div className="fixed inset-x-0 bottom-[68px] z-30 border-t bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto max-w-xl">
          <Button className="h-12 w-full text-base font-semibold" disabled={!validation.ok || complete.isPending} onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 className="mr-2 h-5 w-5" /> Complete Job
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Complete this job?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            After completion, notes, parts, time entries, the signature and status become read-only for technicians. This can't be undone in the field.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="h-11" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="h-11" disabled={complete.isPending} onClick={doComplete}>
              {complete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, complete job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorkOrderCompletion;
