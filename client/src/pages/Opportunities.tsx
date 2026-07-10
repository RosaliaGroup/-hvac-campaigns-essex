/**
 * /opportunities — the Opportunity Center.
 * Surfaces QuickBooks Estimates/Proposals mirrored into Mechanical CRM as
 * opportunities, with a manual "Sync QuickBooks Now" trigger. Read-only over
 * QuickBooks data (QBO stays the source of truth); actions live on the detail
 * view. Structure mirrors pages/Jobs.tsx.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { FileText, RefreshCw, Search } from "lucide-react";
import { formatMoney } from "@/lib/jobPresentation";
import { deriveWorkCategory, workCategoryLabel, deriveDocTypeLabel, type WorkCategory } from "@shared/opportunityCategory";

/** Primary work-category badge styling (large badge). */
const WORK_CATEGORY_BADGE: Record<WorkCategory, string> = {
  residential: "bg-sky-100 text-sky-800 border-sky-200",
  commercial: "bg-violet-100 text-violet-800 border-violet-200",
  change_order: "bg-orange-100 text-orange-800 border-orange-200",
};

const STAGE_META: { value: string; label: string; badge: string }[] = [
  { value: "new", label: "New", badge: "bg-slate-100 text-slate-700" },
  { value: "proposal_sent", label: "Proposal Sent", badge: "bg-blue-100 text-blue-700" },
  { value: "pending", label: "Pending", badge: "bg-amber-100 text-amber-700" },
  { value: "won", label: "Won", badge: "bg-green-100 text-green-700" },
  { value: "lost", label: "Lost", badge: "bg-red-100 text-red-700" },
];

const DOC_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  closed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-slate-200 text-slate-600",
};

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Opportunities() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: stats } = trpc.opportunities.stats.useQuery();
  const { data, isLoading } = trpc.opportunities.list.useQuery({
    search: search || undefined,
    stage: stageFilter === "all" ? undefined : (stageFilter as never),
    limit: 200,
    offset: 0,
  });

  const sync = trpc.quickbooks.syncSalesDocumentsNow.useMutation({
    onSuccess: res => {
      toast({
        title: "QuickBooks sync complete",
        description: `Pulled ${res.pulled} · new ${res.created} · updated ${res.updated} · new contacts ${res.contactsCreated} · new opportunities ${res.opportunitiesCreated}`,
      });
      utils.opportunities.list.invalidate();
      utils.opportunities.stats.invalidate();
    },
    onError: err =>
      toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const byStage = stats?.byStage ?? {};
  const total = stats?.total ?? 0;

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-[#1e3a5f]" /> Opportunity Center
            </h1>
            <p className="text-sm text-muted-foreground">
              QuickBooks estimates &amp; proposals from the last 60 days — {total} opportunit{total === 1 ? "y" : "ies"}. QuickBooks is the source of truth.
            </p>
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
            <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Syncing…" : "Sync QuickBooks Now"}
          </Button>
        </div>

        {/* Stage chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStageFilter("all")}
            className={`text-xs px-2.5 py-1 rounded-full border ${stageFilter === "all" ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white hover:bg-muted"}`}
          >
            All ({total})
          </button>
          {STAGE_META.map(m => (
            <button
              key={m.value}
              onClick={() => setStageFilter(stageFilter === m.value ? "all" : m.value)}
              className={`text-xs px-2.5 py-1 rounded-full border ${stageFilter === m.value ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white hover:bg-muted"}`}
            >
              {m.label} ({byStage[m.value] ?? 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customer or document #…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading opportunities…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No opportunities yet. Click "Sync QuickBooks Now" to pull estimates from the last 60 days.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Work / Document</TableHead>
                    <TableHead>Doc #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Days pending</TableHead>
                    <TableHead>Next action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(row => {
                    const stageMeta = STAGE_META.find(m => m.value === row.stage);
                    // Single source of truth: the shared classifier. Primary badge
                    // = work category; secondary = unchanged QBO document type.
                    const category = deriveWorkCategory(
                      {
                        docType: row.docType,
                        docNumber: row.docNumber,
                        text: row.categoryText,
                        linkedToExistingJob: row.linkedToExistingJob,
                      },
                      { type: row.customerType, companyName: row.customerCompany, displayName: row.customerName },
                    );
                    const docLabel = deriveDocTypeLabel({ docType: row.docType, text: row.categoryText });
                    return (
                      <TableRow key={row.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium max-w-xs truncate">{row.customerName ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 ${WORK_CATEGORY_BADGE[category]}`}>
                              {workCategoryLabel(category)}
                            </Badge>
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{docLabel}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.docNumber ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(Number(row.docAmount ?? row.amount ?? 0))}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={row.docStatus ? DOC_STATUS_BADGE[row.docStatus] ?? "" : stageMeta?.badge ?? ""}>
                            {row.docStatus ?? stageMeta?.label ?? row.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(row.sentAt)}</TableCell>
                        <TableCell className="text-right text-sm">{row.daysPending ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{row.nextAction ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
