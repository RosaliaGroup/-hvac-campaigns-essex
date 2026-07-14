/**
 * Structured Convert-to-Job panel. Runs the server validation preview
 * (convertToJobValidate) and only enables conversion when canConvert is true.
 * Conversion reuses the linked customer/property/estimate and never creates
 * them. Idempotent: if a Job already exists it is shown (and repeated requests
 * return it).
 */
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Briefcase, ArrowRight } from "lucide-react";
import { conversionCheckRows } from "@/lib/commercialOpportunities";
import { useCommercialPerms } from "./shared";

export default function ConvertToJobPanel({ opportunityId }: { opportunityId: number }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();

  const validation = trpc.opportunities.commercial.convertToJobValidate.useQuery({ id: opportunityId });
  const convert = trpc.opportunities.convertToJob.useMutation({
    onSuccess: res => {
      utils.opportunities.commercial.get.invalidate({ id: opportunityId });
      utils.opportunities.commercial.convertToJobValidate.invalidate({ id: opportunityId });
      utils.opportunities.commercial.list.invalidate();
      if ("ok" in res && res.ok) {
        toast({ title: res.alreadyConverted ? "Job already exists" : "Converted to Job", description: res.jobNumber });
      } else if ("reason" in res && res.reason === "property_selection_required") {
        toast({ title: "Select a property", description: "This customer has multiple properties — choose one first.", variant: "destructive" });
      }
    },
    onError: err => toast({ title: "Conversion failed", description: err.message, variant: "destructive" }),
  });

  if (validation.isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Checking conversion readiness…</p>;
  if (validation.isError) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-red-600">Couldn’t run validation.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => validation.refetch()}>Retry</Button>
      </div>
    );
  }

  const v = validation.data!;
  const rows = conversionCheckRows(v);

  // Already converted → show the existing Job (idempotent).
  if (v.alreadyConverted && v.existingJob) {
    return (
      <div className="rounded-lg border bg-green-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-green-800">
          <Briefcase className="h-4 w-4" /> This opportunity has been converted.
        </p>
        <Link href={`/jobs/${v.existingJob.id}`}>
          <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1e3a5f] hover:underline">
            {v.existingJob.jobNumber} <Badge variant="secondary" className="capitalize">{v.existingJob.status}</Badge> <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 rounded-lg border p-3">
        {rows.map(r => (
          <li key={r.key} className="flex items-start gap-2 text-sm">
            {r.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
            <span>
              <span className={r.ok ? "" : "font-medium text-red-700"}>{r.label}</span>
              {r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {v.reuse ? (
        <p className="text-xs text-muted-foreground">
          Reuses customer #{v.reuse.customerId ?? "—"}
          {v.reuse.propertyId ? `, property #${v.reuse.propertyId}` : ""}
          {v.reuse.estimateId ? `, estimate #${v.reuse.estimateId}` : ""}. No customer, property, or estimate is created.
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={!v.canConvert || !canWrite || convert.isPending}
        onClick={() => convert.mutate({ id: opportunityId })}
      >
        {convert.isPending ? "Converting…" : v.canConvert ? "Convert to Job" : "Resolve the items above to convert"}
      </Button>
      {!canWrite ? <p className="text-center text-xs text-muted-foreground">You have read-only access.</p> : null}
    </div>
  );
}
