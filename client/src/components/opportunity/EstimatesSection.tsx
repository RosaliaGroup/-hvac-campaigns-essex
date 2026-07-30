/**
 * Task 8A — internal tiered-estimate builder on the Opportunity detail page.
 * Create an estimate, author up to 3 Good/Better/Best options with line items,
 * mark it sent, then approve exactly one option (which pushes that option to
 * QuickBooks) or decline with a reason. v1 is internal only (no customer e-sign);
 * the 3-option comparison is print/PDF-friendly. Money/decimal fields arrive from
 * the API as strings and are wrapped in Number().
 */
import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { formatEstimateNumber } from "@shared/estimateNumber";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/jobPresentation";
import { FileText, Plus, Trash2, Printer, Check, X, RefreshCw, ClipboardList } from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type EstimateFull = RouterOutput["estimates"]["listByOpportunity"][number];
type OptionFull = EstimateFull["options"][number];

const TIERS = ["good", "better", "best"] as const;
type Tier = (typeof TIERS)[number];
const ITEM_TYPES = ["labor", "part", "service", "equipment", "other"] as const;

const ESTIMATE_STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};
const QB_SYNC: Record<string, string> = {
  not_pushed: "bg-gray-100 text-gray-600",
  pushed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};
const QB_SYNC_LABEL: Record<string, string> = {
  not_pushed: "QB: not pushed",
  pushed: "QB: pushed",
  failed: "QB: sync failed",
};

const money = (v: unknown) => formatMoney(Number(v ?? 0));

