/**
 * CRM-native prospect review queue policy.
 * This module does not send messages, schedule sends, or bypass any paused automation.
 * The queue is for human review and explicit approval only.
 */
import { isOutreachSuppressed } from "./outreachSuppression";
import { getDb } from "../db";

export type ReviewCandidate = {
  email: string;
  company: string;
  decisionMaker: string;
  sourceUrl: string;
  draftSubject: string;
  draftBody: string;
  verifiedAt: Date;
};
export type ReviewDecision =
  | { eligible: true; normalizedEmail: string; state: "needs_human_approval" }
  | { eligible: false; normalizedEmail: string; reason: string };

const normalize = (email: string) => email.trim().toLowerCase();

export async function checkOutreachReviewCandidate(
  candidate: ReviewCandidate,
  wasPreviouslyContacted: (email: string) => Promise<boolean>,
  isUnsubscribed: (email: string) => Promise<boolean>,
): Promise<ReviewDecision> {
  const email = normalize(candidate.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { eligible: false, normalizedEmail: email, reason: "invalid_email" };
  if (!candidate.company.trim() || !candidate.decisionMaker.trim() || !candidate.sourceUrl.startsWith("https://"))
    return { eligible: false, normalizedEmail: email, reason: "unverified_contact" };
  if (!candidate.draftSubject.trim() || !candidate.draftBody.trim())
    return { eligible: false, normalizedEmail: email, reason: "missing_draft" };
  const db = await getDb();
  if (!db) return { eligible: false, normalizedEmail: email, reason: "database_unavailable" };
  if (await isOutreachSuppressed(db, email))
    return { eligible: false, normalizedEmail: email, reason: "suppressed" };
  if (await isUnsubscribed(email))
    return { eligible: false, normalizedEmail: email, reason: "unsubscribed" };
  if (await wasPreviouslyContacted(email))
    return { eligible: false, normalizedEmail: email, reason: "previously_contacted" };
  return { eligible: true, normalizedEmail: email, state: "needs_human_approval" };
}
