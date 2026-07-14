/**
 * Adaptive batch planning for the AI Take-Off.
 *
 * The browser POSTs each batch through Netlify's `/api/*` proxy, which rejects
 * request bodies over ~10 MB with an empty-body 400 (the payload never reaches
 * Railway). Drawing-page images dominate the request size, so this planner sizes
 * each batch to stay under a safe budget:
 *
 *   1. Prefer 4 pages per batch when the serialized request is safely under
 *      budget (fewer requests, cheaper reconciliation).
 *   2. If a 4-page batch is too large, split it into 2-page batches.
 *   3. If a 2-page batch is still too large, retry it with stronger image
 *      compression (`strong: true`).
 *   4. If a 2-page batch is *still* too large after stronger compression, fall
 *      back to single-page batches (also strongly compressed).
 *   5. If a single page still exceeds the budget even strongly compressed, fail
 *      with a clear, actionable error naming the page.
 *
 * The planner is pure and transport-agnostic: `measure(pages, strong)` returns
 * the serialized request size in bytes and is injected by the caller (the app
 * builds the real request incl. re-compressed images; tests inject a table). No
 * image, prompt, or document content is handled here.
 */

export interface PlannedBatch<P> {
  pages: P[];
  /** true → this batch must be built with the stronger image compression. */
  strong: boolean;
}

export interface PlanDeps<P> {
  /** Max serialized request size (bytes) that safely passes the proxy. */
  budgetBytes: number;
  /** Serialized request size (bytes) for these pages at base / strong quality. */
  measure: (pages: P[], strong: boolean) => Promise<number> | number;
  /** Preferred pages per batch (default 4). */
  groupSize?: number;
}

export async function planTakeoffBatches<P extends { pageNum: number }>(
  pages: P[],
  deps: PlanDeps<P>,
): Promise<Array<PlannedBatch<P>>> {
  const group = deps.groupSize ?? 4;
  const fits = async (ps: P[], strong: boolean) =>
    (await deps.measure(ps, strong)) <= deps.budgetBytes;

  const out: Array<PlannedBatch<P>> = [];

  for (let i = 0; i < pages.length; i += group) {
    const chunk = pages.slice(i, i + group);
    if (chunk.length === 0) continue;

    // 1. Whole chunk (up to `group` pages) at base quality.
    if (await fits(chunk, false)) {
      out.push({ pages: chunk, strong: false });
      continue;
    }

    // 2. Split into 2-page sub-batches.
    for (let j = 0; j < chunk.length; j += 2) {
      const sub = chunk.slice(j, j + 2);

      if (await fits(sub, false)) {
        out.push({ pages: sub, strong: false });
        continue;
      }

      // 3. Oversized 2-page batch → stronger compression.
      if (sub.length > 1 && (await fits(sub, true))) {
        out.push({ pages: sub, strong: true });
        continue;
      }

      // 4. Still too large → single-page batches (strongly compressed).
      for (const page of sub) {
        if (await fits([page], true)) {
          out.push({ pages: [page], strong: true });
        } else {
          // 5. A single page cannot fit even strongly compressed.
          throw new Error(
            `Page ${page.pageNum} is too large to analyze even after compression. ` +
              `Re-export this sheet at a lower resolution or split it into smaller sheets, then try again.`,
          );
        }
      }
    }
  }

  return out;
}
