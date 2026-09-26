/**
 * Weekly B2B content pipeline's topic backlog (docs/seo-automation-spec.md
 * Part 2). seedContentQueue() is idempotent (checks by title) — safe to call
 * on every boot. The model may propose new topics (status "proposed") but
 * per spec "cannot self-select them" — nextTopicToProcess() only ever picks
 * up "queued" or "refresh_due" rows, which requires a human to promote a
 * proposed topic first.
 */
import { asc, eq, or } from "drizzle-orm";
import { getDb } from "../../db";
import { seoContentQueue, type SeoContentQueueRow } from "../../../drizzle/schema";
import { logAudit } from "./auditLog";

/** Owner's authority-list topics (spec Part 2). #8 already has an approved package — drafting should reuse it verbatim, not regenerate. */
export const SEED_TOPICS: Array<{ title: string; audience: string; brief: string }> = [
  { title: "Multifamily HVAC Replacement Planning in Occupied Buildings", audience: "multifamily property owners/managers", brief: "How to plan HVAC replacement across occupied units with minimal tenant disruption." },
  { title: "HVAC Capital Budgeting Per Unit for Apartment Owners", audience: "apartment building owners", brief: "Per-unit capital budgeting for HVAC lifecycle replacement." },
  { title: "PTAC vs Mini-Split vs VRF for Multifamily Retrofits", audience: "multifamily property owners/managers", brief: "Comparing the three dominant multifamily HVAC retrofit options." },
  { title: "What GCs Need From an HVAC Subcontractor", audience: "general contractors", brief: "Submittals, coordination, and close-out expectations from a GC's perspective." },
  { title: "HVAC Service Contracts for Property Managers: Scope and Pricing Models", audience: "property managers", brief: "How HVAC service contract scope and pricing typically works for commercial/multifamily." },
  { title: "HVAC in NJ Affordable-Housing Renovation (NJHMFA/DCA-Funded Projects)", audience: "affordable housing developers/owners", brief: "HVAC considerations specific to NJHMFA/DCA-funded renovation projects." },
  { title: "Commercial HVAC Lifecycle: When to Repair, When to Replace", audience: "commercial building owners/facility managers", brief: "Decision framework for repair-vs-replace on aging commercial HVAC equipment." },
  { title: "PTAC Replacement for Condo Associations", audience: "condo associations/HOA boards", brief: "Already drafted — use the approved PTAC package verbatim (do not regenerate)." },
  { title: "Mini-Split/VRF Considerations for Mixed-Use Buildings", audience: "mixed-use building owners/developers", brief: "HVAC zoning and system-selection considerations specific to mixed-use (retail+residential) buildings." },
  { title: "Preventive Maintenance Checklist for Building Owners", audience: "commercial/multifamily building owners", brief: "A practical preventive-maintenance checklist for building-owner HVAC oversight." },
];

/** Idempotent: only inserts topics whose title isn't already in the queue. Safe to call on every boot. */
export async function seedContentQueue(): Promise<{ inserted: number }> {
  const db = await getDb();
  if (!db) return { inserted: 0 };
  const existing = await db.select().from(seoContentQueue);
  const existingTitles = new Set(existing.map((r) => r.title));
  let inserted = 0;
  for (const topic of SEED_TOPICS) {
    if (existingTitles.has(topic.title)) continue;
    await db.insert(seoContentQueue).values({ ...topic, status: "queued", source: "seed" });
    inserted++;
  }
  return { inserted };
}

export async function listContentQueue(): Promise<SeoContentQueueRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(seoContentQueue).orderBy(asc(seoContentQueue.createdAt));
}

/** Model-proposed topic — status "proposed", requires a human to promote it to "queued" before the job will draft it. */
export async function proposeTopic(input: { title: string; audience?: string | null; targetQuery?: string | null; brief?: string | null }): Promise<SeoContentQueueRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  await db.insert(seoContentQueue).values({ ...input, status: "proposed", source: "proposed" });
  const [row] = await db.select().from(seoContentQueue).where(eq(seoContentQueue.title, input.title)).limit(1);
  await logAudit({ actorId: null, action: "topic_proposed", batchId: null, pagePath: null, before: null, after: { title: input.title }, lintResult: null });
  return row;
}

export async function updateQueueStatus(id: number, status: SeoContentQueueRow["status"], contentBatchId?: number | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(seoContentQueue).set({ status, ...(contentBatchId !== undefined ? { contentBatchId } : {}) }).where(eq(seoContentQueue.id, id));
}

/** The next topic the weekly job should draft — "queued" or "refresh_due" ONLY (never "proposed" — the model cannot self-select). Oldest first. */
export async function nextTopicToProcess(): Promise<SeoContentQueueRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(seoContentQueue)
    .where(or(eq(seoContentQueue.status, "queued"), eq(seoContentQueue.status, "refresh_due")))
    .orderBy(asc(seoContentQueue.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
