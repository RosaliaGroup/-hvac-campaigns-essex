/**
 * Resume cache + concurrent-run lock for the internal AI Take-Off.
 *
 * The browser drives 4-page batching and calls the authenticated
 * `takeoffs.analyzeBatch` mutation once per batch. Completed batch responses are
 * cached in localStorage under a VERSIONED key tied to (project, mode) so a
 * reload or a mid-document failure resumes from the first incomplete batch
 * instead of restarting the whole document. The cache is cleared only after the
 * final reconciliation is saved (see TakeOffDetail.persistAnalysis).
 *
 * All functions accept an optional `Storage` so they are unit-testable without a
 * DOM (vitest runs in a node environment); in the app they default to
 * `globalThis.localStorage`.
 */

export const BATCH_CACHE_VERSION = "v1";

export interface BatchCache {
  signature: string;
  batches: Record<string, string>;
}

/** Versioned localStorage key, tied to the Take-Off project and analysis mode. */
export function batchCacheKey(projectId: number, mode: string): string {
  return `takeoff-batches:${BATCH_CACHE_VERSION}:${projectId}:${mode}`;
}

/**
 * Signature of the current run's inputs. If the selected pages (or their order)
 * change, the signature changes and any stale cache is ignored — preventing a
 * resume from mixing results across different page selections.
 */
export function batchSignature(mode: string, pageNums: number[]): string {
  return `${mode}|${pageNums.join(",")}`;
}

/**
 * Deterministic 32-bit FNV-1a hash of a string, as 8 hex chars. Dependency-free
 * and stable across reloads/retries. Used only to key idempotent batch requests
 * — NOT for security. It is a digest: it contains no source/document text.
 */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Deterministic idempotency id for one billed batch request. Derived from the
 * Take-Off id, analysis mode, and a checksum of the EXACT payload sent to the
 * model (system + messages) — which encodes the page range and the document
 * content for those pages. Properties:
 *  - Same batch retried after a network blip → identical id → the server returns
 *    the cached response instead of billing Anthropic again.
 *  - Any change to page selection or document content → different id → a stale
 *    result is never reused.
 * The id is opaque (a hash); it carries no document text.
 */
export function computeBatchId(
  projectId: number,
  mode: string,
  payload: { system: string; messages: unknown[] },
): string {
  const checksum = hashString(JSON.stringify(payload));
  return `to:${projectId}:${mode}:${checksum}`;
}

function resolveStore(store?: Storage): Storage | null {
  if (store) return store;
  try {
    return typeof globalThis !== "undefined" && globalThis.localStorage
      ? globalThis.localStorage
      : null;
  } catch {
    return null; // localStorage can throw in some privacy modes
  }
}

/**
 * Load completed batches for (project, mode) IF the stored signature matches the
 * current run. On any mismatch or parse error, returns {} (a fresh start).
 */
export function loadBatches(
  projectId: number,
  mode: string,
  signature: string,
  store?: Storage,
): Record<string, string> {
  const s = resolveStore(store);
  if (!s) return {};
  try {
    const raw = s.getItem(batchCacheKey(projectId, mode));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BatchCache;
    if (!parsed || parsed.signature !== signature || typeof parsed.batches !== "object" || parsed.batches === null) {
      return {};
    }
    return parsed.batches;
  } catch {
    return {};
  }
}

/** Persist one completed batch's response text. Best-effort (ignores quota errors). */
export function saveBatch(
  projectId: number,
  mode: string,
  signature: string,
  index: number,
  text: string,
  store?: Storage,
): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    const batches = loadBatches(projectId, mode, signature, s);
    batches[String(index)] = text;
    const payload: BatchCache = { signature, batches };
    s.setItem(batchCacheKey(projectId, mode), JSON.stringify(payload));
  } catch {
    // Quota exceeded or serialization failure: resume simply won't have this
    // batch cached — correctness is preserved, it will just be re-analyzed.
  }
}

/** Remove the resume cache for (project, mode). Called only after a successful save. */
export function clearBatches(projectId: number, mode: string, store?: Storage): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.removeItem(batchCacheKey(projectId, mode));
  } catch {
    /* ignore */
  }
}

/**
 * In-session lock preventing duplicate concurrent runs for the same Take-Off.
 * Module-level (per SPA runtime) — covers repeated clicks / overlapping runs in
 * the current browser session without risking a stale persisted lock.
 */
const activeRuns = new Set<string>();

/** Returns true if the lock was acquired; false if a run is already active. */
export function tryAcquireRun(projectId: number): boolean {
  const key = String(projectId);
  if (activeRuns.has(key)) return false;
  activeRuns.add(key);
  return true;
}

export function releaseRun(projectId: number): void {
  activeRuns.delete(String(projectId));
}

export function isRunActive(projectId: number): boolean {
  return activeRuns.has(String(projectId));
}

/** Test-only: reset the in-memory run lock between tests. */
export function __resetRunLockForTests(): void {
  activeRuns.clear();
}
