/**
 * Opportunity detail drawer. Reuses opportunities.get and exposes the full
 * context + action buttons. QuickBooks Amount is read-only; the CRM Opportunity
 * Value and probability are editable (saving sets the override so QBO sync won't
 * revert them). Nothing here writes back to QuickBooks.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { internalSmsConversationPath } from "@/lib/internalSms";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayName, formatAddress, formatStateCode } from "@shared/nameFormat";
import { isOpenStage } from "@shared/stageMeta";
import { isDecisionTask } from "@shared/followupLoop";
import {
  Archive, ArchiveRestore, Phone, MessageSquare, Mail, ExternalLink, User, CalendarPlus, GitBranch, Trophy, XCircle, Clock, AlertTriangle,
} from "lucide-react";
import { ConvertToJobControl } from "./ConvertToJobControl";
import { EstimatesSection } from "./EstimatesSection";
import CommercialSections from "./commercial/CommercialSections"; // P2: self-gating; renders only for commercial records
import { STAGE_META, DOC_STATUS_BADGE, RELATIONSHIP_BADGE, WorkCategoryBadge, StageBadge, fmtMoney, fmtDate } from "./shared";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ActionButton({ href, disabled, onClick, icon: Icon, label }: {
  href?: string; disabled?: boolean; onClick?: () => void; icon: React.ElementType; label: string;
}) {
  // Trello's card buttons: a horizontal pill with the icon beside the label, wrapping
  // across rows, rather than a fixed grid of stacked tiles.
  const cls = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40";
  if (href && !disabled) {
    return <a href={href} className={cls}><Icon className="h-4 w-4" />{label}</a>;
  }
  return <button onClick={onClick} disabled={disabled} className={cls}><Icon className="h-4 w-4" />{label}</button>;
}

/**
 * Click-to-rename card title, Trello-style. Writes opportunities.title, which is what the
 * bid board cards display — so naming a card here renames it everywhere.
 */
function EditableCardTitle({ id, title }: { id: number; title: string }) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const update = trpc.opportunities.commercial.update.useMutation({
    onSuccess: () => { utils.opportunities.commercial.get.invalidate({ id }); utils.opportunities.invalidate(); setEditing(false); },
  });

  const save = () => {
    const v = draft.trim();
    if (v && v !== title) update.mutate({ id, title: v });
    else setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setDraft(title); setEditing(false); }
        }}
        className="min-w-0 flex-1 rounded border px-1 text-2xl font-bold leading-tight"
      />
    );
  }

  return (
    <button
      className="rounded px-1 text-left hover:bg-muted"
      title="Click to rename"
      onClick={() => { setDraft(title); setEditing(true); }}
    >
      {title || "Name this card…"}
    </button>
  );
}

