/**
 * Daily digest section for the Social Lane (docs/social-lane-spec.md §6).
 * Assembles the report data; rendering into the actual digest email template
 * is left to whatever calls this (no single "assembleDigest()" function was
 * found elsewhere in this codebase to hook into — this returns a
 * self-contained, already-formatted section so any digest sender can splice
 * it in as HTML).
 */
import type { SocialPost } from "../../../drizzle/schema";
import { buildVetoLink, buildRevertLink } from "./holdAndPublish";
import { listPostsPostedBetween, listRecentPosts } from "./repo";

export interface DigestPostLine {
  id: number;
  platform: string;
  excerpt: string;
  postUrl: string | null;
  deleteLink: string | null;
  reach: number | null;
  engagement: number | null;
}

export interface DigestSection {
  posted: DigestPostLine[];
  held: Array<{ id: number; platform: string; excerpt: string; holdUntil: Date | null; vetoLink: string }>;
  vetoed: Array<{ id: number; platform: string; excerpt: string }>;
  queuedManual: Array<{ id: number; platform: string; excerpt: string }>;
  boostCandidates: Array<{ id: number; platform: string }>;
  /** Clicks/leads attribution isn't wired yet — see README note below. Always null until GA4 + CRM source join is built for social UTM traffic. */
  clicksAttributed: number | null;
  leadsAttributed: number | null;
  boostSpendCents: number;
}

function excerpt(content: string, max = 120): string {
  return content.length > max ? `${content.slice(0, max - 1)}…` : content;
}

function parseEngagement(json: string | null): number | null {
  if (!json) return null;
  try {
    const e = JSON.parse(json) as { likes?: number; comments?: number; shares?: number };
    return (e.likes ?? 0) + (e.comments ?? 0) * 2 + (e.shares ?? 0) * 3;
  } catch {
    return null;
  }
}

function postExternalUrl(row: SocialPost): string | null {
  if (!row.postId) return null;
  if (row.platform === "facebook") return `https://facebook.com/${row.postId}`;
  if (row.platform === "google_business") return null; // GBP local posts have no stable public URL to link to.
  return null;
}

/** Build today's digest section from already-fetched rows (pure, testable). */
export function buildDigestSection(params: {
  postedToday: SocialPost[];
  held: SocialPost[];
  vetoedToday: SocialPost[];
  queuedManual: SocialPost[];
  boostCandidateIds: number[];
  boostSpendCents: number;
  baseUrl: string;
}): DigestSection {
  return {
    posted: params.postedToday.map((r) => ({
      id: r.id,
      platform: r.platform,
      excerpt: excerpt(r.content),
      postUrl: postExternalUrl(r),
      deleteLink: r.postId ? buildRevertLink(params.baseUrl, r.id) : null,
      reach: null, // Platform insights (getFacebookInsights/getGoogleBusinessReviews) return engagement, not reach — reach would need a separate insights call not wired into this pass.
      engagement: parseEngagement(r.engagement),
    })),
    held: params.held.map((r) => ({
      id: r.id,
      platform: r.platform,
      excerpt: excerpt(r.content),
      holdUntil: r.holdUntil,
      vetoLink: buildVetoLink(params.baseUrl, r.id),
    })),
    vetoed: params.vetoedToday.map((r) => ({ id: r.id, platform: r.platform, excerpt: excerpt(r.content) })),
    queuedManual: params.queuedManual.map((r) => ({ id: r.id, platform: r.platform, excerpt: excerpt(r.content) })),
    boostCandidates: params.boostCandidateIds.map((id) => ({ id, platform: "facebook" })),
    clicksAttributed: null,
    leadsAttributed: null,
    boostSpendCents: params.boostSpendCents,
  };
}

/** Real, DB-backed assembly for "today" (UTC calendar day) — the thin I/O wrapper around buildDigestSection. */
export async function buildTodaysDigestSection(baseUrl: string, now: Date = new Date()): Promise<DigestSection> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const [postedToday, recent] = await Promise.all([listPostsPostedBetween(dayStart, dayEnd), listRecentPosts(1, now)]);

  const held = recent.filter((r) => r.status === "held");
  const vetoedToday = recent.filter((r) => r.status === "vetoed");
  const queuedManual = recent.filter((r) => r.status === "scheduled" && (r.platform === "nextdoor" || r.contentSource === "b2b"));

  return buildDigestSection({
    postedToday,
    held,
    vetoedToday,
    queuedManual,
    boostCandidateIds: [],
    boostSpendCents: 0,
    baseUrl,
  });
}
