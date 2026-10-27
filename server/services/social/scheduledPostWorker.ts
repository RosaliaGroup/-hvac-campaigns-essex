/**
 * Existing manually-approved socialPosts with status=scheduled are published
 * at their due time. Single Railway instance expected; atomic DB claim avoids
 * overlapping timer ticks on one or multiple replicas. Failed publishes remain
 * failed for review, not silently retried or duplicated.
 */
import { and, eq, lte } from "drizzle-orm";
import { getDb } from "../../db";
import { socialPosts } from "../../../drizzle/schema";
import { publishSocialPost } from "../socialPublisher";

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
      try {
        const mediaUrls = post.mediaUrls ? JSON.parse(post.mediaUrls) as string[] : undefined;
        // The existing publisher requires scheduled status for approval, so
        // this worker explicitly approves only the row it atomically claimed.
        await publishSocialPost({ id: post.id, platform: post.platform, content: post.content, mediaUrls, approved: true });
        console.log(`[SocialScheduler] published due post #${post.id} to ${post.platform}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.update(socialPosts).set({ status: "failed", errorMessage: message.slice(0, 480) }).where(eq(socialPosts.id, post.id));
        console.error(`[SocialScheduler] post #${post.id} failed:`, message);
      }
      processed++;
    }
    return processed;
  } finally { running = false; }
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
