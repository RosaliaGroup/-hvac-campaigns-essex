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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayName, formatAddress, formatStateCode } from "@shared/nameFormat";
import {
  Phone, MessageSquare, Mail, ExternalLink, User, CalendarPlus, GitBranch, Trophy, XCircle, Clock, AlertTriangle,
} from "lucide-react";
import { ConvertToJobControl } from "./ConvertToJobControl";
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
  const cls = "flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-medium hover:bg-muted disabled:opacity-40";
  if (href && !disabled) {
    return <a href={href} className={cls}><Icon className="h-4 w-4" />{label}</a>;
  }
  return <button onClick={onClick} disabled={disabled} className={cls}><Icon className="h-4 w-4" />{label}</button>;
}

export default function OpportunityDetailDrawer({ id, open, onClose }: { id: number | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
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

  const saveValue = () => {
    if (id == null) return;
    updateValue.mutate({
      id,
      opportunityValue: valueDraft === "" ? undefined : Number(valueDraft),
      probability: probDraft === "" ? null : Number(probDraft),
    });
  };
  const addCallTask = () => {
    if (id == null) return;
    createTask.mutate({ opportunityId: id, type: "call", title: "Call customer", dueAt: new Date(Date.now() + 24 * 3600 * 1000) });
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        {isLoading || !o ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex flex-col">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="flex items-center gap-2 text-lg">
                {formatDisplayName(c?.companyName || c?.displayName) || "Opportunity"}
                {data?.opportunity.relationship ? (
                  <Badge variant="secondary" className={RELATIONSHIP_BADGE[data.opportunity.relationship] ?? ""}>{data.opportunity.relationship}</Badge>
                ) : null}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <StageBadge stage={o.stage} />
                <WorkCategoryBadge category={o.workCategory} />
                {o.stageOverridden ? <Badge variant="outline" className="text-[10px]">stage overridden</Badge> : null}
              </div>
            </SheetHeader>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-2 border-b p-3 sm:grid-cols-6">
              <ActionButton href={c?.phone ? `tel:${c.phone}` : undefined} disabled={!c?.phone} icon={Phone} label="Call" />
              <ActionButton href={c?.phone ? `sms:${c.phone}` : undefined} disabled={!c?.phone} icon={MessageSquare} label="Text" />
              <ActionButton href={c?.email ? `mailto:${c.email}` : undefined} disabled={!c?.email} icon={Mail} label="Email" />
              <ActionButton
                href={data?.salesDocuments.find(d => d.id === data.primaryDocumentId)?.documentLink ?? undefined}
                disabled={!data?.salesDocuments.find(d => d.id === data.primaryDocumentId)?.documentLink}
                icon={ExternalLink} label="QBO doc"
              />
              <ActionButton onClick={() => c && navigate(`/customers/${c.id}`)} disabled={!c} icon={User} label="Customer" />
              <ActionButton onClick={addCallTask} icon={CalendarPlus} label="Task" />
            </div>

            {/* Stage / outcome actions */}
            <div className="flex flex-wrap gap-2 border-b p-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" disabled={stageMutating}><GitBranch className="h-4 w-4" /> Change stage</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {STAGE_META.filter(s => s.value !== o.stage).map(s => (
                    <DropdownMenuItem key={s.value} disabled={stageMutating} onSelect={() => id != null && !stageMutating && setStage.mutate({ id, stage: s.value })}>{s.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" disabled={stageMutating || o.stage === "won"} className="gap-1 text-green-700" onClick={() => id != null && markWon.mutate({ id })}><Trophy className="h-4 w-4" /> Won</Button>
              <Button variant="outline" size="sm" disabled={stageMutating || o.stage === "lost"} className="gap-1 text-red-700" onClick={() => id != null && markLost.mutate({ id })}><XCircle className="h-4 w-4" /> Lost</Button>
              <Button variant="outline" size="sm" disabled={stageMutating} className="gap-1" onClick={() => id != null && followUpLater.mutate({ id, days: 3 })}><Clock className="h-4 w-4" /> Follow up later</Button>
              <ConvertToJobControl opportunityId={id} primaryJob={primaryJob} onConverted={invalidate} />
            </div>

            <div className="space-y-5 p-4">
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
                    <span className="font-medium tabular-nums">{fmtMoney(Number(d.totalAmount))}</span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No QuickBooks document (manual opportunity).</p>}
              </Section>

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

              {/* Timeline */}
              <Section title="Timeline">
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
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
