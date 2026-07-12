import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConvertToJobControl } from "@/components/opportunity/ConvertToJobControl";
import { formatMoney } from "@/lib/jobPresentation";
import { ArrowLeft, Target, FileText, Hash, Tag, UserRound, MapPin, Calendar } from "lucide-react";

function fmt(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const OPP_STAGE: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  proposal_sent: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};
const DOC_STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

/**
 * Opportunity detail — the destination for opportunity/estimate rows on the
 * customer profile. Read-only view of the CRM opportunity and its backing
 * QuickBooks sales documents (estimates). No writes here.
 */
export default function OpportunityDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.opportunities.get.useQuery({ id }, { enabled: id > 0, retry: false });

  if (isLoading) {
    return <DashboardLayout><InternalNav /><p className="p-8 text-sm text-muted-foreground">Loading opportunity…</p></DashboardLayout>;
  }
  if (!data) {
    return (
      <DashboardLayout><InternalNav />
        <div className="p-8 space-y-3">
          <p className="text-sm text-muted-foreground">Opportunity not found.</p>
          <Button variant="outline" onClick={() => navigate("/opportunities")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Opportunities</Button>
        </div>
      </DashboardLayout>
    );
  }

  const { opportunity: o, customer, serviceAddresses, salesDocuments } = data;
  const primaryAddress = serviceAddresses?.[0]
    ? [serviceAddresses[0].addressLine1, serviceAddresses[0].city, serviceAddresses[0].state, serviceAddresses[0].zip].filter(Boolean).join(", ")
    : null;

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6 mx-auto max-w-4xl">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/opportunities")} className="-ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" /> Opportunities
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6 text-[#1e3a5f]" /> {o.title}</h1>
            {/* Same Opportunity → Job control as the detail drawer. */}
            <ConvertToJobControl opportunityId={id} primaryJob={data.primaryJob} onConverted={() => utils.opportunities.get.invalidate({ id })} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className={OPP_STAGE[o.stage] ?? ""}>{o.stage.replace(/_/g, " ")}</Badge>
            {o.projectReference && <span className="inline-flex items-center gap-1 text-muted-foreground"><Tag className="h-3.5 w-3.5" /> {o.projectReference}</span>}
            {customer && (
              <button className="inline-flex items-center gap-1 text-[#1e3a5f] hover:underline" onClick={() => navigate(`/customers/${customer.id}`)}>
                <UserRound className="h-3.5 w-3.5" /> {customer.displayName}
              </button>
            )}
            {primaryAddress && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {primaryAddress}</span>}
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">CRM Value</div><div className="text-lg font-bold text-[#1e3a5f]">{formatMoney(Number(o.opportunityValue ?? o.amount))}</div></div>
            <div><div className="text-xs text-muted-foreground">QuickBooks Amount</div><div className="text-lg font-bold">{o.quickbooksAmount != null ? formatMoney(Number(o.quickbooksAmount)) : "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Created</div><div className="font-medium">{fmt(o.createdAt)}</div></div>
            <div><div className="text-xs text-muted-foreground">Closed</div><div className="font-medium">{fmt(o.closedAt)}</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-[#1e3a5f]" /> Estimates / Proposals ({salesDocuments.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {salesDocuments.length === 0 ? <p className="text-sm text-muted-foreground">No QuickBooks documents linked.</p> :
              salesDocuments.map(d => (
                <div key={d.id} className="flex items-start justify-between gap-3 border rounded-lg p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.docNumber ? `#${d.docNumber}` : `QBO ${d.quickbooksId}`}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmt(d.txnDate)}</span>
                      <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> QBO {d.docType === "invoice" ? "Invoice" : "Estimate"} {d.quickbooksId}</span>
                      {d.quickbooksCustomerId && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> QBO Customer {d.quickbooksCustomerId}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="secondary" className={DOC_STATUS[d.status] ?? ""}>{d.status}</Badge>
                    <span className="font-semibold">{formatMoney(Number(d.totalAmount))}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
