/**
 * WorkOrderParts (PR #41) — materials a technician records as used. Field-only
 * (part number, description, qty, unit, notes) — no cost/price. Add/edit/delete
 * allowed until the job is completed (server returns `editable`); admins retain
 * override after completion.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Plus, Pencil, Trash2, Loader2, Lock } from "lucide-react";

type Draft = { partNumber: string; description: string; quantity: string; unit: string; notes: string };
const EMPTY: Draft = { partNumber: "", description: "", quantity: "1", unit: "", notes: "" };

export function WorkOrderParts({ jobId }: { jobId: number }) {
  const utils = trpc.useUtils();
  const { data } = trpc.jobs.fieldListParts.useQuery({ jobId }, { enabled: jobId > 0 });
  const addPart = trpc.jobs.fieldAddPart.useMutation();
  const updatePart = trpc.jobs.fieldUpdatePart.useMutation();
  const deletePart = trpc.jobs.fieldDeletePart.useMutation();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);

  const parts = data?.parts ?? [];
  const editable = data?.editable ?? false;
  const refetch = () => utils.jobs.fieldListParts.invalidate({ jobId });

  const toInput = (d: Draft) => ({
    partNumber: d.partNumber.trim() || null, description: d.description.trim(),
    quantity: Number(d.quantity) || 0, unit: d.unit.trim() || null, notes: d.notes.trim() || null,
  });

  const add = async () => {
    if (!draft.description.trim()) return;
    try { await addPart.mutateAsync({ jobId, ...toInput(draft) }); setDraft(EMPTY); refetch(); toast.success("Part added"); }
    catch (e: any) { toast.error(e?.message || "Could not add part"); }
  };
  const saveEdit = async (id: number) => {
    try { await updatePart.mutateAsync({ id, ...toInput(editDraft) }); setEditingId(null); refetch(); toast.success("Part updated"); }
    catch (e: any) { toast.error(e?.message || "Could not update part"); }
  };
  const remove = async (id: number) => {
    try { await deletePart.mutateAsync({ id }); refetch(); }
    catch (e: any) { toast.error(e?.message || "Could not delete part"); }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Package className="h-4 w-4" />
          <span className="uppercase tracking-wide">Parts Used</span>
          <Badge variant="secondary" className="ml-auto">{parts.length}</Badge>
        </div>

        {/* List */}
        {parts.length === 0 ? <p className="text-sm text-muted-foreground">No parts recorded.</p> : (
          <div className="space-y-2">
            {parts.map((p: any) => editingId === p.id ? (
              <div key={p.id} className="space-y-2 rounded-lg border p-2">
                <Input placeholder="Part #" value={editDraft.partNumber} onChange={e => setEditDraft(d => ({ ...d, partNumber: e.target.value }))} />
                <Input placeholder="Description" value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Qty" inputMode="decimal" value={editDraft.quantity} onChange={e => setEditDraft(d => ({ ...d, quantity: e.target.value }))} />
                  <Input placeholder="Unit" value={editDraft.unit} onChange={e => setEditDraft(d => ({ ...d, unit: e.target.value }))} />
                </div>
                <Input placeholder="Notes" value={editDraft.notes} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" className="h-9" disabled={updatePart.isPending} onClick={() => saveEdit(p.id)}>Save</Button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {p.description} <span className="text-muted-foreground">× {Number(p.quantity)}{p.unit ? ` ${p.unit}` : ""}</span>
                  </div>
                  {p.partNumber ? <div className="text-xs text-muted-foreground">Part #{p.partNumber}</div> : null}
                  {p.notes ? <div className="text-xs text-muted-foreground">{p.notes}</div> : null}
                </div>
                {editable ? (
                  <div className="flex shrink-0 gap-1">
                    <button className="text-[#ff6b35]" aria-label="Edit part" onClick={() => { setEditingId(p.id); setEditDraft({ partNumber: p.partNumber ?? "", description: p.description, quantity: String(Number(p.quantity)), unit: p.unit ?? "", notes: p.notes ?? "" }); }}><Pencil className="h-4 w-4" /></button>
                    <button className="text-red-500" aria-label="Delete part" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ) : <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {editable ? (
          <div className="space-y-2 rounded-xl border p-3">
            <Input placeholder="Part # (optional)" value={draft.partNumber} onChange={e => setDraft(d => ({ ...d, partNumber: e.target.value }))} />
            <Input placeholder="Description" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Qty" inputMode="decimal" value={draft.quantity} onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))} />
              <Input placeholder="Unit (optional)" value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} />
            </div>
            <Input placeholder="Notes (optional)" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            <Button className="h-11 w-full" disabled={addPart.isPending || !draft.description.trim()} onClick={add}>
              {addPart.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Add Part
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Parts are locked (job completed).</p>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkOrderParts;
