/**
 * Wire types for the SEO Intelligence async-job protocol.
 *
 * Every long-running SEO mutation (single-page optimize, bulk optimize,
 * regenerate drafts, Search Console sync) returns `{ jobId, started }`
 * immediately and the client polls `seo.getJobStatus`. Shared so the router
 * and SeoIntelligence.tsx agree on the result shapes without the client
 * importing server code.
 */
import type { SeoAction } from "./seo";

export const SEO_JOB_KINDS = ["optimize", "bulkOptimize", "regenerateDrafts", "seoSync"] as const;
export type SeoJobKind = (typeof SEO_JOB_KINDS)[number];

/** What every job-starting mutation returns. `started: false` = attach to the already-running `jobId`. */
export type StartedJob = { jobId: string; started: boolean };

export type SeoJobSnapshot<T = unknown> = {
  id: string;
  kind: string;
  key: string;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt: number | null;
  progress: { done: number; total: number } | null;
  error: string | null;
  result: T | null;
};

/** getJobStatus answer: a snapshot, or "unknown" when the server no longer has the job (restart / pruned). */
export type SeoJobPoll<T = unknown> = SeoJobSnapshot<T> | { status: "unknown" };

/** Per-page outcome — draft bodies are deliberately NOT included (poll payload stays small; the client refetches drafts). */
export type SeoPageJobOutcome = { pageId: number; ok: true } | { pageId: number; ok: false; error: string };

export type OptimizeJobResult = { pageId: number; action: SeoAction };

export type BulkOptimizeJobResult = {
  results: SeoPageJobOutcome[];
  succeeded: number;
  failed: number;
  skippedPendingBatch: number[];
};

export type RegenerateDraftsJobResult = {
  results: SeoPageJobOutcome[];
  skippedLocked: string[];
};

export type SeoSyncJobResult =
  | { ok: true; pagesSynced: number; queriesSynced: number }
  | { ok: false; reason: "no_db" | "unavailable" | "already_running" | "error"; error?: string };
