/**
 * Commercial list — server-paginated, server-sorted table. It never loads the
 * whole dataset: it requests one page at a time and sorts on the server.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildCommercialListInput, fmtMoney, fmtEstimatedValue, fmtDate, financialView, type CommercialFilters, type CommercialView,
} from "@/lib/commercialOpportunities";
import { PriorityBadge, StatusBadge, opportunityTypeLabel } from "./shared";

const PAGE_SIZE = 25;

const SORTABLE: { key: string; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "amount", label: "Value" },
  { key: "probability", label: "Prob." },
  { key: "bidDueAt", label: "Bid Due" },
  { key: "followUpAt", label: "Follow-up" },
  { key: "expectedCloseAt", label: "Exp. Close" },
];

export default function CommercialList({ view, filters, onOpen }: { view: CommercialView; filters: CommercialFilters; onOpen: (id: number) => void }) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const q = trpc.opportunities.commercial.list.useQuery(
    buildCommercialListInput(view, filters, { sortBy, sortDir, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  );

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("desc"); }
    setPage(0);
  };

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (q.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-red-600">Couldn’t load opportunities.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>Retry</Button>
      </div>
    );
  }
  if (!items.length) return <p className="py-10 text-center text-sm text-muted-foreground">No opportunities match these filters.</p>;

  const Sortable = ({ k, label }: { k: string; label: string }) => (
    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
      {label} <ArrowUpDown className={`h-3 w-3 ${sortBy === k ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead><Sortable k="title" label="Title" /></TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Estimator</TableHead>
              <TableHead className="text-right"><Sortable k="amount" label="Value" /></TableHead>
              <TableHead className="text-right">Gross Margin</TableHead>
              <TableHead className="text-right"><Sortable k="probability" label="Prob." /></TableHead>
              <TableHead className="text-right">Weighted</TableHead>
              <TableHead><Sortable k="bidDueAt" label="Bid Due" /></TableHead>
              <TableHead><Sortable k="followUpAt" label="Follow-up" /></TableHead>
              <TableHead><Sortable k="expectedCloseAt" label="Exp. Close" /></TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(r => {
              const fin = financialView(r.amount, r.estimatedCost, r.estimatedGrossMargin, r.probability);
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r.id)}>
                  <TableCell className="font-mono text-xs">{r.opportunityNumber ?? `OPP-${r.id}`}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-medium">{r.title}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{r.customerCompany || r.customerName}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                    {r.propertyAddress ? `${r.propertyAddress}${r.propertyCity ? `, ${r.propertyCity}` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.opportunityType ? opportunityTypeLabel(r.opportunityType) : "—"}</TableCell>
                  <TableCell className="text-xs">{(r.categoriesList ?? []).map(c => c.replace(/_/g, " ")).join(", ") || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.stageName ?? "—"}</Badge></TableCell>
                  <TableCell><PriorityBadge priority={r.priority} /></TableCell>
                  <TableCell className="text-xs">{r.ownerName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.estimatorName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtEstimatedValue(r.amount, "Not estimated")}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fin.effectiveMargin != null ? fmtMoney(fin.effectiveMargin) : "—"}
                    {fin.marginIsOverridden ? <Badge variant="secondary" className="ml-1 text-[9px]">override</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.probability != null ? `${r.probability}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fin.weightedValue != null ? fmtMoney(fin.weightedValue) : "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.bidDueAt)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.followUpAt)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.expectedCloseAt)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.updatedAt)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} opportunit{total === 1 ? "y" : "ies"}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span>Page {page + 1} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
