/**
 * Commercial opportunity master-record drawer. Customer-360-style tabs. Deferred
 * capabilities are not faked: only real, functioning sections are shown. Loading,
 * empty, permission, and error states are handled per section.
 */
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowRight, Briefcase } from "lucide-react";
import { fmtDate, fmtMoney, type FinancialView } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { PriorityBadge, StatusBadge } from "./shared";
import OverviewSection, { FinancialCard } from "./OverviewSection";
import ChecklistSection from "./ChecklistSection";
import CommentsSection from "./CommentsSection";
import DocumentsSection from "./DocumentsSection";
import ConvertToJobPanel from "./ConvertToJobPanel";

const HISTORY_TYPES = new Set(["created", "stage_changed", "reopened", "converted_to_job", "awarded", "lost"]);

export default function CommercialDetailDrawer({ id, open, onClose }: { id: number | null; open: boolean; onClose: () => void }) {
  const q = trpc.opportunities.commercial.get.useQuery({ id: id! }, { enabled: id != null && open });

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {q.isLoading ? (
          <div className="flex h-40 items-center justify-center"><Spinner /></div>
        ) : q.isError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-red-600">Couldn’t load this opportunity.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>Retry</Button>
          </div>
        ) : q.data ? (
          <DetailBody detail={q.data} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ detail }: { detail: CommercialDetail }) {
  const opp = detail.opportunity;
  const fin = detail.financials as FinancialView;

  return (
    <>
      <SheetHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{opp.opportunityNumber ?? `OPP-${opp.id}`}</span>
          {detail.stage ? <Badge variant="outline">{detail.stage.name}</Badge> : null}
          <StatusBadge status={opp.status} />
          <PriorityBadge priority={opp.priority} />
        </div>
        <SheetTitle className="text-lg">{opp.title}</SheetTitle>
        <p className="text-sm text-muted-foreground">
          {detail.customer?.displayName ?? "—"} · {fmtMoney(opp.amount)}
          {detail.primaryJob ? (
            <Link href={`/jobs/${detail.primaryJob.id}`}>
              <a className="ml-2 inline-flex items-center gap-1 text-[#1e3a5f] hover:underline"><Briefcase className="h-3 w-3" />{detail.primaryJob.jobNumber}</a>
            </Link>
          ) : null}
        </p>
      </SheetHeader>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="tasks">Tasks{detail.tasks.length ? ` (${detail.tasks.length})` : ""}</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="appointments">Appointments{detail.appointments.length ? ` (${detail.appointments.length})` : ""}</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="documents">Documents{detail.documents.length ? ` (${detail.documents.length})` : ""}</TabsTrigger>
          <TabsTrigger value="estimates">Estimates{detail.salesDocuments.length ? ` (${detail.salesDocuments.length})` : ""}</TabsTrigger>
          <TabsTrigger value="jobs">Jobs{detail.linkedJobs.length ? ` (${detail.linkedJobs.length})` : ""}</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="comments">Comments{detail.comments.length ? ` (${detail.comments.length})` : ""}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewSection detail={detail} /></TabsContent>

        <TabsContent value="activity" className="mt-4"><Timeline events={detail.events} /></TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {detail.tasks.length === 0 ? <Empty>No follow-up tasks.</Empty> : (
            <ul className="divide-y rounded-lg border">
              {detail.tasks.map(t => (
                <li key={t.id} className="flex items-center justify-between p-2.5 text-sm">
                  <span>{t.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="capitalize">{t.status}</Badge>{fmtDate(t.dueAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="mt-4"><ChecklistSection opportunityId={opp.id} items={detail.checklist} /></TabsContent>

        <TabsContent value="appointments" className="mt-4">
          {detail.appointments.length === 0 ? <Empty>No appointments.</Empty> : (
            <ul className="divide-y rounded-lg border">
              {detail.appointments.map(a => (
                <li key={a.id} className="flex items-center justify-between p-2.5 text-sm">
                  <span>{a.appointmentType?.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(a.scheduledAt ?? a.preferredDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Customer" value={detail.customer?.displayName} />
            <Info label="Company" value={detail.customer?.companyName} />
            <Info label="Primary contact" value={detail.primaryContact?.displayName} />
            <Info label="Email" value={detail.customer?.email} />
            <Info label="Phone" value={detail.customer?.phone} />
          </div>
          {detail.customer ? (
            <Link href={`/customers/${detail.customer.id}`}><a className="mt-3 inline-flex items-center gap-1 text-sm text-[#1e3a5f] hover:underline">Open customer 360 <ArrowRight className="h-3.5 w-3.5" /></a></Link>
          ) : null}
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          {detail.property ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{detail.property.addressLine1}</p>
              <p className="text-muted-foreground">{[detail.property.city, detail.property.state, detail.property.zip].filter(Boolean).join(", ")}</p>
            </div>
          ) : <Empty>No property linked. Link one from the Overview.</Empty>}
        </TabsContent>

        <TabsContent value="documents" className="mt-4"><DocumentsSection opportunityId={opp.id} documents={detail.documents} /></TabsContent>

        <TabsContent value="estimates" className="mt-4">
          {detail.salesDocuments.length === 0 ? <Empty>No estimates or proposals linked.</Empty> : (
            <ul className="divide-y rounded-lg border">
              {detail.salesDocuments.map(d => (
                <li key={d.id} className="flex items-center justify-between p-2.5 text-sm">
                  <span className="capitalize">{d.docType} {d.docNumber ? `#${d.docNumber}` : ""}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="capitalize">{d.status}</Badge>{fmtMoney(d.totalAmount)}
                    {d.documentLink ? <a href={d.documentLink} target="_blank" rel="noreferrer" className="text-[#1e3a5f] hover:underline">open</a> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-4">
          {detail.linkedJobs.length ? (
            <ul className="divide-y rounded-lg border">
              {detail.linkedJobs.map(j => (
                <li key={j.id} className="flex items-center justify-between p-2.5 text-sm">
                  <Link href={`/jobs/${j.id}`}><a className="font-medium text-[#1e3a5f] hover:underline">{j.jobNumber}</a></Link>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="capitalize">{j.status}</Badge>{fmtDate(j.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium">Convert to Job</p>
            <ConvertToJobPanel opportunityId={opp.id} />
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <FinancialCard fin={fin} probability={opp.probability} />
          <p className="mt-2 text-xs text-muted-foreground">The margin override is optional. When empty, the effective margin is the calculated value (value − cost).</p>
        </TabsContent>

        <TabsContent value="comments" className="mt-4"><CommentsSection opportunityId={opp.id} comments={detail.comments} /></TabsContent>

        <TabsContent value="history" className="mt-4"><Timeline events={detail.events.filter(e => HISTORY_TYPES.has(e.type))} emptyLabel="No stage/conversion history yet." /></TabsContent>
      </Tabs>
    </>
  );
}

function Timeline({ events, emptyLabel = "No activity yet." }: { events: { id: number; type: string; message: string | null; createdAt: string | Date }[]; emptyLabel?: string }) {
  if (!events.length) return <Empty>{emptyLabel}</Empty>;
  return (
    <ul className="space-y-2">
      {events.map(e => (
        <li key={e.id} className="flex items-start gap-2 text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          <div>
            <p>{e.message ?? e.type.replace(/_/g, " ")}</p>
            <p className="text-[11px] text-muted-foreground">{fmtDate(e.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
