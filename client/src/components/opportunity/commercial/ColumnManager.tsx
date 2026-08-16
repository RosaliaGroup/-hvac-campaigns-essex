/**
 * Column manager — create, rename, reorder and archive the columns of a pipeline.
 *
 * Backed by the stage CRUD that already existed (opportunityStages). Two guardrails
 * carried over from that router and surfaced here rather than left as raw errors:
 *
 *  - system stages can't be renamed away or removed, because conversion and reporting
 *    key off their classification;
 *  - a column holding cards can't be deleted, since the cards would lose their stage.
 *    Archive it instead: it leaves the board but its history stays intact.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";

/** stageKey is the stable identifier; derive one from the name so users never see it. */
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "stage";
}

export default function ColumnManager({
  open, onOpenChange, pipelineKey,
}: { open: boolean; onOpenChange: (v: boolean) => void; pipelineKey: string }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const stagesQuery = trpc.opportunities.commercial.stages.list.useQuery(
    { pipelineKey, includeInactive: true },
    { enabled: open },
  );
  const columns = stagesQuery.data ?? [];

  const refresh = () => {
    utils.opportunities.commercial.stages.list.invalidate();
    utils.opportunities.commercial.list.invalidate();
  };
  const onErr = (err: { message: string }) =>
    toast({ title: "Couldn't update columns", description: err.message, variant: "destructive" });

  const create = trpc.opportunities.commercial.stages.create.useMutation({ onSuccess: () => { setNewName(""); refresh(); }, onError: onErr });
  const update = trpc.opportunities.commercial.stages.update.useMutation({ onSuccess: refresh, onError: onErr });
  const reorder = trpc.opportunities.commercial.stages.reorder.useMutation({ onSuccess: refresh, onError: onErr });
  const setActive = trpc.opportunities.commercial.stages.setActive.useMutation({ onSuccess: refresh, onError: onErr });
  const remove = trpc.opportunities.commercial.stages.remove.useMutation({ onSuccess: refresh, onError: onErr });

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    create.mutate({ pipelineKey, stageKey: slugify(name), name, classification: "open", sortOrder: columns.length });
  };

  // Swap with the neighbour and submit the whole order, which is what the API expects.
  const swap = (index: number, delta: number) => {
    const next = [...columns];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate({ orderedIds: next.map(c => c.id) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Columns</DialogTitle></DialogHeader>

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {stagesQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : columns.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No columns yet. Add the first one below.</p>
          ) : (
            columns.map((c, i) => (
              <div key={c.id} className={`flex items-center gap-1.5 rounded-md border p-1.5 ${c.isActive ? "" : "opacity-50"}`}>
                <div className="flex flex-col">
                  <button className="rounded p-0.5 hover:bg-muted disabled:opacity-30" disabled={i === 0} onClick={() => swap(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded p-0.5 hover:bg-muted disabled:opacity-30" disabled={i === columns.length - 1} onClick={() => swap(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Input
                  defaultValue={c.name}
                  disabled={c.isSystem}
                  className="h-8 flex-1 text-sm"
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v && v !== c.name) update.mutate({ id: c.id, name: v });
                    else e.target.value = c.name;
                  }}
                />

                {c.isSystem ? <Badge variant="secondary" className="text-[9px]">system</Badge> : null}
                {!c.isActive ? <Badge variant="outline" className="text-[9px]">hidden</Badge> : null}

                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setActive.mutate({ id: c.id, isActive: !c.isActive })}>
                  {c.isActive ? "Hide" : "Show"}
                </Button>

                {!c.isSystem ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1.5 text-red-600"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => remove.mutate({ id: c.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-1.5 border-t pt-3">
          <Input
            value={newName}
            placeholder="New column name"
            className="h-9"
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <Button className="h-9" disabled={!newName.trim() || create.isPending} onClick={add}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Hiding a column keeps its cards and history but takes it off the board. Deleting is
          only possible for empty, non-system columns.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="mr-1 h-4 w-4" /> Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
