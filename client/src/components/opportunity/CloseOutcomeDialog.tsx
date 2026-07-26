/**
 * Confirmation + reason capture for closing an opportunity Won or Lost. Marking
 * an opportunity Lost requires a reason (the pipeline should never accumulate
 * unexplained losses); marking it Won takes an optional close reason. Both are
 * confirmations, so a single misclick can't silently close a live opportunity.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, XCircle } from "lucide-react";
import { LOST_REASONS, WON_REASONS, canConfirmClose, normalizeReason } from "./closeReasons";

export function CloseOutcomeDialog({
  outcome, open, onOpenChange, onConfirm, pending,
}: {
  outcome: "won" | "lost" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  // Reset the draft whenever the dialog (re)opens for a given outcome.
  const [seenFor, setSeenFor] = useState<string | null>(null);
  if (open && seenFor !== outcome) { setSeenFor(outcome); setReason(""); }
  if (!open && seenFor !== null) setSeenFor(null);

  if (!outcome) return null;
  const isLost = outcome === "lost";
  const suggestions = isLost ? LOST_REASONS : WON_REASONS;
  const canConfirm = canConfirmClose(outcome, reason) && !pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLost ? <XCircle className="h-5 w-5 text-red-600" /> : <Trophy className="h-5 w-5 text-green-600" />}
            Mark {isLost ? "Lost" : "Won"}
          </DialogTitle>
          <DialogDescription>
            {isLost
              ? "Record why this opportunity was lost. This closes it and cancels open follow-ups."
              : "Confirm this opportunity was won. You can note why. This closes it and cancels open follow-ups."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  normalizeReason(reason) === s ? "border-[#1e3a5f] bg-[#1e3a5f] text-white" : "bg-background hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Textarea
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={isLost ? "Reason this was lost (required)…" : "Optional note…"}
            aria-label={isLost ? "Reason this opportunity was lost" : "Close reason (optional)"}
            className="min-h-20"
          />
          {isLost && !canConfirmClose("lost", reason) ? (
            <p className="text-xs text-muted-foreground">A reason is required to mark an opportunity lost.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button
            className={isLost ? "bg-red-600 hover:bg-red-600/90" : "bg-green-600 hover:bg-green-600/90"}
            disabled={!canConfirm}
            onClick={() => onConfirm(normalizeReason(reason))}
          >
            {pending ? "Saving…" : `Mark ${isLost ? "Lost" : "Won"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
