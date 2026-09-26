/**
 * Cadence + content-source rotation (docs/social-lane-spec.md §1/§2).
 *
 * `SOCIAL_POSTS_PER_WEEK` (hard max 7) is a global ceiling applied to EACH
 * platform's weekly cap — the spec states one global env var capped at 7
 * alongside per-platform defaults that individually sum higher (FB 3 + IG 3 +
 * GBP 2 + Nextdoor 1 = 9), so it can't mean "sum of all platforms ≤ 7". Read
 * literally, it's a per-platform ceiling: no single platform may be
 * scheduled more than 7x/week, and each platform's configured cadence is
 * clamped to it. This is a judgment call — flagged in the build report.
 */
export type SocialPlatformKey = "facebook" | "instagram" | "google_business" | "nextdoor";

export const HARD_MAX_POSTS_PER_WEEK = 7;

export const PLATFORM_WEEKLY_DEFAULTS: Record<SocialPlatformKey, number> = {
  facebook: 3,
  instagram: 3,
  google_business: 2,
  nextdoor: 1,
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** The configured (env-overridable) global cap, hard-clamped to 7. */
export function getSocialPostsPerWeekCap(): number {
  return Math.min(envInt("SOCIAL_POSTS_PER_WEEK", HARD_MAX_POSTS_PER_WEEK), HARD_MAX_POSTS_PER_WEEK);
}

/** This platform's effective weekly cadence cap: its default, clamped to the global ceiling. */
export function getPlatformWeeklyCap(platform: SocialPlatformKey): number {
  return Math.min(PLATFORM_WEEKLY_DEFAULTS[platform], getSocialPostsPerWeekCap());
}

/** True if scheduling one more post this week would stay within the platform's cap. */
export function isUnderWeeklyCap(platform: SocialPlatformKey, postsScheduledThisWeek: number): boolean {
  return postsScheduledThisWeek < getPlatformWeeklyCap(platform);
}

export const DEFAULT_POST_TIMES_ET = [
  { day: "Tue", hour: 10, minute: 0 },
  { day: "Thu", hour: 10, minute: 0 },
  { day: "Sat", hour: 10, minute: 0 },
] as const;

/* ── Content-source rotation (§2): never two of the same type in a row ──── */

export type ContentSourceType = "offer" | "blog" | "job_photo" | "review" | "seasonal" | "video" | "b2b";

/** Enabled sources in rotation priority order, given current feature flags. */
export function enabledContentSources(flags: {
  jobPhotosEnabled: boolean;
  videoEnabled: boolean;
}): ContentSourceType[] {
  const sources: ContentSourceType[] = ["offer", "blog", "review", "seasonal", "b2b"];
  if (flags.jobPhotosEnabled) sources.push("job_photo");
  if (flags.videoEnabled) sources.push("video");
  return sources;
}

/**
 * Pick the next content-source type given recent history (most-recent-first)
 * and the enabled set — round-robins through `enabled`, skipping a repeat of
 * the immediately-preceding type whenever an alternative exists.
 */
export function pickNextContentSource(recentHistory: ContentSourceType[], enabled: ContentSourceType[]): ContentSourceType {
  if (enabled.length === 0) throw new Error("No content sources enabled");
  const last = recentHistory[0];
  if (enabled.length === 1) return enabled[0];

  // Rotate starting just after whichever enabled source was used least recently.
  const lastUsedIndex = new Map<ContentSourceType, number>();
  recentHistory.forEach((type, idx) => {
    if (!lastUsedIndex.has(type)) lastUsedIndex.set(type, idx);
  });
  const ranked = [...enabled].sort((a, b) => {
    const ai = lastUsedIndex.has(a) ? (lastUsedIndex.get(a) as number) : Infinity;
    const bi = lastUsedIndex.has(b) ? (lastUsedIndex.get(b) as number) : Infinity;
    return bi - ai; // least-recently-used (or never-used) first
  });
  const pick = ranked.find((t) => t !== last) ?? ranked[0];
  return pick;
}

/** Enforces "never two of the same type in a row" on an already-decided candidate. */
export function violatesRotationRule(candidate: ContentSourceType, recentHistory: ContentSourceType[]): boolean {
  return recentHistory[0] === candidate;
}
