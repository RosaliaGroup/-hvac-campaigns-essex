/**
 * /field/jobs/:id — Field Work Order (mobile).
 *
 * A phone-first work order for the technician running a service call. Read-only
 * on customer/property/appointment/history (no financials, no customer or
 * equipment editing); the only write is advancing the technician work status
 * (shared/workStatus.ts) via jobs.setTechnicianWorkStatus, which records an audit
 * event. Access is enforced server-side (technicians see only assigned work).
 */
import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { appointmentTypeLabel, serviceTypeLabel } from "@shared/appointmentTypes";
import { buildDirectionsUrl, hasServiceAddress } from "@shared/fieldApp";
import { formatDisplayName, formatAddress } from "@shared/nameFormat";
import {
  WORK_STATUS_LABEL,
  WORK_STATUS_BADGE,
  WORK_STATUS_TIMELINE,
  workStatusStep,
  nextWorkStatuses,
  type TechnicianWorkStatus,
} from "@shared/workStatus";
import { WorkOrderNotes } from "@/components/field/WorkOrderNotes";
import { WorkOrderPhotos } from "@/components/field/WorkOrderPhotos";
import { WorkOrderTime } from "@/components/field/WorkOrderTime";
import { WorkOrderParts } from "@/components/field/WorkOrderParts";
import { WorkOrderSignature } from "@/components/field/WorkOrderSignature";
import { WorkOrderCompletion } from "@/components/field/WorkOrderCompletion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Phone, Mail, MapPin, Navigation, UserRound, Briefcase, Wrench, Clock,
  CalendarClock, StickyNote, Image as ImageIcon, CheckCircle2, Loader2, ChevronRight,
  History as HistoryIcon, ClipboardList, MessageSquare, AlertTriangle, Radio,
} from "lucide-react";

// Verb-forward labels for the status action buttons.
const ACTION_LABEL: Record<TechnicianWorkStatus, string> = {
  assigned: "Assigned",
  accepted: "Accept Job",
  en_route: "En Route",
  arrived: "Arrived",
  working: "Start Work",
  waiting_parts: "Waiting for Parts",
  completed: "Complete Job",
};

const APPT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", arrived: "Arrived",
  completed: "Completed", cancelled: "Cancelled", rescheduled: "Rescheduled",
};

