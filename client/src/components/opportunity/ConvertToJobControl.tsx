/**
 * ConvertToJobControl — the single Opportunity → Job control used by every
 * opportunity surface (detail drawer and full-page view). Encapsulates the one
 * conversion mutation, the property-selection modal, and the
 * Convert-to-Job / View-Job button states, so the surfaces cannot drift.
 *
 * All behavioral decisions come from the pure helpers in convertToJobState.ts;
 * idempotency and property-resolution safeguards live server-side in
 * opportunityToJob.ts. This component never creates a property.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wrench } from "lucide-react";
import { formatAddress } from "@shared/nameFormat";
import {
  convertControlMode,
  convertResultEffect,
  viewJobLabel,
  propertyChoiceAddress,
  type PrimaryJob,
  type PropertyChoice,
} from "./convertToJobState";

export function ConvertToJobControl({
  opportunityId,
  primaryJob,
  onConverted,
  size = "sm",
  variant = "outline",
}: {
  opportunityId: number | null;
  primaryJob: PrimaryJob;
  /** Called after a successful (new or idempotent) conversion so the caller can refetch. */
  onConverted?: () => void;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [propChoices, setPropChoices] = useState<PropertyChoice[] | null>(null);

  const convert = trpc.opportunities.convertToJob.useMutation({
    onSuccess: res => {
      const effect = convertResultEffect(res);
      if (effect.kind === "open_property_modal") {
        setPropChoices(effect.candidates); // customer has multiple properties — ask; no write happened
        return;
      }
      setPropChoices(null);
      toast({ title: effect.alreadyConverted ? `Opportunity already linked to ${effect.jobNumber}` : `Job ${effect.jobNumber} created` });
      utils.jobs.list.invalidate();
      onConverted?.();
    },
    onError: err => toast({ title: "Conversion failed", description: err.message, variant: "destructive" }),
  });

  if (convertControlMode(primaryJob) === "view_job" && primaryJob) {
    const { label, status } = viewJobLabel(primaryJob);
    return (
      <Button variant={variant} size={size} className="gap-1 text-[#1e3a5f]" onClick={() => navigate(`/jobs/${primaryJob.id}`)}>
        <Wrench className="h-4 w-4" /> View Job {label}
        <Badge variant="secondary" className="ml-1 text-[10px]">{status}</Badge>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className="gap-1"
        disabled={opportunityId == null || convert.isPending}
        onClick={() => opportunityId != null && convert.mutate({ id: opportunityId })}
      >
        <Wrench className="h-4 w-4" /> {convert.isPending ? "Converting…" : "Convert to Job"}
      </Button>

      {/* Property picker — only when the customer has multiple properties and no
          single primary. Never creates a property. */}
      <Dialog open={propChoices != null} onOpenChange={v => !v && setPropChoices(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a service property</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This customer has more than one property. Choose which one the new job is for.
          </p>
          <div className="space-y-2 py-2">
            {(propChoices ?? []).map(p => (
              <button
                key={p.id}
                disabled={convert.isPending}
                onClick={() => opportunityId != null && convert.mutate({ id: opportunityId, propertyId: p.id })}
                className="flex w-full flex-col items-start rounded border p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span className="font-medium">
                  {formatAddress(p.label || p.addressLine1)}
                  {p.isPrimary ? <Badge variant="secondary" className="ml-2 text-[10px]">primary</Badge> : null}
                </span>
                <span className="text-[11px] text-muted-foreground">{formatAddress(propertyChoiceAddress(p))}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPropChoices(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
