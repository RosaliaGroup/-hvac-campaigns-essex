import { ReceiptText, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { AsyncSection, PortalPageHeader, StatusBadge, InlineSpinner } from "../components/common";
import { formatMoney, formatDate, humanize, docStatusTone } from "../lib/format";

export default function PortalInvoices() {
  const query = trpc.portal.invoices.list.useQuery(undefined, { retry: false });
  const { toast } = useToast();

  const checkout = trpc.portal.payments.createInvoiceCheckout.useMutation({
    onSuccess: (res) => {
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else toast({ variant: "destructive", title: "Payment unavailable", description: "Please try again later." });
    },
    onError: (err) => toast({ variant: "destructive", title: "Couldn't start payment", description: err.message }),
  });

  const payable = (status: string, voided: boolean) => !voided && status !== "paid" && status !== "void";

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Invoices" description="Your billing history and balances." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No invoices yet"
        emptyDescription="Invoices for completed work will appear here."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <ReceiptText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {inv.docNumber ? `Invoice ${inv.docNumber}` : `Invoice #${inv.id}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(inv.txnDate)}
                        {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMoney(inv.totalAmount)}</p>
                      {inv.balance != null && Number(inv.balance) > 0 ? (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{formatMoney(inv.balance)} due</p>
                      ) : null}
                    </div>
                    <StatusBadge label={humanize(inv.status)} tone={docStatusTone(inv.status)} />
                    {inv.documentLink ? (
                      <a href={inv.documentLink} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#ff6b35]" aria-label="Open invoice document">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    {payable(inv.status, inv.voided) ? (
                      <Button
                        size="sm"
                        className="bg-[#ff6b35] hover:bg-[#ff6b35]/90"
                        disabled={checkout.isPending}
                        onClick={() => checkout.mutate({ invoiceId: inv.id, origin: window.location.origin })}
                      >
                        {checkout.isPending ? <InlineSpinner className="mr-2" /> : null} Pay now
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
