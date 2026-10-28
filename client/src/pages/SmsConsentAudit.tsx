import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const METHODS: Array<{ value: "signed_written_form" | "external_web_form" | "consumer_text_request" | "third_party_lead_form"; label: string }> = [
  { value: "signed_written_form", label: "Signed written / e-signed form" },
  { value: "external_web_form", label: "Web or ad form outside the CRM" },
  { value: "consumer_text_request", label: "Consumer texted us requesting texts" },
  { value: "third_party_lead_form", label: "Lead-gen form naming Mechanical Enterprise" },
];

const SUMMARY_LABELS: Array<[string, string]> = [
  ["total", "Contacts in cohort"], ["createdOct27", "Created Oct 27"], ["inactive", "Inactive"],
  ["active", "Active"], ["withValidPhone", "Valid phone"], ["distinctPhones", "Distinct phones"],
  ["withEmail", "Real email"], ["placeholderEmail", "Placeholder email"],
];

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function SmsConsentAudit() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const audit = trpc.smsConsent.cohortAudit.useQuery({ source: "hvac-list-07105" }, { staleTime: 60_000 });
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ id: number; name: string; phone: string | null } | null>(null);
  const [form, setForm] = useState({ method: "signed_written_form" as typeof METHODS[number]["value"],
    consentLanguage: "", evidenceReference: "", evidenceNotes: "", obtainedAt: "", attested: false });
  const [notice, setNotice] = useState("");
  const record = trpc.smsConsent.record.useMutation();
  const revoke = trpc.smsConsent.revoke.useMutation();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (audit.data?.rows ?? []).filter(r =>
      (filter === "all" || (filter === "eligible" ? r.eligible : r.reason === filter)) &&
      (!q || r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q.replace(/\D/g, "") || "~")));
  }, [audit.data, filter, search]);

  const labels = audit.data?.reasonLabels ?? {};
  const reasonText = (r: { eligible: boolean; reason: string | null }) =>
    (labels as Record<string, string>)[r.eligible ? "eligible" : (r.reason ?? "verification_error")] ?? r.reason ?? "";

  function downloadCsv() {
    const header = ["customer_id", "name", "phone", "crm_status", "sms_eligible", "reason", "consent_source"];
    const lines = [header.join(",")].concat((audit.data?.rows ?? []).map(r =>
      [r.id, r.name, r.phone, r.status, r.eligible ? "yes" : "no", reasonText(r), r.consentSource].map(csvCell).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sms-consent-audit-hvac-list-07105-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function submitConsent() {
    if (!target) return;
    setNotice("");
    try {
      const res = await record.mutateAsync({ customerId: target.id, ...form,
        evidenceNotes: form.evidenceNotes || undefined });
      setNotice(res.review?.eligible
        ? `${target.name}: consent recorded — now eligible for texting.`
        : `${target.name}: consent recorded, but still blocked — ${reasonText(res.review!)}.`);
      setTarget(null);
      void audit.refetch();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not record consent");
    }
  }

  async function revokeConsent(id: number, name: string) {
    const reason = window.prompt(`Why is SMS consent for ${name} being revoked?`);
    if (!reason || reason.trim().length < 3) return;
    try {
      await revoke.mutateAsync({ customerId: id, reason });
      setNotice(`${name}: consent revoked.`);
      void audit.refetch();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not revoke consent");
    }
  }

  const s = audit.data?.summary ?? {};
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">SMS consent audit — purchased homeowner list</h1>
            <p className="text-sm text-slate-600">Source <code>hvac-list-07105</code> (Dataman). Every contact is checked the same way the
              “Text selected” send is checked. Being on a purchased list is not consent.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/customers"><Button variant="outline" size="sm">Back to contacts</Button></Link>
            <Button variant="outline" size="sm" onClick={() => void audit.refetch()} disabled={audit.isFetching}>
              {audit.isFetching ? "Checking…" : "Re-run audit"}</Button>
            <Button size="sm" onClick={downloadCsv} disabled={!audit.data}>Download CSV</Button>
          </div>
        </div>

        {audit.error && <p className="text-red-700 text-sm">Audit failed: {audit.error.message}</p>}
        {notice && <p role="status" className="rounded border p-2 text-sm">{notice}</p>}

        {audit.data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SUMMARY_LABELS.map(([k, label]) => (
                <div key={k} className="rounded border p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-xl font-semibold">{(s[k] ?? 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div className="rounded border p-3 space-y-1">
              <p className="font-medium text-sm">SMS eligibility (checked {new Date(audit.data.generatedAt).toLocaleString()})</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
                  All ({audit.data.rows.length})</Button>
                {Object.entries(audit.data.byReason).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
                    {(labels as Record<string, string>)[k] ?? k} ({n})</Button>
                ))}
              </div>
            </div>
          </>
        )}

        <Input placeholder="Search name or phone" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        {audit.isLoading ? <p className="text-sm">Checking every contact…</p> : (
          <div className="rounded border overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>CRM status</TableHead>
                <TableHead>SMS</TableHead><TableHead>Why</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.slice(0, 300).map(r => (
                  <TableRow key={r.id}>
                    <TableCell><Link href={`/customers/${r.id}`} className="underline">{r.name}</Link></TableCell>
                    <TableCell>{r.phone ?? "—"}</TableCell>
                    <TableCell>{r.status ?? "—"}</TableCell>
                    <TableCell className={r.eligible ? "text-green-700" : "text-amber-700"}>{r.eligible ? "Eligible" : "Blocked"}</TableCell>
                    <TableCell className="text-sm">{reasonText(r)}{r.consentSource ? ` (${r.consentSource === "web_form" ? "website form" : "documented record"})` : ""}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isAdmin && r.reason === "no_verified_sms_consent" && (
                        <Button size="sm" variant="outline" onClick={() => { setTarget(r); setNotice(""); }}>Record consent</Button>)}
                      {r.consentSource === "documented_record" && user?.teamRole !== "viewer" && (
                        <Button size="sm" variant="ghost" onClick={() => void revokeConsent(r.id, r.name)}>Revoke</Button>)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 300 && <p className="p-2 text-xs text-slate-500">Showing 300 of {rows.length}. Filter, search, or download the CSV for all rows.</p>}
          </div>
        )}
      </div>

      <Dialog open={Boolean(target)} onOpenChange={o => { if (!o) setTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record SMS consent — {target?.name}</DialogTitle>
            <DialogDescription>
              Only record consent this person actually gave Mechanical Enterprise for {target?.phone ?? "this number"}.
              The purchased list or its invoice is not consent. A later STOP always overrides this record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="font-medium" htmlFor="consent-method">How was consent given?</label>
            <select id="consent-method" className="w-full rounded-md border px-3 py-2" value={form.method}
              onChange={e => setForm({ ...form, method: e.target.value as typeof form.method })}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <label className="font-medium" htmlFor="consent-language">Exact consent wording they agreed to</label>
            <Textarea id="consent-language" rows={4} value={form.consentLanguage}
              placeholder="e.g. By signing, I agree to receive marketing text messages from Mechanical Enterprise LLC at the number above…"
              onChange={e => setForm({ ...form, consentLanguage: e.target.value })} />
            <label className="font-medium" htmlFor="consent-ref">Evidence reference</label>
            <Input id="consent-ref" value={form.evidenceReference}
              placeholder="Signed-form file link, e-sign ID, form submission ID, or SMS message ID"
              onChange={e => setForm({ ...form, evidenceReference: e.target.value })} />
            <label className="font-medium" htmlFor="consent-date">Date consent was given</label>
            <Input id="consent-date" type="date" value={form.obtainedAt}
              onChange={e => setForm({ ...form, obtainedAt: e.target.value })} />
            <label className="font-medium" htmlFor="consent-notes">Notes (optional)</label>
            <Textarea id="consent-notes" rows={2} value={form.evidenceNotes}
              onChange={e => setForm({ ...form, evidenceNotes: e.target.value })} />
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={form.attested} onChange={e => setForm({ ...form, attested: e.target.checked })} />
              <span>I reviewed this evidence. It shows this person's own agreement to receive marketing texts from Mechanical Enterprise at this number.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button disabled={record.isPending || !form.attested || !form.obtainedAt} onClick={() => void submitConsent()}>
              {record.isPending ? "Saving…" : "Save consent record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