function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}
function dateTimeLabel(d: Date | string | null | undefined): string {
  if (!d) return "Unscheduled";
  return new Date(d).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

/** Horizontal step timeline for the six main lifecycle steps. */
function StatusTimeline({ status }: { status: TechnicianWorkStatus }) {
  const step = workStatusStep(status);
  return (
    <div className="flex items-center">
      {WORK_STATUS_TIMELINE.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <div key={s} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || current ? "bg-[#ff6b35]" : "bg-muted"}`} />
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                  done ? "border-[#ff6b35] bg-[#ff6b35] text-white"
                  : current ? "border-[#ff6b35] bg-white text-[#ff6b35]"
                  : "border-muted bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === WORK_STATUS_TIMELINE.length - 1 ? "opacity-0" : done ? "bg-[#ff6b35]" : "bg-muted"}`} />
            </div>
            <span className={`mt-1 text-center text-[10px] leading-tight ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {WORK_STATUS_LABEL[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="uppercase tracking-wide">{title}</span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function FieldWorkOrder() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const jobId = Number(params.id);

  const { data, isLoading, isError, error, refetch } =
    trpc.jobs.fieldWorkOrder.useQuery({ id: jobId }, { enabled: jobId > 0, retry: false });

  const setStatus = trpc.jobs.setTechnicianWorkStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: e => toast.error(e.message || "Could not update status"),
  });

  const current = (data?.job.technicianWorkStatus ?? "assigned") as TechnicianWorkStatus;
  const actions = useMemo(() => nextWorkStatuses(current), [current]);

  // Derived (safe when data is absent). Quick actions render only when their
  // underlying data exists (phone → Call/Text, address → Directions, customer → Open).
  const isEmergency = data?.job.priority === "emergency" || data?.appointment?.priority === "emergency";
  const phone = data?.customer?.phone ?? null;
  const address = data?.property.address ?? null;
  const customerId = data?.job.customerId ?? null;
  const directionsUrl = buildDirectionsUrl(address);
  type QuickAction = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; href?: string; external?: boolean; onClick?: () => void };
  const quickActions: QuickAction[] = data
    ? ([
        phone ? { key: "call", label: "Call", icon: Phone, href: `tel:${dialable(phone)}` } : null,
        phone ? { key: "text", label: "Text", icon: MessageSquare, href: `sms:${dialable(phone)}` } : null,
        directionsUrl ? { key: "dir", label: "Directions", icon: Navigation, href: directionsUrl, external: true } : null,
        customerId != null ? { key: "cust", label: "Customer", icon: UserRound, onClick: () => navigate(`/customers/${customerId}`) } : null,
      ].filter(Boolean) as QuickAction[])
    : [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-3">
          <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Back to My Jobs" onClick={() => navigate("/field/today")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">Work Order</h1>
            <p className="truncate text-xs text-muted-foreground">{data?.job.jobNumber ?? (jobId > 0 ? `#${jobId}` : "")}</p>
          </div>
          {data ? (
            <Badge variant="outline" className={`shrink-0 border ${WORK_STATUS_BADGE[current]}`}>
              {WORK_STATUS_LABEL[current]}
            </Badge>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-3 py-4 pb-40">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35]" />
            <p className="text-sm">Loading work order…</p>
          </div>
        ) : isError ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-6 text-center">
              <p className="text-sm font-medium text-red-600">Can't open this work order.</p>
              <p className="text-xs text-muted-foreground">{error?.message}</p>
              <Button variant="outline" className="mt-2 h-11" onClick={() => navigate("/field/today")}>Back to My Jobs</Button>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Emergency work is visually unmistakable */}
            {isEmergency ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-700 bg-red-600 px-4 py-3 text-white shadow">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold uppercase tracking-wide">Emergency — respond immediately</span>
              </div>
            ) : null}

            {/* Title + priority */}
            <div className="px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold leading-tight">{data.job.title || "Service Call"}</h2>
                {data.job.priority && data.job.priority !== "normal" ? (
                  <Badge className="bg-red-100 capitalize text-red-700">{data.job.priority}</Badge>
                ) : null}
              </div>
              {data.job.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{data.job.description}</p>
              ) : null}
            </div>

            {/* Work status timeline + actions */}
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <ClipboardList className="h-4 w-4" />
                  <span className="uppercase tracking-wide">Work Status</span>
                  <Badge variant="outline" className={`ml-auto border ${WORK_STATUS_BADGE[current]}`}>
                    {WORK_STATUS_LABEL[current]}
                  </Badge>
                </div>
                <StatusTimeline status={current} />
                {actions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {actions.map(next => (
                      <Button
                        key={next}
                        className="h-14 w-full text-base font-semibold"
                        variant={next === "completed" ? "default" : "secondary"}
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: jobId, status: next })}
                      >
                        {setStatus.isPending && setStatus.variables?.status === next ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <ChevronRight className="mr-1 h-5 w-5" />
                        )}
                        {ACTION_LABEL[next]}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 py-3 text-sm font-semibold text-green-700">
                    <CheckCircle2 className="h-5 w-5" /> Work order completed
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer */}
            <SectionCard icon={UserRound} title="Customer">
              <div className="text-base font-semibold">{formatDisplayName(data.customer?.displayName ?? "Customer")}</div>
              {data.customer?.phone ? (
                <a href={`tel:${dialable(data.customer.phone)}`} className="flex items-center gap-2 text-sm font-medium text-[#ff6b35]">
                  <Phone className="h-4 w-4" /> {data.customer.phone}
                </a>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> No phone number</div>
              )}
              {data.customer?.email ? (
                <a href={`mailto:${data.customer.email}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> {data.customer.email}
                </a>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> No email</div>
              )}
            </SectionCard>

            {/* Property */}
            <SectionCard icon={MapPin} title="Property">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{data.property.address ? formatAddress(data.property.address) : "No service address"}</span>
              </div>
            </SectionCard>

            {/* Appointment */}
            {data.appointment ? (
              <SectionCard icon={CalendarClock} title="Appointment">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  {[appointmentTypeLabel(data.appointment.appointmentType), serviceTypeLabel(data.appointment.serviceType)].filter(Boolean).join(" · ") || "Appointment"}
                  {data.appointment.priority && data.appointment.priority !== "normal" ? (
                    <Badge className="bg-red-100 capitalize text-red-700">{data.appointment.priority}</Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> {dateTimeLabel(data.appointment.scheduledAt)}
                </div>
                {data.appointment.description ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="font-semibold">Issue: </span>{data.appointment.description}</div>
                ) : null}
                {data.appointment.dispatcherNotes ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="font-semibold">Dispatcher notes: </span>{data.appointment.dispatcherNotes}</div>
                ) : null}
              </SectionCard>
            ) : null}

            {/* Assignment */}
            <SectionCard icon={Briefcase} title="Assignment">
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                {data.assignee?.name ? `Assigned to ${data.assignee.name}` : "Unassigned"}
              </div>
              {data.appointment?.source ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Radio className="h-4 w-4" /> Source: <span className="capitalize">{data.appointment.source.replace(/_/g, " ")}</span>
                </div>
              ) : null}
            </SectionCard>

            {/* History */}
            <SectionCard icon={HistoryIcon} title="History">
              {/* Work-status audit trail */}
              {data.workStatusEvents.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground">Status changes</div>
                  {data.workStatusEvents.map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 text-xs">
                      <span className={`rounded border px-1.5 py-0.5 ${WORK_STATUS_BADGE[(ev.toStatus as TechnicianWorkStatus)] ?? "bg-muted"}`}>
                        {WORK_STATUS_LABEL[ev.toStatus as TechnicianWorkStatus] ?? ev.toStatus}
                      </span>
                      <span className="text-muted-foreground">{dateTimeLabel(ev.createdAt)}</span>
                      {ev.changedByName ? <span className="text-muted-foreground">· {ev.changedByName}</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Previous visits */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Previous visits</div>
                {data.history.visits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No prior visits.</p>
                ) : data.history.visits.map(v => (
                  <div key={v.id} className="flex items-center gap-2 text-xs">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{dateTimeLabel(v.scheduledAt)}</span>
                    <span className="text-muted-foreground">· {APPT_STATUS_LABEL[v.status] ?? v.status}</span>
                    {v.technicianName ? <span className="text-muted-foreground">· {v.technicianName}</span> : null}
                  </div>
                ))}
              </div>

            </SectionCard>

            {/* Notes (PR #40) — internal / customer, editable per server rules */}
            <WorkOrderNotes jobId={jobId} />

            {/* Photos (PR #40) — capture/upload + category gallery */}
            <WorkOrderPhotos jobId={jobId} />

            {/* Job completion workflow (PR #41) */}
            <WorkOrderTime jobId={jobId} locked={current === "completed"} />
            <WorkOrderParts jobId={jobId} />
            <WorkOrderSignature jobId={jobId} locked={current === "completed"} />
            <WorkOrderCompletion jobId={jobId} workStatus={current} onCompleted={() => refetch()} />
          </>
        ) : null}
      </main>

      {/* Sticky quick-action bar — large touch targets; only actions with data. */}
      {quickActions.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div
            className="mx-auto grid max-w-xl gap-1 px-2 py-2"
            style={{ gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))` }}
          >
            {quickActions.map(a => {
              const inner = (
                <>
                  <a.icon className="h-5 w-5" />
                  <span className="text-xs font-semibold">{a.label}</span>
                </>
              );
              const cls = "flex h-14 w-full flex-col items-center justify-center gap-1";
              return a.href ? (
                <Button key={a.key} asChild variant="ghost" className={cls}>
                  <a href={a.href} target={a.external ? "_blank" : undefined} rel="noopener noreferrer">{inner}</a>
                </Button>
              ) : (
                <Button key={a.key} variant="ghost" className={cls} onClick={a.onClick}>{inner}</Button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
