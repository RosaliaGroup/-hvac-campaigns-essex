/**
 * Customer 360 → Equipment tab (staff, PR #1).
 *
 * Read + create/edit/retire of a customer's installed HVAC units. Equipment is
 * PROPERTY-ANCHORED: every unit is filed under one of the customer's properties
 * (the picker requires a property; if the customer has none, we prompt to add
 * one first). Category uses the shared HVAC vocabulary. Linked warranties are
 * shown READ-ONLY. This component never touches the customer portal.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wrench, Plus, Pencil, MapPin, Calendar, ShieldCheck, Archive, RotateCcw } from "lucide-react";
import { EQUIPMENT_CATEGORIES, equipmentCategoryLabel } from "@shared/equipment";

type PropertyLite = { id: number; label: string | null; addressLine1: string; city: string | null };

const EMPTY_FORM = {
  propertyId: "",
  category: "",
  make: "",
  model: "",
  serialNumber: "",
  location: "",
  installedAt: "",
  notes: "",
};

function propertyLabel(properties: PropertyLite[], propertyId: number | null): string | null {
  if (propertyId == null) return null;
  const p = properties.find(x => x.id === propertyId);
  if (!p) return null;
  return p.label || [p.addressLine1, p.city].filter(Boolean).join(", ");
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}

function shortDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? null
    : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CustomerEquipmentTab({
  customerId,
  properties,
}: {
  customerId: number;
  properties: PropertyLite[];
}) {
  const { toast } = useToast();
  const { data, refetch } = trpc.equipment.listByCustomer.useQuery({ customerId }, { enabled: customerId > 0 });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const close = () => setOpen(false);
  const afterWrite = (title: string) => {
    toast({ title });
    setOpen(false);
    refetch();
  };
  const onError = (title: string) => (e: { message: string }) =>
    toast({ title, description: e.message, variant: "destructive" });

  const create = trpc.equipment.create.useMutation({ onSuccess: () => afterWrite("Equipment added"), onError: onError("Could not add equipment") });
  const update = trpc.equipment.update.useMutation({ onSuccess: () => afterWrite("Equipment updated"), onError: onError("Update failed") });
  const retire = trpc.equipment.retire.useMutation({ onSuccess: () => { toast({ title: "Equipment retired" }); refetch(); }, onError: onError("Could not retire") });
  const reactivate = trpc.equipment.reactivate.useMutation({ onSuccess: () => { toast({ title: "Equipment reactivated" }); refetch(); }, onError: onError("Could not reactivate") });

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;
  const hasProperties = properties.length > 0;

  const openAdd = () => {
    setEditingId(null);
    const primary = properties[0];
    setForm({ ...EMPTY_FORM, propertyId: primary ? String(primary.id) : "" });
    setOpen(true);
  };

  const openEdit = (u: (typeof items)[number]) => {
    setEditingId(u.id);
    setForm({
      propertyId: u.propertyId ? String(u.propertyId) : "",
      category: u.category ?? "",
      make: u.make ?? "",
      model: u.model ?? "",
      serialNumber: u.serialNumber ?? "",
      location: u.location ?? "",
      installedAt: toDateInput(u.installedAt),
      notes: u.notes ?? "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.propertyId) {
      toast({ title: "Property is required", description: "Pick which property the unit is installed at.", variant: "destructive" });
      return;
    }
    if (!form.category) {
      toast({ title: "Category is required", variant: "destructive" });
      return;
    }
    const payload = {
      propertyId: Number(form.propertyId),
      category: form.category,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      serialNumber: form.serialNumber.trim() || null,
      location: form.location.trim() || null,
      installedAt: form.installedAt ? new Date(form.installedAt).toISOString() : null,
      notes: form.notes.trim() || null,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };

  const saving = create.isPending || update.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4 text-[#1e3a5f]" /> Equipment ({total})</CardTitle>
        <Button size="sm" variant="outline" onClick={openAdd} disabled={!hasProperties} title={hasProperties ? undefined : "Add a property first"}>
          <Plus className="h-4 w-4 mr-1" /> Add Equipment
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!hasProperties ? (
          <p className="text-sm text-muted-foreground">Add a property to this customer first — equipment is filed under a property.</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No equipment on file yet.</p>
        ) : (
          items.map(u => {
            const retired = u.status === "retired";
            const addr = propertyLabel(properties, u.propertyId);
            const installed = shortDate(u.installedAt);
            return (
              <div key={u.id} className={`flex items-start justify-between gap-3 border rounded-lg p-3 text-sm ${retired ? "opacity-60" : ""}`}>
                <div className="min-w-0 space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    {equipmentCategoryLabel(u.category) ?? "Equipment"}
                    {(u.make || u.model) && <span className="text-muted-foreground font-normal">{[u.make, u.model].filter(Boolean).join(" ")}</span>}
                    {retired && <Badge variant="secondary" className="bg-gray-100 text-gray-600">Retired</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {u.serialNumber && <span>S/N {u.serialNumber}</span>}
                    {u.location && <span>· {u.location}</span>}
                    {addr && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {addr}</span>}
                    {installed && <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Installed {installed}</span>}
                  </div>
                  {u.notes && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{u.notes}</div>}
                  {u.warranties.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {u.warranties.map(w => {
                        const exp = shortDate(w.expiresAt);
                        return (
                          <Badge key={w.id} variant="outline" className="text-xs font-normal gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {w.type}{w.provider ? ` · ${w.provider}` : ""}{exp ? ` · exp ${exp}` : ""}{w.status !== "active" ? ` (${w.status})` : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(u)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                  {retired ? (
                    <Button size="icon" variant="ghost" onClick={() => reactivate.mutate({ id: u.id })} title="Reactivate"><RotateCcw className="h-4 w-4 text-green-600" /></Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => retire.mutate({ id: u.id })} title="Retire"><Archive className="h-4 w-4 text-muted-foreground" /></Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Equipment" : "Add Equipment"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Property</Label>
              <Select value={form.propertyId} onValueChange={v => setForm(f => ({ ...f, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.label || [p.addressLine1, p.city].filter(Boolean).join(", ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make</Label><Input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="e.g. Carrier" /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Serial Number</Label><Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} /></div>
              <div><Label>Installed</Label><Input type="date" value={form.installedAt} onChange={e => setForm(f => ({ ...f, installedAt: e.target.value }))} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Basement, Roof, Unit 2B" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{editingId ? "Save" : "Add Equipment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
