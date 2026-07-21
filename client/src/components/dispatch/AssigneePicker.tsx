/**
 * Dispatch AssigneePicker (M2) — admin-only assign / reassign / unassign control
 * on a VisitCard. Owns the `dispatch.assign` / `dispatch.unassign` mutations and
 * refetches the board + unscheduled queue on success. It sends
 * `expectedAssignedToId` (the assignee the card currently shows) so a concurrent
 * change is detected server-side and surfaces to the user as a refresh — never a
 * silent overwrite. A same-assignee pick is a client-side no-op (no request). No
 * drag-and-drop, no scheduling.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { UserRound, Check, Loader2, UserX } from "lucide-react";
import type { BoardVisit } from "@shared/dispatchBoard";

export interface PickerTechnician { id: number; name: string }

export default function AssigneePicker({ visit, technicians }: { visit: BoardVisit; technicians: PickerTechnician[] }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const refresh = () => { utils.dispatch.board.invalidate(); utils.dispatch.unscheduled.invalidate(); };
  const reportError = (err: { message: string; data?: { code?: string | null } | null }) => {
    if (err.data?.code === "CONFLICT") {
      // Someone else changed this visit first — never overwrite; pull the truth.
      toast.error("This visit was just reassigned by someone else — refreshing.");
      refresh();
    } else {
      toast.error(err.message || "Assignment failed. Please try again.");
    }
  };

  const assign = trpc.dispatch.assign.useMutation({
    onSuccess: (_res, vars) => { toast.success(`Assigned to ${technicians.find(t => t.id === vars.technicianId)?.name ?? "technician"}`); refresh(); },
    onError: (error) => reportError(error),
  });
  const unassign = trpc.dispatch.unassign.useMutation({
    onSuccess: () => { toast.success("Unassigned"); refresh(); },
    onError: (error) => reportError(error),
  });

  const pending = assign.isPending || unassign.isPending;
  const current = visit.assignedToId;
  const noTechs = technicians.length === 0;
  const label = visit.assigneeName ?? (current != null ? `#${current}` : "Unassigned");

  const choose = (techId: number | null) => {
    setOpen(false);
    if (techId === current) return;                          // same assignee → no-op, don't call the server
    const expectedAssignedToId = visit.assignedToId;         // what this card is showing (concurrency token)
    if (techId === null) unassign.mutate({ appointmentId: visit.appointmentId, expectedAssignedToId });
    else assign.mutate({ appointmentId: visit.appointmentId, technicianId: techId, expectedAssignedToId });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={pending || noTechs}
          aria-label="Assign technician">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRound className="h-3.5 w-3.5" />}
          <span className="max-w-[8rem] truncate">{noTechs ? "No active technicians" : label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        <DropdownMenuLabel>Assign to</DropdownMenuLabel>
        {technicians.map(t => (
          <DropdownMenuItem key={t.id} onSelect={() => choose(t.id)} className="justify-between">
            <span className="truncate">{t.name}</span>
            {t.id === current && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => choose(null)} className="justify-between text-muted-foreground">
          <span className="inline-flex items-center gap-1"><UserX className="h-3.5 w-3.5" /> Unassign</span>
          {current == null && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
