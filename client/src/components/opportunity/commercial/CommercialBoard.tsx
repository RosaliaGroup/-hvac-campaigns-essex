/**
 * Commercial bid board — Kanban columns by commercial pipeline stage (Phase 1).
 *
 * A focused sibling of the residential PipelineBoard, NOT a parameterization of it:
 * the residential board is bound to the static residential stage ENUM (STAGE_META
 * and the residential stage-move mutation), whereas commercial stages are DB-driven
 * rows (opportunityStages, pipelineKey='commercial'), a card's column is its
 * `stageId`, and moves go through the validated transitionStage(toStageId) mutation.
 * The card face is entirely commercial (bid number, priority score, strategic flags).
 *
 * Drag-and-drop uses the same native HTML5 idiom as the residential board. Terminal
 * columns (won / lost / declined) are NOT drop targets — closing goes through the
 * drawer's Won/Lost actions, which capture confirmation / loss reason.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MoreVertical, GripVertical, Star } from "lucide-react";
import { fmtMoney } from "@/components/opportunity/shared";
import { formatDisplayName } from "@shared/nameFormat";
import { StatusBadge, CLASSIFICATION_COLUMN } from "./shared";
import type { CommercialListItem, CommercialStage } from "@/lib/commercialApiTypes";

const TERMINAL = new Set(["won", "lost", "declined"]);
const isTerminal = (classification: string | null | undefined) => TERMINAL.has(classification ?? "");

/** Priority score palette — the commercial scoring scale is 10/7/5/3/1 (0 = unscored). */
const SCORE_BADGE: Record<number, string> = {
  10: "bg-red-100 text-red-700 border-red-200",
  7: "bg-orange-100 text-orange-700 border-orange-200",
  5: "bg-amber-100 text-amber-800 border-amber-200",
  3: "bg-sky-100 text-sky-700 border-sky-200",
  1: "bg-slate-100 text-slate-600 border-slate-200",
};

function PriorityScoreBadge({ score }: { score: number | null | undefined }) {
  if (!score) return null; // null / 0 = unscored
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold tabular-nums ${SCORE_BADGE[score] ?? ""}`}>
      P{score}
    </Badge>
  );
}

function StrategicFlags({ row }: { row: CommercialListItem }) {
  if (!row.isStrategicLead && !row.isStrategicProject) return null;
  return (
    <>
      {row.isStrategicLead ? (
        <Badge variant="outline" className="gap-0.5 border-violet-200 bg-violet-100 text-[10px] text-violet-700">
          <Star className="h-2.5 w-2.5" /> Strategic Lead
        </Badge>
      ) : null}
      {row.isStrategicProject ? (
        <Badge variant="outline" className="gap-0.5 border-indigo-200 bg-indigo-100 text-[10px] text-indigo-700">
          <Star className="h-2.5 w-2.5" /> Strategic Project
        </Badge>
      ) : null}
    </>
  );
}

function Card({ row, columns, onOpen, onMove, dragging, onDragStart, onDragEnd }: {
  row: CommercialListItem;
  columns: CommercialStage[];
  onOpen: (id: number) => void;
  onMove: (id: number, toStageId: number) => void;
  dragging: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
}) {
  const name = formatDisplayName(row.customerCompany || row.customerName || row.title);
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("text/plain", String(row.id)); e.dataTransfer.effectAllowed = "move"; onDragStart(row.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(row.id)}
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {row.opportunityNumber ? (
            <p className="font-mono text-[11px] text-muted-foreground">{row.opportunityNumber}</p>
          ) : null}
          <p className="truncate text-sm font-semibold">{row.title}</p>
          {name && name !== row.title ? <p className="truncate text-xs text-muted-foreground">{name}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="rounded p-0.5 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
              {/* Won/Lost/Declined are reached via the drawer's close actions, so the
                  quick-move menu offers only the open / parked (non-terminal) stages. */}
              {columns.filter(c => c.id !== row.stageId && !isTerminal(c.classification)).map(c => (
                <DropdownMenuItem key={c.id} onSelect={() => onMove(row.id, c.id)}>Move to {c.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {row.isBid ? <Badge variant="secondary" className="text-[10px]">BID</Badge> : null}
        <PriorityScoreBadge score={row.priorityScore} />
        <StrategicFlags row={row} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold tabular-nums">{fmtMoney(row.amount != null ? Number(row.amount) : null)}</span>
        <StatusBadge status={row.status} />
      </div>
    </div>
  );
}

export default function CommercialBoard({ onOpen }: { onOpen: (id: number) => void }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const stagesQuery = trpc.opportunities.commercial.stages.list.useQuery({ pipelineKey: "commercial", includeInactive: false });
  const listQuery = trpc.opportunities.commercial.list.useQuery({ recordType: "commercial", limit: 200, offset: 0, sortBy: "createdAt", sortDir: "desc" });

  const [dragId, setDragId] = useState<number | null>(null);
  const [overStageId, setOverStageId] = useState<number | null>(null);

  const transition = trpc.opportunities.commercial.transitionStage.useMutation({
    onSuccess: () => { utils.opportunities.commercial.list.invalidate(); },
    onError: err => toast({ title: "Could not move card", description: err.message, variant: "destructive" }),
  });

  const move = (id: number, toStageId: number, fromStageId?: number | null) => {
    if (fromStageId === toStageId || transition.isPending) return; // ignore no-op moves + re-fires
    const to = columns.find(c => c.id === toStageId);
    transition.mutate({ id, toStageId });
    if (to) toast({ title: `Moved to ${to.name}` });
  };

  if (stagesQuery.isLoading || listQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading commercial board…</p>;
  }

  const columns = (stagesQuery.data ?? []) as CommercialStage[];
  const rows = (listQuery.data?.items ?? []) as CommercialListItem[];

  if (!columns.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No commercial pipeline stages configured.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(col => {
        const colRows = rows.filter(r => r.stageId === col.id);
        const total = colRows.reduce((s, r) => s + (r.amount != null ? Number(r.amount) : 0), 0);
        const terminal = isTerminal(col.classification);
        return (
          <div
            key={col.id}
            onDragOver={e => { if (terminal) return; e.preventDefault(); setOverStageId(col.id); }}
            onDragLeave={() => setOverStageId(s => (s === col.id ? null : s))}
            onDrop={e => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              const from = rows.find(r => r.id === id)?.stageId;
              setOverStageId(null); setDragId(null);
              if (id && !terminal) move(id, col.id, from);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-muted/30 ${CLASSIFICATION_COLUMN[col.classification] ?? "border-slate-300"} ${terminal ? "opacity-90" : ""} ${overStageId === col.id ? "ring-2 ring-[#1e3a5f]/40" : ""}`}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold">{col.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{colRows.length} · {fmtMoney(total)}</span>
            </div>
            <div className="flex-1 space-y-2 px-2 pb-3">
              {colRows.map(r => (
                <Card
                  key={r.id} row={r} columns={columns} onOpen={onOpen}
                  onMove={(id, toStageId) => move(id, toStageId, r.stageId)}
                  dragging={dragId === r.id}
                  onDragStart={setDragId} onDragEnd={() => setDragId(null)}
                />
              ))}
              {colRows.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">{terminal ? "Set via a card's close action" : "Drop here"}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
