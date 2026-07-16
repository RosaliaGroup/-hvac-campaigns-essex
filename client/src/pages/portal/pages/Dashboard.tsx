import { Link } from "wouter";
import { FileText, ReceiptText, CalendarClock, BadgeCheck, AirVent, MessagesSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { PortalPageHeader, LoadingState, ErrorState, StatusBadge } from "../components/common";
import { formatMoney, formatDate, humanize, apptStatusTone } from "../lib/format";

export default function PortalDashboard() {
  const query = trpc.portal.dashboard.summary.useQuery(undefined, { retry: false });

  if (query.isLoading) return <LoadingState rows={5} />;
  if (query.isError) return <ErrorState message={query.error?.message} onRetry={query.refetch} />;
  const data = query.data!;

  const tiles = [
    { label: "Open estimates", value: String(data.stats.openEstimates), icon: FileText, href: "/portal/estimates" },
    { label: "Open invoices", value: String(data.stats.openInvoices), icon: ReceiptText, href: "/portal/invoices" },
    { label: "Balance due", value: formatMoney(data.stats.outstandingBalance), icon: ReceiptText, href: "/portal/invoices" },
    { label: "Active plans", value: String(data.stats.activeAgreements), icon: BadgeCheck, href: "/portal/maintenance" },
    { label: "Equipment", value: String(data.stats.equipmentCount), icon: AirVent, href: "/portal/equipment" },
    { label: "Unread messages", value: String(data.stats.unreadMessages), icon: MessagesSquare, href: "/portal/messages" },
  ];

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={`Welcome, ${data.customer.displayName}`}
        description="Here's a quick look at your account."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href}>
              <Card className="cursor-pointer transition-colors hover:border-[#ff6b35]/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">{t.value}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="upcoming-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <CalendarClock className="h-4 w-4" aria-hidden="true" /> Upcoming appointments
          </h2>
          <Link href="/portal/appointments" className="text-sm font-medium text-[#ff6b35] hover:underline">
            View all
          </Link>
        </div>

        {data.upcomingAppointments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              You have no upcoming appointments.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.upcomingAppointments.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{humanize(a.appointmentType)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {a.scheduledAt ? formatDate(a.scheduledAt) : `${a.preferredDate} · ${a.preferredTime}`}
                    </p>
                  </div>
                  <StatusBadge label={humanize(a.status)} tone={apptStatusTone(a.status)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
