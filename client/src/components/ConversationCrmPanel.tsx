/**
 * Conversation → CRM workspace panel (Phase 2).
 *
 * Lazy-loaded strip shown above the SMS thread. Resolves the conversation's
 * phone to its CRM records and lets staff open the linked Customer/Lead/
 * Property/Appointment/Job/Estimate/Invoice, disambiguate multiple matches,
 * pick a property, or quick-create a Lead/Customer when nothing is linked.
 *
 * It loads on its own query (enabled per selected phone) so it never blocks the
 * Phase-1 thread render — the thread appears first, the CRM strip fills in.
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, UserPlus, Link2, Users, Home, CalendarClock, Briefcase, FileText, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Field({ label, value, onOpen }: { label: string; value?: string | null; onOpen?: () => void }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="flex items-center gap-1">
        {value ? (
          <span className="text-xs text-gray-800 truncate">{value}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">Not linked</span>
        )}
        {value && onOpen && (
          <button onClick={onOpen} title={`Open ${label}`} className="text-[#1e3a5f] hover:text-[#ff6b35] shrink-0">
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConversationCrmPanel({ phone }: { phone: string }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { toast } = useToast();

  const { data: ctx, isLoading } = trpc.conversationCrm.context.useQuery({ phone }, { enabled: !!phone });
  const invalidate = () => utils.conversationCrm.context.invalidate({ phone });

  const linkM = trpc.conversationCrm.link.useMutation({ onSuccess: () => { invalidate(); toast({ title: "Conversation linked" }); }, onError: (e) => toast({ title: "Link failed", description: e.message, variant: "destructive" }) });
  const unlinkM = trpc.conversationCrm.unlink.useMutation({ onSuccess: () => { invalidate(); toast({ title: "Link removed" }); } });
  const selPropM = trpc.conversationCrm.selectProperty.useMutation({ onSuccess: invalidate });
  const createLeadM = trpc.conversationCrm.quickCreateLead.useMutation({ onSuccess: () => { invalidate(); toast({ title: "Lead created & linked" }); } });
  const createCustM = trpc.conversationCrm.quickCreateCustomer.useMutation({ onSuccess: () => { invalidate(); toast({ title: "Customer created & linked" }); } });
  const busy = linkM.isPending || createLeadM.isPending || createCustM.isPending;

  if (isLoading || !ctx) {
    return (
      <div className="px-4 py-2 border-b bg-gray-50 text-xs text-gray-400 flex items-center gap-2">
        <RefreshCw className="h-3 w-3 animate-spin" /> Loading CRM…
      </div>
    );
  }

  // Multiple matches — never auto-linked; user picks.
  if (ctx.status === "ambiguous") {
    return (
      <div className="px-4 py-2 border-b bg-amber-50 space-y-1.5">
        <div className="text-xs font-medium text-amber-800 flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Multiple CRM matches — choose one to link:</div>
        <div className="flex flex-wrap gap-1.5">
          {ctx.candidates.customers.map((c) => (
            <Button key={`c${c.id}`} size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy} onClick={() => linkM.mutate({ phone, target: "customer", id: c.id })}>
              <Users className="h-3 w-3" /> {c.name || `Customer #${c.id}`}
            </Button>
          ))}
          {ctx.candidates.leads.map((l) => (
            <Button key={`l${l.id}`} size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy} onClick={() => linkM.mutate({ phone, target: "lead", id: l.id })}>
              Lead: {l.name || `#${l.id}`}
            </Button>
          ))}
          {ctx.candidates.leadCaptures.map((l) => (
            <Button key={`lc${l.id}`} size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy} onClick={() => linkM.mutate({ phone, target: "leadCapture", id: l.id })}>
              Lead: {l.name || `#${l.id}`}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // No match — offer quick-create.
  if (ctx.status === "unlinked") {
    return (
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-500 italic">Not linked to any CRM record.</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy} onClick={() => createLeadM.mutate({ phone })}>
            <UserPlus className="h-3 w-3" /> Create Lead
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={busy} onClick={() => createCustM.mutate({ phone })}>
            <UserPlus className="h-3 w-3" /> Create Customer
          </Button>
        </div>
      </div>
    );
  }

  // linked | single — the workspace header
  const cust = ctx.customer;
  const custHref = cust ? () => navigate(`/customers/${cust.id}`) : undefined;
  const apptVal = ctx.appointment
    ? [ctx.appointment.status, ctx.appointment.scheduledAt ? new Date(ctx.appointment.scheduledAt).toLocaleString() : null, ctx.appointment.assignedTo].filter(Boolean).join(" · ")
    : null;

  return (
    <div className="px-4 py-2 border-b bg-white space-y-2">
      {ctx.status === "single" && (
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
          <Link2 className="h-3.5 w-3.5" /> Auto-matched (unconfirmed).
          <Button size="sm" variant="outline" className="h-6 text-[11px] ml-auto" disabled={busy}
            onClick={() => cust ? linkM.mutate({ phone, target: "customer", id: cust.id }) : ctx.lead ? linkM.mutate({ phone, target: "lead", id: ctx.lead.id }) : ctx.leadCapture ? linkM.mutate({ phone, target: "leadCapture", id: ctx.leadCapture.id }) : undefined}>
            Confirm link
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5">
        <Field label="Customer" value={cust?.name} onOpen={custHref} />
        <Field label="Lead" value={ctx.lead?.name ?? ctx.leadCapture?.name} onOpen={(ctx.lead || ctx.leadCapture) ? () => navigate("/leads") : undefined} />
        <Field label="Property" value={ctx.selectedProperty?.address} onOpen={custHref} />
        <Field label="Appointment" value={apptVal} onOpen={ctx.appointment ? () => navigate("/calendar") : undefined} />
        <Field label="Job" value={ctx.job ? [ctx.job.jobNumber, ctx.job.status, ctx.job.priority].filter(Boolean).join(" · ") : null} onOpen={ctx.job ? () => navigate(`/jobs/${ctx.job!.id}`) : undefined} />
        <Field label="Open Estimate" value={ctx.estimate ? `$${ctx.estimate.amount ?? "0"} · ${ctx.estimate.status ?? ""}` : null} onOpen={custHref} />
        <Field label="Invoice Balance" value={ctx.invoice ? `$${ctx.invoice.balance ?? "0"} · ${ctx.invoice.status ?? ""}` : null} onOpen={custHref} />
        <Field label="Phone" value={ctx.phone} />
      </div>

      {ctx.properties.length > 1 && (
        <div className="flex items-center gap-2">
          <Home className="h-3.5 w-3.5 text-gray-400" />
          <select
            className="text-xs border rounded px-2 py-1 max-w-[280px]"
            value={ctx.selectedProperty?.id ?? ""}
            onChange={(e) => selPropM.mutate({ phone, propertyId: Number(e.target.value) })}
          >
            {ctx.properties.map((p) => (
              <option key={p.id} value={p.id}>{p.label ? `${p.label} — ` : ""}{p.address}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-400">(remembered per conversation)</span>
        </div>
      )}

      <div className="flex items-center gap-3 pt-0.5">
        {cust && <button onClick={() => navigate(`/customers/${cust.id}`)} className="text-[11px] text-[#1e3a5f] hover:underline flex items-center gap-1"><Users className="h-3 w-3" /> Open Customer</button>}
        {ctx.job && <button onClick={() => navigate(`/jobs/${ctx.job!.id}`)} className="text-[11px] text-[#1e3a5f] hover:underline flex items-center gap-1"><Briefcase className="h-3 w-3" /> Open Job</button>}
        {ctx.appointment && <button onClick={() => navigate("/calendar")} className="text-[11px] text-[#1e3a5f] hover:underline flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Calendar</button>}
        {ctx.estimate && <button onClick={custHref} className="text-[11px] text-[#1e3a5f] hover:underline flex items-center gap-1"><FileText className="h-3 w-3" /> Estimate</button>}
        {ctx.invoice && <button onClick={custHref} className="text-[11px] text-[#1e3a5f] hover:underline flex items-center gap-1"><Receipt className="h-3 w-3" /> Invoice</button>}
        <button onClick={() => unlinkM.mutate({ phone, target: "all" })} className="text-[11px] text-gray-400 hover:text-red-600 ml-auto">Unlink</button>
      </div>
    </div>
  );
}
