import { AirVent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AsyncSection, PortalPageHeader, StatusBadge } from "../components/common";
import { formatDate, humanize, genericStatusTone } from "../lib/format";

export default function PortalEquipment() {
  const query = trpc.portal.equipment.list.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Equipment" description="HVAC systems installed at your property." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No equipment on file"
        emptyDescription="Once we install or register a unit for you, it'll appear here."
      >
        {(rows) => (
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                        <AirVent className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {[e.make, e.model].filter(Boolean).join(" ") || e.category || "Unit"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{e.category ? humanize(e.category) : "Equipment"}</p>
                      </div>
                    </div>
                    <StatusBadge label={humanize(e.status)} tone={genericStatusTone(e.status)} />
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {e.serialNumber ? (
                      <div className="flex justify-between gap-2">
                        <dt>Serial</dt>
                        <dd className="font-mono text-slate-700 dark:text-slate-300">{e.serialNumber}</dd>
                      </div>
                    ) : null}
                    {e.location ? (
                      <div className="flex justify-between gap-2">
                        <dt>Location</dt>
                        <dd className="text-slate-700 dark:text-slate-300">{e.location}</dd>
                      </div>
                    ) : null}
                    {e.propertyLabel ? (
                      <div className="flex justify-between gap-2">
                        <dt>Property</dt>
                        <dd className="text-slate-700 dark:text-slate-300">{e.propertyLabel}</dd>
                      </div>
                    ) : null}
                    {e.installedAt ? (
                      <div className="flex justify-between gap-2">
                        <dt>Installed</dt>
                        <dd className="text-slate-700 dark:text-slate-300">{formatDate(e.installedAt)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
