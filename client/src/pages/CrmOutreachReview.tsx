import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CrmOutreachReview() {
  const [filter, setFilter] = useState("");
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
