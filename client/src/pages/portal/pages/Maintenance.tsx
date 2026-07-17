import { BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AsyncSection, PortalPageHeader, StatusBadge } from "../components/common";
import { formatMoney, formatDate, humanize, genericStatusTone } from "../lib/format";

export default function PortalMaintenance() {
  const query = trpc.portal.maintenance.list.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Maintenance Agreements" description="Your service plans and coverage." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No maintenance plans yet"
        emptyDescription="Ask us about a Comfort Club plan to keep your system running year-round."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                        <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {m.planName}
                          {m.tier ? ` · ${m.tier}` : ""}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {humanize(m.billingFrequency)}
                          {m.price ? ` · ${formatMoney(m.price)}` : ""}
                          {m.visitsPerYear ? ` · ${m.visitsPerYear} visits/yr` : ""}
                        </p>
                      </div>
                    </div>
                    <StatusBadge label={humanize(m.status)} tone={genericStatusTone(m.status)} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                    <div>
                      <dt className="text-slate-400">Started</dt>
                      <dd className="text-slate-700 dark:text-slate-300">{formatDate(m.startsAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Renews</dt>
                      <dd className="text-slate-700 dark:text-slate-300">{formatDate(m.renewsAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Next service</dt>
                      <dd className="text-slate-700 dark:text-slate-300">{formatDate(m.nextServiceAt)}</dd>
                    </div>
                  </dl>
                  {m.coverage ? <p className="mt-3 text-xs text-slate-400">{m.coverage}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
