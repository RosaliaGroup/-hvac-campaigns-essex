/**
 * Content-source generators (docs/social-lane-spec.md §2). Each generator is
 * a pure function: given source data, it returns a draft post or a reason it
 * can't produce one right now (never throws for an ordinary "nothing to post"
 * case — only truly invalid input, like a missing required id, throws).
 *
 * Callers (the scheduler) are responsible for: picking the source per the
 * rotation rule (cadence.ts), running the linter (linter.ts) and duplicate
 * check (duplicateCheck.ts) on the result, and attaching hashtags/UTM.
 */
import type { ContentSourceType } from "./cadence";
import { VERIFIED_FACTS, type VerifiedIncentive, type VerifiedWarranty, type VerifiedMembership } from "@shared/verifiedFacts";

export interface ContentDraft {
  ok: true;
  sourceType: ContentSourceType;
  content: string;
  mediaUrls: string[];
  contentType: string;
  /** Manual-queue sources (Nextdoor/B2B/LinkedIn) never auto-publish — copy is generated for copy/paste only. */
  manualOnly: boolean;
}
export interface ContentDraftSkipped {
  ok: false;
  sourceType: ContentSourceType;
  reason: string;
}
export type ContentResult = ContentDraft | ContentDraftSkipped;

/* ── 1. Offer / education (facts-only) ──────────────────────────────────── */

export function generateOfferPost(): ContentResult {
  const facts = VERIFIED_FACTS;
  // One claim per post (§2.1) — rotate through whichever verified facts exist;
  // never invent a number/program not in shared/verifiedFacts.ts.
  const candidates: Array<{ label: string; text: string }> = [];

  for (const inc of facts.incentives as VerifiedIncentive[]) {
    candidates.push({ label: inc.program, text: `${inc.program}: ${inc.amountText}. Ask us if your home qualifies.` });
  }
  const warranty: VerifiedWarranty = facts.warranty;
  candidates.push({ label: warranty.headline, text: `${warranty.headline} on ${warranty.availableFor.join(" and ")}. Call ${facts.business.phone}.` });

  const membership: VerifiedMembership = facts.membership;
  if (membership.priceText) {
    candidates.push({ label: membership.name, text: `${membership.name}: ${membership.includes[0]}. ${membership.priceText}.` });
  }

  if (candidates.length === 0) {
    return { ok: false, sourceType: "offer", reason: "No verified facts available to draft an offer/education post from." };
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { ok: true, sourceType: "offer", content: pick.text, mediaUrls: [], contentType: "offer_education", manualOnly: false };
}

/* ── 2. Blog amplification ──────────────────────────────────────────────── */

export interface BlogPostForAmplification {
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
  /** Optional — only known if GA4/analytics is wired for this post. */
  impressions?: number;
}

const BLOG_BASE_URL = "https://mechanicalenterprise.com/blog";

export function generateBlogAmplificationPost(post: BlogPostForAmplification, now: Date = new Date()): ContentResult {
  const ageMs = now.getTime() - post.publishedAt.getTime();
  const withinFirst24h = ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000;
  const isThirtyDayReshare = ageMs >= 29 * 24 * 60 * 60 * 1000 && ageMs <= 31 * 24 * 60 * 60 * 1000 && (post.impressions ?? 0) > 0;

  if (!withinFirst24h && !isThirtyDayReshare) {
    return { ok: false, sourceType: "blog", reason: "Not within the 24h amplification window or the 30-day re-share window." };
  }
  const content = `${post.title}\n\n${post.summary}\n\nRead more: ${BLOG_BASE_URL}/${post.slug}`;
  return { ok: true, sourceType: "blog", content, mediaUrls: [], contentType: "blog_amplification", manualOnly: false };
}

/* ── 3. Job photos (photoConsent=true ONLY) ─────────────────────────────── */

export interface JobPhotoInput {
  jobId: number;
  jobType: string | null;
  photoConsent: boolean;
  photos: Array<{ url: string; category: "before" | "after" }>;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  installation: "a new system installation", replacement: "a system replacement",
  heat_pump: "a heat pump installation", mini_split: "a ductless mini-split installation",
  ac: "an AC installation", furnace: "a furnace installation", boiler: "a boiler installation",
  maintenance: "a maintenance visit", repair: "a repair", commercial_hvac: "a commercial HVAC project",
  residential_hvac: "a residential HVAC project", rooftop_unit: "a rooftop unit project",
};

/** Hard gate: never returns a post unless `job.photoConsent === true`. No customer/address text ever appears. */
export function generateJobPhotoPost(job: JobPhotoInput): ContentResult {
  if (!job.photoConsent) {
    return { ok: false, sourceType: "job_photo", reason: "photoConsent is not true for this job — job photos may never be used without it." };
  }
  if (job.photos.length === 0) {
    return { ok: false, sourceType: "job_photo", reason: "No photos available for this job." };
  }
  const label = (job.jobType && JOB_TYPE_LABELS[job.jobType]) || "a recent HVAC project";
  const before = job.photos.find((p) => p.category === "before");
  const after = job.photos.find((p) => p.category === "after");
  const mediaUrls = [before?.url, after?.url].filter((u): u is string => !!u);
  if (mediaUrls.length === 0) mediaUrls.push(job.photos[0].url);

  const content = `Before & after from ${label}. Quality work, done right.`;
  return { ok: true, sourceType: "job_photo", content, mediaUrls, contentType: "job_photo", manualOnly: false };
}

/* ── 4. Reviews (4-5 star, first-name only, skip short/full-name reviews) ── */

export interface ReviewInput {
  reviewerFirstName: string;
  reviewerFullNameRaw?: string;
  rating: number;
  text: string;
  reviewUrl: string;
}

function mentionsFullName(text: string): boolean {
  return /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
}

export function generateReviewPost(review: ReviewInput): ContentResult {
  if (review.rating < 4) return { ok: false, sourceType: "review", reason: "Rating below 4 stars." };
  const wordCount = review.text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) return { ok: false, sourceType: "review", reason: "Review is under 20 words." };
  if (mentionsFullName(review.text)) return { ok: false, sourceType: "review", reason: "Review text mentions a person by full name." };

  const content = `"${review.text.trim()}" — ${review.reviewerFirstName}\n\nRead more reviews: ${review.reviewUrl}`;
  return { ok: true, sourceType: "review", content, mediaUrls: [], contentType: "review", manualOnly: false };
}

