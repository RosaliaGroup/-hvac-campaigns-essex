/**
 * Autopublish warm-up gate (owner decision, relayed 2026-09-26): each lane
 * starts requiring a manual "Publish now" click regardless of the enabled
 * flag, and only auto-merges once its warm-up counter reaches zero.
 *   - Meta lane / content lane defaults: see warmupConfig.ts
 *     (SEO_META_WARMUP_DEFAULT / SEO_CONTENT_WARMUP_DEFAULT — both default to
 *     0 as of 2026-09-29, i.e. auto-merge-eligible immediately subject to
 *     every other gate; originally hardcoded to meta=2/content=8).
 * A veto or a revert resets the counter back UP — interpreting the owner's
 * "resets the warm-up counter by half" as: add back half of the lane's
 * default requirement (capped at the default), i.e. a veto/revert costs you
 * half of the total trust you'd need to rebuild from scratch. This is a
 * documented judgment call, not spelled out numerically in the brief — flag
 * it if a different formula was intended. With the default now 0, half of 0
 * is 0, so a veto/revert is a no-op on a lane still at its (0) default —
 * this only has visible effect once a lane's default is configured above 0.
 */
import { logAudit } from "./auditLog";
import { getAutopublishState, updateAutopublishState } from "./autopublishStateRepo";
import { WARMUP_DEFAULTS, type AutopublishLane } from "./warmupConfig";

export type { AutopublishLane };
export { WARMUP_DEFAULTS };

function fieldFor(lane: AutopublishLane): "metaWarmupRemaining" | "contentWarmupRemaining" {
  return lane === "meta" ? "metaWarmupRemaining" : "contentWarmupRemaining";
}

/** True once this lane's warm-up requirement is satisfied — auto-merge is allowed (subject to every other gate). */
export async function isWarmedUp(lane: AutopublishLane): Promise<boolean> {
  const state = await getAutopublishState();
  return state[fieldFor(lane)] <= 0;
}

export async function warmupRemaining(lane: AutopublishLane): Promise<number> {
  const state = await getAutopublishState();
  return state[fieldFor(lane)];
}

/**
 * Call after a batch/post in this lane merges cleanly (no veto, no revert
 * within the window that would trigger a reset). Counts down toward
 * auto-merge eligibility; never goes below zero.
 */
export async function advanceWarmup(lane: AutopublishLane, actorId: number | null): Promise<number> {
  const state = await getAutopublishState();
  const field = fieldFor(lane);
  const before = state[field];
  const after = Math.max(0, before - 1);
  await updateAutopublishState({ [field]: after } as Partial<Record<typeof field, number>>);
  await logAudit({
    actorId,
    action: "warmup_advanced",
    batchId: null,
    pagePath: null,
    before: { lane, remaining: before },
    after: { lane, remaining: after },
    lintResult: null,
  });
  return after;
}

/** Call on a veto or a revert — pushes the counter back up (see file header for the "by half" interpretation). */
export async function resetWarmupByHalf(lane: AutopublishLane, reason: "veto" | "revert", actorId: number | null): Promise<number> {
  const state = await getAutopublishState();
  const field = fieldFor(lane);
  const defaultForLane = WARMUP_DEFAULTS[lane];
  const before = state[field];
  const after = Math.min(defaultForLane, before + Math.ceil(defaultForLane / 2));
  await updateAutopublishState({ [field]: after } as Partial<Record<typeof field, number>>);
  await logAudit({
    actorId,
    action: "warmup_reset",
    batchId: null,
    pagePath: null,
    before: { lane, remaining: before, reason },
    after: { lane, remaining: after, reason },
    lintResult: null,
  });
  return after;
}
