/**
 * One-cycle recovery for a Take-Off batch that hits the API proxy's ~26 s
 * response-time limit (HTTP 504), independent of payload size.
 *
 * Recovery for a single batch, at most ONE cycle:
 *   1. Send the batch.
 *   2. On a gateway timeout, retry the SAME batch once. Because the request
 *      carries the same deterministic batchId, a server that finished late
 *      (after the proxy gave up) returns its cached result — no re-billing.
 *   3. If it still times out, subdivide once into smaller page batches (each a
 *      NEW deterministic id) and send each once. No further recovery.
 *   4. If a batch can't be subdivided (single page) and still times out, give up.
 *
 * Non-timeout errors propagate immediately. Pure and injectable: the caller
 * provides `send` (which computes the deterministic id + calls the server),
 * `isTimeout`, and `subdivide`.
 */

export type RecoveryEvent =
  | { type: "timeout-retry" }
  | { type: "subdivide"; parts: number }
  | { type: "give-up" };

export interface RecoveryDeps<P> {
  /** Send a batch; resolves with the response text, rejects on failure. */
  send: (pages: P[], strong: boolean) => Promise<string>;
  /** Classify a rejection as a gateway timeout (retry/subdivide) vs fatal (bubble). */
  isTimeout: (err: unknown) => boolean;
  /** Split a batch into smaller batches; return [] when not splittable. */
  subdivide: (pages: P[]) => P[][];
  /** Optional progress hook (for UI logging). */
  onEvent?: (e: RecoveryEvent) => void;
}

export interface RecoveredPart<P> {
  pages: P[];
  text: string;
  strong: boolean;
}

export async function runBatchWithRecovery<P>(
  pages: P[],
  strong: boolean,
  deps: RecoveryDeps<P>,
): Promise<Array<RecoveredPart<P>>> {
  try {
    return [{ pages, text: await deps.send(pages, strong), strong }];
  } catch (err) {
    if (!deps.isTimeout(err)) throw err;

    // Step 1 — retry the SAME batch once (same id → reuse a late completion).
    deps.onEvent?.({ type: "timeout-retry" });
    try {
      return [{ pages, text: await deps.send(pages, strong), strong }];
    } catch (err2) {
      if (!deps.isTimeout(err2)) throw err2;

      // Step 2 — subdivide once into smaller batches (new ids), one attempt each.
      const parts = deps.subdivide(pages);
      if (parts.length <= 1) {
        deps.onEvent?.({ type: "give-up" });
        throw err2;
      }
      deps.onEvent?.({ type: "subdivide", parts: parts.length });
      const out: Array<RecoveredPart<P>> = [];
      for (const part of parts) {
        out.push({ pages: part, text: await deps.send(part, true), strong: true });
      }
      return out;
    }
  }
}

/** Split a batch into two halves; returns [] for a single page (not splittable). */
export function halve<P>(pages: P[]): P[][] {
  if (pages.length <= 1) return [];
  const mid = Math.ceil(pages.length / 2);
  return [pages.slice(0, mid), pages.slice(mid)];
}
