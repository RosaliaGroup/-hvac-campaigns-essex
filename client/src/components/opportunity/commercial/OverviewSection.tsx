/**
 * Overview tab — read view + inline edit of the opportunity's core fields via
 * safe partial updates (only changed fields are sent; the server no-ops
 * unchanged values and logs one activity event per real change). Also exports
 * the FinancialCard used by the Financial tab.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";
import {
  OPPORTUNITY_TYPES, PROJECT_CATEGORIES, OPPORTUNITY_PRIORITIES,
  opportunityTypeLabel, projectCategoryLabel,
} from "@shared/commercialPipeline";
import { financialView, fmtMoney, fmtDate, type FinancialView } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms, CategoryChips, TypeBadge } from "./shared";
import MembersSection from "./MembersSection";

const NONE = "__none__";
const toDateInput = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const fromDateInput = (s: string) => (s ? new Date(s + "T00:00:00") : null);

export function FinancialCard({ fin, probability }: { fin: FinancialView; probability: number | null | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
      <Field label="Estimated value">{fmtMoney(fin.estimatedValue)}</Field>
      <Field label="Estimated cost">{fin.estimatedCost != null ? fmtMoney(fin.estimatedCost) : "—"}</Field>
      <Field label="Calculated gross margin">
        {fin.calculatedMargin != null ? fmtMoney(fin.calculatedMargin) : "—"}
        {fin.calculatedMarginPercent != null ? <span className="ml-1 text-xs text-muted-foreground">({fin.calculatedMarginPercent}%)</span> : null}
      </Field>
      <Field label="Margin override">
        {fin.marginIsOverridden ? (
          <span className="inline-flex items-center gap-1">{fmtMoney(fin.marginOverride)} <Badge variant="secondary" className="text-[9px]">manual override</Badge></span>
        ) : (
          <span className="text-muted-foreground">None — using calculated</span>
        )}
      </Field>
      <Field label="Probability">{probability != null ? `${probability}%` : "—"}</Field>
      <Field label="Weighted value">{fin.weightedValue != null ? fmtMoney(fin.weightedValue) : "—"}</Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{children}</p>
    </div>
  );
}

export default function OverviewSection({ detail }: { detail: CommercialDetail }) {
  const opp = detail.opportunity;
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();
  const salespeople = trpc.opportunities.salespeople.useQuery();
  const [editing, setEditing] = useState(false);

  const initial = useMemo(
    () => ({
      title: opp.title ?? "",
      description: opp.description ?? "",
      priority: opp.priority ?? "",
      opportunityType: opp.opportunityType ?? "",
      source: opp.source ?? "",
      assignedToId: opp.assignedToId,
      estimatorId: opp.estimatorId,
      projectManagerId: opp.projectManagerId,
      communicationPlatform: opp.communicationPlatform ?? "",
      externalReference: opp.externalReference ?? "",
      amount: opp.amount ?? "",
      estimatedCost: opp.estimatedCost ?? "",
      estimatedGrossMargin: opp.estimatedGrossMargin ?? "",
      probability: opp.probability,
      bidDueAt: toDateInput(opp.bidDueAt),
      siteVisitAt: toDateInput(opp.siteVisitAt),
      proposalDueAt: toDateInput(opp.proposalDueAt),
      proposalSentAt: toDateInput(opp.proposalSentAt),
      followUpAt: toDateInput(opp.followUpAt),
      expectedCloseAt: toDateInput(opp.expectedCloseAt),
      categories: detail.projectCategories,
    }),
    [opp, detail.projectCategories],
  );
  const [form, setForm] = useState(initial);
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const invalidate = () => utils.opportunities.commercial.get.invalidate({ id: opp.id });
  const onError = (err: { message: string }) => toast({ title: "Update failed", description: err.message, variant: "destructive" });
  const update = trpc.opportunities.commercial.update.useMutation({ onError });
  const setCats = trpc.opportunities.commercial.setProjectCategories.useMutation({ onError });

  const fin = financialView(opp.amount, opp.estimatedCost, opp.estimatedGrossMargin, opp.probability);

  async function save() {
    try {
      await update.mutateAsync({
        id: opp.id,
        title: form.title,
        description: form.description || null,
        priority: (form.priority || null) as never,
        opportunityType: (form.opportunityType || null) as never,
        source: form.source || null,
        assignedToId: form.assignedToId ?? null,
        estimatorId: form.estimatorId ?? null,
        projectManagerId: form.projectManagerId ?? null,
        communicationPlatform: form.communicationPlatform || null,
        externalReference: form.externalReference || null,
        amount: form.amount === "" ? undefined : Number(form.amount),
        estimatedCost: form.estimatedCost === "" ? null : Number(form.estimatedCost),
        estimatedGrossMargin: form.estimatedGrossMargin === "" ? null : Number(form.estimatedGrossMargin),
        probability: form.probability ?? null,
        bidDueAt: fromDateInput(form.bidDueAt),
        siteVisitAt: fromDateInput(form.siteVisitAt),
        proposalDueAt: fromDateInput(form.proposalDueAt),
        proposalSentAt: fromDateInput(form.proposalSentAt),
        followUpAt: fromDateInput(form.followUpAt),
        expectedCloseAt: fromDateInput(form.expectedCloseAt),
      });
      const before = detail.projectCategories.slice().sort().join(",");
      const after = form.categories.slice().sort().join(",");
      if (before !== after) await setCats.mutateAsync({ id: opp.id, categories: form.categories });
      await invalidate();
      setEditing(false);
      toast({ title: "Saved" });
    } catch {
      /* onError toast already fired */
    }
  }

  const people = salespeople.data ?? [];
  const nameOf = (id: number | null | undefined) => (id == null ? "—" : people.find(p => p.id === id)?.name ?? `#${id}`);

  if (!editing) {
    return (
      <div className="space-y-4">
        {canWrite ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setForm(initial); setEditing(true); }}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
          </div>
        ) : null}

        {opp.description ? <p className="whitespace-pre-wrap text-sm">{opp.description}</p> : <p className="text-sm text-muted-foreground">No description.</p>}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Customer">{detail.customer?.displayName ?? "—"}</Field>
          <Field label="Primary contact">{detail.primaryContact?.displayName ?? "—"}</Field>
          <Field label="Property">{detail.property ? `${detail.property.addressLine1}${detail.property.city ? `, ${detail.property.city}` : ""}` : "—"}</Field>
          <Field label="Type"><TypeBadge type={opp.opportunityType} /></Field>
          <Field label="Source">{opp.source ?? "—"}</Field>
          <Field label="Owner">{nameOf(opp.assignedToId)}</Field>
          <Field label="Estimator">{nameOf(opp.estimatorId)}</Field>
          <Field label="Project manager">{nameOf(opp.projectManagerId)}</Field>
          <Field label="Communication">{opp.communicationPlatform ?? "—"}</Field>
          <Field label="External ref">{opp.externalReference ?? "—"}</Field>
          <Field label="Bid due">{fmtDate(opp.bidDueAt)}</Field>
          <Field label="Site visit">{fmtDate(opp.siteVisitAt)}</Field>
          <Field label="Proposal due">{fmtDate(opp.proposalDueAt)}</Field>
          <Field label="Proposal sent">{fmtDate(opp.proposalSentAt)}</Field>
          <Field label="Follow-up">{fmtDate(opp.followUpAt)}</Field>
          <Field label="Expected close">{fmtDate(opp.expectedCloseAt)}</Field>
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Categories</p>
          {detail.projectCategories.length ? <CategoryChips categories={detail.projectCategories} /> : <span className="text-sm text-muted-foreground">—</span>}
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Additional members</p>
          <MembersSection opportunityId={opp.id} members={detail.members} />
        </div>

        <FinancialCard fin={fin} probability={opp.probability} />
      </div>
    );
  }

  // ── Edit mode ──
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <L label="Title" className="col-span-2"><Input value={form.title} onChange={e => set({ title: e.target.value })} /></L>
        <L label="Description" className="col-span-2"><Textarea value={form.description} onChange={e => set({ description: e.target.value })} rows={3} /></L>

        <L label="Type">
          <Select value={form.opportunityType || NONE} onValueChange={v => set({ opportunityType: v === NONE ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent><SelectItem value={NONE}>—</SelectItem>{OPPORTUNITY_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </L>
        <L label="Priority">
          <Select value={form.priority || NONE} onValueChange={v => set({ priority: v === NONE ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent><SelectItem value={NONE}>—</SelectItem>{OPPORTUNITY_PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
          </Select>
        </L>
        <L label="Source"><Input value={form.source} onChange={e => set({ source: e.target.value })} /></L>
        <L label="Communication"><Input value={form.communicationPlatform} onChange={e => set({ communicationPlatform: e.target.value })} /></L>

        <L label="Owner"><PersonSelect people={people} value={form.assignedToId} onChange={id => set({ assignedToId: id })} /></L>
        <L label="Estimator"><PersonSelect people={people} value={form.estimatorId} onChange={id => set({ estimatorId: id })} /></L>
        <L label="Project manager"><PersonSelect people={people} value={form.projectManagerId} onChange={id => set({ projectManagerId: id })} /></L>
        <L label="External ref"><Input value={form.externalReference} onChange={e => set({ externalReference: e.target.value })} /></L>

        <L label="Estimated value"><Input type="number" value={String(form.amount)} onChange={e => set({ amount: e.target.value })} /></L>
        <L label="Estimated cost"><Input type="number" value={String(form.estimatedCost)} onChange={e => set({ estimatedCost: e.target.value })} /></L>
        <L label="Margin override (optional)"><Input type="number" placeholder="leave blank = calculated" value={String(form.estimatedGrossMargin)} onChange={e => set({ estimatedGrossMargin: e.target.value })} /></L>
        <L label="Probability %"><Input type="number" min={0} max={100} value={form.probability ?? ""} onChange={e => set({ probability: num(e.target.value) })} /></L>

        <L label="Bid due"><Input type="date" value={form.bidDueAt} onChange={e => set({ bidDueAt: e.target.value })} /></L>
        <L label="Site visit"><Input type="date" value={form.siteVisitAt} onChange={e => set({ siteVisitAt: e.target.value })} /></L>
        <L label="Proposal due"><Input type="date" value={form.proposalDueAt} onChange={e => set({ proposalDueAt: e.target.value })} /></L>
        <L label="Proposal sent"><Input type="date" value={form.proposalSentAt} onChange={e => set({ proposalSentAt: e.target.value })} /></L>
        <L label="Follow-up"><Input type="date" value={form.followUpAt} onChange={e => set({ followUpAt: e.target.value })} /></L>
        <L label="Expected close"><Input type="date" value={form.expectedCloseAt} onChange={e => set({ expectedCloseAt: e.target.value })} /></L>
      </div>

      <div>
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Categories</Label>
        <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {PROJECT_CATEGORIES.map(c => {
            const on = form.categories.includes(c.key);
            return (
              <label key={c.key} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={on}
                  onCheckedChange={v => set({ categories: v === true ? [...form.categories, c.key] : form.categories.filter(x => x !== c.key) })}
                />
                {c.label}
              </label>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Note: margin override is optional — leave blank to use the calculated value ({fmtMoney(fin.calculatedMargin)}).</p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        <Button disabled={update.isPending || setCats.isPending || !form.title.trim()} onClick={save}>{update.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

function L({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function PersonSelect({ people, value, onChange }: { people: { id: number; name: string }[]; value: number | null | undefined; onChange: (id: number | null) => void }) {
  return (
    <Select value={value == null ? NONE : String(value)} onValueChange={v => onChange(v === NONE ? null : Number(v))}>
      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent><SelectItem value={NONE}>Unassigned</SelectItem>{people.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
