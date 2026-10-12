import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Admin-only diagnostic surface. Never sends or changes follow-up tasks. */
export default function FollowupDeliveryDiagnostics() {
  const [entry, setEntry] = useState("");
  const [taskId, setTaskId] = useState<number | null>(null);
  const preflight = trpc.crmFollowups.deliveryPreflight.useQuery(
    { id: taskId ?? 1 }, { enabled: taskId !== null, retry: false });
  const reconciliation = trpc.crmFollowups.deliveryReconciliation.useQuery(
    { id: taskId ?? 1 }, { enabled: taskId !== null, retry: false });
  return <section className="rounded-xl border bg-white p-4 space-y-3">
    <h2 className="font-semibold">Follow-up delivery diagnostics</h2>
    <p className="text-sm text-slate-600">Check one CRM task's sending safeguards and Gmail reconciliation. Read-only; this never sends an email.</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault();
      const id = Number(entry);
      if (Number.isSafeInteger(id) && id > 0) setTaskId(id);
    }}>
      <label className="text-sm">CRM follow-up task ID
        <Input type="number" min={1} step={1} required value={entry}
          onChange={event => setEntry(event.target.value)} />
      </label>
      <Button type="submit">Check task</Button>
      {taskId !== null && <Button type="button" variant="outline"
        onClick={() => { void preflight.refetch(); void reconciliation.refetch(); }}>Refresh results</Button>}
    </form>
    {taskId !== null && <>
      {(preflight.isLoading || reconciliation.isLoading) && <p role="status">Checking task {taskId}…</p>}
      {(preflight.error || reconciliation.error) && <p role="alert" className="text-red-700">
        Unable to inspect task. Administrator access may be required.
      </p>}
      {preflight.data && <p className="text-sm">Preflight: {preflight.data.eligible ? "Eligible" : preflight.data.reason ?? "Blocked"}</p>}
      {preflight.data?.signals && <div className="rounded-md border p-3 space-y-2">
        <h3 className="text-sm font-semibold">Current delivery safeguards</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {([
            ["Suppressed / opted out", preflight.data.signals.suppressed],
            ["Inbound reply recorded", preflight.data.signals.inbound],
            ["Later outbound recorded", preflight.data.signals.laterOutbound],
            ["Valid task owner", preflight.data.signals.validOwner],
            ["Gmail send permission", preflight.data.signals.gmailSendPermission],
          ] as const).map(([label, value]) => <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt><dd className="font-medium">{value ? "Yes" : "No"}</dd>
          </div>)}
        </dl>
        <p className="text-xs text-slate-600">Sending remains disabled independently of these signals. A green check is not authorization to send.</p>
      </div>}
      {reconciliation.data && <p className="text-sm">Gmail reconciliation: {reconciliation.data.state.replaceAll("_", " ")}</p>}
    </>}
  </section>;
}
