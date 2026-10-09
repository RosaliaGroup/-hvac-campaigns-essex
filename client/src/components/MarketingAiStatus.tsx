import { useState } from "react";
import { Activity, Bot, ExternalLink, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isCanaryAdmin } from "@/lib/marketingCanary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function MarketingAiStatus() {
  const { user } = useAuth();
  const admin = isCanaryAdmin(user);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<{url:string; number:number}|null>(null);
  const [error, setError] = useState("");
  const status = trpc.seo.autopublishStatus.useQuery(undefined, { refetchInterval: 30000, retry: 1 });
  const jobs = trpc.seo.getActiveJobs.useQuery(undefined, { enabled: admin, refetchInterval: 15000, retry: 1 });
  const lane = trpc.seo.getLaneJobStatus.useQuery({ lane: "content" }, { enabled: admin, refetchInterval: 5000, retry: 1 });
  const queue = trpc.seo.listContentQueue.useQuery(undefined, { enabled: admin && open, refetchInterval: 30000, retry: 1 });
  const runContent = trpc.seo.runContentJobNow.useMutation({
    onSuccess: () => { setError(""); lane.refetch(); queue.refetch(); jobs.refetch(); },
    onError: e => setError(e.message),
  });
  const retryDraft = trpc.seo.retryRejectedContentDraft.useMutation({
    onSuccess: () => { setError(""); queue.refetch(); lane.refetch(); },
    onError: e => setError(e.message),
  });
  const task = trpc.marketingAiTasks.submit.useMutation({
    onSuccess: (data) => { setResult(data); setError(""); setTitle(""); setInstructions(""); },
    onError: (e) => setError(e.message),
  });
  const paused = !!status.data?.circuitBreakerPaused || status.isError;
  const active = admin && (lane.data?.status === "running" || (Array.isArray(jobs.data) && jobs.data.length > 0));
  const state = paused || (admin && lane.data?.status === "error") ? "Needs attention" : active ? "Working" : status.isLoading || (admin && lane.isLoading) ? "Checking" : "Idle";
  const color = paused ? "bg-red-500" : active ? "bg-green-500 animate-pulse" : "bg-slate-400";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label={`Marketing AI status: ${state}. Open report and tasks`} className="inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-accent focus-visible:outline focus-visible:outline-2" >
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          <span className="hidden sm:inline">Marketing AI</span>
          <span className="text-muted-foreground">{state}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Marketing AI — Activity & Tasks</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="font-medium">Current status: {state}</span>
            <Button size="sm" variant="outline" onClick={() => {status.refetch(); if(admin) jobs.refetch();}}><RefreshCw className="h-3 w-3 mr-1" />Refresh</Button>
          </div>
          <p className="text-xs text-muted-foreground">Live status reflects the website's tracked SEO jobs, not ChatGPT activity. Idle does not prove all scheduled jobs succeeded.</p>
          <div className="rounded-md border p-3 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4"/> Automation report</p>
            <p>SEO autopublish: {status.isLoading ? "Checking" : status.isError ? "Unavailable" : status.data?.autopublishEnabled ? "Enabled" : "Disabled"}</p>
            <p>Publishing circuit breaker: {status.data?.circuitBreakerPaused ? "Paused" : "Not paused / unverified"}</p>
            <p>GitHub publishing integration: {status.data?.githubConfigured ? "Configured" : "Not configured / unavailable"}</p>
            <p>Tracked active SEO jobs: {admin && jobs.data ? jobs.data.length : "Not available"}</p>
            {status.data?.circuitBreakerReason && <p className="text-red-600">Reason: {status.data.circuitBreakerReason}</p>}
            {admin && <div className="space-y-2 border-t pt-2">
              <p className="font-medium">Blog content pipeline</p>
              <p role="status">Content job: {lane.data?.status ?? "Checking"} {lane.data?.error ? `— ${lane.data.error}` : ""}</p>
              <p>Queued topics: {queue.data ? queue.data.filter(t => t.status === "queued" || t.status === "refresh_due").length : "Checking"}</p>
              <div className="space-y-1">
                <p className="font-medium">Retry a rejected blog draft</p>
                <p className="text-xs text-muted-foreground">Regenerates through existing quality checks. One draft at a time; may use paid AI tokens.</p>
                {(queue.data ?? []).filter(t => t.status === "drafted" && !t.contentBatchId).map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-xs border-b py-1">
                    <span>{t.title}</span>
                    <Button size="sm" variant="outline" disabled={retryDraft.isPending || runContent.isPending || lane.data?.status === "running"} onClick={() => retryDraft.mutate({ topicId: t.id })}>Retry</Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Runs the existing admin-authorized draft workflow. Publishing still requires the configured warm-up, quality checks, and hold rules.</p>
              <Button size="sm" variant="outline" disabled={runContent.isPending || lane.data?.status === "running" || status.data?.circuitBreakerPaused} onClick={() => runContent.mutate()}>
                {runContent.isPending || lane.data?.status === "running" ? "Content job running" : "Run blog content job now"}
              </Button>
            </div>}
            <div className="flex flex-wrap gap-2 pt-2">
              <a href="/marketing-dashboard" className="underline">Marketing report</a>
              <a href="/marketing-autopilot" className="underline">Autopilot</a>
              <a href="/growth" className="underline">Growth report</a>
            </div>
          </div>
          {admin ? <form className="space-y-2 border-t pt-3" onSubmit={e=>{e.preventDefault();setResult(null);setError("");task.mutate({title,instructions});}}>
            <p className="font-semibold">Give Marketing AI a task</p>
            <Input aria-label="Task title" placeholder="Task title" value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} required minLength={5}/>
            <Textarea aria-label="Task instructions" placeholder="What should be done? Include the goal and constraints." value={instructions} maxLength={4000} onChange={e=>setInstructions(e.target.value)} required minLength={10}/>
            <p className="text-xs text-muted-foreground">Submitting creates a tracked GitHub task for review. It does not start autonomous ChatGPT work or send messages.</p>
            <Button type="submit" disabled={task.isPending || title.trim().length<5 || instructions.trim().length<10}>{task.isPending ? "Submitting..." : "Submit task"}</Button>
            {error && <p role="alert" className="text-red-600">{error}</p>}
            {result && <a className="text-green-700 underline inline-flex gap-1 items-center" href={result.url} target="_blank" rel="noopener noreferrer">Task #{result.number} created <ExternalLink className="h-3 w-3"/></a>}
          </form> : <p className="text-xs text-muted-foreground">Admin access is required to submit tasks.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
