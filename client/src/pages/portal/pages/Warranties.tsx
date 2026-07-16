import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AsyncSection, PortalPageHeader, StatusBadge } from "../components/common";
import { formatDate, humanize, genericStatusTone } from "../lib/format";

export default function PortalWarranties() {
  const query = trpc.portal.warranty.list.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Warranties" description="Coverage on your equipment and labor." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No warranties on file"
        emptyDescription="Warranty coverage we register for you will appear here."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((w) => (
              <Card key={w.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {humanize(w.type)} warranty
                        {w.provider ? ` · ${w.provider}` : ""}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {w.equipmentLabel ? `${w.equipmentLabel} · ` : ""}
                        {w.policyNumber ? `Policy ${w.policyNumber}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {w.startsAt ? formatDate(w.startsAt) : "—"} – {w.expiresAt ? formatDate(w.expiresAt) : "—"}
                      </p>
                      {w.coverage ? <p className="mt-1 max-w-lg text-xs text-slate-400">{w.coverage}</p> : null}
                    </div>
                  </div>
                  <StatusBadge label={humanize(w.status)} tone={genericStatusTone(w.status)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
