import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Props = { onOpenContact: (id: number) => void };
const stepLabels: Record<number, string> = {
  2: "Personal introduction call",
  3: "Brief email check-in",
  4: "Second personal call",
  5: "Maintenance insight",
  6: "Upcoming project conversation",
  7: "Replacement planning example",
  8: "Relationship check-in",
  9: "Final value-based email",
  10: "Final personal check-in",
};

export default function CrmFollowupTasks({ onOpenContact }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const tasks = trpc.crmFollowups.list.useQuery({ status: "open" });
  const sync = trpc.crmFollowups.syncOutreach.useMutation({
    onSuccess: result => { setJobId(result.jobId); setNotice("Checking labeled Gmail outreach…"); },
    onError: error => setNotice(error.message),
  });
  const job = trpc.crmFollowups.syncJob.useQuery(
    { jobId: jobId ?? "" },
    { enabled: Boolean(jobId), refetchInterval: jobId ? 1500 : false }
  );
  const complete = trpc.crmFollowups.complete.useMutation({
    onSuccess: () => { void tasks.refetch(); setNotice("Touch outcome saved to CRM."); },
    onError: error => setNotice(error.message),
  });
  const assign = trpc.crmFollowups.assignToMe.useMutation({
    onSuccess: () => { void tasks.refetch(); setNotice("Task assigned to your CRM account."); },
    onError: error => setNotice(error.message),
  });
  const assignAll = trpc.crmFollowups.assignAllToMe.useMutation({
    onSuccess: result => {
      void tasks.refetch();
      setNotice(`${result.assigned} tasks assigned to your CRM account; ${result.remainingUnassigned} remain unassigned.`);
    },
    onError: error => setNotice(error.message),
  });
  useEffect(() => {
    if (!jobId || job.isFetching) return;
    if (job.data?.status === "done") {
      const result = job.data.result as {
        created?: number; cancelled?: number; scanned?: number; note?: string; hasMore?: boolean;
      } | null;
      setNotice(result
        ? `Gmail scan: ${result.created ?? 0} reminders created, ${result.cancelled ?? 0} cancelled, ${result.scanned ?? 0} messages checked.${result.hasMore ? " More messages remain." : ""} ${result.note ?? ""}`
        : "Scan completed.");
      setJobId(null);
      void tasks.refetch();
    } else if (job.data?.status === "error" || job.data === null || job.error) {
      setNotice(job.data?.error ?? job.error?.message ?? "Follow-up scan interrupted.");
      setJobId(null);
    }
  }, [job.data, job.error, job.isFetching, jobId]);

  return (
    <section className="rounded-xl border bg-white p-4 space-y-3" aria-label="CRM 30-day outreach cadence">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="font-semibold">30-day prospect follow-up · 10 touches</h2>
          <p className="text-xs text-slate-500">
            Day 0 introduction + nine follow-up opportunities through Day 30.
            Five email opportunities and five human touches. Tasks never send email or SMS automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={assignAll.isPending}
            onClick={() => assignAll.mutate()}>Assign all to me</Button>
          <Button variant="outline" size="sm" disabled={sync.isPending || Boolean(jobId)}
            onClick={() => sync.mutate({ lookbackDays: 35 })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Sync outreach tasks
          </Button>
        </div>
      </div>
      {notice && <p className="text-xs text-slate-700" role="status">{notice}</p>}
      {tasks.error && <p role="alert" className="text-sm text-red-600">{tasks.error.message}</p>}
      {tasks.isLoading && <p className="text-sm">Loading cadence tasks…</p>}
      {tasks.data?.length === 0 && <p className="text-sm text-slate-500">
        No open cadence tasks. Use Sync outreach tasks to import labeled Gmail introductions.
      </p>}
      {Boolean(tasks.data?.length) && (
        <div className="max-h-80 overflow-y-auto divide-y">
          {tasks.data?.map(task => (
            <div key={task.id} className="flex flex-wrap gap-3 items-center justify-between py-2">
              <div className="min-w-0">
                <button type="button" className="text-left font-medium text-blue-700 hover:underline"
                  onClick={() => onOpenContact(task.externalContactId)}>
                  {task.name && task.name !== task.recipientEmail ? task.name : task.recipientEmail}
                </button>
                <div className="text-xs text-slate-600">
                  {task.company ? `${task.company} · ` : ""}
                  Touch {task.touchNumber}/10 · {stepLabels[task.touchNumber] ?? task.kind} ·
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
              <div className="flex flex-wrap gap-1">
                {!task.assignedToUserId && (
                  <Button size="sm" variant="outline" disabled={assign.isPending}
                    onClick={() => assign.mutate({ id: task.id })}>Assign to me</Button>
                )}
                {task.kind === "human" ? (
                  <>
                    <Button size="sm" variant="outline" disabled={complete.isPending}
                      onClick={() => complete.mutate({ id: task.id, outcome: "attempted_no_answer" })}>Called · no answer</Button>
                    <Button size="sm" variant="outline" disabled={complete.isPending}
                      onClick={() => complete.mutate({ id: task.id, outcome: "connected" })}>Spoke · handoff</Button>
                    <Button size="sm" variant="outline" disabled={complete.isPending}
                      onClick={() => complete.mutate({ id: task.id, outcome: "not_interested" })}>Not interested</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={complete.isPending}
                      onClick={() => complete.mutate({ id: task.id, outcome: "reviewed_no_send" })}>Reviewed · no send</Button>
                    <Button size="sm" variant="outline" disabled={complete.isPending}
                      onClick={() => complete.mutate({ id: task.id, outcome: "sent_verified" })}>Verify sent email</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
