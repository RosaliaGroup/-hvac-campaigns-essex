/**
 * Schedule owner-approved Facebook posts from outside the CRM UI.
 * POST /api/team-hub/social/schedule   header x-hub-secret: TEAM_HUB_SECRET
 * body: { posts: [{ content, imageUrl, scheduledAt }] }
 * GET  /api/team-hub/social/scheduled  (same header) — upcoming scheduled posts.
 *
 * Rows go into socialPosts as status "scheduled"; the existing scheduled-post
 * worker publishes them when due (and cross-posts photos to Instagram when
 * SOCIAL_CROSSPOST_INSTAGRAM=true). Images must be on our own site.
 */
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { socialPosts } from "../../drizzle/schema";
import { getDb } from "../db";
import { socialRuleViolation } from "./social/instagram";

function secretOk(req: Request): boolean {
  const want = process.env.TEAM_HUB_SECRET?.trim();
  const got = String(req.headers["x-hub-secret"] ?? "");
  if (!want || want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function registerTeamHubSocialRoutes(app: Express) {
  app.post("/api/team-hub/social/schedule", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const posts = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 20) : [];
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const out: Array<Record<string, unknown>> = [];
    for (const p of posts) {
      const content = String(p?.content ?? "").trim();
      const imageUrl = String(p?.imageUrl ?? "").trim();
      const when = new Date(String(p?.scheduledAt ?? ""));
      if (!content || content.length > 5000) { out.push({ error: "bad content" }); continue; }
      if (!/^https:\/\/mechanicalenterprise\.com\/[\w./-]+\.(jpe?g|png)$/i.test(imageUrl)) { out.push({ error: "image must be a .jpg/.png on mechanicalenterprise.com" }); continue; }
      if (isNaN(when.getTime()) || when.getTime() < Date.now() + 10 * 60_000) { out.push({ error: "scheduledAt must be at least 10 minutes ahead" }); continue; }
      const violation = socialRuleViolation(content);
      if (violation) { out.push({ error: `content rule: ${violation}` }); continue; }
      const [dup] = await db.select({ id: socialPosts.id }).from(socialPosts)
        .where(and(eq(socialPosts.platform, "facebook"), eq(socialPosts.content, content))).limit(1);
      if (dup) { out.push({ skipped: "already scheduled", id: dup.id }); continue; }
      await db.insert(socialPosts).values({
        platform: "facebook", content, contentType: "owner_approved", scheduledAt: when,
        mediaUrls: JSON.stringify([imageUrl]), status: "scheduled",
      });
      out.push({ scheduled: when.toISOString() });
    }
    return res.json({ ok: true, results: out });
  });

  app.get("/api/team-hub/social/scheduled", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    const rows = await db.select({ id: socialPosts.id, platform: socialPosts.platform, status: socialPosts.status, scheduledAt: socialPosts.scheduledAt, content: socialPosts.content, mediaUrls: socialPosts.mediaUrls })
      .from(socialPosts).where(gte(socialPosts.scheduledAt, new Date(Date.now() - 86400_000))).limit(100);
    return res.json({ posts: rows.map((r) => ({ ...r, content: String(r.content).slice(0, 80) })) });
  });
}
