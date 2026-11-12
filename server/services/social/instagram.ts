/**
 * Instagram lane (Nov 11, 2026 — owner: "yes do it").
 *
 *  1. Cross-post: every scheduled Facebook photo post is also published to
 *     Instagram as a photo post (JPEG via Netlify image CDN, Instagram caption).
 *  2. Reels: REEL_CALENDAR below publishes branded motion-text Reels
 *     (client/public/reels/*.mp4, rendered by scripts/make-reels.py) at set times.
 *
 * Both run inside the existing due-post worker (scheduledPostWorker.ts) and go
 * through publishSocialPost, so every Instagram post is a socialPosts row.
 * Idempotent: a calendar entry or cross-post with an existing row (any status)
 * is never published again — a failed Reel stays failed for review instead of
 * retrying every 5 minutes (a slow Reel could otherwise post twice).
 *
 * Content rules (owner, Nov 1–11): no rebate/incentive/tax-credit/OBR
 * promotion, no 24/7 or same-day, no prices.
 */
import { EXCLUDED_PROGRAM_RE, REBATE_PROMO_RE } from "../../../shared/excludedPrograms";
import { PHONE_DISPLAY, SMS_DISPLAY } from "../../../shared/business";

const SITE = "https://mechanicalenterprise.com";
const OTHER_RULES_RE = /\b24\s*\/\s*7\b|\b24-7\b|\bsame[-\s]day\b|\$\s?\d/i;

/** Returns the offending phrase when a post breaks the standing content rules, else null. */
export function socialRuleViolation(text: string): string | null {
  const m = text.match(REBATE_PROMO_RE) ?? text.match(EXCLUDED_PROGRAM_RE) ?? text.match(OTHER_RULES_RE);
  return m ? m[0] : null;
}

export const IG_HASHTAGS = "#NewJersey #NJHVAC #NorthJersey #EssexCounty #HeatPump #MiniSplit #HVACInstallation #HomeComfort";

export const IG_CTA =
  `Book a free in-home assessment: call ${PHONE_DISPLAY}, text ${SMS_DISPLAY}, or tap the link in our bio.`;

/**
 * Instagram captions can't hold clickable links: drop URLs (and dangling
 * "Learn more:"-style lead-ins), then add the call/text CTA and hashtags.
 */
export function toInstagramCaption(text: string): string {
  let body = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b(?:learn more|read more|details|book now|visit us|see more)\s*[:\-–—]?\s*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!/link in (?:our )?bio/i.test(body)) body += `\n\n${IG_CTA}`;
  if (!/#\w/.test(body)) body += `\n\n${IG_HASHTAGS}`;
  return body.slice(0, 2200); // Instagram caption limit
}

export function isImageUrl(url: string | undefined | null): boolean {
  return !!url && /\.(png|jpe?g|webp)(\?|$)/i.test(url);
}

/* ── Reel calendar ────────────────────────────────────────────────────────── */

export interface ReelEntry {
  slug: string;
  /** ISO time (UTC). Tue/Thu 6:30 PM New York. */
  publishAt: string;
  caption: string;
}

/**
 * Equipment photos in the Reels are licensed stock photos of real equipment
 * (scripts/reel-photos/CREDITS.json), not our jobs — the credit line is
 * required by CC BY and keeps that clear.
 */
export const REEL_PHOTO_CREDITS: Record<string, string> = {
  "signs-to-replace": "Gnomedude, Bonnie Bogle, Mike On Maui, engelcox (Flickr, CC BY 2.0)",
  "quote-checklist": "engelcox, Mike On Maui, Bonnie Bogle, Gnomedude (Flickr, CC BY 2.0); Southend-on-Sea Borough Council (public domain)",
  "premium-honestly-priced": "engelcox, Mike On Maui (Flickr, CC BY 2.0); Southend-on-Sea Borough Council (public domain)",
  "window-units": "Eric Fischer, Mike On Maui (Flickr, CC BY 2.0); Southend-on-Sea Borough Council (public domain)",
  "done-right": "Bonnie Bogle, engelcox, Mike On Maui, Gnomedude (Flickr, CC BY 2.0)",
  "oil-to-heat-pump": "Gnomedude, Bonnie Bogle, Mike On Maui (Flickr, CC BY 2.0); Southend-on-Sea Borough Council (public domain)",
};

const reelCaption = (slug: string, body: string) =>
  `${body}\n\n${IG_CTA}\n\n${IG_HASHTAGS}\n\n📷 Equipment photos: ${REEL_PHOTO_CREDITS[slug]}`;

export const REEL_CALENDAR: ReelEntry[] = [
  {
    slug: "signs-to-replace",
    publishAt: "2026-11-12T23:30:00Z",
    caption: reelCaption("signs-to-replace", 
      "How old is your furnace, really? 🤔\n\n" +
        "1️⃣ Older than 15 years?\n2️⃣ Repairs keep adding up?\n3️⃣ Some rooms never feel right?\n\n" +
        "If you nodded at two of these, it's time to plan a replacement — on your schedule, not in an emergency.",
    ),
  },
  {
    slug: "quote-checklist",
    publishAt: "2026-11-17T23:30:00Z",
    caption: reelCaption("quote-checklist", 
      "Comparing HVAC quotes? Check these 4 before you sign 👇\n\n" +
        "✔ Was your house actually sized — or just the old unit copied?\n✔ Is the exact equipment model listed?\n✔ Is ductwork & line set work spelled out?\n✔ Are the warranty terms in writing?\n\n" +
        "If it's not on paper, it's not in the price. Save this for your next quote.",
    ),
  },
  {
    slug: "premium-honestly-priced",
    publishAt: "2026-11-19T23:30:00Z",
    caption: reelCaption("premium-honestly-priced", 
      "What \"premium\" HVAC actually means:\n\n" +
        "✔ Sized for your house, not a guess\n✔ Clean, careful installation\n✔ Optional 10-year parts & labor coverage\n\n" +
        "Premium HVAC, honestly priced.",
    ),
  },
  {
    slug: "window-units",
    publishAt: "2026-11-24T23:30:00Z",
    caption: reelCaption("window-units", 
      "Still hauling window units up from the basement every year? 🪟\n\n" +
        "One ductless mini-split or heat pump system heats AND cools — quietly, all year, with nothing to carry.",
    ),
  },
  {
    slug: "done-right",
    publishAt: "2026-12-01T23:30:00Z",
    caption: reelCaption("done-right", 
      "Why is one HVAC quote thousands cheaper? Usually it's a smaller job:\n\n" +
        "• Undersized equipment\n• Old ductwork left as-is\n• Shortcuts you can't see\n\n" +
        "We'd rather do it right the first time.",
    ),
  },
  {
    slug: "oil-to-heat-pump",
    publishAt: "2026-12-03T23:30:00Z",
    caption: reelCaption("oil-to-heat-pump", 
      "Still paying for oil deliveries? 🛢️\n\n" +
        "A heat pump heats and cools your home with no oil tank to fill. We size the system to your house — not a guess.",
    ),
  },
];

export const reelVideoUrl = (slug: string) => `${SITE}/reels/${slug}.mp4`;

/** Entries due now: publishAt has passed but by less than `graceMs` (no backlog dumps after downtime). */
export function dueReels(now: Date, calendar: ReelEntry[] = REEL_CALENDAR, graceMs = 36 * 3600 * 1000): ReelEntry[] {
  const t = now.getTime();
  return calendar.filter((r) => {
    const at = Date.parse(r.publishAt);
    return at <= t && t - at < graceMs;
  });
}
