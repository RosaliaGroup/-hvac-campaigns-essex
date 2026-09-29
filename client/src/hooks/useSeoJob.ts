import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { SeoJobKind, StartedJob } from "@shared/seoJobs";

const POLL_MS = 1500;

/**
 * Client half of the SEO async-job protocol (see server/services/asyncLaneJob.ts).
 *
 * The job-starting mutations return `{ jobId, started }` in milliseconds; this
 * hook takes that, polls `seo.getJobStatus` every 1.5s while the job runs, and
 * calls `onDone(result)` / `onError(message)` exactly once when it settles.
 *
 * - `start(job)` — attach to a job (also for `started: false`: the job is
 *   already in flight, e.g. a retried click after a 504, and we just follow it).
 * - Re-attach: on mount, if the server has a running job of this `kind` (and
 *   `key`, when given) — say the page was reloaded mid-run — follow that one.
 * - A poll answering "unknown" means the server restarted / pruned the job;
 *   surfaced as an error rather than an endless spinner.
 */
export function useSeoJob<T>(opts: {
  kind: SeoJobKind;
  /** Only re-attach to a running job with exactly this key (e.g. `optimize:42`). Omit to re-attach to any of this kind. */
  key?: string;
  enabled?: boolean;
  onDone: (result: T) => void;
  onError: (message: string) => void;
}) {
  const { kind, key, enabled = true } = opts;
  const [jobId, setJobId] = useState<string | null>(null);

  // Latest callbacks without re-triggering the settle effect.
  const cb = useRef({ onDone: opts.onDone, onError: opts.onError });
  cb.current = { onDone: opts.onDone, onError: opts.onError };

  const activeQ = trpc.seo.getActiveJobs.useQuery({ kind }, { enabled, refetchOnWindowFocus: false, staleTime: 0 });
  const reattached = useRef(false);
  useEffect(() => {
    if (reattached.current || jobId || !activeQ.data) return;
    reattached.current = true;
    const running = activeQ.data.find((j) => key === undefined || j.key === key);
    if (running) setJobId(running.id);
  }, [activeQ.data, jobId, key]);

  const statusQ = trpc.seo.getJobStatus.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: enabled && !!jobId,
      refetchInterval: (query) => {
        const d = query.state.data;
        return !d || d.status === "running" ? POLL_MS : false;
      },
      retry: true,
    },
  );

  const settledFor = useRef<string | null>(null);
  useEffect(() => {
    const d = statusQ.data;
    if (!jobId || !d || d.status === "running" || settledFor.current === jobId) return;
    settledFor.current = jobId;
    setJobId(null);
    if (d.status === "done") cb.current.onDone((d as { result: T }).result);
    else if (d.status === "error") cb.current.onError((d as { error: string | null }).error ?? "Job failed");
    else cb.current.onError("The server lost track of this job (it may have restarted). Check the drafts and try again.");
  }, [statusQ.data, jobId]);

  const start = useCallback((job: StartedJob) => {
    settledFor.current = null;
    setJobId(job.jobId);
  }, []);

  const s = statusQ.data;
  const progress = s && s.status === "running" ? s.progress : null;
  return { start, running: !!jobId, progress };
}
