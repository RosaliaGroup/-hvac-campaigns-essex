/**
 * Sequencer for the autopublish lanes: run ONE batch (meta) or ONE topic (content),
 * wait for its PR to merge, then run the next — so every batch is its own PR and no
 * two open PRs ever edit the same file (which would conflict). The merge itself is
 * done by the production auto-merge poller after the hold; this script only waits
 * and records. It never merges, vetoes, or weakens a gate.
 *
 *   LANE=meta    MAX=10 npx tsx scripts/drain-seo-lanes.ts   # until the clean backlog is empty (or MAX batches)
 *   LANE=content MAX=3  npx tsx scripts/drain-seo-lanes.ts   # the next MAX passing topics
 *
 * Run with production env (railway run …). Prints one JSON summary line per batch
 * ("BATCH {...}") and a final "SUMMARY {...}".
 */
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoApprovalBatches } from "../drizzle/schema";
import { runNightlyDraftJob } from "../server/services/seo/nightlyDraftJob";
import { runWeeklyContentJob } from "../server/services/seo/contentPipeline";
import { findOpenBatchWithPrefix, META_BRANCH_PREFIX, CONTENT_BRANCH_PREFIX } from "../server/services/seo/batchBranches";

const LANE = (process.env.LANE ?? "meta") as "meta" | "content";
const MAX = Number(process.env.MAX ?? (LANE === "meta" ? 10 : 3));
const POLL_MS = Number(process.env.POLL_MS ?? 60_000);
const MAX_WAIT_MS = Number(process.env.MAX_WAIT_MS ?? 4 * 60 * 60 * 1000);

const et = (d: Date | null | undefined) => (d ? new Date(d).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "short", timeStyle: "medium" }) + " ET" : "—");
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(`[${et(new Date())}]`, ...a);

type Batch = { id: number; label: string; prNumber: number | null; prUrl: string | null; holdUntil: string | null; pages: number; mergedAt?: string | null; finalStatus?: string };
const batches: Batch[] = [];
const stopReasons: string[] = [];

async function batchRow(id: number) {
  const db = (await getDb())!;
  const [b] = await db.select().from(seoApprovalBatches).where(eq(seoApprovalBatches.id, id)).limit(1);
  return b;
}

/** Poll until the batch leaves pr_open. The production poller merges it after the hold. */
async function waitForMerge(id: number): Promise<string> {
  const started = Date.now();
  let warned = false;
  while (Date.now() - started < MAX_WAIT_MS) {
    const b = await batchRow(id);
    if (b.status !== "pr_open") return b.status;
    if (!warned && b.holdUntil && Date.now() > new Date(b.holdUntil).getTime() + 30 * 60 * 1000) {
      warned = true;
      log(`batch ${id}: hold expired >30 min ago and PR #${b.prNumber} is still open — the production auto-merge poller hasn't merged it (check the "[SEO] auto-merge" logs). Still waiting.`);
    }
    await sleep(POLL_MS);
  }
  return "timeout";
}

async function waitForNoOpenBatch(prefix: string) {
  const started = Date.now();
  for (;;) {
    const open = await findOpenBatchWithPrefix(prefix);
    if (!open) return;
    if (Date.now() - started > MAX_WAIT_MS) throw new Error(`batch ${open.id} (PR #${open.prNumber}) is still open after ${MAX_WAIT_MS / 60000} min`);
    log(`waiting for open ${LANE} batch ${open.id} (PR #${open.prNumber}) to merge before starting the next…`);
    await sleep(POLL_MS);
  }
}

async function record(batchId: number, pages: number) {
  const b = await batchRow(batchId);
  const entry: Batch = { id: b.id, label: b.label, prNumber: b.prNumber, prUrl: b.prUrl, holdUntil: b.holdUntil ? new Date(b.holdUntil).toISOString() : null, pages };
  batches.push(entry);
  log(`opened batch ${b.id} → PR #${b.prNumber} ${b.prUrl} (${pages} page(s)); hold until ${et(b.holdUntil)}`);
  entry.finalStatus = await waitForMerge(b.id);
  const after = await batchRow(b.id);
  entry.mergedAt = entry.finalStatus === "merged" ? new Date(after.updatedAt).toISOString() : null;
  console.log("BATCH " + JSON.stringify(entry));
  log(`batch ${b.id} (PR #${b.prNumber}): ${entry.finalStatus}${entry.mergedAt ? " at " + et(after.updatedAt) : ""}`);
  return entry;
}

async function drainMeta() {
  for (let i = 1; i <= MAX; i++) {
    await waitForNoOpenBatch(META_BRANCH_PREFIX);
    log(`meta run ${i}/${MAX}`);
    const s = await runNightlyDraftJob();
    log("meta result", JSON.stringify(s));
    if (!s.autoApproved || !s.batchId) {
      stopReasons.push(s.pickedUp === 0 && s.ready === 0 ? `meta: nothing eligible and clean remains (run ${i})` : `meta: run ${i} did not open a PR (not warmed up / breaker / open batch / lint)`);
      return;
    }
    const e = await record(s.batchId, s.ready + s.pickedUp);
    if (e.finalStatus !== "merged") {
      stopReasons.push(`meta: batch ${e.id} ended ${e.finalStatus} — stopping`);
      return;
    }
  }
  stopReasons.push(`meta: reached MAX=${MAX} batches`);
}

async function drainContent() {
  const blocked = new Set<number>();
  let shipped = 0;
  for (let attempt = 1; attempt <= MAX + 5 && shipped < MAX; attempt++) {
    await waitForNoOpenBatch(CONTENT_BRANCH_PREFIX);
    log(`content run (shipped ${shipped}/${MAX})`);
    const r = await runWeeklyContentJob();
    if (r.status !== "drafted") {
      stopReasons.push(`content: stopped — ${r.status}${"reason" in r && r.reason ? ` (${r.reason})` : ""}`);
      return;
    }
    (r.blockedTopicIds ?? []).forEach((id) => blocked.add(id));
    log(`content result: topic ${r.topicId} passes=${r.passes} attempts=${r.attempts} autoApproved=${r.autoApproved} blockedThisRun=${JSON.stringify(r.blockedTopicIds)}`);
    if (!r.passes) {
      blocked.add(r.topicId);
      continue; // every retried topic this run was lint-blocked; the next run takes the next queued topic
    }
    if (!r.autoApproved || r.batchId === undefined) {
      stopReasons.push(`content: topic ${r.topicId} passed but was NOT auto-approved to a PR (lane not warmed up / autopublish off / GitHub error) — staged only`);
      return;
    }
    const e = await record(r.batchId, 1);
    if (e.finalStatus !== "merged") {
      stopReasons.push(`content: batch ${e.id} ended ${e.finalStatus} — stopping`);
      return;
    }
    shipped++;
  }
  stopReasons.push(`content: ${shipped} post(s) shipped${shipped < MAX ? " (ran out of passing topics)" : ""}`);
  if (blocked.size) stopReasons.push(`content: lint-blocked topic ids (not retried further): ${JSON.stringify([...blocked])}`);
}

try {
  if (LANE === "meta") await drainMeta();
  else await drainContent();
} catch (err) {
  stopReasons.push(`ERROR: ${(err as Error).message}`);
  console.error(err);
}
console.log("SUMMARY " + JSON.stringify({ lane: LANE, batches, stopReasons }));
process.exit(0);
