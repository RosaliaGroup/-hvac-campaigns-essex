import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RefreshCw } from "lucide-react";

type Props = { onOpenContact: (id: number) => void };
const labels = {
  human: "Personal follow-up",
  email_review: "Email review (day 3)",
  final_review: "Final check-in review",
};

export default function CrmFollowupTasks({ onOpenContact }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const tasks = trpc.crmFollowups.list.useQuery({ status: "open" });
  const sync = trpc.crmFollowups.syncOutreach.useMutation({
    onSuccess: result => { setJobId(result.jobId); setNotice("Checking Gmail outreach…"); },
    onError: error => setNotice(error.message),
  });
  const job = trpc.crmFollowups.syncJob.useQuery(
    { jobId: jobId ?? "" },
    { enabled: Boolean(jobId), refetchInterval: jobId ? 1500 : false }
  );
  const update = trpc.crmFollowups.updateStatus.useMutation({
    onSuccess: () => { void tasks.refetch(); setNotice("CRM task updated."); },
    onError: error => setNotice(error.message),
  });
  const assign = trpc.crmFollowups.assignToMe.useMutation({
    onSuccess: () => { void tasks.refetch(); setNotice("CRM task assigned to your account."); },
    onError: error => setNotice(error.message),
  });
  useEffect(() => {
    if (!jobId || job.isFetching) return;
    if (job.data?.status === "done") {
      const result = job.data.result as {
        created?: number; cancelled?: number; scanned?: number; note?: string; hasMore?: boolean;
      } | null;
      setNotice(result
        ? `Gmail scan complete: ${result.created ?? 0} tasks created, ${result.cancelled ?? 0} cancelled, ${result.scanned ?? 0} messages checked.${result.hasMore ? " More messages remain; rerun to backfill." : ""} ${result.note ?? ""}`
        : "Scan completed.");
      setJobId(null);
      void tasks.refetch();
    } else if (job.data?.status === "error" || job.data === null || job.error) {
      setNotice(job.data?.error ?? job.error?.message ?? "Follow-up scan interrupted.");
      setJobId(null);
    }
  }, [job.data, job.error, job.isFetching, jobId]);

  return (
    <section className="rounded-xl border bg-white p-4 space-y-3" aria-label="CRM prospect follow-up tasks">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-semibold">Prospect follow-up tasks</h2>
          <p className="text-xs text-slate-500">
            For Ana Haynes · Day 2 personal contact, day 3 email review, day 33 final review.
            No automatic email or SMS is sent from this panel.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={sync.isPending || Boolean(jobId)}
          onClick={() => sync.mutate({ lookbackDays: 35 })}>
          <RefreshCw className="h-4 w-4 mr-2" /> Sync outreach tasks
        </Button>
      </div>
      {notice && <p className="text-xs text-slate-700" role="status">{notice}</p>}
      {tasks.error && <p role="alert" className="text-sm text-red-600">{tasks.error.message}</p>}
      {tasks.isLoading && <p className="text-sm">Loading follow-up tasks…</p>}
      {tasks.data?.length === 0 && <p className="text-sm text-slate-500">
        No open follow-up tasks. Use Sync outreach tasks to import labeled Gmail introductions.
      </p>}
      {Boolean(tasks.data?.length) && (
        <div className="max-h-64 overflow-y-auto divide-y">
          {tasks.data?.map(task => (
            <div key={task.id} className="flex flex-wrap gap-3 items-center justify-between py-2">
              <div className="min-w-0">
                <button type="button" className="text-left font-medium text-blue-700 hover:underline"
                  onClick={() => onOpenContact(task.externalContactId)}>
                  {task.name && task.name !== task.recipientEmail ? task.name : task.recipientEmail}
                </button>
                <div className="text-xs text-slate-600">
                  {task.company ? `${task.company} · ` : ""}{labels[task.kind]} ·
                  Due {new Date(task.dueAt).toLocaleString("en-US", {
                    timeZone: "America/New_York", month: "short", day: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })} ET
                </div>
                {!task.assignedToUserId && <div className="text-xs text-amber-700">CRM user assignment not linked yet</div>}
                <a className="text-xs text-blue-700 hover:underline" target="_blank" rel="noreferrer"
                  href={`https://mail.google.com/mail/u/?authuser=sales%40mechanicalenterprise.com#all/${encodeURIComponent(task.introThreadId)}`}>
                  Original Gmail thread
                </a>
              </div>
              {!task.assignedToUserId && (
                <Button size="sm" variant="outline" disabled={assign.isPending}
                  onClick={() => assign.mutate({ id: task.id })}>Assign to me</Button>
              )}
              <Button size="sm" variant="outline" disabled={update.isPending}
                onClick={() => update.mutate({ id: task.id, status: "done" })}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Done
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
