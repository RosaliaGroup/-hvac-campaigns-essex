/**
 * Task 8B — estimate entry points shared by the Customer and Lead detail pages.
 *
 * <StartEstimateButton> is the single door to the Good/Better/Best builder:
 *   1. Resolve a customer (converting a lead capture first, with dedupe, when
 *      `captureId` is given).
 *   2. Look at that customer's OPEN opportunities: exactly one → attach; none →
 *      auto-create one (carrying the originating lead via sourceLeadCaptureId);
 *      more than one → a small picker (existing opps + "create new").
 *   3. Create a fresh draft estimate on the chosen opportunity and navigate to
 *      /opportunities/:id, where EstimatesSection (PR #74/#75) hosts the builder.
 *
 * <TieredEstimateList> renders a customer's tiered estimates across all their
 * opportunities, each row linking back to its opportunity's builder.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/jobPresentation";
import { ClipboardList, FileText, Plus, Loader2 } from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type OpenOpp = RouterOutput["opportunities"]["openForCustomer"][number];

const NEW_OPP = -1; // sentinel radio value for "create a new opportunity"

const ESTIMATE_STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};
const QB_SYNC: Record<string, string> = {
  not_pushed: "bg-gray-100 text-gray-600",
  pushed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};
const QB_SYNC_LABEL: Record<string, string> = {
  not_pushed: "QB: not pushed",
  pushed: "QB: pushed",
  failed: "QB: sync failed",
};

export function StartEstimateButton({
  customerId,
  captureId,
  defaultTitle,
  label = "New Estimate",
  size = "sm",
  variant,
  className,
}: {
  /** Attach to this customer directly (customer page). */
  customerId?: number;
  /** Convert this lead capture to a customer first (lead page). */
  captureId?: number;
  /** Title used when a brand-new opportunity has to be created. */
  defaultTitle: string;
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<{ customerId: number; opps: OpenOpp[] } | null>(null);

  const convert = trpc.customers.convertFromCapture.useMutation();
  const createOpp = trpc.opportunities.create.useMutation();
  const createEstimate = trpc.estimates.create.useMutation();

  const goToBuilder = async (opportunityId: number) => {
    await createEstimate.mutateAsync({ opportunityId });
    utils.estimates.listByOpportunity.invalidate({ opportunityId });
    if (customerId) utils.estimates.listByCustomer.invalidate({ customerId });
    navigate(`/opportunities/${opportunityId}`);
  };

  const createOppThenGo = async (custId: number) => {
    const opp = await createOpp.mutateAsync({
      customerId: custId,
      title: defaultTitle,
      sourceLeadCaptureId: captureId ?? undefined,
    });
    await goToBuilder(opp.id);
  };

  const start = async () => {
    setBusy(true);
    try {
      let custId = customerId ?? null;
      if (custId == null && captureId != null) {
        const res = await convert.mutateAsync({ captureId });
        custId = res.customerId;
        if (res.merged) toast.message("Linked to an existing customer by phone/email");
      }
      if (custId == null) {
        toast.error("No customer to attach an estimate to");
        return;
      }
      const opps = await utils.opportunities.openForCustomer.fetch({ customerId: custId });
      if (opps.length === 0) await createOppThenGo(custId);
      else if (opps.length === 1) await goToBuilder(opps[0].id);
      else setPicker({ customerId: custId, opps });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={start} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} {label}
      </Button>
      {picker && (
        <OpportunityPicker
          opps={picker.opps}
          busy={busy}
          onCancel={() => setPicker(null)}
          onChoose={async (choice) => {
            setPicker(null);
            setBusy(true);
            try {
              if (choice === NEW_OPP) await createOppThenGo(picker.customerId);
              else await goToBuilder(choice);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}

function OpportunityPicker({
  opps, busy, onChoose, onCancel,
}: {
  opps: OpenOpp[];
  busy: boolean;
  onChoose: (choice: number) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<number>(opps[0]?.id ?? NEW_OPP);
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Which opportunity is this estimate for?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          This customer has more than one open opportunity. Attach the estimate to one, or create a new opportunity.
        </p>
        <div className="space-y-2 py-2">
          {opps.map((o) => (
            <label key={o.id} className="flex items-center justify-between gap-3 border rounded-md p-2 text-sm cursor-pointer">
              <span className="flex items-center gap-2 min-w-0">
                <input type="radio" name="pick-opp" checked={selected === o.id} onChange={() => setSelected(o.id)} />
                <span className="truncate font-medium">{o.title}</span>
                <Badge variant="secondary" className="capitalize shrink-0">{o.stage.replace(/_/g, " ")}</Badge>
              </span>
              <span className="font-semibold shrink-0">{formatMoney(Number(o.amount))}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer border-dashed">
            <input type="radio" name="pick-opp" checked={selected === NEW_OPP} onChange={() => setSelected(NEW_OPP)} />
            <Plus className="h-4 w-4" /> Create a new opportunity
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onChoose(selected)} disabled={busy}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tiered estimates across all of a customer's opportunities (customer/lead 360). */
export function TieredEstimateList({ customerId, onOpen }: { customerId: number; onOpen: (opportunityId: number) => void }) {
  const q = trpc.estimates.listByCustomer.useQuery({ customerId }, { enabled: customerId > 0 });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading estimates…</p>;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No tiered estimates yet. Use “New Estimate” to build Good/Better/Best options.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((e) => (
        <div
          key={e.id}
          onClick={() => onOpen(e.opportunityId)}
          className="flex items-start justify-between gap-3 border rounded-lg p-3 text-sm cursor-pointer hover:bg-muted/50"
        >
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-[#1e3a5f] shrink-0" />
              <span className="truncate">{e.estimateNumber || `Estimate #${e.id}`}</span>
              {e.opportunityTitle && <span className="text-muted-foreground truncate hidden sm:inline">· {e.opportunityTitle}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {e.approvedTier && <span className="capitalize">Approved: {e.approvedTier}</span>}
              {e.quickbooksEstimateId && <span>QBO Estimate {e.quickbooksEstimateId}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="secondary" className={ESTIMATE_STATUS[e.status] ?? ""}>{e.status}</Badge>
            {e.status === "approved" && (
              <Badge variant="secondary" className={QB_SYNC[e.qbSyncStatus] ?? ""}>{QB_SYNC_LABEL[e.qbSyncStatus] ?? e.qbSyncStatus}</Badge>
            )}
            {e.approvedTotal != null && <span className="font-semibold">{formatMoney(Number(e.approvedTotal))}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Exported for a header icon so callers don't re-import lucide. */
export { ClipboardList as EstimatesIcon };
