/**
 * Card checklists — Trello's card layout and interaction model.
 *
 * Several named checklists per opportunity. Each has a heading (click the name to
 * rename), a percentage bar, and its items. Clicking an item turns it into a compact
 * editor: a text box with Save / Cancel and a row of small actions (Assign, Due date,
 * and an overflow for the required flag and Delete) — not a stacked panel.
 *
 * INVARIANT: convert-to-job gates on requiredForConversion + isComplete, so the server
 * refuses to delete a checklist holding outstanding required items.
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
import { AlertTriangle, CheckSquare, Clock, MoreHorizontal, Plus, UserPlus, X } from "lucide-react";
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

  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState("");
  const [panel, setPanel] = useState<"assign" | "due" | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
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

  // Conversion readiness spans every checklist — the gate doesn't care which list.
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

  const openEditor = (item: ChecklistItem) => {
    setEditingItem(item.id);
    setItemDraft(item.label);
    setPanel(null);
  };
  const closeEditor = () => { setEditingItem(null); setPanel(null); };

  const saveLabel = (item: ChecklistItem) => {
    const v = itemDraft.trim();
    if (v && v !== item.label) updateItem.mutate({ itemId: item.id, label: v });
    closeEditor();
  };

  const submitItem = (g: Group) => {
    const label = (drafts[g.id] ?? "").trim();
    if (!label) return;
    setDrafts(d => ({ ...d, [g.id]: "" }));
    addItem.mutate({ opportunityId, groupId: g.id === UNGROUPED ? null : g.id, label, requiredForConversion: false });
  };

  return (
    <div className="space-y-6">
      {!overall.conversionReady ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{overall.requiredIncomplete} required item(s) must be completed before this opportunity can be converted to a Job.</span>
        </div>
      ) : null}

      {lists.map(g => {
        const list = itemsOf(g);
        return (
          <div key={g.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 shrink-0 text-muted-foreground" />
              {renaming === g.id ? (
                <Input
                  autoFocus
                  defaultValue={g.name}
                  className="h-8 flex-1 text-sm font-semibold"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== g.name) renameGroup.mutate({ groupId: g.id, name: v });
                    setRenaming(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <button
                  className="flex-1 rounded px-1 py-0.5 text-left text-base font-semibold hover:bg-muted"
                  onClick={() => canWrite && g.id !== UNGROUPED && setRenaming(g.id)}
                >
                  {g.name}
                </button>
              )}
              {canWrite && g.id !== UNGROUPED ? (
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => removeGroup.mutate({ groupId: g.id })}>
                  Delete
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground">{pct(list)}%</span>
              <Progress value={pct(list)} className="h-2 flex-1" />
            </div>

            <div>
              {list.map(item => {
                const assignee = members.find(m => m.teamMemberId === item.assigneeId);
                const editing = editingItem === item.id;
                const overdue = item.dueAt && !item.isComplete && new Date(item.dueAt).getTime() < Date.now();

                if (editing) {
                  return (
                    <div key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1.5">
                      <Checkbox className="mt-2" checked={!!item.isComplete} disabled />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Textarea
                          autoFocus
                          value={itemDraft}
                          className="min-h-[60px] text-sm"
                          onChange={e => setItemDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveLabel(item); }
                            if (e.key === "Escape") closeEditor();
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button size="sm" className="h-7 text-xs" onClick={() => saveLabel(item)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={closeEditor}><X className="h-4 w-4" /></Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => setPanel(panel === "assign" ? null : "assign")}
                          >
                            <UserPlus className="mr-1 h-3.5 w-3.5" /> Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => setPanel(panel === "due" ? null : "due")}
                          >
                            <Clock className="mr-1 h-3.5 w-3.5" /> Due date
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="secondary" className="h-7 px-2"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onSelect={() => updateItem.mutate({ itemId: item.id, requiredForConversion: !item.requiredForConversion })}>
                                {item.requiredForConversion ? "Not required for conversion" : "Required for conversion"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onSelect={() => { removeItem.mutate({ itemId: item.id }); closeEditor(); }}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {panel === "assign" ? (
                          <select
                            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                            value={item.assigneeId ?? ""}
                            onChange={e => { updateItem.mutate({ itemId: item.id, assigneeId: e.target.value ? Number(e.target.value) : null }); setPanel(null); }}
                          >
                            <option value="">Unassigned</option>
                            {members.map(m => (
                              <option key={m.id} value={m.teamMemberId}>{m.name ?? `Member ${m.teamMemberId}`}</option>
                            ))}
                          </select>
                        ) : null}

                        {panel === "due" ? (
                          <input
                            type="date"
                            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                            value={toDateInput(item.dueAt)}
                            onChange={e => { updateItem.mutate({ itemId: item.id, dueAt: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null }); setPanel(null); }}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
                    <Checkbox
                      className="mt-0.5"
                      checked={!!item.isComplete}
                      disabled={!canWrite}
                      onCheckedChange={v => setComplete.mutate({ itemId: item.id, isComplete: v === true })}
                    />
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => canWrite && openEditor(item)}
                    >
                      <span className={`text-sm ${item.isComplete ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
                    </button>
                    {item.requiredForConversion ? (
                      <Badge variant="outline" className="shrink-0 border-amber-300 text-[9px] text-amber-700">required</Badge>
                    ) : null}
                    {item.dueAt ? (
                      <span className={`shrink-0 rounded px-1 text-[11px] ${overdue ? "bg-red-100 font-medium text-red-700" : "text-muted-foreground"}`}>
                        {fmtDate(item.dueAt)}
                      </span>
                    ) : null}
                    {assignee ? (
                      <span
                        title={assignee.name ?? undefined}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[9px] font-semibold text-white"
                      >
                        {initials(assignee.name)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {canWrite ? (
              adding === g.id ? (
                <div className="ml-7 space-y-1.5">
                  <Textarea
                    autoFocus
                    value={drafts[g.id] ?? ""}
                    placeholder="Add an item"
                    className="min-h-[60px] text-sm"
                    onChange={e => setDrafts(d => ({ ...d, [g.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitItem(g); }
                      if (e.key === "Escape") setAdding(null);
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" className="h-7 text-xs" onClick={() => submitItem(g)}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAdding(null)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" className="ml-7 h-8 text-xs" onClick={() => setAdding(g.id)}>
                  Add an item
                </Button>
              )
            ) : null}
          </div>
        );
      })}

      {canWrite ? (
        newList !== null ? (
          <div className="space-y-1.5">
            <Input
              autoFocus
              value={newList}
              placeholder="Checklist name"
              className="h-8 text-sm"
              onChange={e => setNewList(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newList.trim()) { e.preventDefault(); addGroup.mutate({ opportunityId, name: newList.trim() }); setNewList(null); }
                if (e.key === "Escape") setNewList(null);
              }}
            />
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-7 text-xs" disabled={!newList.trim()} onClick={() => { addGroup.mutate({ opportunityId, name: newList.trim() }); setNewList(null); }}>
                Add
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setNewList(null)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setNewList("")}>
            <Plus className="mr-1 h-4 w-4" /> Add checklist
          </Button>
        )
      ) : null}
    </div>
  );
}
