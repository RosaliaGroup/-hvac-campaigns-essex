import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { personalizedVideos } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generatePersonalizedVideo,
  getVideoStatus,
  listAvatars,
  listVoices,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
} from "../heygen";

export const heygenRouter = router({
  /**
   * Trigger generation of a personalized HeyGen video for the logged-in user.
   */
  generate: protectedProcedure
    .input(
      z.object({
        topic: z.enum(["rebates", "financing", "solar", "assessment"]),
        clientName: z.string().min(1),
        rebateAmount: z.number().optional(),
        avatarId: z.string().optional(),
        voiceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Generate the video via HeyGen API
      const heygenVideoId = await generatePersonalizedVideo({
        clientName: input.clientName,
        topic: input.topic,
        rebateAmount: input.rebateAmount,
        avatarId: input.avatarId ?? DEFAULT_AVATAR_ID,
        voiceId: input.voiceId ?? DEFAULT_VOICE_ID,
      });

      // Persist the job to the database
      await db.insert(personalizedVideos).values({
        userId: ctx.user.id,
        heygenVideoId,
        topic: input.topic,
        clientName: input.clientName,
        status: "pending",
      });

      return { heygenVideoId, status: "pending" as const };
    }),

  /**
   * Poll the status of a video generation job and update the database.
   */
  checkStatus: protectedProcedure
    .input(z.object({ heygenVideoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch latest status from HeyGen API
      const status = await getVideoStatus(input.heygenVideoId);

      // Update DB if status changed
      if (status.status === "completed" || status.status === "failed") {
        await db
          .update(personalizedVideos)
          .set({
            status: status.status,
            videoUrl: status.videoUrl ?? null,
            thumbnailUrl: status.thumbnailUrl ?? null,
            errorMessage: status.error ?? null,
          })
          .where(
            and(
              eq(personalizedVideos.heygenVideoId, input.heygenVideoId),
              eq(personalizedVideos.userId, ctx.user.id)
            )
          );
      }

      return status;
    }),

  /**
   * List all personalized videos for the logged-in user.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    return await db
      .select()
      .from(personalizedVideos)
      .where(eq(personalizedVideos.userId, ctx.user.id))
      .orderBy(desc(personalizedVideos.createdAt));
  }),

  /**
   * List available non-premium avatars.
   */
  avatars: protectedProcedure.query(async () => {
    const avatars = await listAvatars();
    return avatars.filter((a) => !a.premium).slice(0, 50);
  }),

  /**
   * List available English voices.
   */
  voices: protectedProcedure.query(async () => {
    const voices = await listVoices();
    return voices.slice(0, 50);
  }),
});
