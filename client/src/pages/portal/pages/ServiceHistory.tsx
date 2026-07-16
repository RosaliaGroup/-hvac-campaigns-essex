import { Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AsyncSection, PortalPageHeader, StatusBadge } from "../components/common";
import { formatDate, humanize, jobStatusTone } from "../lib/format";

export default function PortalServiceHistory() {
  const query = trpc.portal.serviceHistory.list.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Service History" description="Work we've done for you." />
      <AsyncSection
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No service history yet"
        emptyDescription="Completed jobs and visits will be listed here."
      >
        {(rows) => (
          <div className="space-y-2">
            {rows.map((j) => (
              <Card key={j.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                      <Wrench className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{j.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {j.jobNumber ? `#${j.jobNumber} · ` : ""}
                        {humanize(j.jobType)} · {formatDate(j.completedAt ?? j.createdAt)}
                      </p>
                      {j.completionSummary || j.customerVisibleNotes ? (
                        <p className="mt-1 max-w-lg text-xs text-slate-500 dark:text-slate-400">
                          {j.completionSummary ?? j.customerVisibleNotes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge label={humanize(j.status)} tone={jobStatusTone(j.status)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
