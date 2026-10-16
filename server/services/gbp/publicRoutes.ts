import type { Express } from "express";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { gbpLocations, gbpReviews, gbpPhotos } from "../../drizzle/schema";
import { getGbpTarget } from "../integrations/gbp";

/** Public read-only, cache-backed content; never exposes credentials or private CRM data. */
export function registerPublicGbpRoutes(app: Express) {
  app.get("/api/public/google-business", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    try {
      const target = getGbpTarget();
      const db = await getDb();
      if (!target || !db) return res.json({ connected: false, reviews: [], photos: [] });
      const [locations, reviews, photos] = await Promise.all([
        db.select({ rating: gbpLocations.rating, totalReviews: gbpLocations.totalReviews })
          .from(gbpLocations).where(eq(gbpLocations.locationName, target.locationName)).limit(1),
        db.select({
          id: gbpReviews.reviewHash, author: gbpReviews.reviewerName,
          rating: gbpReviews.starRating, text: gbpReviews.comment, date: gbpReviews.createTime,
        }).from(gbpReviews).where(eq(gbpReviews.locationName, target.locationName))
          .orderBy(desc(gbpReviews.createTime)).limit(24),
        db.select({ id: gbpPhotos.mediaHash, url: gbpPhotos.googleUrl, category: gbpPhotos.category })
          .from(gbpPhotos).where(eq(gbpPhotos.locationName, target.locationName)).limit(48),
      ]);
      const safePhotos = photos.filter(p => {
        try { const u = new URL(p.url ?? ""); return u.protocol === "https:" && /(^|\.)googleusercontent\.com$|(^|\.)google\.com$/.test(u.hostname); }
        catch { return false; }
      }).slice(0, 24);
      return res.json({
        connected: true,
        rating: locations[0]?.rating ?? null,
        totalReviews: locations[0]?.totalReviews ?? null,
        reviews: reviews.filter(r => r.rating > 0 && r.text?.trim()).map(r => ({
          ...r, author: r.author || "Google reviewer",
        })),
        photos: safePhotos,
      });
    } catch {
      return res.status(503).json({ connected: false, reviews: [], photos: [] });
    }
  });
}
