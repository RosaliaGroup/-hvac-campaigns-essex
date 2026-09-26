/**
 * Ads hand-off (docs/social-lane-spec.md §5). Boost-candidate flagging is
 * pure and always runs (feeds the report); actual auto-boost execution is
 * gated behind SOCIAL_BOOST_ENABLED (default false) and a daily spend cap,
 * and goes through the same platformClient.ts seam as everything else — see
 * server/metaAds.ts's boostPost() for why the REAL boost call is stubbed.
 */
import type { SocialPlatformClient, BoostParams } from "./platformClient";

export interface EngagementSnapshot {
  postId: number;
  platform: "facebook" | "instagram" | "google_business";
  engagementScore: number; // likes + comments*2 + shares*3, or whatever the caller's engagement JSON yields
  postUrl: string;
}

export const BOOST_CANDIDATE_MULTIPLIER = 2;

export interface BoostCandidate extends EngagementSnapshot {
  isBoostCandidate: true;
  medianEngagement: number;
}

/** Any post beating the page's 30-day median engagement by 2x is a "boost candidate" for the report. */
export function flagBoostCandidates(posts: EngagementSnapshot[], medianEngagement30d: number): BoostCandidate[] {
  if (medianEngagement30d <= 0) return [];
  return posts
    .filter((p) => p.engagementScore >= medianEngagement30d * BOOST_CANDIDATE_MULTIPLIER)
    .map((p) => ({ ...p, isBoostCandidate: true as const, medianEngagement: medianEngagement30d }));
}

export function isSocialBoostEnabled(): boolean {
  return String(process.env.SOCIAL_BOOST_ENABLED ?? "false").toLowerCase() === "true";
}

export function getSocialBoostDailyCapCents(): number {
  const raw = process.env.SOCIAL_BOOST_DAILY_CAP;
  const n = raw ? parseFloat(raw) : NaN;
  const dollars = Number.isFinite(n) && n > 0 ? n : 10;
  return Math.round(dollars * 100);
}

export interface AutoBoostOutcome {
  attempted: boolean;
  result?: { externalCampaignId: string; spendCents: number };
  skippedReason?: string;
}

/**
 * Execute an automatic boost for a candidate, IF SOCIAL_BOOST_ENABLED and
 * within the daily cap (given today's already-spent total). Always routes
 * through the platform client seam — mock in tests/default, real only when
 * the caller supplies a RealSocialPlatformClient AND it's actually
 * configured (server/metaAds.ts's boostPost throws in real mode today; see
 * that file's comment).
 */
export async function maybeAutoBoost(
  candidate: BoostCandidate,
  client: SocialPlatformClient,
  todaysSpendCents: number,
  destinationUrl: string,
  targetCounties: string[],
): Promise<AutoBoostOutcome> {
  if (!isSocialBoostEnabled()) {
    return { attempted: false, skippedReason: "SOCIAL_BOOST_ENABLED is false" };
  }
  const cap = getSocialBoostDailyCapCents();
  const remaining = cap - todaysSpendCents;
  if (remaining <= 0) {
    return { attempted: false, skippedReason: `Daily boost cap ($${(cap / 100).toFixed(2)}) already spent` };
  }
  const params: BoostParams = {
    platform: candidate.platform,
    postId: String(candidate.postId),
    dailyBudgetCents: Math.min(remaining, cap),
    objective: "leads",
    targetCounties,
    destinationUrl,
  };
  try {
    const result = await client.boost(params);
    return { attempted: true, result };
  } catch (err) {
    return { attempted: true, skippedReason: err instanceof Error ? err.message : String(err) };
  }
}
