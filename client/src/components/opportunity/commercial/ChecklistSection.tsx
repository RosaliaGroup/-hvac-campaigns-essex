/**
 * Card checklists — Trello's card layout: several named checklists on one opportunity,
 * each with its own progress bar, its own items, and its own "Add an item".
 *
 * Items are plain checkboxes (Trello semantics), with assignee, due date and notes
 * revealed on click. This replaced the To do / In progress / Done board: the board's
 * `boardStatus` column still exists and is kept in lockstep by the server, but the
 * checkbox is the completion signal the conversion gate reads.
 *
 * INVARIANT: convert-to-job gates on requiredForConversion + isComplete, so anything
 * that could clear a required item without completing it (deleting a whole checklist)
 * is refused server-side rather than handled here.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckSquare, Plus, Trash2, X } from "lucide-react";
import { checklistProgress, fmtDate } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

type ChecklistItem = CommercialDetail["checklist"][number];
type Member = CommercialDetail["members"][number];
type Group = { id: number; name: string; sortOrder: number };

const UNGROUPED = -1; // pre-0068 rows with a null groupId still need somewhere to render

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

function pct(items: ChecklistItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter(i => i.isComplete).length / items.length) * 100);
}

export default function ChecklistSection({
  opportunityId, items, groups = [], members = [],
}: { opportunityId: number; items: ChecklistItem[]; groups?: Group[]; members?: Member[] }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();

  const [openItem, setOpenItem] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState<number | null>(null);
  const [newList, setNewList] = useState<string | null>(null);

  const key = { id: opportunityId };
  const refresh = () => utils.opportunities.commercial.get.invalidate(key);
  const onErr = (err: { message: string }) =>
    toast({ title: "Checklist update failed", description: err.message, variant: "destructive" });
  const c = trpc.opportunities.commercial.checklist;

  const setComplete = c.setComplete.useMutation({ onSuccess: refresh, onError: onErr });
  const addItem = c.addItem.useMutation({ onSuccess: refresh, onError: onErr });
  const updateItem = c.updateItem.useMutation({ onSuccess: refresh, onError: onErr });
  const removeItem = c.removeItem.useMutation({ onSuccess: refresh, onError: onErr });
  const addGroup = c.addGroup.useMutation({ onSuccess: refresh, onError: onErr });
  const renameGroup = c.renameGroup.useMutation({ onSuccess: refresh, onError: onErr });
  const removeGroup = c.removeGroup.useMutation({ onSuccess: refresh, onError: onErr });

  // Overall gate status stays across all checklists — conversion doesn't care which list.
  const overall = checklistProgress(
    items.map(i => ({ isComplete: !!i.isComplete, requiredForConversion: !!i.requiredForConversion })),
  );

  const orphans = items.filter(i => i.groupId == null);
  const lists: Group[] = [
    ...groups,
    ...(orphans.length ? [{ id: UNGROUPED, name: "Checklist", sortOrder: 999 }] : []),
  ];
  const itemsOf = (g: Group) =>
    (g.id === UNGROUPED ? orphans : items.filter(i => i.groupId === g.id)).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

  const submitItem = (g: Group) => {
    const label = (drafts[g.id] ?? "").trim();
    if (!label) return;
    setDrafts(d => ({ ...d, [g.id]: "" }));
    addItem.mutate({ opportunityId, groupId: g.id === UNGROUPED ? null : g.id, label, requiredForConversion: false });
  };

  return (
    <div className="space-y-5">
      {!overall.conversionReady ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{overall.requiredIncomplete} required item(s) must be completed before this opportunity can be converted to a Job.</span>
        </div>
      ) : null}

      {lists.map(g => {
        const list = itemsOf(g);
        const done = list.filter(i => i.isComplete).length;
        return (
          <div key={g.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              {canWrite && g.id !== UNGROUPED ? (
                <input
                  defaultValue={g.name}
                  className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold uppercase tracking-wide hover:border-input focus:border-input focus:outline-none"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== g.name) renameGroup.mutate({ groupId: g.id, name: v });
                    else e.target.value = g.name;
                  }}
                />
              ) : (
                <span className="flex-1 text-sm font-semibold uppercase tracking-wide">{g.name}</span>
              )}
              <span className="text-xs text-muted-foreground">{done}/{list.length}</span>
              {canWrite && g.id !== UNGROUPED ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => removeGroup.mutate({ groupId: g.id })}
                >
                  Delete
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="w-8 text-right text-[11px] text-muted-foreground">{pct(list)}%</span>
              <Progress value={pct(list)} className="flex-1" />
            </div>

            <div className="space-y-0.5">
              {list.map(item => {
                const assignee = members.find(m => m.teamMemberId === item.assigneeId);
                const open = openItem === item.id;
                const overdue = item.dueAt && !item.isComplete && new Date(item.dueAt).getTime() < Date.now();
                return (
                  <div key={item.id} className="rounded-md px-1 py-1 hover:bg-muted/50">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        className="mt-0.5"
                        checked={!!item.isComplete}
                        disabled={!canWrite}
                        onCheckedChange={v => setComplete.mutate({ itemId: item.id, isComplete: v === true })}
                      />
                      <button className="min-w-0 flex-1 text-left" onClick={() => setOpenItem(open ? null : item.id)}>
                        <span className={`text-sm ${item.isComplete ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
                      </button>
                      {item.requiredForConversion ? (
                        <Badge variant="outline" className="border-amber-300 text-[9px] text-amber-700">required</Badge>
                      ) : null}
                      {item.dueAt ? (
                        <span className={`shrink-0 text-[11px] ${overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                          {fmtDate(item.dueAt)}
                        </span>
                      ) : null}
                      {assignee ? (
                        <span
                          title={assignee.name ?? undefined}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[9px] font-semibold text-white"
                        >
                          {initials(assignee.name)}
                        </span>
                      ) : null}
                    </div>

                    {open ? (
                      <div className="ml-6 mt-2 space-y-2 border-l pl-3">
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
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Checkbox
                              checked={!!item.requiredForConversion}
                              disabled={!canWrite}
                              onCheckedChange={v => updateItem.mutate({ itemId: item.id, requiredForConversion: v === true })}
                            />
                            Required before converting to a Job
                          </label>
                          {canWrite ? (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600" onClick={() => removeItem.mutate({ itemId: item.id })}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canWrite ? (
              adding === g.id ? (
                <div className="ml-6 flex gap-1">
                  <Input
                    autoFocus
                    value={drafts[g.id] ?? ""}
                    placeholder="Add an item"
                    className="h-8 text-sm"
                    onChange={e => setDrafts(d => ({ ...d, [g.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); submitItem(g); }
                      if (e.key === "Escape") setAdding(null);
                    }}
                  />
                  <Button size="sm" className="h-8" onClick={() => submitItem(g)}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAdding(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" className="ml-6 h-7 text-xs" onClick={() => setAdding(g.id)}>
                  Add an item
                </Button>
              )
            ) : null}
          </div>
        );
      })}

      {canWrite ? (
        newList !== null ? (
          <div className="flex gap-1">
            <Input
              autoFocus
              value={newList}
              placeholder="Checklist name"
              className="h-8 text-sm"
              onChange={e => setNewList(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newList.trim()) {
                  e.preventDefault();
                  addGroup.mutate({ opportunityId, name: newList.trim() });
                  setNewList(null);
                }
                if (e.key === "Escape") setNewList(null);
              }}
            />
            <Button
              size="sm"
              className="h-8"
              disabled={!newList.trim()}
              onClick={() => { addGroup.mutate({ opportunityId, name: newList.trim() }); setNewList(null); }}
            >
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setNewList(null)}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setNewList("")}>
            <Plus className="mr-1 h-4 w-4" /> Add checklist
          </Button>
        )
      ) : null}
    </div>
  );
}
