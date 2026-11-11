/**
 * Existing manually-approved socialPosts with status=scheduled are published
 * at their due time. Single Railway instance expected; atomic DB claim avoids
 * overlapping timer ticks on one or multiple replicas. Failed publishes remain
 * failed for review, not silently retried or duplicated.
 *
 * Nov 11, 2026 additions (server/services/social/instagram.ts):
 *  - Content-rule guard: a due post with rebate / 24-7 / same-day / price
 *    wording is NOT published; it is marked failed with the reason.
 *  - SOCIAL_CROSSPOST_INSTAGRAM=true: each Facebook photo post that publishes
 *    is also posted to Instagram (once).
 *  - SOCIAL_INSTAGRAM_REELS_ENABLED=true: Reels from REEL_CALENDAR publish when due.
 */
import { and, eq, lte } from "drizzle-orm";
import { getDb, findReusableSocialPost } from "../../db";
import { socialPosts } from "../../../drizzle/schema";
import { publishSocialPost } from "../socialPublisher";
import {
  dueReels,
  isImageUrl,
  reelVideoUrl,
  socialRuleViolation,
  toInstagramCaption,
  type ReelEntry,
} from "./instagram";

let running = false;
export async function processDueScheduledPosts(now = new Date()): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const db = await getDb();
    if (!db) return 0;
    const due = await db.select().from(socialPosts)
      .where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, now)))
      .orderBy(socialPosts.scheduledAt).limit(10);
    let processed = 0;
    for (const post of due) {
      if (post.platform !== "facebook" && post.platform !== "instagram") continue;
      // Atomic claim: do not publish the same row from concurrent workers.
      const claim = await db.update(socialPosts).set({ status: "held" })
        .where(and(eq(socialPosts.id, post.id), eq(socialPosts.status, "scheduled")));
      const changed = (claim as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0;
      if (changed !== 1) continue;

      const violation = socialRuleViolation(post.content);
      if (violation) {
        const message = `Blocked by content rules (no rebate/24-7/same-day/price promotion): "${violation}"`;
        await db.update(socialPosts).set({ status: "failed", errorMessage: message }).where(eq(socialPosts.id, post.id));
        console.warn(`[SocialScheduler] post #${post.id} NOT published — ${message}`);
        processed++;
        continue;
      }

      let mediaUrls: string[] | undefined;
      try {
        mediaUrls = post.mediaUrls ? JSON.parse(post.mediaUrls) as string[] : undefined;
        // The existing publisher requires scheduled status for approval, so
        // this worker explicitly approves only the row it atomically claimed.
        await publishSocialPost({ id: post.id, platform: post.platform, content: post.content, mediaUrls, approved: true });
        console.log(`[SocialScheduler] published due post #${post.id} to ${post.platform}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.update(socialPosts).set({ status: "failed", errorMessage: message.slice(0, 480) }).where(eq(socialPosts.id, post.id));
        console.error(`[SocialScheduler] post #${post.id} failed:`, message);
        processed++;
        continue;
      }
      processed++;

      if (post.platform === "facebook" && process.env.SOCIAL_CROSSPOST_INSTAGRAM === "true" && isImageUrl(mediaUrls?.[0])) {
        await crossPostToInstagram(post.id, post.content, mediaUrls![0]);
      }
    }

    if (process.env.SOCIAL_INSTAGRAM_REELS_ENABLED === "true") {
      for (const reel of dueReels(now)) processed += await publishReel(reel);
    }
    return processed;
  } finally { running = false; }
}

async function crossPostToInstagram(fbPostId: number, content: string, imageUrl: string): Promise<void> {
  const caption = toInstagramCaption(content);
  try {
    if (await findReusableSocialPost("instagram", caption)) return; // already attempted once
    const r = await publishSocialPost({ platform: "instagram", content: caption, contentType: "crosspost", mediaUrls: [imageUrl], approved: true });
    console.log(`[SocialScheduler] cross-posted FB #${fbPostId} to instagram as #${r.id}`);
  } catch (error) {
    console.error(`[SocialScheduler] instagram cross-post of FB #${fbPostId} failed:`, error instanceof Error ? error.message : String(error));
  }
}

async function publishReel(reel: ReelEntry): Promise<number> {
  try {
    if (await findReusableSocialPost("instagram", reel.caption)) return 0; // posted or attempted already
    const r = await publishSocialPost({ platform: "instagram", content: reel.caption, contentType: "reel", mediaUrls: [reelVideoUrl(reel.slug)], approved: true });
    console.log(`[SocialScheduler] published reel "${reel.slug}" to instagram as #${r.id}`);
    return 1;
  } catch (error) {
    console.error(`[SocialScheduler] reel "${reel.slug}" failed:`, error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function startScheduledSocialPostWorker(): void {
  if (process.env.SOCIAL_LANE_ENABLED !== "true") return;
  // The scheduler runs only on the designated instance if configured.
  if (process.env.SOCIAL_SCHEDULED_WORKER_ENABLED !== "true") return;
  console.log("[SocialScheduler] due-post worker enabled (5-minute interval)");
  const tick = () => processDueScheduledPosts().catch(err => console.error("[SocialScheduler] sweep error:", err));
  void tick();
  setInterval(tick, 5 * 60 * 1000);
}
