/**
 * /opportunities/commercial — Bid Board: bids being prepared, first look → estimate.
 * A dedicated Kanban of the commercial pipeline (opportunityStages, pipelineKey=
 * 'commercial'), filtered to recordType='commercial'. Cards open the shared
 * Opportunity detail drawer (which renders the commercial sections). Stage
 * administration, project-type labels, task assignment and file upload are out
 * of scope here (later phases).
 */
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowLeft, Columns3, Plus } from "lucide-react";
import CommercialBoard from "@/components/opportunity/commercial/CommercialBoard";
import ColumnManager from "@/components/opportunity/commercial/ColumnManager";
import NewBidDialog from "@/components/opportunity/commercial/NewBidDialog";
import OpportunityDetailDrawer from "@/components/opportunity/OpportunityDetailDrawer";

export default function CommercialOpportunities() {
  const [detailId, setDetailId] = useState<number | null>(null);
  const [newBidOpen, setNewBidOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  // Deep-link support: /opportunities/commercial?opportunityId=42 opens that drawer.
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
              <Briefcase className="h-6 w-6 text-[#1e3a5f]" /> Bid Board
            </h1>
            <p className="text-sm text-muted-foreground">
              Commercial pipeline stages. Drag a card between stages to move it; closing goes through the card's detail drawer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setNewBidOpen(true)} className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
              <Plus className="mr-2 h-4 w-4" /> New Bid
            </Button>
            <Button variant="outline" onClick={() => setColumnsOpen(true)}>
              <Columns3 className="mr-2 h-4 w-4" /> Columns
            </Button>
            <Link href="/opportunities/residential">
              <Button variant="outline">Residential</Button>
            </Link>
            <Link href="/opportunities">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Opportunity Center
              </Button>
            </Link>
          </div>
        </div>

        <CommercialBoard onOpen={setDetailId} />
      </div>

      <ColumnManager open={columnsOpen} onOpenChange={setColumnsOpen} pipelineKey="commercial" />
      <NewBidDialog open={newBidOpen} onOpenChange={setNewBidOpen} onCreated={id => setDetailId(id)} />
      <OpportunityDetailDrawer id={detailId} open={detailId != null} onClose={() => setDetailId(null)} />
    </DashboardLayout>
  );
}
