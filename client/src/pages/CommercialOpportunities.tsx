/**
 * /commercial-opportunities — the Commercial Opportunities workspace. Extends the
 * Sales area WITHOUT touching the legacy Opportunity Center (/opportunities):
 * every query is scoped to recordType=commercial. Six sub-views (Board / All /
 * My / Follow-ups / Won / Lost) share one filter state; the board and list are
 * server-driven; a right-side drawer is the master project record.
 */
import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus } from "lucide-react";
import { COMMERCIAL_VIEWS, isCommercialView, type CommercialView, type CommercialFilters } from "@/lib/commercialOpportunities";
import CommercialFiltersBar from "@/components/opportunity/commercial/CommercialFilters";
import CommercialBoard from "@/components/opportunity/commercial/CommercialBoard";
import CommercialList from "@/components/opportunity/commercial/CommercialList";
import CommercialDetailDrawer from "@/components/opportunity/commercial/CommercialDetailDrawer";
import CreateCommercialDialog from "@/components/opportunity/commercial/CreateCommercialDialog";
import { useCommercialPerms } from "@/components/opportunity/commercial/shared";

export default function CommercialOpportunities() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { canWrite } = useCommercialPerms();
  const [view, setView] = useState<CommercialView>("board");
  const [filters, setFilters] = useState<CommercialFilters>({});
  const [detailId, setDetailId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Sync ?view= and ?opportunityId= for deep links / shareable URLs.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const v = params.get("view");
    if (isCommercialView(v)) setView(v);
    const oid = params.get("opportunityId");
    const parsed = oid ? Number(oid) : NaN;
    if (Number.isFinite(parsed)) setDetailId(parsed);
  }, [search]);

  const changeView = (v: string) => {
    setView(v as CommercialView);
    navigate(`/commercial-opportunities?view=${v}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Building2 className="h-6 w-6 text-[#1e3a5f]" /> Commercial Opportunities
            </h1>
            <p className="text-sm text-muted-foreground">Trello-style commercial bidding &amp; project pipeline.</p>
          </div>
          {canWrite ? (
            <Button onClick={() => setCreating(true)} className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
              <Plus className="mr-2 h-4 w-4" /> New Commercial Opportunity
            </Button>
          ) : null}
        </div>

        <Tabs value={view} onValueChange={changeView}>
          <TabsList className="flex-wrap">
            {COMMERCIAL_VIEWS.map(v => <TabsTrigger key={v.key} value={v.key}>{v.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <CommercialFiltersBar filters={filters} onChange={setFilters} />

        {view === "board" ? (
          <CommercialBoard filters={filters} onOpen={setDetailId} />
        ) : (
          <CommercialList view={view} filters={filters} onOpen={setDetailId} />
        )}
      </div>

      <CommercialDetailDrawer id={detailId} open={detailId != null} onClose={() => setDetailId(null)} />
      <CreateCommercialDialog open={creating} onOpenChange={setCreating} onCreated={setDetailId} />
    </DashboardLayout>
  );
}
