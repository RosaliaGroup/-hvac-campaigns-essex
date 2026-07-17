import { useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { AsyncSection, PortalPageHeader, StatusBadge } from "../components/common";
import { formatMoney, formatDateTime, humanize, genericStatusTone } from "../lib/format";

export default function PortalPayments() {
  const query = trpc.portal.payments.list.useQuery(undefined, { retry: false });
  const search = useSearch();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const confirmed = useRef(false);

  const sessionId = new URLSearchParams(search).get("session_id");

  const confirm = trpc.portal.payments.confirm.useMutation({
    onSuccess: async (res) => {
      if (res.status === "succeeded") {
        toast({ title: "Payment received", description: "Thank you! Your payment has been recorded." });
      } else {
        toast({ variant: "destructive", title: "Payment not completed", description: "We couldn't confirm this payment." });
      }
      await utils.portal.payments.list.invalidate();
      await utils.portal.invoices.list.invalidate();
      // Clean the query string so a refresh doesn't re-confirm.
      window.history.replaceState({}, "", "/portal/payments");
    },
  });

  useEffect(() => {
    if (sessionId && !confirmed.current) {
      confirmed.current = true;
      confirm.mutate({ sessionId });
    }
  }, [sessionId, confirm]);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Payments" description="A record of payments on your account." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No payments yet"
        emptyDescription="Payments you make through the portal will be listed here."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {p.invoiceNumber ? `Invoice ${p.invoiceNumber}` : "Payment"} · {humanize(p.method)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(p.paidAt ?? p.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMoney(p.amount, p.currency)}</span>
                    <StatusBadge label={humanize(p.status)} tone={genericStatusTone(p.status)} />
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
