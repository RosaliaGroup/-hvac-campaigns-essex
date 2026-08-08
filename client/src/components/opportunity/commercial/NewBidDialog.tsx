/**
 * New Commercial Bid dialog. Creates a commercial opportunity via the existing
 * opportunities.commercial.create endpoint (which sets recordType='commercial',
 * drops it on the first commercial stage, and — when isBid — allocates an ME-BID
 * number from the commercial_bid sequence). Customer selection reuses the shared
 * ContactCombobox. On success it invalidates the board list so the card appears
 * without a manual refresh. No server changes.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import ContactCombobox, { type SchedulingContact } from "@/components/ContactCombobox";
import { COMMERCIAL_PRIORITY_SCORES } from "@shared/commercialPipeline";

export default function NewBidDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<SchedulingContact | null>(null);
  const [title, setTitle] = useState("");
  const [isBid, setIsBid] = useState(true);
  const [priorityScore, setPriorityScore] = useState<string>("none");
  const [isStrategicLead, setIsStrategicLead] = useState(false);
  const [isStrategicProject, setIsStrategicProject] = useState(false);

  const reset = () => {
    setCustomer(null); setTitle(""); setIsBid(true);
    setPriorityScore("none"); setIsStrategicLead(false); setIsStrategicProject(false);
  };

  const create = trpc.opportunities.commercial.create.useMutation({
    onSuccess: res => {
      utils.opportunities.commercial.list.invalidate();
      toast({ title: `${isBid ? "Bid" : "Opportunity"} ${res.opportunityNumber ?? ""} created`.trim() });
      reset();
      onOpenChange(false);
      onCreated?.(res.id);
    },
    onError: err => toast({ title: "Could not create bid", description: err.message, variant: "destructive" }),
  });

  const customerId = customer?.customerId ?? null;
  const canSubmit = customerId != null && title.trim().length > 0 && !create.isPending;

  const submit = () => {
    if (customerId == null || !title.trim()) return;
    create.mutate({
      title: title.trim(),
      customerId,
      isBid,
      isStrategicLead,
      isStrategicProject,
      ...(priorityScore !== "none" ? { priorityScore: Number(priorityScore) } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Commercial Bid</DialogTitle>
          <DialogDescription>Lands on the commercial board. A bid draws an ME-BID number.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <ContactCombobox
              triggerLabel={customer ? (customer.companyName || customer.displayName) : undefined}
              onSelect={c => {
                if (c.customerId == null) {
                  toast({ title: "That contact is an unconverted lead", description: "Convert it to a customer before creating a bid.", variant: "destructive" });
                  return;
                }
                setCustomer(c);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bid-title">Title</Label>
            <Input id="bid-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Rooftop RTU replacement" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="bid-isbid" checked={isBid} onCheckedChange={v => setIsBid(v === true)} />
            <Label htmlFor="bid-isbid" className="font-normal">This is a BID (draws an ME-BID number)</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Priority score (optional)</Label>
            <Select value={priorityScore} onValueChange={setPriorityScore}>
              <SelectTrigger><SelectValue placeholder="Unscored" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unscored</SelectItem>
                {COMMERCIAL_PRIORITY_SCORES.map(s => <SelectItem key={s} value={String(s)}>P{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id="bid-slead" checked={isStrategicLead} onCheckedChange={v => setIsStrategicLead(v === true)} />
              <Label htmlFor="bid-slead" className="font-normal">Strategic lead</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="bid-sproj" checked={isStrategicProject} onCheckedChange={v => setIsStrategicProject(v === true)} />
              <Label htmlFor="bid-sproj" className="font-normal">Strategic project</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>{create.isPending ? "Creating…" : "Create bid"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
