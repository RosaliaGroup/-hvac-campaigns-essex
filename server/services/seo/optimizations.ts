/**
 * AI SEO Optimization service (PR #23) — DB layer + orchestration.
 *
 * Generates AI drafts via the swappable AiOptimizationProvider and stores them
 * in `seoAiDrafts` (one editable record per page). DRAFTS ONLY — nothing here
 * publishes to the live site. The Search Console sync is never touched: this
 * service only reads `seoPages` and writes `seoAiDrafts` (+ the operational
 * `seoPages.status` workflow column, which the sync already leaves alone).
 */
import { eq, inArray } from "drizzle-orm";
import {
  ACTION_DRAFT_FIELDS,
  computeBusinessImpact,
  computeOpportunityScore,
  emptyDraft,
  projectClicksForPage,
  type AiFaqItem,
  type AiInternalLink,
  type AiOptimizationDraft,
  type BusinessImpact,
  type SeoAction,
  type SeoProblem,
  type SeoStatus,
} from "@shared/seo";
import { getDb } from "../../db";
import {
  seoAiDrafts,
  seoPages,
  type InsertSeoAiDraft,
  type SeoAiDraftRow,
  type SeoPageRow,
} from "../../../drizzle/schema";
import { getSeoSiteUrl } from "../../integrations/searchConsole";
import { getAiOptimizationProvider, type PageContext } from "./ai/optimizationProvider";

/* ── Mapping ─────────────────────────────────────────────────────────────── */

