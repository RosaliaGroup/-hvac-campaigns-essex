/**
 * Commercial board/list filter bar. Edits the shared `CommercialFilters` state
 * that the board and list pass to the server via buildCommercialListInput — all
 * filtering is server-side (the browser never filters a full dataset locally).
 */
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { OPPORTUNITY_TYPES, PROJECT_CATEGORIES, OPPORTUNITY_PRIORITIES } from "@shared/commercialPipeline";
import type { CommercialFilters } from "@/lib/commercialOpportunities";

const ANY = "__any__";

export default function CommercialFiltersBar({ filters, onChange }: { filters: CommercialFilters; onChange: (f: CommercialFilters) => void }) {
  const salespeople = trpc.opportunities.salespeople.useQuery();
  const stages = trpc.opportunities.commercial.stages.list.useQuery();

  const set = (patch: Partial<CommercialFilters>) => onChange({ ...filters, ...patch });
  const single = (v: number[] | undefined) => (v && v.length ? String(v[0]) : ANY);
  const asArr = (v: string) => (v === ANY ? undefined : [Number(v)]);

  const activeCount = Object.values(filters).filter(v => (Array.isArray(v) ? v.length : v !== undefined && v !== "" && v !== false)).length;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      <Input
        placeholder="Search title, number, customer…"
        value={filters.search ?? ""}
        onChange={e => set({ search: e.target.value })}
        className="h-9 w-full sm:w-56"
      />

      <Select value={single(filters.stageId)} onValueChange={v => set({ stageId: asArr(v) })}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Stage" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any stage</SelectItem>
          {(stages.data ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.opportunityType?.[0] ?? ANY} onValueChange={v => set({ opportunityType: v === ANY ? undefined : [v] })}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any type</SelectItem>
          {OPPORTUNITY_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.projectCategories?.[0] ?? ANY} onValueChange={v => set({ projectCategories: v === ANY ? undefined : [v] })}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any category</SelectItem>
          {PROJECT_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.priority?.[0] ?? ANY} onValueChange={v => set({ priority: v === ANY ? undefined : [v as "low" | "normal" | "high" | "urgent"] })}>
        <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any priority</SelectItem>
          {OPPORTUNITY_PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={single(filters.assignedToId)} onValueChange={v => set({ assignedToId: asArr(v) })}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Owner" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any owner</SelectItem>
          {(salespeople.data ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={single(filters.estimatorId)} onValueChange={v => set({ estimatorId: asArr(v) })}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Estimator" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any estimator</SelectItem>
          {(salespeople.data ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Input placeholder="City" value={filters.city ?? ""} onChange={e => set({ city: e.target.value })} className="h-9 w-28" />
      <Input placeholder="State" value={filters.state ?? ""} onChange={e => set({ state: e.target.value })} className="h-9 w-20" />

      <Input type="number" placeholder="Min $" value={filters.valueMin ?? ""} onChange={e => set({ valueMin: e.target.value ? Number(e.target.value) : undefined })} className="h-9 w-24" />
      <Input type="number" placeholder="Max $" value={filters.valueMax ?? ""} onChange={e => set({ valueMax: e.target.value ? Number(e.target.value) : undefined })} className="h-9 w-24" />

      <Select value={filters.wonLostOpen?.[0] ?? ANY} onValueChange={v => set({ wonLostOpen: v === ANY ? undefined : [v as "open" | "won" | "lost"] })}>
        <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Outcome" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Open/Won/Lost</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="won">Won</SelectItem>
          <SelectItem value="lost">Lost</SelectItem>
        </SelectContent>
      </Select>

      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={!!filters.overdue} onCheckedChange={c => set({ overdue: c === true ? true : undefined })} /> Overdue
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={!!filters.followUpDue} onCheckedChange={c => set({ followUpDue: c === true ? true : undefined })} /> Follow-up due
      </label>

      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange({})}>
          <X className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      ) : null}
      <Label className="sr-only">Active filters: {activeCount}</Label>
    </div>
  );
}
