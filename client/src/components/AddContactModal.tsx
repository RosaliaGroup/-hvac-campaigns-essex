/**
 * Add Contact modal — creates (or matches) a customer AND its first property in a
 * single transactional call (customers.createWithProperty). Reused by the Contacts
 * page and the appointment dialog; on success returns both ids for immediate prefill.
 * Surfaces a duplicate match instead of creating silent duplicates.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export interface CreatedContact {
  customerId: number;
  propertyId: number | null;
  mergedCustomer: boolean;
  mergedProperty: boolean;
  customer: { id: number; displayName: string; phone: string | null; email: string | null; type: "residential" | "commercial" } | null;
  property: { id: number; propertyType: "residential" | "commercial"; address: string } | null;
}

const EMPTY = {
  type: "residential" as "residential" | "commercial",
  firstName: "", lastName: "", companyName: "", phone: "", email: "",
  addressLine1: "", addressLine2: "", city: "", state: "NJ", zip: "",
  propertyType: "residential" as "residential" | "commercial",
};

export default function AddContactModal({
  open, onClose, onCreated, initialType,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (c: CreatedContact) => void;
  initialType?: "residential" | "commercial";
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (open) setForm({ ...EMPTY, type: initialType ?? "residential", propertyType: initialType ?? "residential" });
  }, [open, initialType]);

  const create = trpc.customers.createWithProperty.useMutation({
    onSuccess: res => {
      toast({
        title: res.mergedCustomer ? "Matched an existing customer" : "Customer created",
        description: res.mergedCustomer
          ? "Found a customer with the same phone/email — linked to it instead of creating a duplicate."
          : res.mergedProperty ? "Linked to an existing property." : res.property ? "First property added." : undefined,
      });
      onCreated?.(res as CreatedContact);
      onClose();
    },
    onError: e => toast({ title: "Could not save contact", description: e.message, variant: "destructive" }),
  });

  const submit = () => {
    if (!form.firstName && !form.lastName && !form.companyName && !form.email && !form.phone) {
      toast({ title: "Add at least a name, email, or phone", variant: "destructive" });
      return;
    }
    create.mutate({
      type: form.type,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      companyName: form.companyName || null,
      email: form.email || null,
      phone: form.phone || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      propertyType: form.propertyType,
    });
  };

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => set({ type: v as typeof form.type, propertyType: v as typeof form.type })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>First name</Label><Input value={form.firstName} onChange={e => set({ firstName: e.target.value })} /></div>
          <div><Label>Last name</Label><Input value={form.lastName} onChange={e => set({ lastName: e.target.value })} /></div>
          {form.type === "commercial" && (
            <div className="col-span-2"><Label>Company</Label><Input value={form.companyName} onChange={e => set({ companyName: e.target.value })} /></div>
          )}
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set({ phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set({ email: e.target.value })} /></div>
          <div className="col-span-2 border-t pt-2 text-xs font-medium text-muted-foreground">Service property</div>
          <div className="col-span-2"><Label>Street</Label><Input value={form.addressLine1} onChange={e => set({ addressLine1: e.target.value })} /></div>
          <div><Label>Unit</Label><Input value={form.addressLine2} onChange={e => set({ addressLine2: e.target.value })} /></div>
          <div><Label>City</Label><Input value={form.city} onChange={e => set({ city: e.target.value })} /></div>
          <div><Label>State</Label><Input value={form.state} onChange={e => set({ state: e.target.value })} /></div>
          <div><Label>ZIP</Label><Input value={form.zip} onChange={e => set({ zip: e.target.value })} /></div>
          <div className="col-span-2">
            <Label>Property type</Label>
            <Select value={form.propertyType} onValueChange={v => set({ propertyType: v as typeof form.propertyType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending} className="bg-[#1e3a5f] hover:bg-[#16304f]">
            {create.isPending ? "Saving…" : "Save Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
