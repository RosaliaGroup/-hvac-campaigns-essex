/**
 * Checklist board — Trello-style columns (To do / In progress / Done) with native
 * HTML5 drag-and-drop (same pattern as PipelineBoard, no extra dependency), an
 * add-card input per column, and an inline card editor for label / assignee /
 * due date / notes / required flag.
 *
 * INVARIANT: the Done column and `isComplete` are the same signal. The server's
 * `checklist.move` mutation writes both together in every direction, because
 * convert-to-job gates on isComplete + requiredForConversion. Nothing here may
 * set a column without going through that mutation.
 *
 * A per-card "Move to" menu is the accessible fallback for moving without dragging.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, GripVertical, MoreVertical, Plus, Trash2 } from "lucide-react";
import { checklistProgress, fmtDate } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

type ChecklistItem = CommercialDetail["checklist"][number];
type Member = CommercialDetail["members"][number];

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "In progress" },
  { key: "done", label: "Done" },
] as const;
type BoardStatus = (typeof COLUMNS)[number]["key"];

/** Pre-0067 rows read back without boardStatus — fall back to the isComplete flag. */
function columnOf(item: ChecklistItem): BoardStatus {
  const s = (item as { boardStatus?: string }).boardStatus;
  if (s === "doing" || s === "done" || s === "todo") return s;
  return item.isComplete ? "done" : "todo";
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

function isPastDue(item: ChecklistItem): boolean {
  if (!item.dueAt || item.isComplete) return false;
  return new Date(item.dueAt).getTime() < Date.now();
}

export default function ChecklistSection({
  opportunityId, items, members = [],
}: { opportunityId: number; items: ChecklistItem[]; members?: Member[] }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();

  const [dragId, setDragId] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<BoardStatus | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const key = { id: opportunityId };
  const refresh = () => utils.opportunities.commercial.get.invalidate(key);
  const onErr = (err: { message: string }) =>
    toast({ title: "Checklist update failed", description: err.message, variant: "destructive" });

  // Optimistic move so the card lands under the cursor immediately; rolled back on error.
  const move = trpc.opportunities.commercial.checklist.move.useMutation({
    onMutate: async vars => {
      await utils.opportunities.commercial.get.cancel(key);
      const prev = utils.opportunities.commercial.get.getData(key);
      if (prev) {
        utils.opportunities.commercial.get.setData(key, {
          ...prev,
          checklist: prev.checklist.map(i =>
            i.id === vars.itemId
              ? { ...i, boardStatus: vars.boardStatus, isComplete: vars.boardStatus === "done" }
              : i,
          ),
        });
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) utils.opportunities.commercial.get.setData(key, ctx.prev);
      onErr(err);
    },
    onSettled: refresh,
  });

  const addItem = trpc.opportunities.commercial.checklist.addItem.useMutation({ onSuccess: refresh, onError: onErr });
  const updateItem = trpc.opportunities.commercial.checklist.updateItem.useMutation({ onSuccess: refresh, onError: onErr });
  const removeItem = trpc.opportunities.commercial.checklist.removeItem.useMutation({ onSuccess: refresh, onError: onErr });

  const progress = checklistProgress(
    items.map(i => ({ isComplete: !!i.isComplete, requiredForConversion: !!i.requiredForConversion })),
  );

  const columnItems = (col: BoardStatus) =>
    items.filter(i => columnOf(i) === col).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const doMove = (itemId: number, col: BoardStatus, sortOrder: number) => {
    if (!canWrite) return;
    move.mutate({ itemId, boardStatus: col, sortOrder });
  };

  const dropOnColumn = (col: BoardStatus) => {
    const id = dragId;
    setDragId(null);
    setOverColumn(null);
    if (id == null) return;
    const existing = columnItems(col);
    if (existing.length && existing[existing.length - 1]?.id === id) return; // already last here
    doMove(id, col, existing.filter(i => i.id !== id).length);
  };

  const addCard = (col: BoardStatus) => {
    const label = (drafts[col] ?? "").trim();
    if (!label) return;
    setDrafts(d => ({ ...d, [col]: "" }));
    addItem.mutate(
      { opportunityId, label, requiredForConversion: false },
      {
        onSuccess: res => {
          // Items are created in To do; move them only when they belong elsewhere.
          if (col !== "todo" && res?.id) doMove(res.id, col, columnItems(col).length);
          refresh();
        },
      },
    );
  };

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

      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map(col => {
          const cards = columnItems(col.key);
          return (
            <div
              key={col.key}
              onDragOver={e => { if (canWrite) { e.preventDefault(); setOverColumn(col.key); } }}
              onDragLeave={() => setOverColumn(c => (c === col.key ? null : c))}
              onDrop={e => { e.preventDefault(); dropOnColumn(col.key); }}
              className={`rounded-lg border bg-muted/30 p-2 transition ${overColumn === col.key ? "border-[#1e3a5f] bg-muted/60" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</span>
                <Badge variant="secondary" className="text-[10px]">{cards.length}</Badge>
              </div>

              <div className="space-y-2">
                {cards.map(item => {
                  const assignee = members.find(m => m.teamMemberId === item.assigneeId);
                  const editing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      draggable={canWrite && !editing}
                      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDragId(item.id); }}
                      onDragEnd={() => { setDragId(null); setOverColumn(null); }}
                      className={`group rounded-lg border bg-card p-2.5 shadow-sm transition hover:shadow-md ${dragId === item.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <button className="min-w-0 flex-1 text-left" onClick={() => setEditingId(editing ? null : item.id)}>
                          <span className={`text-sm ${item.isComplete ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          {canWrite ? <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100" /> : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded p-0.5 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {COLUMNS.filter(c => c.key !== col.key).map(c => (
                                <DropdownMenuItem key={c.key} disabled={!canWrite} onSelect={() => doMove(item.id, c.key, columnItems(c.key).length)}>
                                  Move to {c.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem disabled={!canWrite} onSelect={() => setEditingId(item.id)}>Edit details</DropdownMenuItem>
                              <DropdownMenuItem disabled={!canWrite} className="text-red-600" onSelect={() => removeItem.mutate({ itemId: item.id })}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {item.requiredForConversion ? (
                          <Badge variant="outline" className="border-amber-300 text-[9px] text-amber-700">required</Badge>
                        ) : null}
                        {item.dueAt ? (
                          <span className={`text-[11px] ${isPastDue(item) ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                            Due {fmtDate(item.dueAt)}
                          </span>
                        ) : null}
                        {assignee ? (
                          <span
                            title={assignee.name ?? undefined}
                            className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[9px] font-semibold text-white"
                          >
                            {initials(assignee.name)}
                          </span>
                        ) : null}
                      </div>

                      {item.notes && !editing ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.notes}</p> : null}

                      {editing ? (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <Input
                            defaultValue={item.label}
                            disabled={!canWrite}
                            className="h-8 text-sm"
                            onBlur={e => {
                              const v = e.target.value.trim();
                              if (v && v !== item.label) updateItem.mutate({ itemId: item.id, label: v });
                            }}
                          />
                          <div className="flex gap-2">
                            <select
                              className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                              disabled={!canWrite}
                              value={item.assigneeId ?? ""}
                              onChange={e => updateItem.mutate({ itemId: item.id, assigneeId: e.target.value ? Number(e.target.value) : null })}
                            >
                              <option value="">Unassigned</option>
                              {members.map(m => (
                                <option key={m.id} value={m.teamMemberId}>{m.name ?? `Member ${m.teamMemberId}`}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                              disabled={!canWrite}
                              value={toDateInput(item.dueAt)}
                              onChange={e => updateItem.mutate({ itemId: item.id, dueAt: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })}
                            />
                          </div>
                          <Textarea
                            defaultValue={item.notes ?? ""}
                            disabled={!canWrite}
                            placeholder="Notes"
                            className="min-h-[52px] text-xs"
                            onBlur={e => {
                              const v = e.target.value;
                              if (v !== (item.notes ?? "")) updateItem.mutate({ itemId: item.id, notes: v || null });
                            }}
                          />
                          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Checkbox
                              checked={!!item.requiredForConversion}
                              disabled={!canWrite}
                              onCheckedChange={c => updateItem.mutate({ itemId: item.id, requiredForConversion: c === true })}
                            />
                            Required before converting to a Job
                          </label>
                          <Button size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => setEditingId(null)}>Close</Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {canWrite ? (
                  <div className="flex gap-1">
                    <Input
                      value={drafts[col.key] ?? ""}
                      placeholder="Add a card…"
                      className="h-8 text-sm"
                      onChange={e => setDrafts(d => ({ ...d, [col.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCard(col.key); } }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      disabled={!(drafts[col.key] ?? "").trim() || addItem.isPending}
                      onClick={() => addCard(col.key)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
