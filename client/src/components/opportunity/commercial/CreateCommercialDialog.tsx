/**
 * Create a commercial opportunity. Reuses an EXISTING customer (searched, never
 * created here) and seeds the record with recordType=commercial. Property,
 * categories, members, and the rest are edited afterwards in the detail drawer.
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
import { Check } from "lucide-react";
import { OPPORTUNITY_TYPES, OPPORTUNITY_PRIORITIES } from "@shared/commercialPipeline";

const NONE = "__none__";

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
  const [search, setSearch] = useState("");
  const [opportunityType, setOpportunityType] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [assignedToId, setAssignedToId] = useState<string>(NONE);
  const [estimatedValue, setEstimatedValue] = useState("");

  const customers = trpc.customers.list.useQuery({ search, limit: 8 }, { enabled: open && search.trim().length >= 2 });
  const salespeople = trpc.opportunities.salespeople.useQuery(undefined, { enabled: open });

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
    setTitle(""); setDescription(""); setCustomerId(null); setCustomerLabel(""); setSearch("");
    setOpportunityType(""); setPriority(""); setAssignedToId(NONE); setEstimatedValue("");
  }

  const canSubmit = title.trim().length > 0 && customerId != null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Commercial Opportunity</DialogTitle>
          <DialogDescription>Link an existing customer — this never creates a customer or property.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rooftop RTU replacement — Building A" />
          </div>

          <div>
            <Label>Customer</Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-green-600" /> {customerLabel}</span>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setCustomerId(null); setCustomerLabel(""); }}>change</button>
              </div>
            ) : (
              <>
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers (name, company, email)…" />
                {search.trim().length >= 2 ? (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border">
                    {customers.isLoading ? <p className="p-2 text-xs text-muted-foreground">Searching…</p> : null}
                    {(customers.data?.items ?? []).map(c => (
                      <button
                        key={c.id}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => { setCustomerId(c.id); setCustomerLabel(c.companyName || c.displayName); }}
                      >
                        {c.companyName || c.displayName}{c.companyName ? <span className="text-xs text-muted-foreground"> · {c.displayName}</span> : null}
                      </button>
                    ))}
                    {customers.data && customers.data.items.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No matches.</p> : null}
                  </div>
                ) : null}
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
              <Label>Estimated value</Label>
              <Input type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="0" />
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
                opportunityType: (opportunityType || undefined) as never,
                priority: (priority || undefined) as never,
                assignedToId: assignedToId === NONE ? null : Number(assignedToId),
                estimatedValue: estimatedValue === "" ? null : Number(estimatedValue),
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
