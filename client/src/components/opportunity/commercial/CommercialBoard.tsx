/**
 * Commercial Kanban — columns from the configurable pipeline (opportunityStages),
 * cards dragged via native HTML5 drag-and-drop (no dependency), same pattern as
 * the legacy PipelineBoard. The server is authoritative: a move fires
 * `transitionStage` and re-reads on success; on failure we toast and invalidate,
 * so the card never disappears (no optimistic hiding). Won requires confirmation;
 * Lost requires a reason. A "Move to…" menu is the keyboard/mobile fallback.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { MoreVertical, GripVertical, AlertTriangle, MessageSquare, Paperclip, CheckSquare } from "lucide-react";
import {
  buildCommercialListInput, groupByStage, moveIntent, isOverdue, nextDate, fmtMoney, fmtDate,
  type CommercialFilters, type BoardStage,
} from "@/lib/commercialOpportunities";
import type { CommercialListItem } from "@/lib/commercialApiTypes";
import { PriorityBadge, TypeBadge, useCommercialPerms } from "./shared";

function Card({ row, stages, onOpen, onMove, dragging, onDragStart, onDragEnd, disabled }: {
  row: CommercialListItem;
  stages: BoardStage[];
  onOpen: (id: number) => void;
  onMove: (row: CommercialListItem, target: BoardStage) => void;
  dragging: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  disabled: boolean;
}) {
  const overdue = isOverdue(row.bidDueAt, row.followUpAt, new Date());
  const nd = nextDate(row.bidDueAt, row.followUpAt);
  const checklistTotal = row.checklistTotal ?? 0;
  const checklistDone = row.checklistDone ?? 0;
  return (
    <div
      draggable={!disabled}
      onDragStart={e => { e.dataTransfer.setData("text/plain", String(row.id)); e.dataTransfer.effectAllowed = "move"; onDragStart(row.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(row.id)}
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md ${dragging ? "opacity-50" : ""} ${overdue ? "border-red-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">{row.opportunityNumber ?? `OPP-${row.id}`}</span>
            {overdue ? <AlertTriangle className="h-3 w-3 text-red-500" aria-label="Overdue" /> : null}
          </div>
          <p className="truncate text-sm font-semibold">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">{row.customerCompany || row.customerName}</p>
        </div>
        <div className="flex items-center gap-1">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
          {!disabled ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <button className="rounded p-0.5 hover:bg-muted" aria-label="Move to stage"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                {stages.filter(s => s.id !== row.stageId).map(s => (
                  <DropdownMenuItem key={s.id} onSelect={() => onMove(row, s)}>Move to {s.name}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {row.propertyAddress ? (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {row.propertyAddress}{row.propertyCity ? `, ${row.propertyCity}` : ""}{row.propertyState ? ` ${row.propertyState}` : ""}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={row.priority} />
        <TypeBadge type={row.opportunityType} />
        {(row.categoriesList ?? []).slice(0, 2).map(c => (
          <Badge key={c} variant="secondary" className="text-[10px]">{c.replace(/_/g, " ")}</Badge>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        {row.amount == null || row.amount === "" ? (
          <span className="text-xs italic text-muted-foreground">Not estimated</span>
        ) : (
          <span className="text-sm font-bold tabular-nums">{fmtMoney(row.amount)}</span>
        )}
        {nd ? (
          <span className={`text-[11px] ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
            {nd.kind === "bid" ? "Bid" : "Follow-up"} {fmtDate(nd.date)}
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{row.ownerName ?? "Unassigned"}{row.estimatorName ? ` · ${row.estimatorName}` : ""}</span>
        <span className="flex items-center gap-2 shrink-0">
          {checklistTotal > 0 ? <span className="flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{checklistDone}/{checklistTotal}</span> : null}
          {(row.commentCount ?? 0) > 0 ? <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{row.commentCount}</span> : null}
          {(row.documentCount ?? 0) > 0 ? <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{row.documentCount}</span> : null}
        </span>
      </div>
    </div>
  );
}

export default function CommercialBoard({ filters, onOpen }: { filters: CommercialFilters; onOpen: (id: number) => void }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();

  const stagesQuery = trpc.opportunities.commercial.stages.list.useQuery();
  const listQuery = trpc.opportunities.commercial.list.useQuery(buildCommercialListInput("board", filters));

  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<number | null>(null);
  const [wonPending, setWonPending] = useState<{ row: CommercialListItem; target: BoardStage } | null>(null);
  const [lostPending, setLostPending] = useState<{ row: CommercialListItem; target: BoardStage } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const transition = trpc.opportunities.commercial.transitionStage.useMutation({
    onSuccess: () => {
      utils.opportunities.commercial.list.invalidate();
    },
    onError: err => {
      toast({ title: "Could not move card", description: err.message, variant: "destructive" });
      utils.opportunities.commercial.list.invalidate(); // resync — the card stays where the server has it
    },
  });

  const stages: BoardStage[] = (stagesQuery.data ?? []).map(s => ({
    id: s.id, stageKey: s.stageKey, name: s.name, sortOrder: s.sortOrder, classification: s.classification, isActive: !!s.isActive,
  }));
  const items = (listQuery.data?.items ?? []) as CommercialListItem[];
  const { columns } = groupByStage(items, stages);

  function requestMove(row: CommercialListItem, target: BoardStage) {
    if (!canWrite || transition.isPending) return;
    const intent = moveIntent(row.stageId, target);
    if (intent === "noop") return;
    if (intent === "confirm_won") { setWonPending({ row, target }); return; }
    if (intent === "require_lost_reason") { setLostReason(""); setLostPending({ row, target }); return; }
    transition.mutate({ id: row.id, toStageId: target.id });
    toast({ title: `Moved to ${target.name}` });
  }

  if (stagesQuery.isLoading || listQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading board…</p>;
  }
  if (listQuery.isError || stagesQuery.isError) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-red-600">Couldn’t load the board.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => { listQuery.refetch(); stagesQuery.refetch(); }}>Retry</Button>
      </div>
    );
  }
  if (!items.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No commercial opportunities yet. Create one to get started.</p>;
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(({ stage, cards }) => {
          // Totals exclude unknown (NULL) values rather than counting them as 0.
          const known = cards.filter(r => r.amount != null && r.amount !== "");
          const total = known.reduce((s, r) => s + Number(r.amount), 0);
          return (
            <div
              key={stage.id}
              onDragOver={e => { if (canWrite) { e.preventDefault(); setOverStage(stage.id); } }}
              onDragLeave={() => setOverStage(s => (s === stage.id ? null : s))}
              onDrop={e => {
                e.preventDefault();
                const id = Number(e.dataTransfer.getData("text/plain"));
                setOverStage(null); setDragId(null);
                const row = items.find(r => r.id === id);
                if (row) requestMove(row, stage);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-muted/30 border-slate-300 ${overStage === stage.id ? "ring-2 ring-[#1e3a5f]/40" : ""}`}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold">{stage.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{cards.length} · {known.length ? fmtMoney(total) : "—"}</span>
              </div>
              <div className="flex-1 space-y-2 px-2 pb-3">
                {cards.map(r => (
                  <Card
                    key={r.id} row={r} stages={stages} onOpen={onOpen} onMove={requestMove}
                    dragging={dragId === r.id} onDragStart={setDragId} onDragEnd={() => setDragId(null)}
                    disabled={!canWrite}
                  />
                ))}
                {cards.length === 0 ? <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop here</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Won confirmation */}
      <AlertDialog open={wonPending != null} onOpenChange={o => !o && setWonPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark “{wonPending?.row.title}” as {wonPending?.target.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This records the opportunity as won. It does <strong>not</strong> create a Job — use “Convert to Job” for that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!wonPending) return;
                transition.mutate({ id: wonPending.row.id, toStageId: wonPending.target.id, confirmWon: true });
                setWonPending(null);
              }}
            >
              Confirm won
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lost reason */}
      <Dialog open={lostPending != null} onOpenChange={o => !o && setLostPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move “{lostPending?.row.title}” to {lostPending?.target.name}</DialogTitle>
            <DialogDescription>A reason is required before marking an opportunity lost.</DialogDescription>
          </DialogHeader>
          <Textarea value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Why was this opportunity lost?" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostPending(null)}>Cancel</Button>
            <Button
              disabled={!lostReason.trim()}
              onClick={() => {
                if (!lostPending) return;
                transition.mutate({ id: lostPending.row.id, toStageId: lostPending.target.id, lostReason: lostReason.trim() });
                setLostPending(null);
              }}
            >
              Mark lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
