/**
 * All Opportunities — responsive table (cards on mobile) with server-side
 * search, sortable columns, combinable + resettable filters (in a drawer),
 * pagination, and a filtered pipeline total.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Search, SlidersHorizontal, ChevronUp, ChevronDown, ChevronRight } from "lucide-react";
import {
  STAGE_META, DOC_STATUS_BADGE, AGING_BADGE, WorkCategoryBadge, StageBadge, fmtMoney, fmtDate, type OppRow,
} from "./shared";
import { AGING_BUCKETS, type SortKey } from "@shared/opportunityDashboard";
import { workCategoryLabel, type WorkCategory } from "@shared/opportunityCategory";

const PAGE_SIZE = 25;
const CATEGORIES: WorkCategory[] = ["residential", "commercial", "change_order"];
const DOC_STATUSES = ["pending", "accepted", "closed", "rejected", "expired"] as const;

type Filters = {
  workCategory: WorkCategory[];
  stages: (typeof STAGE_META)[number]["value"][];
  docStatus: (typeof DOC_STATUSES)[number][];
  docTypeLabel: ("estimate" | "proposal")[];
  wonLostOpen: ("won" | "lost" | "open")[];
  agingBucket: (typeof AGING_BUCKETS)[number][];
  assignedToId: number[];
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  followUpDue: boolean;
};

const EMPTY: Filters = {
  workCategory: [], stages: [], docStatus: [], docTypeLabel: [], wonLostOpen: [],
  agingBucket: [], assignedToId: [], followUpDue: false,
};

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
}

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-[#1e3a5f] bg-[#1e3a5f] text-white" : `bg-background hover:bg-muted ${className ?? ""}`}`}
    >
      {children}
    </button>
  );
}

const SORT_COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "workCategory", label: "Work" },
  { key: "amount", label: "Value", className: "text-right" },
  { key: "stage", label: "Stage" },
  { key: "docStatus", label: "QBO status" },
  { key: "sentAt", label: "Sent" },
  { key: "daysPending", label: "Days", className: "text-right" },
  { key: "nextFollowUp", label: "Next follow-up" },
];

export default function AllOpportunitiesTab({ onOpen }: { onOpen: (id: number) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: salespeople } = trpc.opportunities.salespeople.useQuery();
  const spName = useMemo(() => Object.fromEntries((salespeople ?? []).map(s => [s.id, s.name])), [salespeople]);

  const { data, isLoading } = trpc.opportunities.list.useQuery({
    search: search || undefined,
    stages: filters.stages.length ? filters.stages : undefined,
    docStatus: filters.docStatus.length ? filters.docStatus : undefined,
    workCategory: filters.workCategory.length ? filters.workCategory : undefined,
    docTypeLabel: filters.docTypeLabel.length ? filters.docTypeLabel : undefined,
    wonLostOpen: filters.wonLostOpen.length ? filters.wonLostOpen : undefined,
    agingBucket: filters.agingBucket.length ? filters.agingBucket : undefined,
    assignedToId: filters.assignedToId.length ? filters.assignedToId : undefined,
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    followUpDue: filters.followUpDue || undefined,
    sortBy, sortDir, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
  });

  const rows = (data?.items ?? []) as unknown as OppRow[];
  const total = data?.total ?? 0;
  const totals = data?.totals ?? { count: 0, totalValue: 0, weightedValue: 0, quickbooksTotal: 0 };
  const activeFilterCount =
    filters.workCategory.length + filters.stages.length + filters.docStatus.length + filters.docTypeLabel.length +
    filters.wonLostOpen.length + filters.agingBucket.length + filters.assignedToId.length +
    (filters.amountMin != null ? 1 : 0) + (filters.amountMax != null ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0) + (filters.followUpDue ? 1 : 0);

  const changeSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(key === "amount" || key === "daysPending" ? "desc" : "asc"); }
    setPage(0);
  };
  const set = (patch: Partial<Filters>) => { setFilters(f => ({ ...f, ...patch })); setPage(0); };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, company, phone, email, doc #, service, amount…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-8"
          />
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {activeFilterCount > 0 ? <Badge className="ml-1 bg-[#1e3a5f]">{activeFilterCount}</Badge> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-5 text-sm">
              <FilterGroup label="Work category">
                {CATEGORIES.map(c => (
                  <Chip key={c} active={filters.workCategory.includes(c)} onClick={() => set({ workCategory: toggle(filters.workCategory, c) })}>{workCategoryLabel(c)}</Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="Document">
                {(["estimate", "proposal"] as const).map(d => (
                  <Chip key={d} active={filters.docTypeLabel.includes(d)} onClick={() => set({ docTypeLabel: toggle(filters.docTypeLabel, d) })}>{d[0].toUpperCase() + d.slice(1)}</Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="Stage">
                {STAGE_META.map(s => (
                  <Chip key={s.value} active={filters.stages.includes(s.value)} onClick={() => set({ stages: toggle(filters.stages, s.value) })}>{s.label}</Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="QuickBooks status">
                {DOC_STATUSES.map(s => (
                  <Chip key={s} active={filters.docStatus.includes(s)} onClick={() => set({ docStatus: toggle(filters.docStatus, s) })}>{s}</Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="Outcome">
                {(["open", "won", "lost"] as const).map(s => (
                  <Chip key={s} active={filters.wonLostOpen.includes(s)} onClick={() => set({ wonLostOpen: toggle(filters.wonLostOpen, s) })}>{s}</Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="Aging bucket">
                {AGING_BUCKETS.map(b => (
                  <Chip key={b} active={filters.agingBucket.includes(b)} onClick={() => set({ agingBucket: toggle(filters.agingBucket, b) })}>{b} days</Chip>
                ))}
              </FilterGroup>
              {salespeople && salespeople.length > 0 ? (
                <FilterGroup label="Salesperson">
                  {salespeople.map(s => (
                    <Chip key={s.id} active={filters.assignedToId.includes(s.id)} onClick={() => set({ assignedToId: toggle(filters.assignedToId, s.id) })}>{s.name}</Chip>
                  ))}
                </FilterGroup>
              ) : null}
              <div>
                <p className="mb-1 font-medium">Amount range</p>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder="Min" value={filters.amountMin ?? ""} onChange={e => set({ amountMin: e.target.value ? Number(e.target.value) : undefined })} />
                  <span className="text-muted-foreground">–</span>
                  <Input type="number" placeholder="Max" value={filters.amountMax ?? ""} onChange={e => set({ amountMax: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
              <div>
                <p className="mb-1 font-medium">Date range (sent/issued)</p>
                <div className="flex items-center gap-2">
                  <Input type="date" value={filters.dateFrom ?? ""} onChange={e => set({ dateFrom: e.target.value || undefined })} />
                  <span className="text-muted-foreground">–</span>
                  <Input type="date" value={filters.dateTo ?? ""} onChange={e => set({ dateTo: e.target.value || undefined })} />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={filters.followUpDue} onChange={e => set({ followUpDue: e.target.checked })} />
                Follow-up due today
              </label>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setFilters(EMPTY); setPage(0); }}>Reset all</Button>
                <Button className="flex-1 bg-[#1e3a5f]" onClick={() => setFiltersOpen(false)}>Show {total}</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filtered totals */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span><span className="text-muted-foreground">Results:</span> <b className="tabular-nums">{total}</b></span>
        <span><span className="text-muted-foreground">Pipeline value:</span> <b className="tabular-nums">{fmtMoney(totals.totalValue)}</b></span>
        <span><span className="text-muted-foreground">Weighted:</span> <b className="tabular-nums">{fmtMoney(totals.weightedValue)}</b></span>
        <span><span className="text-muted-foreground">QuickBooks total:</span> <b className="tabular-nums">{fmtMoney(totals.quickbooksTotal)}</b></span>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No opportunities match these filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {SORT_COLUMNS.map(col => (
                    <TableHead key={col.key} className={`cursor-pointer select-none ${col.className ?? ""}`} onClick={() => changeSort(col.key)}>
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortBy === col.key ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpen(r.id)}>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate font-medium">{r.customerCompany || r.customerName}</p>
                      {r.assignedToId ? <p className="truncate text-xs text-muted-foreground">{spName[r.assignedToId] ?? "Assigned"}</p> : null}
                    </TableCell>
                    <TableCell><WorkCategoryBadge category={r.workCategory} /></TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium tabular-nums">{fmtMoney(r.amount)}</span>
                      {r.valueDiffersFromQuickbooks ? <span className="block text-[10px] text-amber-600">≠ QBO</span> : null}
                    </TableCell>
                    <TableCell><StageBadge stage={r.stage} /></TableCell>
                    <TableCell>{r.docStatus ? <Badge variant="secondary" className={DOC_STATUS_BADGE[r.docStatus] ?? ""}>{r.docStatus}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.sentAt)}</TableCell>
                    <TableCell className="text-right">
                      {r.daysPending != null ? <span className={`rounded px-1.5 py-0.5 text-xs ${r.agingBucket ? AGING_BADGE[r.agingBucket] : ""}`}>{r.daysPending}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.nextActionDueAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No opportunities match these filters.</p>
        ) : rows.map(r => (
          <button key={r.id} onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.customerCompany || r.customerName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <WorkCategoryBadge category={r.workCategory} />
                <StageBadge stage={r.stage} />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{r.nextAction ?? (r.docNumber ? `${r.docTypeLabel} #${r.docNumber}` : "")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-bold tabular-nums">{fmtMoney(r.amount)}</p>
              {r.daysPending != null ? <p className="text-[11px] text-muted-foreground">{r.daysPending}d</p> : null}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total === 0 ? "0" : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)}`} of {total}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
