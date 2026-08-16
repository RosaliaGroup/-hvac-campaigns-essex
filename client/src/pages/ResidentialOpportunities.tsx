/**
 * /opportunities/residential — Residential Board.
 *
 * The same Kanban component as the commercial board, over a separate set of columns
 * (opportunityStages, pipelineKey='residential') and filtered to recordType='residential'.
 * Keeping them as two pipelines rather than one mixed board means residential stages
 * ("Assessment Scheduled", "Sales Doc Created") stop appearing on commercial bids and
 * vice versa.
 *
 * The residential pipeline starts with no columns — use Columns to create them. An empty
 * board is deliberate: nobody's guessed stage names are better than yours.
 */
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Columns3 } from "lucide-react";
import CommercialBoard from "@/components/opportunity/commercial/CommercialBoard";
import ColumnManager from "@/components/opportunity/commercial/ColumnManager";
import OpportunityDetailDrawer from "@/components/opportunity/OpportunityDetailDrawer";

export default function ResidentialOpportunities() {
  const [detailId, setDetailId] = useState<number | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Deep-link support: /opportunities/residential?opportunityId=42 opens that drawer.
  const search = useSearch();
  useEffect(() => {
    const raw = new URLSearchParams(search).get("opportunityId");
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) setDetailId(parsed);
  }, [search]);

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Home className="h-6 w-6 text-[#1e3a5f]" /> Residential Board
            </h1>
            <p className="text-sm text-muted-foreground">
              Residential pipeline stages. Drag a card between stages to move it; closing goes through the card's detail drawer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setColumnsOpen(true)}>
              <Columns3 className="mr-2 h-4 w-4" /> Columns
            </Button>
            <Link href="/opportunities/commercial">
              <Button variant="outline">Commercial</Button>
            </Link>
            <Link href="/opportunities">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Opportunity Center
              </Button>
            </Link>
          </div>
        </div>

        <CommercialBoard onOpen={setDetailId} pipelineKey="residential" recordType="residential" />
      </div>

      <ColumnManager open={columnsOpen} onOpenChange={setColumnsOpen} pipelineKey="residential" />
      <OpportunityDetailDrawer id={detailId} open={detailId != null} onClose={() => setDetailId(null)} />
    </DashboardLayout>
  );
}
