import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { outreachCampaignTemplates, type OutreachCampaignKey } from "@/lib/outreachCampaignTemplates";

export default function CrmOutreachReview() {
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    email: "", company: "", decisionMaker: "", sourceUrl: "",
    draftSubject: "", draftBody: "",
  });
  const [intakeResult, setIntakeResult] = useState("");
  const enqueue = trpc.crmOutreachReview.enqueue.useMutation({
    onSuccess: result => {
      if ("eligible" in result && result.eligible === false) {
        setIntakeResult(`Not queued: ${result.reason}`);
      } else {
        setIntakeResult("Draft saved for human approval. No message sent.");
        setForm({ email: "", company: "", decisionMaker: "", sourceUrl: "", draftSubject: "", draftBody: "" });
        drafts.refetch();
      }
    },
    onError: error => setIntakeResult(`Queue error: ${error.message}`),
  });
  const drafts = trpc.crmOutreachReview.list.useQuery(undefined, { retry: false });
  const decide = trpc.crmOutreachReview.decide.useMutation({ onSuccess: () => drafts.refetch() });
  const rows = (drafts.data ?? []).filter(row =>
    [row.email, row.company, row.decisionMaker, row.draftSubject]
      .some(value => (value ?? "").toLowerCase().includes(filter.toLowerCase()))
  );
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Outreach Review Queue</h1>
          <p className="text-sm text-muted-foreground">Review-only drafts. No automatic emails are sent from this page.</p>
        </div>
        <Button variant="outline" onClick={() => drafts.refetch()} disabled={drafts.isFetching}>Refresh</Button>
      </div>
      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Add a verified prospect for review</h2>
        <p className="text-sm text-muted-foreground">Enter a verified direct business email and its public HTTPS verification source. The CRM checks suppressions and previous outreach before saving a draft. Approval never sends an email.</p>
        <label className="block space-y-1 text-sm">
          <span>Optional campaign draft template</span>
          <select className="w-full rounded-md border bg-background p-2" defaultValue=""
            onChange={event => {
              const key = event.target.value as OutreachCampaignKey;
              const template = outreachCampaignTemplates[key];
              if (template) setForm(current => ({
                ...current, draftSubject: template.subject, draftBody: template.body,
              }));
            }}>
            <option value="">Start with a blank draft</option>
            {Object.entries(outreachCampaignTemplates).map(([key, template]) => (
              <option key={key} value={key}>{template.label}</option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Replace all bracketed placeholders with verified details. Templates do not send emails.</p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={event => {
          event.preventDefault();
          setIntakeResult("");
          enqueue.mutate({ ...form, verifiedAt: new Date() });
        }}>
          {(["company","decisionMaker","email","sourceUrl","draftSubject"] as const).map(key => (
            <label key={key} className="text-sm space-y-1">
              <span>{({company:"Company",decisionMaker:"Decision-maker name",email:"Verified business email",sourceUrl:"Public verification URL (HTTPS)",draftSubject:"Personalized email subject"})[key]}</span>
              <Input required type={key === "email" ? "email" : key === "sourceUrl" ? "url" : "text"}
                value={form[key]} onChange={e => setForm(current => ({...current,[key]:e.target.value}))}/>
            </label>
          ))}
          <label className="text-sm space-y-1 md:col-span-2">
            <span>Personalized outreach draft</span>
            <Textarea required rows={6} value={form.draftBody}
              onChange={e => setForm(current => ({...current,draftBody:e.target.value}))}/>
          </label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={enqueue.isPending}>{enqueue.isPending ? "Checking…" : "Check eligibility and queue draft"}</Button>
            <span className="text-xs text-muted-foreground">Review only · No automatic sending</span>
          </div>
        </form>
        {intakeResult && <p role="status" className="text-sm">{intakeResult}</p>}
      </section>
      <Input aria-label="Search outreach drafts" placeholder="Search company, contact or subject" value={filter} onChange={event => setFilter(event.target.value)} />
      {drafts.isLoading && <p role="status">Loading drafts…</p>}
      {drafts.error && <p role="alert" className="text-destructive">Unable to load review queue. Administrator access may be required.</p>}
      {!drafts.isLoading && !drafts.error && rows.length === 0 && <p>No matching drafts in the review queue.</p>}
      {decide.error && <p role="alert" className="text-destructive">Could not save review decision.</p>}
      <div className="space-y-4">
        {rows.map(row => (
          <article key={row.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <div><h2 className="font-semibold">{row.company}</h2><p className="text-sm">{row.decisionMaker} · {row.email}</p></div>
              <span className="text-xs text-muted-foreground">{row.status.replaceAll("_", " ")}</span>
            </div>
            <p className="font-medium">{row.draftSubject}</p>
            <p className="whitespace-pre-wrap text-sm">{row.draftBody}</p>
            <a className="text-sm underline" href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Verification source</a>
            {row.status === "needs_human_approval" && (
              <div className="flex gap-2">
                <Button disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: "approved" })}>Approve draft</Button>
                <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, decision: "rejected" })}>Reject</Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
