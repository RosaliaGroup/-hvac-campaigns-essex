/**
 * Durable review-only outreach drafts. No delivery mechanism is exposed here.
 * Status transitions must be performed by an authenticated admin API.
 */
import { and, eq, sql } from "drizzle-orm";
import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { getDb } from "../db";
import type { ReviewCandidate } from "./crmOutreachReviewQueue";

export const crmOutreachReviewDrafts = mysqlTable("crmOutreachReviewDrafts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  company: varchar("company", { length: 255 }).notNull(),
  decisionMaker: varchar("decisionMaker", { length: 255 }).notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  draftSubject: varchar("draftSubject", { length: 255 }).notNull(),
  draftBody: text("draftBody").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("needs_human_approval"),
  verifiedAt: timestamp("verifiedAt").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

async function database() {
  const db = await getDb();
  if (!db) throw new Error("CRM database unavailable");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crmOutreachReviewDrafts (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(320) NOT NULL UNIQUE,
      company VARCHAR(255) NOT NULL,
      decisionMaker VARCHAR(255) NOT NULL,
      sourceUrl TEXT NOT NULL,
      draftSubject VARCHAR(255) NOT NULL,
      draftBody TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'needs_human_approval',
      verifiedAt TIMESTAMP NOT NULL,
      reviewedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

/** Caller must first run checkOutreachReviewCandidate and verify eligibility.
 * A duplicate never resets a previously rejected draft or approval state.
 */
export async function queueReviewedCandidate(candidate: ReviewCandidate) {
  const db = await database();
  const email = candidate.email.trim().toLowerCase();
  await db.insert(crmOutreachReviewDrafts).values({
    email, company: candidate.company, decisionMaker: candidate.decisionMaker,
    sourceUrl: candidate.sourceUrl, draftSubject: candidate.draftSubject,
    draftBody: candidate.draftBody, verifiedAt: candidate.verifiedAt,
  }).onDuplicateKeyUpdate({ set: { email } });
  const [row] = await db.select().from(crmOutreachReviewDrafts)
    .where(eq(crmOutreachReviewDrafts.email, email)).limit(1);
  if (!row) throw new Error("Review queue write verification failed");
  return row;
}

export async function listReviewDrafts() {
  const db = await database();
  return db.select().from(crmOutreachReviewDrafts);
}

/** Review decisions never trigger a send. Rejecting a draft is final. */
export async function decideReviewDraft(id: number, decision: "approved" | "rejected") {
  const db = await database();
  const [before] = await db.select().from(crmOutreachReviewDrafts)
    .where(eq(crmOutreachReviewDrafts.id, id)).limit(1);
  if (!before) throw new Error("Review draft not found");
  if (before.status !== "needs_human_approval")
    throw new Error("Draft has already been reviewed");
  const result = await db.update(crmOutreachReviewDrafts)
    .set({ status: decision, reviewedAt: new Date() })
    .where(and(eq(crmOutreachReviewDrafts.id, id), eq(crmOutreachReviewDrafts.status, "needs_human_approval")));
  if (Number((result as any)?.[0]?.affectedRows ?? 0) !== 1)
    throw new Error("Draft was reviewed concurrently; refresh the queue");
  const [after] = await db.select().from(crmOutreachReviewDrafts)
    .where(eq(crmOutreachReviewDrafts.id, id)).limit(1);
  if (!after || after.status !== decision) throw new Error("Review decision verification failed");
  return after;
}
