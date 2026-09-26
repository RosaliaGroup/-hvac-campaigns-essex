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
/**
 * docs/positioning-warranty-spec.md §5 — the 5 installation/warranty topics
 * are listed first, in the spec's given order; all pre-existing B2B topics
 * (including the PTAC package) are kept as-is below them. No residential/
 * rebate topic was queued before this change, so "remove any queued
 * residential/rebate topics" is a no-op here.
 *
 * Audience strings deliberately avoid "residential"/"rebate(s)"/"homeowner(s)"
 * — isResidentialOrRebateTopic() in shared/contentLinter.ts checks title,
 * targetQuery AND audience, and these topics are meant to run through this
 * same B2B-gated pipeline, not be refused by it.
 */
export const SEED_TOPICS: Array<{ title: string; audience: string; brief: string }> = [
  { title: "What a 10-Year HVAC Warranty Should Actually Cover", audience: "property owners evaluating extended HVAC coverage", brief: "Breaks down parts vs. labor vs. manufacturer's warranty, and what 'covered' really means in a 10-year parts & labor agreement." },
  { title: "Extended Coverage for an Older HVAC System: When It's Worth It", audience: "owners of aging HVAC systems", brief: "What 'eligible' means for extended coverage on an existing system, and when the eligibility inspection is worth scheduling." },
  { title: "How to Compare HVAC Installation Quotes in NJ", audience: "buyers comparing HVAC installation quotes", brief: "What to weigh across competing NJ installation quotes: equipment, labor, warranty terms, and permits." },
  { title: "Heat Pump vs. Furnace Replacement: Total Cost of Ownership Over 10 Years", audience: "property owners comparing HVAC replacement options", brief: "A 10-year total-cost-of-ownership comparison between heat pump and furnace replacement, installation through operation." },
  { title: "Why Compressor Failures Happen in Years 5-8 (and What Protects You)", audience: "HVAC installation customers", brief: "Why compressor failures cluster in years 5-8 of a system's life, and how 10-year parts & labor coverage changes the cost of that failure." },
  // docs/positioning-warranty-spec.md §9b/§9d.
  { title: "What a Heat Pump Installation Costs in Essex County (Real Ranges, and What Changes Them)", audience: "property owners comparing heat pump installation costs", brief: "Real installed-price ranges for Essex County heat pump installs, and the factors (ductwork, electrical, line-set length, permits, equipment tier) that move the price. Only cites figures present in VERIFIED_FACTS.priceRanges." },
  { title: "Fixed Per-Unit HVAC Pricing for Apartment Portfolios: How It Works", audience: "multifamily property owners/managers", brief: "How fixed per-unit portfolio pricing works across PTAC/mini-split/RTU/split systems, quarterly reporting, and one point of contact." },
  { title: "What a 24-Hour HVAC Response SLA Should Actually Include", audience: "commercial property managers", brief: "What a real HVAC response-time SLA should specify — response window, escalation, reporting — without claiming a specific hour figure unless verified." },
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
