/**
 * Social Lane circuit breaker (docs/social-lane-spec.md §7). Follows the same
 * pure-decision + thin-I/O-wrapper split as
 * server/services/seo/circuitBreaker.ts (that module's exact code is
 * SEO-table-coupled — seoPages/seoApprovalBatches/autopublishStateRepo — so
 * this reimplements the same PATTERN against the Social Lane's own state,
 * per the owner's instruction to reuse it as a pattern, not shared code).
 *
 * Pauses on:
 *  - API auth failure (a platform publish/delete throwing an auth-shaped error)
 *  - 2 vetoes in the last 7 days
 *  - any comment flagged as a complaint about a post's claim
 *  - a Meta policy warning
 *
 * `SOCIAL_LANE_ENABLED=false` is a SEPARATE, harder kill switch (checked in
 * platformClient.ts) — it stops everything regardless of circuit-breaker
 * state. This module only governs the auto-pause/resume behavior for when
 * the lane IS enabled.
 */
import { countVetoesSince } from "./repo";
import { getSocialLaneState, updateSocialLaneState } from "./socialLaneStateRepo";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const VETO_PAUSE_THRESHOLD = 2;

export type SocialCircuitBreakerResult = { shouldPause: boolean; reason: string | null };

export type SocialCircuitBreakerSignals = {
  vetoesInLast7Days: number;
  authFailureDetected: boolean;
  complaintFlaggedComment: boolean;
  metaPolicyWarning: boolean;
};

/** Pure — no I/O. */
export function evaluateSocialCircuitBreakerSignals(signals: SocialCircuitBreakerSignals): SocialCircuitBreakerResult {
  if (signals.authFailureDetected) {
    return { shouldPause: true, reason: "A platform API auth failure was detected (token likely expired) — re-auth in AI VA Settings." };
  }
  if (signals.vetoesInLast7Days >= VETO_PAUSE_THRESHOLD) {
    return { shouldPause: true, reason: `${signals.vetoesInLast7Days} posts were vetoed in the last 7 days.` };
  }
  if (signals.complaintFlaggedComment) {
    return { shouldPause: true, reason: "A comment flagged as a complaint about a post's claim was received." };
  }
  if (signals.metaPolicyWarning) {
    return { shouldPause: true, reason: "Meta issued a policy warning on the connected Page." };
  }
  return { shouldPause: false, reason: null };
}

/** Fetch real signals not already known to the caller, evaluate, persist a pause if newly triggered. */
export async function checkSocialCircuitBreaker(
  extra: Partial<Pick<SocialCircuitBreakerSignals, "authFailureDetected" | "complaintFlaggedComment" | "metaPolicyWarning">> = {},
): Promise<SocialCircuitBreakerResult> {
  const state = await getSocialLaneState();
  if (state.circuitBreakerPaused) {
    return { shouldPause: true, reason: state.circuitBreakerReason };
  }

  const vetoesInLast7Days = await countVetoesSince(new Date(Date.now() - SEVEN_DAYS_MS));
  const result = evaluateSocialCircuitBreakerSignals({
    vetoesInLast7Days,
    authFailureDetected: extra.authFailureDetected ?? false,
    complaintFlaggedComment: extra.complaintFlaggedComment ?? false,
    metaPolicyWarning: extra.metaPolicyWarning ?? false,
  });

  if (result.shouldPause) {
    await updateSocialLaneState({
      circuitBreakerPaused: true,
      circuitBreakerReason: result.reason,
      circuitBreakerPausedAt: new Date(),
    });
  }
  return result;
}

export class SocialCircuitBreakerNoteRequiredError extends Error {
  constructor() {
    super("Resuming the Social Lane requires a note explaining why it's safe to resume.");
    this.name = "SocialCircuitBreakerNoteRequiredError";
  }
}

/** Admin "Resume" action — requires a note (same convention as the SEO lane). */
export async function resumeSocialCircuitBreaker(note: string): Promise<void> {
  if (!note.trim()) throw new SocialCircuitBreakerNoteRequiredError();
  await updateSocialLaneState({ circuitBreakerPaused: false, circuitBreakerReason: null, circuitBreakerPausedAt: null });
}
