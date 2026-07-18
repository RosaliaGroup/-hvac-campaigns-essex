/**
 * Phase 2A — Conversation CRM panel.
 *
 * Compact, actionable CRM context for the open SMS conversation: lead, customer,
 * property (with selector when a customer has several), upcoming appointment, and
 * open job. Loaded ASYNCHRONOUSLY via its own query — it never blocks the thread
 * or replies. Read-only + navigation + quick-create-by-navigation (reuses the
 * existing create screens with prefill; no record is created from here directly).
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, UserPlus, Home, Wrench, CalendarClock, User2, AlertTriangle } from "lucide-react";

function fmtAddr(p: { addressLine1: string; addressLine2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) {
  return [p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.zip].filter(Boolean).join(" · ");
}

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b last:border-b-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{icon}{title}</div>
      {children}
    </div>
  );
}
function NotLinked({ children }: { children?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-sm text-gray-400">Not linked</span>{children}</div>;
}

export function ConversationCrmPanel({ phone, contactName }: { phone: string; contactName?: string | null }) {
  // Explicit user selections for ambiguous customer / multi-property (session-only).
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = trpc.smsCampaigns.conversationCrmContext.useQuery(
    { phone, customerId, propertyId },
    { enabled: !!phone },
  );

  const prefill = `?phone=${encodeURIComponent(phone)}${contactName ? `&name=${encodeURIComponent(contactName)}` : ""}`;

  return (
    <div className="border rounded-lg bg-white p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-[#1e3a5f]">CRM Context</span>
        <button className="text-gray-400 hover:text-gray-600" onClick={() => refetch()} aria-label="Refresh CRM context">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-gray-400 text-xs flex items-center justify-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Loading CRM context…</div>
      ) : isError ? (
        <div className="py-4 text-center text-red-600 text-xs flex items-center justify-center gap-1.5">
          <AlertTriangle className="h-4 w-4" /> Couldn’t load CRM context. <button className="underline" onClick={() => refetch()}>Retry</button>
        </div>
      ) : !data ? null : (
        <div>
          {/* Lead */}
          <Row icon={<User2 className="h-3 w-3" />} title="Lead">
            {data.lead.matches.length === 0 ? (
              <NotLinked><Link href={`/leads${prefill}`}><Button size="sm" variant="outline" className="h-7 gap-1"><UserPlus className="h-3 w-3" />Create Lead</Button></Link></NotLinked>
            ) : data.lead.ambiguous && data.lead.selectedId == null ? (
              <div className="text-amber-700 text-xs mb-1">Multiple leads match — choose one:</div>
            ) : null}
            {data.lead.matches.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 py-0.5">
                <span className="truncate">{l.name} <Badge variant="outline" className="ml-1">{l.status}</Badge> <span className="text-xs text-gray-400">{l.priority}</span></span>
                <Link href="/leads"><ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-[#ff6b35]" /></Link>
              </div>
            ))}
          </Row>

          {/* Customer */}
          <Row icon={<User2 className="h-3 w-3" />} title="Customer">
            {data.customer.matches.length === 0 ? (
              <NotLinked><Link href={`/customers${prefill}`}><Button size="sm" variant="outline" className="h-7 gap-1"><UserPlus className="h-3 w-3" />Create Customer</Button></Link></NotLinked>
            ) : (
              <>
                {data.customer.ambiguous && (
                  <div className="text-amber-700 text-xs mb-1">Multiple customers match — select the correct one.</div>
                )}
                {data.customer.matches.map((c) => (
                  <div key={c.id} className={`flex items-center justify-between gap-2 py-0.5 ${data.customer.selectedId === c.id ? "" : "opacity-70"}`}>
                    <label className="truncate flex items-center gap-1.5 cursor-pointer">
                      {data.customer.ambiguous && <input type="radio" name="crm-customer" checked={data.customer.selectedId === c.id} onChange={() => { setCustomerId(c.id); setPropertyId(null); }} />}
                      <span className="truncate">{c.displayName} <Badge variant="outline" className="ml-1">{c.status}</Badge></span>
                    </label>
                    <Link href={`/customers/${c.id}`}><ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-[#ff6b35]" /></Link>
                  </div>
                ))}
              </>
            )}
          </Row>

          {/* Property */}
          <Row icon={<Home className="h-3 w-3" />} title="Property">
            {data.customer.selectedId == null ? (
              <span className="text-xs text-gray-400">Select a customer to see properties.</span>
            ) : data.properties.length === 0 ? (
              <NotLinked>{data.customer.selectedId && <Link href={`/customers/${data.customer.selectedId}`}><Button size="sm" variant="outline" className="h-7 gap-1"><UserPlus className="h-3 w-3" />Add Property</Button></Link>}</NotLinked>
            ) : (
              <>
                {data.properties.length > 1 && <div className="text-xs text-gray-500 mb-1">{data.properties.length} properties — pick the service address:</div>}
                {data.properties.map((p) => {
                  const sel = (data.selectedPropertyId ?? (data.properties.length === 1 ? data.properties[0].id : null)) === p.id;
                  return (
                    <label key={p.id} className={`flex items-start justify-between gap-2 py-0.5 cursor-pointer ${sel ? "font-medium" : "opacity-80"}`}>
                      <span className="flex items-start gap-1.5">
                        {data.properties.length > 1 && <input type="radio" name="crm-prop" className="mt-1" checked={sel} onChange={() => setPropertyId(p.id)} />}
                        <span>{p.label ? <span className="text-gray-500">{p.label}: </span> : null}{fmtAddr(p)}</span>
                      </span>
                      <Link href={`/customers/${data.customer.selectedId}`}><ExternalLink className="h-3.5 w-3.5 mt-0.5 text-gray-400 hover:text-[#ff6b35]" /></Link>
                    </label>
                  );
                })}
              </>
            )}
          </Row>

          {/* Upcoming appointment */}
          <Row icon={<CalendarClock className="h-3 w-3" />} title="Upcoming appointment">
            {data.appointment.matches.length === 0 ? <NotLinked /> : (() => {
              const a = data.appointment.matches[0];
              return (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {a.scheduledAt ? new Date(a.scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    <Badge variant="outline" className="ml-1">{a.status}</Badge>
                    {a.assignedToId ? <span className="text-xs text-gray-400 ml-1">tech #{a.assignedToId}</span> : null}
                  </span>
                  {data.appointment.matches.length > 1 && <span className="text-xs text-gray-400">+{data.appointment.matches.length - 1} more</span>}
                </div>
              );
            })()}
          </Row>

          {/* Open job */}
          <Row icon={<Wrench className="h-3 w-3" />} title="Open job">
            {data.job.matches.length === 0 ? <NotLinked /> : (() => {
              const j = data.job.matches[0];
              return (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{j.jobNumber || j.title} <Badge variant="outline" className="ml-1">{j.status}</Badge> <span className="text-xs text-gray-400">{j.priority}</span>{j.assignedToId ? <span className="text-xs text-gray-400 ml-1">tech #{j.assignedToId}</span> : null}</span>
                  <span className="flex items-center gap-1.5">
                    {data.job.matches.length > 1 && <span className="text-xs text-gray-400">+{data.job.matches.length - 1}</span>}
                    <Link href={`/jobs/${j.id}`}><ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-[#ff6b35]" /></Link>
                  </span>
                </div>
              );
            })()}
          </Row>
        </div>
      )}
    </div>
  );
}
