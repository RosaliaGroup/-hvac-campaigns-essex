/**
 * Pipeline view — Kanban columns by CRM stage. Cards are draggable via native
 * HTML5 drag-and-drop (no dependency); dropping onto a column calls setStage,
 * which marks the stage as a manual override so QBO sync won't revert it.
 * A per-card menu is the accessible fallback for moving without dragging.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MoreVertical, GripVertical } from "lucide-react";
import { STAGE_META, WorkCategoryBadge, ViewStateMessage, fmtMoney, type OppRow } from "./shared";
import { viewState } from "./viewState";
import { parseDropId, shouldApplyMove } from "./pipelineMove";
import { formatDisplayName } from "@shared/nameFormat";
import type { OpportunityStage } from "@shared/opportunityDashboard";

function Card({ row, onOpen, onMove, dragging, onDragStart, onDragEnd }: {
  row: OppRow;
  onOpen: (id: number) => void;
  onMove: (id: number, stage: OpportunityStage) => void;
  dragging: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Open opportunity for ${formatDisplayName(row.customerCompany || row.customerName)}, ${fmtMoney(row.amount)}`}
      onDragStart={e => { e.dataTransfer.setData("text/plain", String(row.id)); e.dataTransfer.effectAllowed = "move"; onDragStart(row.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(row.id)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(row.id); } }}
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{formatDisplayName(row.customerCompany || row.customerName)}</p>
          {row.customerCompany ? <p className="truncate text-xs text-muted-foreground">{formatDisplayName(row.customerName)}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button aria-label="Move to another stage" className="rounded p-0.5 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              {STAGE_META.filter(s => s.value !== row.stage).map(s => (
                <DropdownMenuItem key={s.value} onSelect={() => onMove(row.id, s.value)}>Move to {s.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <WorkCategoryBadge category={row.workCategory} />
        {row.docNumber ? <span className="font-mono text-[11px] text-muted-foreground">{row.docTypeLabel ?? "Doc"} #{row.docNumber}</span> : null}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums">{fmtMoney(row.amount)}</span>
        {row.docStatus ? <Badge variant="secondary" className="text-[10px]">{row.docStatus}</Badge> : null}
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{row.daysPending != null ? `${row.daysPending}d pending` : "—"}</span>
        <span className="truncate">{row.nextAction ?? ""}</span>
      </div>
    </div>
  );
}

export default function PipelineBoard({ onOpen }: { onOpen: (id: number) => void }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch } = trpc.opportunities.list.useQuery({ limit: 200, offset: 0, sortBy: "createdAt", sortDir: "desc" });
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const setStage = trpc.opportunities.setStage.useMutation({
    // Confirm the move only once the server accepts it — an optimistic toast
    // here would show "Moved" even when the mutation later fails.
    onSuccess: (_res, vars) => {
      toast({ title: `Moved to ${STAGE_META.find(s => s.value === vars.stage)?.label}` });
      utils.opportunities.list.invalidate();
      utils.opportunities.overview.invalidate();
      utils.opportunities.stats.invalidate();
    },
    onError: err => toast({ title: "Could not move card", description: err.message, variant: "destructive" }),
  });

  const move = (id: number, stage: OpportunityStage, from?: string) => {
    if (!shouldApplyMove({ from, to: stage, pending: setStage.isPending })) return;
    setStage.mutate({ id, stage });
  };

  const rows = (data?.items ?? []) as unknown as OppRow[];

  // Loading / error short-circuit. Empty is intentionally NOT short-circuited:
  // the board still renders its columns (each shows its own "Drop here"), which
  // is more useful than a single "no data" line — but a *failed* load must never
  // fall through and look like an empty pipeline.
  const state = viewState({ isLoading, isError, isEmpty: false });
  if (state !== "ready") {
    return <ViewStateMessage state={state} error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGE_META.map(col => {
        const colRows = rows.filter(r => r.stage === col.value);
        const total = colRows.reduce((s, r) => s + r.amount, 0);
        return (
          <div
            key={col.value}
            onDragOver={e => { e.preventDefault(); setOverStage(col.value); }}
            onDragLeave={() => setOverStage(s => (s === col.value ? null : s))}
            onDrop={e => {
              e.preventDefault();
              const id = parseDropId(e.dataTransfer.getData("text/plain"));
              const from = rows.find(r => r.id === id)?.stage;
              setOverStage(null); setDragId(null);
              if (id != null) move(id, col.value, from);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-muted/30 ${col.column} ${overStage === col.value ? "ring-2 ring-[#1e3a5f]/40" : ""}`}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{colRows.length} · {fmtMoney(total)}</span>
            </div>
            <div className="flex-1 space-y-2 px-2 pb-3">
              {colRows.map(r => (
                <Card
                  key={r.id} row={r} onOpen={onOpen}
                  onMove={(id, stage) => move(id, stage, r.stage)}
                  dragging={dragId === r.id}
                  onDragStart={setDragId} onDragEnd={() => setDragId(null)}
                />
              ))}
              {colRows.length === 0 ? <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop here</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