/* ── 5. Seasonal / service reminders (small owner-editable calendar stub) ── */

export interface SeasonalCalendarEntry {
  /** 1-12 */
  month: number;
  title: string;
  body: string;
}

// Owner-editable stub calendar (§2.5). Facts-only — no price/claim beyond
// what's in shared/verifiedFacts.ts. Extend/replace as the owner directs.
export const SEASONAL_CALENDAR: SeasonalCalendarEntry[] = [
  { month: 3, title: "Spring filter check", body: "Spring is here — a fresh filter keeps your system running efficiently all season." },
  { month: 9, title: "Pre-winter tune-up", body: "Before the cold hits: a pre-winter tune-up helps catch issues before they become emergencies." },
  { month: 11, title: "Heat pump defrost explainer", body: "Seeing frost on your heat pump in winter? That's normal — the defrost cycle clears it automatically." },
  { month: 6, title: "Summer AC check", body: "Beat the heat: a summer AC check-up now can prevent a mid-July breakdown." },
];

export function generateSeasonalPost(now: Date = new Date()): ContentResult {
  const month = now.getMonth() + 1;
  const entry = SEASONAL_CALENDAR.find((e) => e.month === month);
  if (!entry) return { ok: false, sourceType: "seasonal", reason: `No seasonal calendar entry for month ${month}.` };
  return { ok: true, sourceType: "seasonal", content: `${entry.title}: ${entry.body}`, mediaUrls: [], contentType: "seasonal_reminder", manualOnly: false };
}

/* ── 6. Video (HeyGen) — stub, gated behind SOCIAL_VIDEO_ENABLED ────────── */

export function isSocialVideoEnabled(): boolean {
  return String(process.env.SOCIAL_VIDEO_ENABLED ?? "false").toLowerCase() === "true";
}

/**
 * TODO(video): full HeyGen short-form integration (script → fact-check →
 * render → post) is intentionally NOT built out — lowest priority per the
 * owner's build instructions, and gated off by default. This stub documents
 * the shape the real implementation would fill once an avatar/voice is
 * approved (server/heygen.ts already has a HeyGen client for a different use
 * case — personalized lead videos — that a real implementation would extend
 * or sit alongside, not reuse directly, since the script/topic source differs).
 */
export function generateVideoPost(): ContentResult {
  if (!isSocialVideoEnabled()) {
    return { ok: false, sourceType: "video", reason: "SOCIAL_VIDEO_ENABLED is false." };
  }
  return { ok: false, sourceType: "video", reason: "TODO(video): HeyGen script/render/post pipeline not yet implemented." };
}

/* ── 7. B2B (manual queue, like Nextdoor) ───────────────────────────────── */

export function generateB2BPost(): ContentResult {
  const facts = VERIFIED_FACTS;
  const sla = facts.portfolioSla;
  const line = sla.responseHours
    ? `Portfolio service with a ${sla.responseHours}-hour response window, ${sla.reportingCadence} reporting, priced ${sla.pricingBasis}.`
    : `Portfolio HVAC service for property managers and GCs — ${sla.reportingCadence} reporting, priced ${sla.pricingBasis}. Ask about PTAC, mini-split, RTU and split coverage.`;
  return { ok: true, sourceType: "b2b", content: line, mediaUrls: [], contentType: "b2b_linkedin", manualOnly: true };
}
