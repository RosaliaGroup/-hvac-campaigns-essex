import { useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { AsyncSection, PortalPageHeader, StatusBadge, InlineSpinner } from "../components/common";
import { formatMoney, formatDate, humanize, docStatusTone } from "../lib/format";

type Estimate = { id: number; docNumber: string | null; status: string; totalAmount: string; txnDate: Date | string | null; expiresAt: Date | string | null; documentLink: string | null };

export default function PortalEstimates() {
  const query = trpc.portal.estimates.list.useQuery(undefined, { retry: false });
  const [responding, setResponding] = useState<Estimate | null>(null);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Estimates" description="Proposals we've prepared for you." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No estimates yet"
        emptyDescription="When we prepare an estimate for you, it'll show up here."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {e.docNumber ? `Estimate ${e.docNumber}` : `Estimate #${e.id}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(e.txnDate)}
                        {e.expiresAt ? ` · expires ${formatDate(e.expiresAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMoney(e.totalAmount)}</span>
                    <StatusBadge label={humanize(e.status)} tone={docStatusTone(e.status)} />
                    {e.documentLink ? (
                      <a href={e.documentLink} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#ff6b35]" aria-label="Open estimate document">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    {e.status === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => setResponding(e)}>
                        Respond
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>

      <RespondDialog estimate={responding} onClose={() => setResponding(null)} onDone={() => query.refetch()} />
    </div>
  );
}

function RespondDialog({ estimate, onClose, onDone }: { estimate: Estimate | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const respond = trpc.portal.estimates.respond.useMutation({
    onSuccess: (_res, vars) => {
      toast({
        title: vars.decision === "accept" ? "Estimate accepted" : "Changes requested",
        description: "We've notified the team — you can follow up in Messages.",
      });
      setNote("");
      onClose();
      onDone();
    },
    onError: (err) => toast({ variant: "destructive", title: "Couldn't submit", description: err.message }),
  });

  return (
    <Dialog open={Boolean(estimate)} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respond to {estimate?.docNumber ? `Estimate ${estimate.docNumber}` : "estimate"}</DialogTitle>
          <DialogDescription>Let us know if you'd like to move forward or request changes.</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Add a note (optional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={respond.isPending}
            onClick={() => estimate && respond.mutate({ id: estimate.id, decision: "request_changes", note: note || undefined })}
          >
            Request changes
          </Button>
          <Button
            className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
            disabled={respond.isPending}
            onClick={() => estimate && respond.mutate({ id: estimate.id, decision: "accept", note: note || undefined })}
          >
            {respond.isPending ? <InlineSpinner className="mr-2" /> : null} Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