export function EstimatesSection({ opportunityId }: { opportunityId: number }) {
  const utils = trpc.useUtils();
  const list = trpc.estimates.listByOpportunity.useQuery({ opportunityId }, { enabled: opportunityId > 0 });
  const create = trpc.estimates.create.useMutation({
    onSuccess: () => {
      toast.success("Estimate created");
      utils.estimates.listByOpportunity.invalidate({ opportunityId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 estimates-no-print">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#1e3a5f]" /> Tiered Estimates ({list.data?.length ?? 0})
        </CardTitle>
        <Button size="sm" onClick={() => create.mutate({ opportunityId })} disabled={create.isPending}>
          <Plus className="h-4 w-4 mr-1" /> New Estimate
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading estimates…</p>}
        {list.data && list.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No estimates yet. Create one to build Good/Better/Best options.</p>
        )}
        {list.data?.map((est) => (
          <EstimateCard key={est.id} estimate={est} opportunityId={opportunityId} />
        ))}
      </CardContent>
    </Card>
  );
}

function EstimateCard({ estimate, opportunityId }: { estimate: EstimateFull; opportunityId: number }) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tier>("good");
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const refresh = () => {
    utils.estimates.listByOpportunity.invalidate({ opportunityId });
    utils.opportunities.get.invalidate({ id: opportunityId });
  };

  const editable = estimate.status === "draft" || estimate.status === "sent" || estimate.status === "viewed";
  const optionByTier = (t: Tier) => estimate.options.find((o) => o.tier === t);
  const approvedOption = estimate.options.find((o) => o.isApproved) ?? null;

  const markSent = trpc.estimates.markSent.useMutation({
    onSuccess: () => { toast.success("Estimate marked sent"); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const retry = trpc.estimates.retryPush.useMutation({
    onSuccess: () => { toast.success("Pushed to QuickBooks"); refresh(); },
    onError: (e) => toast.error(`QuickBooks push failed: ${e.message}`),
  });

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header / status */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold flex items-center gap-1"><FileText className="h-4 w-4 text-[#1e3a5f]" /> {formatEstimateNumber(estimate.estimateNumber, { short: true })}</span>
          <Badge variant="secondary" className={ESTIMATE_STATUS[estimate.status] ?? ""}>{estimate.status}</Badge>
          {approvedOption && <Badge variant="secondary" className="bg-green-100 text-green-700">Approved: {approvedOption.tier}</Badge>}
          {estimate.status === "approved" && (
            <Badge variant="secondary" className={QB_SYNC[estimate.qbSyncStatus] ?? ""}>{QB_SYNC_LABEL[estimate.qbSyncStatus] ?? estimate.qbSyncStatus}</Badge>
          )}
          {estimate.quickbooksEstimateId && <span className="text-xs text-muted-foreground">QBO Estimate {estimate.quickbooksEstimateId}</span>}
        </div>
        <div className="flex items-center gap-2 estimates-no-print">
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          {estimate.status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => markSent.mutate({ id: estimate.id })} disabled={markSent.isPending}>Mark Sent</Button>
          )}
          {(estimate.status === "sent" || estimate.status === "viewed") && (
            <>
              <Button size="sm" onClick={() => setApproveOpen(true)}><Check className="h-4 w-4 mr-1" /> Approve</Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeclineOpen(true)}><X className="h-4 w-4 mr-1" /> Decline</Button>
            </>
          )}
          {estimate.status === "approved" && estimate.qbSyncStatus === "failed" && (
            <Button size="sm" variant="outline" onClick={() => retry.mutate({ estimateId: estimate.id })} disabled={retry.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry Push
            </Button>
          )}
        </div>
      </div>

      {estimate.status === "approved" && estimate.qbSyncStatus === "failed" && estimate.qbSyncError && (
        <p className="text-sm text-red-600">Approved locally, but the QuickBooks push failed: {estimate.qbSyncError}</p>
      )}
      {estimate.status === "declined" && estimate.declineReason && (
        <p className="text-sm text-muted-foreground">Declined — reason: {estimate.declineReason}</p>
      )}

      {/* Side-by-side comparison (print-friendly) */}
      {estimate.options.length > 0 && <OptionComparison options={estimate.options} />}

      {/* Builder tabs (only while editable) */}
      {editable && (
        <div className="estimates-no-print">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tier)}>
            <TabsList>
              {TIERS.map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">{t}{optionByTier(t) ? " ✓" : ""}</TabsTrigger>
              ))}
            </TabsList>
            {TIERS.map((t) => (
              <TabsContent key={t} value={t} className="pt-3">
                <OptionEditor estimateId={estimate.id} tier={t} existing={optionByTier(t) ?? null} onSaved={refresh} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      {approveOpen && (
        <ApproveDialog estimate={estimate} onClose={() => setApproveOpen(false)} onDone={refresh} />
      )}
      <DeclineDialog
        open={declineOpen}
        estimateId={estimate.id}
        onClose={() => setDeclineOpen(false)}
        onDone={refresh}
      />

      {/* Scoped print CSS — hide builder chrome; the comparison grid prints clean. */}
      <style>{`@media print { .estimates-no-print { display: none !important; } }`}</style>
    </div>
  );
}

function OptionComparison({ options }: { options: OptionFull[] }) {
  const ordered = [...options].sort((a, b) => TIERS.indexOf(a.tier as Tier) - TIERS.indexOf(b.tier as Tier));
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}>
      {ordered.map((o) => (
        <div key={o.id} className={`border rounded-lg p-3 text-sm ${o.isApproved ? "ring-2 ring-green-500" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold capitalize">{o.tier}</span>
            {o.isApproved && <Badge variant="secondary" className="bg-green-100 text-green-700">Approved</Badge>}
          </div>
          <div className="text-muted-foreground">{o.label}</div>
          {o.description && <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>}
          <ul className="mt-2 space-y-1">
            {o.lineItems.map((li) => (
              <li key={li.id} className="flex justify-between gap-2">
                <span className="truncate">{li.name} <span className="text-muted-foreground">×{Number(li.quantity)}</span></span>
                <span>{money(li.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t pt-2 space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(o.subtotal)}</span></div>
            {Number(o.rebateAmount) > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Rebate (est.)</span><span>{money(o.rebateAmount)}</span></div>
            )}
            <div className="flex justify-between font-semibold"><span>Total</span><span>{money(o.total)}</span></div>
          </div>
          {o.warrantyTerms && <p className="mt-2 text-xs"><span className="text-muted-foreground">Warranty:</span> {o.warrantyTerms}</p>}
          {o.maintenancePlan && <p className="text-xs"><span className="text-muted-foreground">Maintenance:</span> {o.maintenancePlan}</p>}
        </div>
      ))}
    </div>
  );
}

interface Row { name: string; description: string; itemType: string; quantity: string; unitPrice: string }

function toRows(existing: OptionFull | null): Row[] {
  if (!existing || existing.lineItems.length === 0) return [{ name: "", description: "", itemType: "service", quantity: "1", unitPrice: "0" }];
  return existing.lineItems.map((li) => ({
    name: li.name,
    description: li.description ?? "",
    itemType: li.itemType,
    quantity: String(Number(li.quantity)),
    unitPrice: String(Number(li.unitPrice)),
  }));
}

function OptionEditor({ estimateId, tier, existing, onSaved }: { estimateId: number; tier: Tier; existing: OptionFull | null; onSaved: () => void }) {
  const [label, setLabel] = useState(existing?.label ?? `${tier[0].toUpperCase()}${tier.slice(1)} option`);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [warrantyTerms, setWarranty] = useState(existing?.warrantyTerms ?? "");
  const [maintenancePlan, setMaintenance] = useState(existing?.maintenancePlan ?? "");
  const [rebateAmount, setRebate] = useState(existing ? String(Number(existing.rebateAmount)) : "0");
  const [rows, setRows] = useState<Row[]>(toRows(existing));

  const save = trpc.estimates.saveOption.useMutation({
    onSuccess: () => { toast.success(`${tier} option saved`); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.estimates.deleteOption.useMutation({
    onSuccess: () => { toast.success("Option removed"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const subtotal = rows.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unitPrice || 0), 0);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { name: "", description: "", itemType: "service", quantity: "1", unitPrice: "0" }]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const onSave = () => {
    const lineItems = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        description: r.description.trim() || undefined,
        itemType: r.itemType as (typeof ITEM_TYPES)[number],
        quantity: Number(r.quantity || 0),
        unitPrice: Number(r.unitPrice || 0),
      }));
    save.mutate({
      estimateId,
      optionId: existing?.id ?? undefined,
      tier,
      label: label.trim() || `${tier} option`,
      description: description.trim() || undefined,
      sortOrder: TIERS.indexOf(tier),
      rebateAmount: Number(rebateAmount || 0),
      warrantyTerms: warrantyTerms.trim() || undefined,
      maintenancePlan: maintenancePlan.trim() || undefined,
      lineItems,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label className="text-xs">Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><Label className="text-xs">Rebate (display only)</Label><Input type="number" value={rebateAmount} onChange={(e) => setRebate(e.target.value)} /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><Label className="text-xs">Warranty terms</Label><Input value={warrantyTerms} onChange={(e) => setWarranty(e.target.value)} /></div>
        <div><Label className="text-xs">Maintenance plan</Label><Input value={maintenancePlan} onChange={(e) => setMaintenance(e.target.value)} /></div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Line items</Label>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[10rem]"><Input placeholder="Name" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} /></div>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={r.itemType}
              onChange={(e) => setRow(i, { itemType: e.target.value })}
            >
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="w-16"><Input type="number" placeholder="Qty" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} /></div>
            <div className="w-24"><Input type="number" placeholder="Unit $" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: e.target.value })} /></div>
            <div className="w-24 text-right text-sm tabular-nums">{money(Number(r.quantity || 0) * Number(r.unitPrice || 0))}</div>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add line</Button>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-medium">Subtotal: {money(subtotal)}</span>
        <div className="flex items-center gap-2">
          {existing && (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => del.mutate({ optionId: existing.id })} disabled={del.isPending}>Delete option</Button>
          )}
          <Button size="sm" onClick={onSave} disabled={save.isPending}>{existing ? "Save option" : "Add option"}</Button>
        </div>
      </div>
    </div>
  );
}

function ApproveDialog({ estimate, onClose, onDone }: { estimate: EstimateFull; onClose: () => void; onDone: () => void }) {
  const options = [...estimate.options].sort((a, b) => TIERS.indexOf(a.tier as Tier) - TIERS.indexOf(b.tier as Tier));
  const [selected, setSelected] = useState<number | null>(options[0]?.id ?? null);
  const [pushResult, setPushResult] = useState<{ ok: boolean; qbId?: string | null; error?: string } | null>(null);

  const approve = trpc.estimates.approve.useMutation({
    onSuccess: (res) => {
      setPushResult(res.push);
      if (res.push.ok) toast.success("Approved and pushed to QuickBooks");
      else toast.warning("Approved locally — QuickBooks push failed");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve estimate {formatEstimateNumber(estimate.estimateNumber, { short: true })}</DialogTitle></DialogHeader>
        {!pushResult ? (
          <>
            <p className="text-sm text-muted-foreground">Select exactly one option to approve. Only the approved option is pushed to QuickBooks.</p>
            <div className="space-y-2 py-2">
              {options.map((o) => (
                <label key={o.id} className="flex items-center justify-between gap-3 border rounded-md p-2 text-sm cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="approve-option" checked={selected === o.id} onChange={() => setSelected(o.id)} />
                    <span className="capitalize font-medium">{o.tier}</span>
                    <span className="text-muted-foreground">{o.label}</span>
                  </span>
                  <span className="font-semibold">{money(o.total)}</span>
                </label>
              ))}
              {options.length === 0 && <p className="text-sm text-muted-foreground">This estimate has no options to approve.</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => selected && approve.mutate({ estimateId: estimate.id, optionId: selected })}
                disabled={!selected || approve.isPending}
              >
                {approve.isPending ? "Approving…" : "Approve & push"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-3 text-sm">
              <p className="text-green-700 font-medium">Estimate approved.</p>
              {pushResult.ok ? (
                <p className="mt-1">Pushed to QuickBooks{pushResult.qbId ? ` — Estimate ${pushResult.qbId}` : ""}.</p>
              ) : (
                <p className="mt-1 text-red-600">QuickBooks push failed: {pushResult.error}. The approval stands — use “Retry Push”.</p>
              )}
            </div>
            <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ open, estimateId, onClose, onDone }: { open: boolean; estimateId: number; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const decline = trpc.estimates.decline.useMutation({
    onSuccess: () => { toast.success("Estimate declined"); onDone(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Decline estimate</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">A reason is required.</p>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was this declined?" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => decline.mutate({ estimateId, reason: reason.trim() })}
            disabled={!reason.trim() || decline.isPending}
          >
            Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
