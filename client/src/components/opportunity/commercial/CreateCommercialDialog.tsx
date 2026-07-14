/**
 * Create a commercial opportunity. Selects an EXISTING customer (searched) or
 * creates a new one inline via the shared customer API (customers.create +
 * customers.addProperty) — never a parallel implementation. Creating a customer
 * auto-selects it (and its new property) without closing or resetting the
 * opportunity form. Estimated value is optional (blank = not yet estimated).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Plus, UserPlus } from "lucide-react";
import { OPPORTUNITY_TYPES, OPPORTUNITY_PRIORITIES } from "@shared/commercialPipeline";

const NONE = "__none__";

type NcState = { company: string; firstName: string; lastName: string; email: string; phone: string; address: string; city: string; state: string; zip: string };
const EMPTY_NC: NcState = { company: "", firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "", zip: "" };

export default function CreateCommercialDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerLabel, setCustomerLabel] = useState("");
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [propertyLabel, setPropertyLabel] = useState("");
  const [search, setSearch] = useState("");
  const [opportunityType, setOpportunityType] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [assignedToId, setAssignedToId] = useState<string>(NONE);
  const [estimatedValue, setEstimatedValue] = useState("");

  // Inline "Create New Customer" form (reuses the shared customer API/UI patterns).
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [nc, setNc] = useState<NcState>(EMPTY_NC);
  const setNcField = (patch: Partial<typeof nc>) => setNc(v => ({ ...v, ...patch }));

  const customers = trpc.customers.list.useQuery({ search, limit: 8 }, { enabled: open && search.trim().length >= 2 });
  const salespeople = trpc.opportunities.salespeople.useQuery(undefined, { enabled: open });

  const createCustomer = trpc.customers.create.useMutation();
  const addProperty = trpc.customers.addProperty.useMutation();

  const create = trpc.opportunities.commercial.create.useMutation({
    onSuccess: res => {
      utils.opportunities.commercial.list.invalidate();
      toast({ title: "Opportunity created", description: res.opportunityNumber });
      reset();
      onOpenChange(false);
      onCreated(res.id);
    },
    onError: err => toast({ title: "Couldn’t create", description: err.message, variant: "destructive" }),
  });

  function reset() {
    setTitle(""); setDescription(""); setCustomerId(null); setCustomerLabel(""); setPropertyId(null); setPropertyLabel(""); setSearch("");
    setOpportunityType(""); setPriority(""); setAssignedToId(NONE); setEstimatedValue("");
    setShowNewCustomer(false); setNc(EMPTY_NC);
  }

  function selectCustomer(id: number, label: string) {
    setCustomerId(id); setCustomerLabel(label); setShowNewCustomer(false);
  }

  const ncName = nc.company.trim() || `${nc.firstName} ${nc.lastName}`.trim();
  const canCreateCustomer = (ncName.length > 0 || nc.email.trim().length > 0) && !createCustomer.isPending && !addProperty.isPending;

  async function handleCreateCustomer() {
    // Guard against silent duplicates: block if a loaded search result already
    // matches the company name or email exactly (case-insensitive).
    const key = (s: string) => s.trim().toLowerCase();
    const dupe = (customers.data?.items ?? []).find(
      c => (nc.company && key(c.companyName ?? "") === key(nc.company)) || (nc.email && key(c.email ?? "") === key(nc.email)),
    );
    if (dupe) {
      toast({ title: "Customer already exists", description: `Select “${dupe.companyName || dupe.displayName}” from the list instead.`, variant: "destructive" });
      return;
    }
    try {
      const { id } = await createCustomer.mutateAsync({
        type: "commercial",
        companyName: nc.company.trim() || null,
        firstName: nc.firstName.trim() || null,
        lastName: nc.lastName.trim() || null,
        email: nc.email.trim() || null,
        phone: nc.phone.trim() || null,
      });
      // Link the new property too, if an address was provided.
      if (nc.address.trim()) {
        const prop = await addProperty.mutateAsync({
          customerId: id,
          addressLine1: nc.address.trim(),
          city: nc.city.trim() || null,
          state: nc.state.trim() || null,
          zip: nc.zip.trim() || null,
          propertyType: "commercial",
          isPrimary: true,
        });
        const pid = (prop as { id?: number })?.id ?? null;
        setPropertyId(pid);
        setPropertyLabel([nc.address.trim(), nc.city.trim()].filter(Boolean).join(", "));
      }
      selectCustomer(id, ncName || nc.email.trim());
      utils.customers.list.invalidate();
      toast({ title: "Customer created", description: ncName || nc.email.trim() });
      setNc(EMPTY_NC);
    } catch (err) {
      toast({ title: "Couldn’t create customer", description: (err as { message?: string })?.message ?? "Please try again.", variant: "destructive" });
    }
  }

  const canSubmit = title.trim().length > 0 && customerId != null;
  const noMatches = !!customers.data && customers.data.items.length === 0 && search.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Commercial Opportunity</DialogTitle>
          <DialogDescription>Select an existing customer or create a new one — estimated value is optional.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rooftop RTU replacement — Building A" />
          </div>

          <div>
            <Label>Customer</Label>
            {customerId ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-green-600" /> {customerLabel}</span>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setCustomerId(null); setCustomerLabel(""); setPropertyId(null); setPropertyLabel(""); }}>change</button>
                </div>
                {propertyLabel ? <p className="mt-1 text-xs text-muted-foreground">Property: {propertyLabel}</p> : null}
              </div>
            ) : showNewCustomer ? (
              <NewCustomerForm
                nc={nc}
                setNcField={setNcField}
                onCancel={() => setShowNewCustomer(false)}
                onCreate={handleCreateCustomer}
                canCreate={canCreateCustomer}
                pending={createCustomer.isPending || addProperty.isPending}
              />
            ) : (
              <>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers (name, company, email, phone)…" />
                {search.trim().length >= 2 ? (
                  <div className="mt-1 max-h-44 overflow-y-auto rounded-md border">
                    {customers.isLoading ? <p className="p-2 text-xs text-muted-foreground">Searching…</p> : null}
                    {(customers.data?.items ?? []).map(c => (
                      <button
                        key={c.id}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => selectCustomer(c.id, c.companyName || c.displayName)}
                      >
                        <span className="font-medium">{c.companyName || c.displayName}</span>
                        {c.companyName && c.displayName !== c.companyName ? <span className="text-xs text-muted-foreground"> · {c.displayName}</span> : null}
                        <span className="block text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ") || "no contact info"}</span>
                      </button>
                    ))}
                    {noMatches ? <p className="p-2 text-xs text-muted-foreground">No matches.</p> : null}
                  </div>
                ) : null}
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => { setShowNewCustomer(true); setNcField({ company: search.trim() }); }}>
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Create New Customer
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={opportunityType || NONE} onValueChange={v => setOpportunityType(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>—</SelectItem>{OPPORTUNITY_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority || NONE} onValueChange={v => setPriority(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>—</SelectItem>{OPPORTUNITY_PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Owner</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Unassigned</SelectItem>{(salespeople.data ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated value <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input type="number" min={0} value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="Leave blank if unknown" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!canSubmit || create.isPending}
            onClick={() =>
              create.mutate({
                title: title.trim(),
                description: description.trim() || undefined,
                customerId: customerId!,
                propertyId: propertyId ?? undefined,
                opportunityType: (opportunityType || undefined) as never,
                priority: (priority || undefined) as never,
                assignedToId: assignedToId === NONE ? null : Number(assignedToId),
                estimatedValue: estimatedValue.trim() === "" ? null : Number(estimatedValue), // blank -> NULL (not yet estimated)
              })
            }
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCustomerForm({ nc, setNcField, onCancel, onCreate, canCreate, pending }: {
  nc: NcState;
  setNcField: (patch: Partial<NcState>) => void;
  onCancel: () => void;
  onCreate: () => void;
  canCreate: boolean;
  pending: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">New customer — company or a contact name is required.</p>
      <Input value={nc.company} onChange={e => setNcField({ company: e.target.value })} placeholder="Company name" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={nc.firstName} onChange={e => setNcField({ firstName: e.target.value })} placeholder="Contact first name" />
        <Input value={nc.lastName} onChange={e => setNcField({ lastName: e.target.value })} placeholder="Contact last name" />
        <Input type="email" value={nc.email} onChange={e => setNcField({ email: e.target.value })} placeholder="Email" />
        <Input value={nc.phone} onChange={e => setNcField({ phone: e.target.value })} placeholder="Phone" />
      </div>
      <p className="pt-1 text-xs text-muted-foreground">Service address (optional — linked as the primary property)</p>
      <Input value={nc.address} onChange={e => setNcField({ address: e.target.value })} placeholder="Address line 1" />
      <div className="grid grid-cols-3 gap-2">
        <Input value={nc.city} onChange={e => setNcField({ city: e.target.value })} placeholder="City" />
        <Input value={nc.state} onChange={e => setNcField({ state: e.target.value })} placeholder="State" maxLength={10} />
        <Input value={nc.zip} onChange={e => setNcField({ zip: e.target.value })} placeholder="ZIP" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Back to search</Button>
        <Button size="sm" disabled={!canCreate} onClick={onCreate}><Plus className="mr-1 h-3.5 w-3.5" /> {pending ? "Creating…" : "Create & select"}</Button>
      </div>
    </div>
  );
}
