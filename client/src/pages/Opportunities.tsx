/**
 * /opportunities — the Opportunity Center (v2).
 * One center, three views: Overview (KPIs), Pipeline (Kanban), and All
 * Opportunities (table). QuickBooks is the source of truth for sales documents
 * and the QuickBooks Amount; Mechanical Enterprise owns pipeline stage, CRM
 * value, follow-ups, assignments and closing analytics. A manual "Sync
 * QuickBooks Now" pulls estimates/proposals + related customers.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, RefreshCw } from "lucide-react";
import OverviewTab from "@/components/opportunity/OverviewTab";
import PipelineBoard from "@/components/opportunity/PipelineBoard";
import AllOpportunitiesTab from "@/components/opportunity/AllOpportunitiesTab";
import OpportunityDetailDrawer from "@/components/opportunity/OpportunityDetailDrawer";

export default function Opportunities() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState("overview");
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: stats } = trpc.opportunities.stats.useQuery();

  const sync = trpc.quickbooks.syncSalesDocumentsNow.useMutation({
    onSuccess: res => {
      toast({
        title: "QuickBooks sync complete",
        description: `Pulled ${res.pulled} · new ${res.created} · updated ${res.updated} · new contacts ${res.contactsCreated} · new opportunities ${res.opportunitiesCreated}`,
      });
      utils.opportunities.list.invalidate();
      utils.opportunities.stats.invalidate();
      utils.opportunities.overview.invalidate();
    },
    onError: err => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const total = stats?.total ?? 0;
  const open = (stats?.byStage?.new ?? 0) + (stats?.byStage?.proposal_sent ?? 0) + (stats?.byStage?.pending ?? 0);

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileText className="h-6 w-6 text-[#1e3a5f]" /> Opportunity Center
            </h1>
            <p className="text-sm text-muted-foreground">
              {open} open · {total} total. QuickBooks is the source of truth for estimates &amp; amounts.
            </p>
          </div>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
            <RefreshCw className={`mr-2 h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
            {sync.isPending ? "Syncing…" : "Sync QuickBooks Now"}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="all">All Opportunities</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-4">
            <PipelineBoard onOpen={setDetailId} />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <AllOpportunitiesTab onOpen={setDetailId} />
          </TabsContent>
        </Tabs>
      </div>

      <OpportunityDetailDrawer id={detailId} open={detailId != null} onClose={() => setDetailId(null)} />
    </DashboardLayout>
  );
}