function rowToDraft(row: SeoAiDraftRow): AiOptimizationDraft {
  return {
    pageId: row.pageId,
    title: row.generatedTitle ?? null,
    metaDescription: row.generatedMetaDescription ?? null,
    h1: row.generatedH1 ?? null,
    faq: Array.isArray(row.faq) ? (row.faq as AiFaqItem[]) : [],
    internalLinks: Array.isArray(row.internalLinks) ? (row.internalLinks as AiInternalLink[]) : [],
    schema: row.schema && typeof row.schema === "object" ? (row.schema as Record<string, unknown>) : null,
    contentExpansion: row.contentExpansion ?? null,
    model: row.model,
    status: row.status,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function buildContext(page: SeoPageRow): PageContext {
  return {
    page: page.page,
    url: page.url,
    title: page.title ?? "",
    metaDescription: page.metaDescription ?? "",
    h1: page.h1 ?? "",
    category: page.category,
    clicks: page.clicks,
    impressions: page.impressions,
    ctr: Number(page.ctr),
    position: Number(page.position),
    problems: Array.isArray(page.problems) ? (page.problems as SeoProblem[]) : [],
  };
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

/** The stored draft for a page, or an empty draft if none has been generated. */
export async function getDraft(pageId: number): Promise<AiOptimizationDraft> {
  const db = await getDb();
  if (!db) return emptyDraft(pageId);
  const [row] = await db.select().from(seoAiDrafts).where(eq(seoAiDrafts.pageId, pageId)).limit(1);
  return row ? rowToDraft(row) : emptyDraft(pageId);
}

/** The page row (for the drawer's LEFT column), or null. */
export async function getPage(pageId: number): Promise<SeoPageRow | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(seoPages).where(eq(seoPages.id, pageId)).limit(1);
  return row ?? null;
}

/* ── Generation (mock AI → draft) ───────────────────────────────────────── */

/**
 * Run an AI action for a page: generate the fields that action covers, store
 * them on the draft (preserving other sections), and move the page to the
 * "optimizing" workflow status. Returns the refreshed draft, or null if the
 * page/DB is unavailable. request_reindex generates nothing (no draft change).
 */
export async function generateOptimization(
  pageId: number,
  action: SeoAction,
): Promise<AiOptimizationDraft | null> {
  const db = await getDb();
  if (!db) return null;
  const page = await getPage(pageId);
  if (!page) return null;

  const fields = ACTION_DRAFT_FIELDS[action];
  if (fields.length === 0) {
    // e.g. request_reindex — no content generated; caller sets the reindex status.
    return getDraft(pageId);
  }

  const provider = getAiOptimizationProvider();
  const ctx = buildContext(page);
  const gen: Partial<InsertSeoAiDraft> = {};
  for (const f of fields) {
    switch (f) {
      case "title": gen.generatedTitle = await provider.generateTitle(ctx); break;
      case "metaDescription": gen.generatedMetaDescription = await provider.generateMetaDescription(ctx); break;
      case "h1": gen.generatedH1 = await provider.generateH1(ctx); break;
      case "faq": gen.faq = await provider.generateFaq(ctx); break;
      case "internalLinks": gen.internalLinks = await provider.generateInternalLinks(ctx); break;
      case "schema": gen.schema = await provider.generateSchema(ctx); break;
      case "contentExpansion": gen.contentExpansion = await provider.expandContent(ctx); break;
    }
  }

  const patch = { ...gen, model: provider.model, status: "draft" as const };
  await db
    .insert(seoAiDrafts)
    .values({ pageId, siteUrl: page.siteUrl, ...patch })
    .onDuplicateKeyUpdate({ set: patch });

  // Workflow: generating moves the page into "optimizing" (never publishes).
  await db.update(seoPages).set({ status: "optimizing" }).where(eq(seoPages.id, pageId));

  return getDraft(pageId);
}

/* ── Editing (everything remains editable) ──────────────────────────────── */

export type DraftPatch = Partial<{
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  faq: AiFaqItem[];
  internalLinks: AiInternalLink[];
  schema: Record<string, unknown> | null;
  contentExpansion: string | null;
}>;

/** Persist human edits to a draft (marks it "edited"). Never publishes. */
export async function updateDraft(pageId: number, patch: DraftPatch): Promise<AiOptimizationDraft | null> {
  const db = await getDb();
  if (!db) return null;
  const page = await getPage(pageId);
  if (!page) return null;

  const set: Partial<InsertSeoAiDraft> = { status: "edited" };
  if ("title" in patch) set.generatedTitle = patch.title ?? null;
  if ("metaDescription" in patch) set.generatedMetaDescription = patch.metaDescription ?? null;
  if ("h1" in patch) set.generatedH1 = patch.h1 ?? null;
  if ("faq" in patch) set.faq = patch.faq ?? [];
  if ("internalLinks" in patch) set.internalLinks = patch.internalLinks ?? [];
  if ("schema" in patch) set.schema = patch.schema ?? null;
  if ("contentExpansion" in patch) set.contentExpansion = patch.contentExpansion ?? null;

  await db
    .insert(seoAiDrafts)
    .values({ pageId, siteUrl: page.siteUrl, ...set })
    .onDuplicateKeyUpdate({ set });
  return getDraft(pageId);
}

/** Approve a draft for review (draft → approved; page → approved). No publish. */
export async function approveDraft(pageId: number): Promise<AiOptimizationDraft | null> {
  const db = await getDb();
  if (!db) return null;
  const page = await getPage(pageId);
  if (!page) return null;
  await db
    .insert(seoAiDrafts)
    .values({ pageId, siteUrl: page.siteUrl, status: "approved" })
    .onDuplicateKeyUpdate({ set: { status: "approved" } });
  await db.update(seoPages).set({ status: "approved" }).where(eq(seoPages.id, pageId));
  return getDraft(pageId);
}

/**
 * Reject a generated draft: revert its lifecycle status to "draft" (so it can be
 * re-generated or edited) and send the page back to "needs_review". The draft
 * content is preserved for reference — nothing is published or deleted, and the
 * live page is never touched.
 */
export async function rejectDraft(pageId: number): Promise<AiOptimizationDraft | null> {
  const db = await getDb();
  if (!db) return null;
  const page = await getPage(pageId);
  if (!page) return null;
  await db
    .insert(seoAiDrafts)
    .values({ pageId, siteUrl: page.siteUrl, status: "draft" })
    .onDuplicateKeyUpdate({ set: { status: "draft" } });
  await db.update(seoPages).set({ status: "needs_review" }).where(eq(seoPages.id, pageId));
  return getDraft(pageId);
}

/* ── Workflow (Phase 6) ─────────────────────────────────────────────────── */

/** Move one or more pages to a workflow status. Returns affected page ids. */
export async function setWorkflowStatus(ids: number[], status: SeoStatus): Promise<number[]> {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  await db.update(seoPages).set({ status }).where(inArray(seoPages.id, ids));
  return ids;
}

/* ── Business Impact (Phase 4) ──────────────────────────────────────────── */

/** Aggregate current vs. projected CRM funnel across all cached pages. */
export async function getBusinessImpact(): Promise<BusinessImpact> {
  const db = await getDb();
  if (!db) return computeBusinessImpact(0, 0);
  const siteUrl = getSeoSiteUrl();
  const rows = await db.select().from(seoPages).where(eq(seoPages.siteUrl, siteUrl));
  let currentClicks = 0;
  let projectedClicks = 0;
  for (const r of rows) {
    const clicks = r.clicks;
    const impressions = r.impressions;
    const position = Number(r.position);
    const ctr = Number(r.ctr);
    const opportunityScore = computeOpportunityScore({ position, ctr, impressions, clicks, category: r.category });
    currentClicks += clicks;
    projectedClicks += projectClicksForPage({ clicks, impressions, position, ctr, opportunityScore });
  }
  return computeBusinessImpact(currentClicks, projectedClicks);
}
