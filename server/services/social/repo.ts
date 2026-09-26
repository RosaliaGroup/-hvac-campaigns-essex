/**
 * Social Lane data access — everything beyond what
 * server/services/socialPublisher.ts already owns (that file stays untouched;
 * this is purely additive reads/writes around it, per migration 0076's new
 * columns/tables). Real DB-backed implementations; callers that want to unit
 * test without a DB pass their own fakes matching these shapes (see
 * server/services/social/*.test.ts).
 */
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../../db";
import * as dbModule from "../../db";
import { socialPosts, jobs, jobPhotos, type SocialPost } from "../../../drizzle/schema";
import type { HoldRepoDeps, HoldablePostRow } from "./holdAndPublish";

export type SocialLaneStatus = SocialPost["status"];

/** Rows in `held` state whose hold window has elapsed — due for auto-publish (§1/§7). */
export async function listDueHeldPosts(now: Date = new Date()): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.status, "held"), lte(socialPosts.holdUntil, now)));
}

/** Posts created in the last N days, for the duplicate check (§3) and the digest (§6). */
export async function listRecentPosts(sinceDays: number, now: Date = new Date()): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(now.getTime() - sinceDays * 24 * 60 * 60 * 1000);
  return db.select().from(socialPosts).where(gte(socialPosts.createdAt, since)).orderBy(desc(socialPosts.createdAt));
}

/** Posts published on a given calendar day, for the daily digest (§6). */
export async function listPostsPostedBetween(start: Date, end: Date): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(socialPosts)
    .where(and(gte(socialPosts.postedAt, start), lte(socialPosts.postedAt, end)))
    .orderBy(desc(socialPosts.postedAt));
}

/** Count of vetoed posts since a given date — feeds the "2 vetoes in 7 days" circuit breaker (§7). */
export async function countVetoesSince(since: Date): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ id: socialPosts.id })
    .from(socialPosts)
    .where(and(eq(socialPosts.status, "vetoed"), gte(socialPosts.vetoedAt, since)));
  return rows.length;
}

export interface JobForPhotoGate {
  id: number;
  jobType: string | null;
  photoConsent: boolean;
}

/** Jobs with photoConsent=true and at least one photo — candidates for the job-photo content source (§2.3). */
export async function listConsentedJobsWithPhotos(): Promise<Array<JobForPhotoGate & { photos: Array<{ id: number; url: string; category: "before" | "after" }> }>> {
  const db = await getDb();
  if (!db) return [];
  const consentedJobs = await db
    .select({ id: jobs.id, jobType: jobs.jobType, photoConsent: jobs.photoConsent })
    .from(jobs)
    .where(eq(jobs.photoConsent, true));
  if (consentedJobs.length === 0) return [];

  const jobIds = consentedJobs.map((j) => j.id);
  const photos = await db.select().from(jobPhotos).where(sql`${jobPhotos.jobId} IN (${sql.join(jobIds, sql`, `)})`);

  return consentedJobs.map((j) => ({
    ...j,
    photos: photos.filter((p) => p.jobId === j.id).map((p) => ({ id: p.id, url: p.url, category: p.category })),
  }));
}

/** A single job's consent flag — the hard gate checked at generation time (§2.3, §9), never cached elsewhere. */
export async function getJobPhotoConsent(jobId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ photoConsent: jobs.photoConsent }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return !!row?.photoConsent;
}

function toHoldableRow(r: SocialPost): HoldablePostRow {
  return {
    id: r.id,
    platform: r.platform,
    content: r.content,
    status: r.status,
    postId: r.postId ?? null,
    mediaUrls: r.mediaUrls ?? null,
    holdUntil: r.holdUntil ?? null,
  };
}

/** Real, DB-backed implementation of holdAndPublish.ts's HoldRepoDeps. */
export function defaultHoldRepoDeps(): HoldRepoDeps {
  return {
    create: async (row) =>
      dbModule.createSocialPostReturningId({
        platform: row.platform,
        content: row.content,
        contentType: row.contentType,
        mediaUrls: row.mediaUrls,
        contentSource: row.contentSource,
        utmCampaign: row.utmCampaign,
        status: "draft",
      } as any),
    getById: async (id) => {
      const r = await dbModule.getSocialPostById(id);
      return r ? toHoldableRow(r as SocialPost) : null;
    },
    setHeld: async (id, holdUntil) => {
      await dbModule.updateSocialPost(id, { status: "held", holdUntil } as any);
    },
    setVetoed: async (id) => {
      await dbModule.updateSocialPost(id, { status: "vetoed", vetoedAt: new Date() } as any);
    },
    setReverted: async (id) => {
      await dbModule.updateSocialPost(id, { status: "reverted", revertedAt: new Date() } as any);
    },
    listDueHeld: async (now) => (await listDueHeldPosts(now)).map(toHoldableRow),
  };
}