export default function OpportunityDetailDrawer({ id, open, onClose }: { id: number | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const reserveInQbo = trpc.opportunities.commercial.reserveInQbo.useMutation({
    onSuccess: (res) => { toast({ title: "Reserved in QuickBooks as estimate " + res.docNumber }); utils.invalidate(); },
    onError: (err) => toast({ title: "Could not reserve", description: err.message, variant: "destructive" }),
  });
  const openEstimatePdf = async (salesDocumentId: number) => {
    // Claim the tab inside the click gesture so popup blockers allow it.
    const tab = window.open("", "_blank");
    try {
      if (tab) tab.document.write("<title>Loading estimate…</title><p style=\"font-family:sans-serif\">Loading the estimate from QuickBooks…</p>");
      const res = await utils.opportunities.estimatePdf.fetch({ salesDocumentId });
      const bytes = Uint8Array.from(atob(res.base64), ch => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (tab && !tab.closed) {
        tab.location.href = url;
      } else {
        // Blocker ate the tab — hand the file over as a download instead.
        const a = document.createElement("a");
        a.href = url;
        a.download = "estimate-" + (res.docNumber ?? salesDocumentId) + ".pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      if (tab && !tab.closed) tab.close();
      toast({ title: "Could not load the estimate PDF", description: (e as Error).message, variant: "destructive" });
    }
  };
  const { data, isLoading } = trpc.opportunities.get.useQuery({ id: id! }, { enabled: open && id != null });

  const [valueDraft, setValueDraft] = useState("");
  const [probDraft, setProbDraft] = useState("");

  useEffect(() => {
    if (data?.opportunity) {
      setValueDraft(String(data.opportunity.opportunityValue ?? ""));
      setProbDraft(data.opportunity.probability != null ? String(data.opportunity.probability) : "");
    }
  }, [data?.opportunity?.id]);

  const invalidate = () => {
    if (id != null) utils.opportunities.get.invalidate({ id });
    utils.opportunities.list.invalidate();
    utils.opportunities.overview.invalidate();
    utils.opportunities.stats.invalidate();
  };
  const onErr = (err: { message: string }) => toast({ title: "Action failed", description: err.message, variant: "destructive" });

  const updateValue = trpc.opportunities.updateValue.useMutation({ onSuccess: () => { toast({ title: "Saved" }); invalidate(); }, onError: onErr });
  const setStage = trpc.opportunities.setStage.useMutation({ onSuccess: () => { toast({ title: "Stage updated" }); invalidate(); }, onError: onErr });
  const archive = trpc.opportunities.archive.useMutation({
    onSuccess: () => { toast({ title: "Archived" }); setArchiveOpen(false); setArchiveReason(""); invalidate(); onClose(); },
    onError: onErr,
  });
  const unarchive = trpc.opportunities.unarchive.useMutation({
    onSuccess: () => { toast({ title: "Restored" }); invalidate(); },
    onError: onErr,
  });
  const markWon = trpc.opportunities.markWon.useMutation({ onSuccess: () => { toast({ title: "Marked Won" }); invalidate(); }, onError: onErr });
  const markLost = trpc.opportunities.markLost.useMutation({ onSuccess: () => { toast({ title: "Marked Lost" }); invalidate(); }, onError: onErr });
  const followUpLater = trpc.opportunities.followUpLater.useMutation({ onSuccess: () => { toast({ title: "Follow-up scheduled" }); invalidate(); }, onError: onErr });
  const createTask = trpc.opportunities.createTask.useMutation({ onSuccess: r => { toast({ title: r.gated ? "Task created (SMS gated)" : "Task created" }); invalidate(); }, onError: onErr });
  const completeTask = trpc.opportunities.completeTask.useMutation({ onSuccess: () => invalidate(), onError: onErr });
  const resolveConflict = trpc.opportunities.resolveCustomerConflict.useMutation({ onSuccess: () => { toast({ title: "Conflict resolved" }); invalidate(); }, onError: onErr });

  const o = data?.opportunity;
  const c = data?.customer;
  const primaryJob = data?.primaryJob ?? null;
  // Disable every stage/outcome control while any stage mutation is in flight,
  // so rapid clicks can't fire duplicate markWon/markLost/setStage calls.
  const stageMutating = setStage.isPending || markWon.isPending || markLost.isPending || followUpLater.isPending;

  // Day-3 forced decision: prompt when the deal is still OPEN but its follow-up
  // loop has expired — i.e. the day-3 decision task is open and now due.
  const decisionPending =
    !!o &&
    isOpenStage(o.stage) &&
    (data?.tasks ?? []).some(
      t => isDecisionTask(t) && t.status === "open" && new Date(t.dueAt).getTime() <= Date.now(),
    );

  const saveValue = () => {
    if (id == null) return;
    updateValue.mutate({
      id,
      opportunityValue: valueDraft === "" ? undefined : Number(valueDraft),
      probability: probDraft === "" ? null : Number(probDraft),
    });
  };
  // Task creation opens a dialog rather than firing immediately: the old one-click
  // button silently queued another identical "Call customer" every time it was pressed,
  // which is why cards ended up with five of them in the timeline.
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [closeIntent, setCloseIntent] = useState<"won" | "lost" | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("Call customer");
  const [taskType, setTaskType] = useState<"call" | "email" | "text">("call");
  const [taskDue, setTaskDue] = useState(() => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [taskAssignee, setTaskAssignee] = useState<string>("");
  const [taskBody, setTaskBody] = useState("");
  const { data: assignees = [] } = trpc.appointments.assignees.useQuery();

  const submitTask = () => {
    if (id == null || !taskTitle.trim()) return;
    createTask.mutate(
      {
        opportunityId: id,
        type: taskType,
        title: taskTitle.trim(),
        body: taskBody.trim() || undefined,
        dueAt: new Date(`${taskDue}T09:00:00`),
        assignedToId: taskAssignee ? Number(taskAssignee) : null,
      },
      { onSuccess: () => { setTaskOpen(false); setTaskBody(""); } },
    );
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="inset-y-0 h-full w-full overflow-y-auto p-0 sm:max-w-2xl lg:max-w-5xl">
        {isLoading || !o ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex flex-col">
            <SheetHeader className="shrink-0 space-y-2 px-4 pb-3 pt-5">
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-10 text-2xl font-bold leading-tight">
                {id != null && o.recordType === "commercial" ? (
                  <EditableCardTitle id={id} title={o.title ?? ""} />
                ) : (
                  <span>{o.title || formatDisplayName(c?.companyName || c?.displayName) || "Opportunity"}</span>
                )}
                {data?.opportunity.relationship ? (
                  <Badge variant="secondary" className={RELATIONSHIP_BADGE[data.opportunity.relationship] ?? ""}>{data.opportunity.relationship}</Badge>
                ) : null}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {formatDisplayName(c?.companyName || c?.displayName) || "No customer linked"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <StageBadge stage={o.stage} />
                <WorkCategoryBadge category={o.workCategory} />
                {o.stageOverridden ? <Badge variant="outline" className="text-[10px]">stage overridden</Badge> : null}
              </div>
            </SheetHeader>

            {/* Quick fields — Trello's chip row under the title: project type, priority,
                strategic flags, platform. Commercial records only; renders nothing else. */}
            {id != null ? (
              <div className="shrink-0 px-4 pb-2">
                <CommercialSections opportunityId={id} section="quickfields" />
              </div>
            ) : null}

            {/* Quick actions */}
            <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
              <ActionButton
                href={data?.salesDocuments.find(d => d.id === data.primaryDocumentId)?.documentLink ?? undefined}
                disabled={!data?.salesDocuments.find(d => d.id === data.primaryDocumentId)?.documentLink}
                icon={ExternalLink} label="QBO doc"
              />
              <ActionButton onClick={() => c && navigate(`/customers/${c.id}`)} disabled={!c} icon={User} label="Customer" />
              {String(o?.opportunityNumber ?? "").startsWith("ME-BID-") && !data?.salesDocuments?.length ? (
                <ActionButton
                  onClick={() => {
                    if (id != null && window.confirm("Create a $0 placeholder estimate in QuickBooks under this bid number, so the number is reserved there?")) {
                      reserveInQbo.mutate({ id });
                    }
                  }}
                  disabled={reserveInQbo.isPending}
                  icon={ExternalLink}
                  label={reserveInQbo.isPending ? "Reserving…" : "Reserve # in QB"}
                />
              ) : null}
              <ActionButton onClick={() => setTaskOpen(true)} icon={CalendarPlus} label="Task" />
            </div>

            {/* Stage / outcome actions */}
            <div className="flex shrink-0 flex-wrap gap-2 border-b px-4 pb-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" disabled={stageMutating}><GitBranch className="h-4 w-4" /> Change stage</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {/* Won/Lost are reached only via the dedicated close buttons below
                      (markWon/markLost — they set stageOverridden/closedAt + reason), so
                      the Change-stage menu offers open + parked stages only. */}
                  {STAGE_META.filter(s => s.value !== o.stage && s.classification !== "won" && s.classification !== "lost").map(s => (
                    <DropdownMenuItem key={s.value} disabled={stageMutating} onSelect={() => id != null && !stageMutating && setStage.mutate({ id, stage: s.value })}>{s.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Won and Lost close the opportunity, cancel its open follow-ups and feed
                  close-rate reporting, so both confirm first rather than firing on a click. */}
              {o.archivedAt ? (
                <Button variant="outline" size="sm" disabled={unarchive.isPending} className="gap-1" onClick={() => id != null && unarchive.mutate({ id })}>
                  <ArchiveRestore className="h-4 w-4" /> Restore
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="gap-1 text-muted-foreground" onClick={() => setArchiveOpen(true)}>
                  <Archive className="h-4 w-4" /> Archive
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={stageMutating || o.stage === "won"} className="gap-1 text-green-700" onClick={() => setCloseIntent("won")}><Trophy className="h-4 w-4" /> Won</Button>
              <Button variant="outline" size="sm" disabled={stageMutating || o.stage === "lost"} className="gap-1 text-red-700" onClick={() => setCloseIntent("lost")}><XCircle className="h-4 w-4" /> Lost</Button>
              <Button variant="outline" size="sm" disabled={stageMutating} className="gap-1" onClick={() => id != null && followUpLater.mutate({ id, days: 3 })}><Clock className="h-4 w-4" /> Follow up later</Button>
              <ConvertToJobControl opportunityId={id} primaryJob={primaryJob} onConverted={invalidate} />
            </div>

            {/* Trello card layout: the card body (description, fields, checklists) fills the
                main column; comments and activity sit in the right-hand column. Stacks to a
                single column below lg so nothing is lost on a phone. */}
            <div className="grid shrink-0 gap-8 px-4 pb-6 pt-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-5">
                {/* Description — Trello's card description, directly under the title row. */}
                {id != null ? <CommercialSections opportunityId={id} section="description" /> : null}
              {/* Day-3 forced decision — the loop expired and this deal is still open. */}
              {decisionPending ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4" /> Decision needed — the 3-day follow-up loop has ended
                  </p>
                  <p className="mt-1 text-xs text-amber-700">This deal is still open after its follow-up touches. Choose an outcome so it doesn't stall.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={stageMutating} className="gap-1 text-green-700" onClick={() => id != null && markWon.mutate({ id })}><Trophy className="h-4 w-4" /> Won</Button>
                    <Button size="sm" variant="outline" disabled={stageMutating} className="gap-1 text-red-700" onClick={() => id != null && markLost.mutate({ id })}><XCircle className="h-4 w-4" /> Lost</Button>
                    <Button size="sm" variant="outline" disabled={stageMutating} className="gap-1" onClick={() => id != null && followUpLater.mutate({ id, days: 3 })}><Clock className="h-4 w-4" /> Follow up later</Button>
                  </div>
                </div>
              ) : null}
              {/* Task 8A — CRM-authored tiered estimates (Good/Better/Best) + QBO push on approval.
                  Residential-only: commercial deals go out as bids, not Good/Better/Best tiers. */}
              {id != null && o.recordType !== "commercial" ? <EstimatesSection opportunityId={id} /> : null}
              {/* Conflicts */}
              {data && data.conflicts.length > 0 ? (
                <Section title="Sync conflicts (review)">
                  <div className="space-y-1.5">
                    {data.conflicts.map(cf => (
                      <div key={cf.id} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs">
                        <p className="font-medium">{cf.fieldName}: CRM "{cf.crmValue}" vs QBO "{cf.qboValue}"</p>
                        <div className="mt-1 flex gap-2">
                          <button className="text-[#1e3a5f] underline" onClick={() => resolveConflict.mutate({ conflictId: cf.id, resolution: "keep_crm" })}>Keep CRM</button>
                          <button className="text-[#1e3a5f] underline" onClick={() => resolveConflict.mutate({ conflictId: cf.id, resolution: "use_qbo" })}>Use QBO</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}
                {id != null && <CommercialSections opportunityId={id} />}
              {/* Money */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">QuickBooks Amount</p>
                  <p className="text-xl font-bold tabular-nums">{o.quickbooksAmount != null ? fmtMoney(o.quickbooksAmount) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">Read-only · from QuickBooks</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Opportunity Value (CRM)</p>
                  <div className="flex items-center gap-1">
                    <Input value={valueDraft} onChange={e => setValueDraft(e.target.value)} type="number" className="h-8" />
                  </div>
                  {o.valueDiffersFromQuickbooks ? <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600"><AlertTriangle className="h-3 w-3" /> CRM value differs from QuickBooks amount</p> : null}
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Probability %</p>
                  <Input value={probDraft} onChange={e => setProbDraft(e.target.value)} type="number" min={0} max={100} className="h-8" placeholder={String(o.effectiveProbability)} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Weighted value</p>
                  <p className="h-8 text-lg font-bold tabular-nums">{fmtMoney(o.weightedValue)}</p>
                </div>
                <Button size="sm" className="bg-[#1e3a5f]" onClick={saveValue} disabled={updateValue.isPending}>Save</Button>
              </div>
              {/* Contact */}
              <Section title="Contact">
                <div className="text-sm">
                  <p className="font-medium">{formatDisplayName(c?.displayName)}</p>
                  {c?.companyName ? <p className="text-muted-foreground">{formatDisplayName(c.companyName)}</p> : null}
                  <p className="text-muted-foreground">{c?.phone ?? "no phone"} · {c?.email ?? "no email"}</p>
                  {c?.quickbooksCustomerId ? <p className="text-[11px] text-muted-foreground">QBO customer #{c.quickbooksCustomerId}</p> : null}
                </div>
                {/* Reach the contact from where their details already are. Text routes to the
                    INTERNAL Communications thread, never the OS messaging app — see
                    client/src/__tests__/leadCustomerSmsInternal.test.ts. */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton href={c?.phone ? `tel:${c.phone}` : undefined} disabled={!c?.phone} icon={Phone} label="Call" />
                  <ActionButton onClick={() => c?.phone && navigate(internalSmsConversationPath(c.phone))} disabled={!c?.phone} icon={MessageSquare} label="Text" />
                  <ActionButton href={c?.email ? `mailto:${c.email}` : undefined} disabled={!c?.email} icon={Mail} label="Email" />
                </div>
              </Section>
              {/* Addresses */}
              <div className="grid grid-cols-2 gap-3">
                <Section title="Billing address">
                  <p className="text-sm text-muted-foreground">
                    {c?.billingLine1 ? <>{formatAddress(c.billingLine1)}{c.billingLine2 ? `, ${formatAddress(c.billingLine2)}` : ""}<br />{[formatDisplayName(c.billingCity), formatStateCode(c.billingState), c.billingZip].filter(Boolean).join(", ")}</> : "—"}
                  </p>
                </Section>
                <Section title="Service address">
                  {data && data.serviceAddresses.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {formatAddress(data.serviceAddresses[0].addressLine1)}<br />
                      {[formatDisplayName(data.serviceAddresses[0].city), formatStateCode(data.serviceAddresses[0].state), data.serviceAddresses[0].zip].filter(Boolean).join(", ")}
                    </p>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </Section>
              </div>
              {/* QBO document */}
              <Section title="QuickBooks document">
                {data && data.salesDocuments.length > 0 ? data.salesDocuments.map(d => (
                  <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <span className="font-mono">{d.docType} #{d.docNumber ?? d.quickbooksId}</span>
                      {d.status ? <Badge variant="secondary" className={`ml-2 ${DOC_STATUS_BADGE[d.status] ?? ""}`}>{d.status}</Badge> : null}
                      <p className="text-[11px] text-muted-foreground">Sent {fmtDate(d.sentAt)} · issued {fmtDate(d.txnDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{fmtMoney(Number(d.totalAmount))}</span>
                      {d.docType === "estimate" ? (
                        <button type="button" className="rounded border px-2 py-0.5 text-[11px] hover:bg-muted" onClick={() => openEstimatePdf(d.id)}>PDF</button>
                      ) : null}
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No QuickBooks document (manual opportunity).</p>}
              </Section>
              {/* Tasks */}
              <Section title="Follow-up tasks">
                {data && data.tasks.length > 0 ? data.tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{t.type}</Badge>
                      <Badge variant="outline" className="ml-1 text-[10px]">{t.status}</Badge>
                      <p className="text-[11px] text-muted-foreground">Due {fmtDate(t.dueAt)}</p>
                    </div>
                    {t.status === "open" || t.status === "gated" ? (
                      <Button size="sm" variant="ghost" onClick={() => completeTask.mutate({ taskId: t.id })}>Done</Button>
                    ) : null}
                  </div>
                )) : <p className="text-sm text-muted-foreground">No tasks.</p>}
              </Section>
              {/* Appointments */}
              <Section title="Appointments">
                {data && data.appointments.length > 0 ? data.appointments.slice(0, 5).map(a => (
                  <div key={a.id} className="rounded border p-2 text-sm">
                    <span className="font-medium">{a.appointmentType}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">{a.status}</Badge>
                    <p className="text-[11px] text-muted-foreground">{a.scheduledAt ? fmtDate(a.scheduledAt) : `${a.preferredDate} ${a.preferredTime}`}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No appointments.</p>}
              </Section>
              {/* Reasons */}
              {o.closeReason || o.lossReason ? (
                <Section title={o.stage === "won" ? "Close reason" : "Loss reason"}>
                  <p className="text-sm text-muted-foreground">{o.closeReason || o.lossReason}</p>
                </Section>
              ) : null}
              </div>

              <aside className="min-w-0 space-y-4 lg:border-l lg:pl-5">
                <h3 className="text-sm font-semibold">Comments and activity</h3>
                {id != null ? <CommercialSections opportunityId={id} section="activity" /> : null}
                            <Section title="Activity">
                <div className="space-y-2 border-l-2 pl-3">
                  {(data?.events ?? []).map(ev => (
                    <div key={ev.id} className="relative text-xs">
                      <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-[#1e3a5f]" />
                      <p className="font-medium">{ev.message ?? ev.type}</p>
                      <p className="text-muted-foreground">{fmtDate(ev.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </Section>
              </aside>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Archive is this system's "delete". Say plainly that nothing is lost, so nobody
          reaches for a real delete instead. */}
      <Dialog open={archiveOpen} onOpenChange={v => { if (!v) { setArchiveOpen(false); setArchiveReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Archive this opportunity?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              It disappears from the board and lists, and its open follow-ups are cancelled.
              Nothing is deleted — the checklists, comments, documents and history stay, and
              you can restore it at any time.
            </p>
            <div className="space-y-1">
              <Label htmlFor="archive-reason">Reason (optional)</Label>
              <Textarea
                id="archive-reason"
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder="Duplicate, created by mistake, customer withdrew…"
                className="min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setArchiveOpen(false); setArchiveReason(""); }}>Cancel</Button>
            <Button
              disabled={archive.isPending}
              onClick={() => id != null && archive.mutate({ id, reason: archiveReason.trim() || undefined })}
            >
              {archive.isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closing an opportunity is final in practice: it cancels open follow-ups and
          lands in close-rate reporting. Confirm, and capture the reason while it's fresh. */}
      <Dialog open={closeIntent !== null} onOpenChange={v => { if (!v) { setCloseIntent(null); setCloseNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark this opportunity {closeIntent === "won" ? "Won" : "Lost"}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {closeIntent === "won"
                ? "This closes the opportunity and cancels its open follow-ups. You can still convert it to a Job afterwards."
                : "This closes the opportunity and cancels its open follow-ups. A Lost opportunity can't be converted to a Job until you change its stage back."}
            </p>
            <div className="space-y-1">
              <Label htmlFor="close-note">{closeIntent === "won" ? "Close reason" : "Loss reason"} (optional)</Label>
              <Textarea
                id="close-note"
                value={closeNote}
                onChange={e => setCloseNote(e.target.value)}
                placeholder={closeIntent === "won" ? "Why did we win it?" : "Why did we lose it?"}
                className="min-h-[70px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCloseIntent(null); setCloseNote(""); }}>Cancel</Button>
            <Button
              className={closeIntent === "won" ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800"}
              disabled={stageMutating}
              onClick={() => {
                if (id == null || closeIntent == null) return;
                const note = closeNote.trim() || undefined;
                if (closeIntent === "won") markWon.mutate({ id, closeReason: note });
                else markLost.mutate({ id, lossReason: note });
                setCloseIntent(null);
                setCloseNote("");
              }}
            >
              {closeIntent === "won" ? "Mark Won" : "Mark Lost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New task / follow-up reminder. An "email" task is dispatched by the follow-up
          service on its due date; "call" stays a human to-do and is never auto-sent. */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="task-type">Type</Label>
                <select
                  id="task-type"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={taskType}
                  onChange={e => setTaskType(e.target.value as "call" | "email" | "text")}
                >
                  <option value="call">Call — reminder only</option>
                  <option value="email">Email — sends on due date</option>
                  <option value="text">Text — sends on due date</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-due">Due</Label>
                <input
                  id="task-due"
                  type="date"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={taskDue}
                  onChange={e => setTaskDue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="task-assignee">Assign to</Label>
              <select
                id="task-assignee"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={taskAssignee}
                onChange={e => setTaskAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="task-body">Notes {taskType !== "call" ? "(sent as the message body)" : ""}</Label>
              <Textarea id="task-body" value={taskBody} onChange={e => setTaskBody(e.target.value)} className="min-h-[70px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button onClick={submitTask} disabled={!taskTitle.trim() || createTask.isPending}>
              {createTask.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
