/**
 * Commercial Opportunities router — extends the existing opportunity system with
 * the configurable commercial pipeline, master-record detail, checklists,
 * comments, documents, members, and stage transitions.
 *
 * It shares the SAME `opportunities` table, `opportunityEvents` activity log, and
 * `opportunityToJob` converter as the legacy QBO opportunities. Legacy records
 * (recordType='qbo_residential') and their `stage` enum + QBO sync are never
 * touched here — commercial records use `stageId` → `opportunityStages`.
 *
 * Mounted under the `opportunities` namespace (see routers.ts) so it is part of
 * the opportunity system, not a disconnected router.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, gt, lt, like, or, sql } from "drizzle-orm";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import {
  opportunities,
  opportunityEvents,
  opportunityStages,
  opportunityProjectCategories,
  opportunityMembers,
  opportunityChecklistTemplates,
  opportunityChecklistTemplateItems,
  opportunityChecklistItems,
  opportunityComments,
  opportunityDocuments,
  opportunityTasks,
  quickbooksSalesDocuments,
  customers,
  properties,
  appointments,
  teamMembers,
  jobs,
} from "../../drizzle/schema";
import {
  COMMERCIAL_PIPELINE_KEY,
  COMMERCIAL_STAGE_SEEDS,
  DOCUMENT_CATEGORY_KEYS,
  OPPORTUNITY_PRIORITIES,
  PROJECT_CATEGORY_KEYS,
  OPPORTUNITY_TYPE_KEYS,
  isDocumentCategory,
  isProjectCategory,
  isOpportunityType,
  makeOpportunityNumber,
} from "@shared/commercialPipeline";
import {
  marginView,
  planStageTransition,
  TransitionError,
  computeOpportunityUpdate,
  isAssignmentAuthorized,
  type StageLike,
} from "./commercialOpportunitiesLogic";
import { evaluateCommercialConversion } from "./commercialConversion";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const dbUnavailable = () => new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

// ─────────────────────────────────────────────────────────────────────────────
// Identity & permission helpers (admin / member / viewer + assignment-based)
// ─────────────────────────────────────────────────────────────────────────────

/** The current user's teamMembers.id (assignments reference it), or null for OAuth users. */
function currentTeamMemberId(ctx: TrpcContext): number | null {
  const openId = ctx.user?.openId;
  if (typeof openId === "string" && openId.startsWith("team:")) {
    const id = Number(openId.slice(5));
    return Number.isFinite(id) ? id : null;
  }
  return null;
}
const isAdmin = (ctx: TrpcContext) => ctx.user?.role === "admin";

/** Load the assignment/ownership signals used for member-level edit permission. */
async function loadOppPeople(db: Db, oppId: number) {
  const o = (
    await db
      .select({
        id: opportunities.id,
        assignedToId: opportunities.assignedToId,
        estimatorId: opportunities.estimatorId,
        projectManagerId: opportunities.projectManagerId,
        createdBy: opportunities.createdBy,
        recordType: opportunities.recordType,
      })
      .from(opportunities)
      .where(eq(opportunities.id, oppId))
      .limit(1)
  )[0];
  if (!o) return null;
  const members = await db
    .select({ teamMemberId: opportunityMembers.teamMemberId })
    .from(opportunityMembers)
    .where(eq(opportunityMembers.opportunityId, oppId));
  return { ...o, memberIds: members.map(m => m.teamMemberId) };
}

/**
 * Admin → full access. Member → only opportunities they own/estimate/PM/created
 * or are an explicit member of. Viewers never reach mutations (blocked by the
 * protectedProcedure middleware). Throws FORBIDDEN/NOT_FOUND otherwise.
 */
export async function assertCanEdit(db: Db, ctx: TrpcContext, oppId: number) {
  if (isAdmin(ctx)) return;
  const people = await loadOppPeople(db, oppId);
  if (!people) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
  const me = currentTeamMemberId(ctx);
  if (!isAssignmentAuthorized(people, me)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You can only modify opportunities assigned to you." });
  }
}

async function insertEvent(db: Db, opportunityId: number, type: string, message: string, metadata?: Record<string, unknown>) {
  await db.insert(opportunityEvents).values({ opportunityId, type, message, metadata: metadata ?? null });
}

/**
 * Isolation guard: the commercial API only ever reads/writes commercial records.
 * Any other recordType — above all the legacy QBO-synced `qbo_residential` rows
 * with the classic 5-stage `stage` enum — is treated as not found, so a
 * commercial page request can never load, mutate, or transition a legacy record.
 * NOT_FOUND (not FORBIDDEN) is deliberate: it does not leak that the id exists.
 */
function assertCommercial(opp: { recordType: string | null } | undefined): void {
  if (!opp) throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
  if (opp.recordType !== "commercial") throw new TRPCError({ code: "NOT_FOUND", message: "Opportunity not found" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed (idempotent) — the 16 default stages + the Commercial QA checklist
//
// ⚠️ RUNTIME SEEDING (temporary, development-oriented — see
//    reports/commercial-opportunities-seeding.md):
//   • The MIGRATIONS (0042/0043) create the schema only; they do NOT seed rows.
//   • The FIRST relevant commercial request (stages.list / create / checklist)
//     performs an idempotent seed: it inserts the default stages / QA template
//     only if they are absent. Safe to run repeatedly; never duplicates.
//   • PRODUCTION: verify the app's DB user has INSERT permission on
//     opportunityStages / opportunityChecklistTemplates(+Items), or the first
//     request will error. Do NOT seed production manually as part of this phase.
//   • FUTURE: this lazy seed may be replaced by an explicit seed command or a
//     data-migration seeding strategy once the pipeline config stabilizes.
// ─────────────────────────────────────────────────────────────────────────────

const QA_TEMPLATE_NAME = "Commercial Opportunity QA";
/** Stable unique key for the system QA template — makes seeding race-safe. */
const QA_SYSTEM_KEY = "commercial_qa";
/** Items with `required` are gates for Convert-to-Job (configurable thereafter). */
const QA_CHECKLIST_ITEMS: Array<{ label: string; required?: boolean }> = [
  { label: "Members assigned" },
  { label: "Due date verified" },
  { label: "Customer linked", required: true },
  { label: "Contact person linked" },
  { label: "Property/address linked", required: true },
  { label: "Project type selected" },
  { label: "Category selected" },
  { label: "Files linked" },
  { label: "File links verified" },
  { label: "Communication platform entered" },
  { label: "Site visit completed" },
  { label: "Scope entered" },
  { label: "Estimate created", required: true },
  { label: "Internal review completed" },
  { label: "Proposal sent" },
  { label: "Follow-up scheduled" },
];

/** Insert the default commercial stages if the pipeline has none. Idempotent. */
async function ensureStagesSeeded(db: Db) {
  const existing = await db
    .select({ id: opportunityStages.id })
    .from(opportunityStages)
    .where(eq(opportunityStages.pipelineKey, COMMERCIAL_PIPELINE_KEY))
    .limit(1);
  if (existing[0]) return;
  await db.insert(opportunityStages).values(
    COMMERCIAL_STAGE_SEEDS.map(s => ({
      pipelineKey: COMMERCIAL_PIPELINE_KEY,
      stageKey: s.key,
      name: s.name,
      sortOrder: s.order,
      isActive: true,
      defaultProbability: s.defaultProbability,
      classification: s.classification,
      isSystem: true,
    })),
  );
}

/**
 * Insert the Commercial QA checklist template if absent. Returns its id.
 * Idempotent AND concurrency-safe: a plain check-then-insert on the (non-unique)
 * name let two concurrent first-time seeds each insert a duplicate template. We
 * key off the UNIQUE `systemKey` and converge with ON DUPLICATE KEY UPDATE, so
 * the second racer's insert is a no-op that keeps the single existing row. Items
 * are likewise upserted against the UNIQUE (templateId, sortOrder) slot, so a
 * concurrent seed never duplicates the checklist. (Mirrors how stage seeding is
 * protected by unique(pipelineKey, stageKey).)
 */
async function ensureQaTemplateSeeded(db: Db): Promise<number> {
  // Converge to exactly one template row on the unique systemKey.
  await db
    .insert(opportunityChecklistTemplates)
    .values({
      name: QA_TEMPLATE_NAME,
      systemKey: QA_SYSTEM_KEY,
      description: "Standard commercial bid readiness checklist.",
      isSystem: true,
    })
    .onDuplicateKeyUpdate({ set: { systemKey: QA_SYSTEM_KEY } }); // no-op: keeps the existing row
  const templateId = (
    await db
      .select({ id: opportunityChecklistTemplates.id })
      .from(opportunityChecklistTemplates)
      .where(eq(opportunityChecklistTemplates.systemKey, QA_SYSTEM_KEY))
      .limit(1)
  )[0]!.id;
  // Upsert each item into its (templateId, sortOrder) slot — idempotent + race-safe.
  await db
    .insert(opportunityChecklistTemplateItems)
    .values(
      QA_CHECKLIST_ITEMS.map((it, i) => ({
        templateId,
        label: it.label,
        sortOrder: i + 1,
        requiredForConversion: !!it.required,
      })),
    )
    .onDuplicateKeyUpdate({ set: { label: sql`values(\`label\`)`, requiredForConversion: sql`values(\`requiredForConversion\`)` } });
  return templateId;
}

/** Copy a template's items onto an opportunity as fresh (incomplete) instances. */
async function instantiateChecklist(db: Db, oppId: number, templateId: number) {
  const items = await db
    .select()
    .from(opportunityChecklistTemplateItems)
    .where(eq(opportunityChecklistTemplateItems.templateId, templateId))
    .orderBy(asc(opportunityChecklistTemplateItems.sortOrder));
  if (!items.length) return 0;
  await db.insert(opportunityChecklistItems).values(
    items.map(it => ({
      opportunityId: oppId,
      templateItemId: it.id,
      label: it.label,
      sortOrder: it.sortOrder,
      requiredForConversion: it.requiredForConversion,
    })),
  );
  return items.length;
}

async function resolveStage(db: Db, stageId: number | null): Promise<StageLike | null> {
  if (stageId == null) return null;
  const s = (await db.select().from(opportunityStages).where(eq(opportunityStages.id, stageId)).limit(1))[0];
  if (!s) return null;
  return { id: s.id, stageKey: s.stageKey, name: s.name, classification: s.classification, isActive: !!s.isActive };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod input shapes
// ─────────────────────────────────────────────────────────────────────────────

const optionalId = z.number().int().positive().nullable().optional();
const money = z.number().min(0).nullable().optional();
const projectCategory = z.string().refine(isProjectCategory, "Unknown project category");
const documentCategory = z.string().refine(isDocumentCategory, "Unknown document category");
const opportunityTypeSchema = z.string().refine(isOpportunityType, "Unknown opportunity type");

const createInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  customerId: z.number().int().positive(),
  primaryContactId: optionalId,
  propertyId: optionalId,
  opportunityType: opportunityTypeSchema.optional(),
  projectCategories: z.array(projectCategory).max(16).optional(),
  priority: z.enum(OPPORTUNITY_PRIORITIES).optional(),
  source: z.string().max(64).optional(),
  assignedToId: optionalId, // sales owner
  estimatorId: optionalId,
  projectManagerId: optionalId,
  memberIds: z.array(z.number().int().positive()).max(50).optional(),
  estimatedValue: money,
  estimatedCost: money,
  estimatedGrossMargin: money, // explicit override only
  probability: z.number().int().min(0).max(100).nullable().optional(),
  bidDueAt: z.date().nullable().optional(),
  siteVisitAt: z.date().nullable().optional(),
  proposalDueAt: z.date().nullable().optional(),
  proposalSentAt: z.date().nullable().optional(),
  followUpAt: z.date().nullable().optional(),
  expectedCloseAt: z.date().nullable().optional(),
  communicationPlatform: z.string().max(64).nullable().optional(),
  externalReference: z.string().max(128).nullable().optional(),
  /** Which checklist template to instantiate; defaults to the seeded Commercial QA. */
  checklistTemplateId: z.number().int().positive().optional(),
});

const listInput = z
  .object({
    // Server-pinned: the commercial list can ONLY ever query commercial records.
    // A literal (not a free string) means a crafted request cannot ask for
    // qbo_residential/other rows; the query below also hardcodes the filter.
    recordType: z.literal("commercial").default("commercial"),
    search: z.string().max(255).optional(),
    stageId: z.array(z.number().int().positive()).optional(),
    opportunityType: z.array(opportunityTypeSchema).optional(),
    projectCategories: z.array(projectCategory).optional(),
    priority: z.array(z.enum(OPPORTUNITY_PRIORITIES)).optional(),
    assignedToId: z.array(z.number().int()).optional(),
    estimatorId: z.array(z.number().int()).optional(),
    projectManagerId: z.array(z.number().int()).optional(),
    memberId: z.number().int().optional(),
    customerId: z.number().int().positive().optional(),
    propertyId: z.number().int().positive().optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(10).optional(),
    wonLostOpen: z.array(z.enum(["open", "won", "lost"])).optional(),
    overdue: z.boolean().optional(),
    bidDueBefore: z.date().optional(),
    followUpDue: z.boolean().optional(),
    valueMin: z.number().optional(),
    valueMax: z.number().optional(),
    /** "My Opportunities": restrict to those assigned to / owned by the current user. */
    mine: z.boolean().optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "title", "amount", "probability", "bidDueAt", "followUpAt", "expectedCloseAt", "priority"])
      .default("createdAt"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .default({ recordType: "commercial", sortBy: "createdAt", sortDir: "desc", limit: 50, offset: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// Stage administration sub-router (admin only for mutations)
// ─────────────────────────────────────────────────────────────────────────────

const stagesRouter = router({
  /** Active stages for the commercial pipeline, ordered by sortOrder. */
  list: protectedProcedure
    .input(z.object({ pipelineKey: z.string().default(COMMERCIAL_PIPELINE_KEY), includeInactive: z.boolean().default(false) }).default({ pipelineKey: COMMERCIAL_PIPELINE_KEY, includeInactive: false }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await ensureStagesSeeded(db);
      const cond = input.includeInactive
        ? eq(opportunityStages.pipelineKey, input.pipelineKey)
        : and(eq(opportunityStages.pipelineKey, input.pipelineKey), eq(opportunityStages.isActive, true));
      return db.select().from(opportunityStages).where(cond).orderBy(asc(opportunityStages.sortOrder));
    }),

  create: adminProcedure
    .input(
      z.object({
        pipelineKey: z.string().max(48).default(COMMERCIAL_PIPELINE_KEY),
        stageKey: z.string().min(1).max(48).regex(/^[a-z0-9_]+$/, "Use lowercase snake_case keys"),
        name: z.string().min(1).max(80),
        sortOrder: z.number().int().min(0).default(0),
        defaultProbability: z.number().int().min(0).max(100).nullable().optional(),
        classification: z.enum(["open", "won", "lost"]).default("open"),
        color: z.string().max(24).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const dup = (
        await db
          .select({ id: opportunityStages.id })
          .from(opportunityStages)
          .where(and(eq(opportunityStages.pipelineKey, input.pipelineKey), eq(opportunityStages.stageKey, input.stageKey)))
          .limit(1)
      )[0];
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "A stage with that key already exists in this pipeline." });
      const res = await db.insert(opportunityStages).values({
        pipelineKey: input.pipelineKey,
        stageKey: input.stageKey,
        name: input.name,
        sortOrder: input.sortOrder,
        defaultProbability: input.defaultProbability ?? null,
        classification: input.classification,
        color: input.color ?? null,
        isSystem: false,
      });
      return { ok: true, id: Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  /** Update label/probability/classification/color. The stable stageKey is immutable once created. */
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(80).optional(),
        defaultProbability: z.number().int().min(0).max(100).nullable().optional(),
        classification: z.enum(["open", "won", "lost"]).optional(),
        color: z.string().max(24).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const set: Record<string, unknown> = {};
      if (input.name !== undefined) set.name = input.name;
      if (input.defaultProbability !== undefined) set.defaultProbability = input.defaultProbability;
      if (input.classification !== undefined) set.classification = input.classification;
      if (input.color !== undefined) set.color = input.color;
      if (!Object.keys(set).length) return { ok: true };
      await db.update(opportunityStages).set(set).where(eq(opportunityStages.id, input.id));
      return { ok: true };
    }),

  /** Reorder stages by supplying the new ordered list of stage ids. */
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number().int().positive()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      let order = 1;
      for (const id of input.orderedIds) {
        await db.update(opportunityStages).set({ sortOrder: order++ }).where(eq(opportunityStages.id, id));
      }
      return { ok: true };
    }),

  setActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await db.update(opportunityStages).set({ isActive: input.isActive }).where(eq(opportunityStages.id, input.id));
      return { ok: true };
    }),

  /**
   * Delete a stage. Refused if it is a seeded/system stage or if any opportunity
   * still references it — deactivate instead (non-destructive).
   */
  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const stage = (await db.select().from(opportunityStages).where(eq(opportunityStages.id, input.id)).limit(1))[0];
    if (!stage) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
    if (stage.isSystem) throw new TRPCError({ code: "FORBIDDEN", message: "Seeded stages cannot be deleted; deactivate them instead." });
    const inUse = (
      await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.stageId, input.id)).limit(1)
    )[0];
    if (inUse) throw new TRPCError({ code: "CONFLICT", message: "Stage is in use by opportunities; deactivate it instead." });
    await db.delete(opportunityStages).where(eq(opportunityStages.id, input.id));
    return { ok: true };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Checklist sub-router
// ─────────────────────────────────────────────────────────────────────────────

const checklistRouter = router({
  templates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await ensureQaTemplateSeeded(db);
    return db.select().from(opportunityChecklistTemplates).where(eq(opportunityChecklistTemplates.isActive, true));
  }),

  createTemplate: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(1000).optional(),
        items: z.array(z.object({ label: z.string().min(1).max(255), requiredForConversion: z.boolean().default(false) })).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const res = await db.insert(opportunityChecklistTemplates).values({ name: input.name, description: input.description ?? null });
      const templateId = Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      await db.insert(opportunityChecklistTemplateItems).values(
        input.items.map((it, i) => ({ templateId, label: it.label, sortOrder: i + 1, requiredForConversion: it.requiredForConversion })),
      );
      return { ok: true, templateId };
    }),

  /** Instantiate a template onto an opportunity (adds its items). */
  instantiate: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive(), templateId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.opportunityId);
      const count = await instantiateChecklist(db, input.opportunityId, input.templateId);
      await insertEvent(db, input.opportunityId, "checklist_added", `Added ${count} checklist item(s) from template.`, { templateId: input.templateId });
      return { ok: true, count };
    }),

  addItem: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive(), label: z.string().min(1).max(255), requiredForConversion: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.opportunityId);
      const res = await db.insert(opportunityChecklistItems).values({
        opportunityId: input.opportunityId,
        label: input.label,
        requiredForConversion: input.requiredForConversion,
      });
      return { ok: true, id: Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0) };
    }),

  /** Toggle complete/incomplete, recording completedAt + completedBy. */
  setComplete: protectedProcedure
    .input(z.object({ itemId: z.number().int().positive(), isComplete: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const item = (await db.select().from(opportunityChecklistItems).where(eq(opportunityChecklistItems.id, input.itemId)).limit(1))[0];
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Checklist item not found" });
      await assertCanEdit(db, ctx, item.opportunityId);
      if (!!item.isComplete === input.isComplete) return { ok: true }; // no-op
      const me = currentTeamMemberId(ctx);
      await db
        .update(opportunityChecklistItems)
        .set({
          isComplete: input.isComplete,
          completedAt: input.isComplete ? new Date() : null,
          completedById: input.isComplete ? me : null,
        })
        .where(eq(opportunityChecklistItems.id, input.itemId));
      await insertEvent(
        db,
        item.opportunityId,
        "checklist_item_completed",
        `Checklist: ${item.label} ${input.isComplete ? "completed" : "reopened"}.`,
        { itemId: item.id, isComplete: input.isComplete },
      );
      return { ok: true };
    }),

  /** Update assignee / due date / notes / required flag on an item. */
  updateItem: protectedProcedure
    .input(
      z.object({
        itemId: z.number().int().positive(),
        assigneeId: optionalId,
        dueAt: z.date().nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        requiredForConversion: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const item = (await db.select().from(opportunityChecklistItems).where(eq(opportunityChecklistItems.id, input.itemId)).limit(1))[0];
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Checklist item not found" });
      await assertCanEdit(db, ctx, item.opportunityId);
      const set: Record<string, unknown> = {};
      if (input.assigneeId !== undefined) set.assigneeId = input.assigneeId;
      if (input.dueAt !== undefined) set.dueAt = input.dueAt;
      if (input.notes !== undefined) set.notes = input.notes;
      if (input.requiredForConversion !== undefined) set.requiredForConversion = input.requiredForConversion;
      if (!Object.keys(set).length) return { ok: true };
      await db.update(opportunityChecklistItems).set(set).where(eq(opportunityChecklistItems.id, input.itemId));
      return { ok: true };
    }),

  removeItem: protectedProcedure.input(z.object({ itemId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const item = (await db.select().from(opportunityChecklistItems).where(eq(opportunityChecklistItems.id, input.itemId)).limit(1))[0];
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Checklist item not found" });
    await assertCanEdit(db, ctx, item.opportunityId);
    await db.delete(opportunityChecklistItems).where(eq(opportunityChecklistItems.id, input.itemId));
    return { ok: true };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Comments sub-router (edit/delete by author or admin)
// ─────────────────────────────────────────────────────────────────────────────

const commentsRouter = router({
  create: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.opportunityId);
      const authorId = currentTeamMemberId(ctx);
      const res = await db.insert(opportunityComments).values({ opportunityId: input.opportunityId, authorId, body: input.body });
      const id = Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      await insertEvent(db, input.opportunityId, "comment_added", "Comment added.", { commentId: id });
      return { ok: true, id };
    }),

  edit: protectedProcedure
    .input(z.object({ commentId: z.number().int().positive(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const c = (await db.select().from(opportunityComments).where(eq(opportunityComments.id, input.commentId)).limit(1))[0];
      if (!c || c.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      const me = currentTeamMemberId(ctx);
      if (!isAdmin(ctx) && c.authorId !== me) throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own comments." });
      await db.update(opportunityComments).set({ body: input.body, editedAt: new Date() }).where(eq(opportunityComments.id, input.commentId));
      await insertEvent(db, c.opportunityId, "comment_edited", "Comment edited.", { commentId: c.id });
      return { ok: true };
    }),

  remove: protectedProcedure.input(z.object({ commentId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const c = (await db.select().from(opportunityComments).where(eq(opportunityComments.id, input.commentId)).limit(1))[0];
    if (!c || c.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
    const me = currentTeamMemberId(ctx);
    if (!isAdmin(ctx) && c.authorId !== me) throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own comments." });
    await db.update(opportunityComments).set({ deletedAt: new Date() }).where(eq(opportunityComments.id, input.commentId));
    await insertEvent(db, c.opportunityId, "comment_deleted", "Comment deleted.", { commentId: c.id });
    return { ok: true };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Documents sub-router (metadata / external links only)
// ─────────────────────────────────────────────────────────────────────────────

const urlSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(u => /^https?:\/\//i.test(u) || u.startsWith("/"), "Must be an http(s) URL or an internal path");

const documentsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        opportunityId: z.number().int().positive(),
        category: documentCategory,
        kind: z.enum(["file", "link"]).default("file"),
        url: urlSchema,
        fileName: z.string().max(255).nullable().optional(),
        mimeType: z.string().max(128).nullable().optional(),
        sizeBytes: z.number().int().min(0).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.opportunityId);
      const res = await db.insert(opportunityDocuments).values({
        opportunityId: input.opportunityId,
        category: input.category as never,
        kind: input.kind,
        url: input.url,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        uploadedById: currentTeamMemberId(ctx),
        notes: input.notes ?? null,
      });
      const id = Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
      await insertEvent(db, input.opportunityId, "document_linked", `Document linked (${input.category}).`, { documentId: id });
      return { ok: true, id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        documentId: z.number().int().positive(),
        category: documentCategory.optional(),
        fileName: z.string().max(255).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const doc = (await db.select().from(opportunityDocuments).where(eq(opportunityDocuments.id, input.documentId)).limit(1))[0];
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      await assertCanEdit(db, ctx, doc.opportunityId);
      const set: Record<string, unknown> = {};
      if (input.category !== undefined) set.category = input.category;
      if (input.fileName !== undefined) set.fileName = input.fileName;
      if (input.notes !== undefined) set.notes = input.notes;
      if (!Object.keys(set).length) return { ok: true };
      await db.update(opportunityDocuments).set(set).where(eq(opportunityDocuments.id, input.documentId));
      return { ok: true };
    }),

  remove: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const doc = (await db.select().from(opportunityDocuments).where(eq(opportunityDocuments.id, input.documentId)).limit(1))[0];
    if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
    await assertCanEdit(db, ctx, doc.opportunityId);
    await db.delete(opportunityDocuments).where(eq(opportunityDocuments.id, input.documentId));
    await insertEvent(db, doc.opportunityId, "document_removed", "Document removed.", { documentId: doc.id });
    return { ok: true };
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Members sub-router (additional members; owner/estimator/PM stay separate)
// ─────────────────────────────────────────────────────────────────────────────

const membersRouter = router({
  add: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive(), teamMemberId: z.number().int().positive(), role: z.string().max(48).default("member") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.opportunityId);
      const dup = (
        await db
          .select({ id: opportunityMembers.id })
          .from(opportunityMembers)
          .where(and(eq(opportunityMembers.opportunityId, input.opportunityId), eq(opportunityMembers.teamMemberId, input.teamMemberId), eq(opportunityMembers.role, input.role)))
          .limit(1)
      )[0];
      if (dup) throw new TRPCError({ code: "CONFLICT", message: "That member is already on this opportunity." });
      await db.insert(opportunityMembers).values({ opportunityId: input.opportunityId, teamMemberId: input.teamMemberId, role: input.role });
      await insertEvent(db, input.opportunityId, "member_added", "Team member added.", { teamMemberId: input.teamMemberId, role: input.role });
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ opportunityId: z.number().int().positive(), teamMemberId: z.number().int().positive(), role: z.string().max(48).optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.opportunityId);
      const cond = input.role
        ? and(eq(opportunityMembers.opportunityId, input.opportunityId), eq(opportunityMembers.teamMemberId, input.teamMemberId), eq(opportunityMembers.role, input.role))
        : and(eq(opportunityMembers.opportunityId, input.opportunityId), eq(opportunityMembers.teamMemberId, input.teamMemberId));
      await db.delete(opportunityMembers).where(cond);
      await insertEvent(db, input.opportunityId, "member_removed", "Team member removed.", { teamMemberId: input.teamMemberId });
      return { ok: true };
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Root commercial router
// ─────────────────────────────────────────────────────────────────────────────

export const commercialOpportunitiesRouter = router({
  stages: stagesRouter,
  checklist: checklistRouter,
  comments: commentsRouter,
  documents: documentsRouter,
  members: membersRouter,

  /** Create a commercial opportunity. Never creates a customer or property. */
  create: protectedProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();

    // Reuse existing records only — validate, never create.
    const customer = (await db.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1))[0];
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
    if (input.propertyId != null) {
      const prop = (await db.select({ id: properties.id, customerId: properties.customerId }).from(properties).where(eq(properties.id, input.propertyId)).limit(1))[0];
      if (!prop || prop.customerId !== input.customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Property does not belong to this customer" });
    }

    await ensureStagesSeeded(db);
    const firstStage = (
      await db
        .select()
        .from(opportunityStages)
        .where(and(eq(opportunityStages.pipelineKey, COMMERCIAL_PIPELINE_KEY), eq(opportunityStages.isActive, true)))
        .orderBy(asc(opportunityStages.sortOrder))
        .limit(1)
    )[0];

    const me = currentTeamMemberId(ctx);
    const res = await db.insert(opportunities).values({
      customerId: input.customerId,
      title: input.title,
      description: input.description ?? null,
      recordType: "commercial",
      stageId: firstStage?.id ?? null,
      status: "open",
      opportunityType: (input.opportunityType as never) ?? null,
      priority: (input.priority as never) ?? null,
      source: input.source ?? "manual",
      primaryContactId: input.primaryContactId ?? null,
      propertyId: input.propertyId ?? null,
      assignedToId: input.assignedToId ?? null,
      estimatorId: input.estimatorId ?? null,
      projectManagerId: input.projectManagerId ?? null,
      amount: input.estimatedValue != null ? input.estimatedValue.toFixed(2) : null, // NULL = not yet estimated (never coerced to 0)
      estimatedCost: input.estimatedCost != null ? input.estimatedCost.toFixed(2) : null,
      estimatedGrossMargin: input.estimatedGrossMargin != null ? input.estimatedGrossMargin.toFixed(2) : null,
      probability: input.probability ?? firstStage?.defaultProbability ?? null,
      bidDueAt: input.bidDueAt ?? null,
      siteVisitAt: input.siteVisitAt ?? null,
      proposalDueAt: input.proposalDueAt ?? null,
      proposalSentAt: input.proposalSentAt ?? null,
      followUpAt: input.followUpAt ?? null,
      expectedCloseAt: input.expectedCloseAt ?? null,
      communicationPlatform: input.communicationPlatform ?? null,
      externalReference: input.externalReference ?? null,
      createdBy: me,
    });
    const id = Number((res as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    const opportunityNumber = makeOpportunityNumber(id, new Date().getFullYear());
    await db.update(opportunities).set({ opportunityNumber }).where(eq(opportunities.id, id));

    // Categories (multi-select), members, and checklist instantiation.
    if (input.projectCategories?.length) {
      await db.insert(opportunityProjectCategories).values(input.projectCategories.map(category => ({ opportunityId: id, category })));
    }
    if (input.memberIds?.length) {
      const unique = Array.from(new Set(input.memberIds));
      await db.insert(opportunityMembers).values(unique.map(teamMemberId => ({ opportunityId: id, teamMemberId, role: "member" })));
    }
    const templateId = input.checklistTemplateId ?? (await ensureQaTemplateSeeded(db));
    const checklistCount = await instantiateChecklist(db, id, templateId);

    await insertEvent(db, id, "created", `Commercial opportunity ${opportunityNumber} created.`, { opportunityNumber, stageId: firstStage?.id ?? null });
    return { ok: true, id, opportunityNumber, checklistCount };
  }),

  /** Server-side filtered/sorted/paginated commercial opportunity list. */
  list: protectedProcedure.input(listInput).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };

    // Hardcoded to "commercial" (never input-derived) so the commercial list —
    // rows AND the counts/totals below, which reuse this same `where` — can never
    // return legacy qbo_residential opportunities.
    const conds = [eq(opportunities.recordType, "commercial" as never)];
    if (input.stageId?.length) conds.push(inArray(opportunities.stageId, input.stageId));
    if (input.opportunityType?.length) conds.push(inArray(opportunities.opportunityType, input.opportunityType as never[]));
    if (input.priority?.length) conds.push(inArray(opportunities.priority, input.priority as never[]));
    if (input.assignedToId?.length) conds.push(inArray(opportunities.assignedToId, input.assignedToId));
    if (input.estimatorId?.length) conds.push(inArray(opportunities.estimatorId, input.estimatorId));
    if (input.projectManagerId?.length) conds.push(inArray(opportunities.projectManagerId, input.projectManagerId));
    if (input.customerId) conds.push(eq(opportunities.customerId, input.customerId));
    if (input.propertyId) conds.push(eq(opportunities.propertyId, input.propertyId));
    if (input.wonLostOpen?.length) {
      const statuses: string[] = [];
      if (input.wonLostOpen.includes("open")) statuses.push("open", "on_hold");
      if (input.wonLostOpen.includes("won")) statuses.push("awarded");
      if (input.wonLostOpen.includes("lost")) statuses.push("lost", "cancelled");
      conds.push(inArray(opportunities.status, statuses as never[]));
    }
    if (input.valueMin != null) conds.push(sql`${opportunities.amount} >= ${input.valueMin}`);
    if (input.valueMax != null) conds.push(sql`${opportunities.amount} <= ${input.valueMax}`);
    if (input.bidDueBefore) conds.push(sql`${opportunities.bidDueAt} <= ${input.bidDueBefore}`);
    if (input.followUpDue) conds.push(sql`${opportunities.followUpAt} IS NOT NULL AND ${opportunities.followUpAt} <= ${new Date()}`);
    if (input.overdue) {
      conds.push(sql`((${opportunities.bidDueAt} IS NOT NULL AND ${opportunities.bidDueAt} < ${new Date()}) OR (${opportunities.followUpAt} IS NOT NULL AND ${opportunities.followUpAt} < ${new Date()}))`);
    }
    if (input.mine) {
      const me = currentTeamMemberId(ctx);
      if (me == null) return { items: [], total: 0 };
      conds.push(
        or(
          eq(opportunities.assignedToId, me),
          eq(opportunities.estimatorId, me),
          eq(opportunities.projectManagerId, me),
          eq(opportunities.createdBy, me),
          sql`EXISTS (SELECT 1 FROM ${opportunityMembers} m WHERE m.opportunityId = ${opportunities.id} AND m.teamMemberId = ${me})`,
        )!,
      );
    }
    if (input.memberId != null) {
      conds.push(sql`EXISTS (SELECT 1 FROM ${opportunityMembers} m WHERE m.opportunityId = ${opportunities.id} AND m.teamMemberId = ${input.memberId})`);
    }
    if (input.projectCategories?.length) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM ${opportunityProjectCategories} pc WHERE pc.opportunityId = ${opportunities.id} AND pc.category IN (${sql.join(input.projectCategories.map(c => sql`${c}`), sql`, `)}))`,
      );
    }
    if (input.search?.trim()) {
      const q = `%${input.search.trim()}%`;
      conds.push(or(like(opportunities.title, q), like(opportunities.opportunityNumber, q), like(customers.displayName, q), like(customers.companyName, q))!);
    }
    if (input.city) conds.push(eq(properties.city, input.city));
    if (input.state) conds.push(eq(properties.state, input.state));

    const where = and(...conds);
    const orderCol = {
      createdAt: opportunities.createdAt,
      updatedAt: opportunities.updatedAt,
      title: opportunities.title,
      amount: opportunities.amount,
      probability: opportunities.probability,
      bidDueAt: opportunities.bidDueAt,
      followUpAt: opportunities.followUpAt,
      expectedCloseAt: opportunities.expectedCloseAt,
      priority: sql`FIELD(${opportunities.priority}, 'low','normal','high','urgent')`,
    }[input.sortBy];
    const orderBy = input.sortDir === "asc" ? sql`${orderCol} asc` : sql`${orderCol} desc`;

    const rows = await db
      .select({
        id: opportunities.id,
        opportunityNumber: opportunities.opportunityNumber,
        title: opportunities.title,
        stageId: opportunities.stageId,
        status: opportunities.status,
        priority: opportunities.priority,
        opportunityType: opportunities.opportunityType,
        amount: opportunities.amount,
        estimatedCost: opportunities.estimatedCost,
        estimatedGrossMargin: opportunities.estimatedGrossMargin,
        probability: opportunities.probability,
        bidDueAt: opportunities.bidDueAt,
        followUpAt: opportunities.followUpAt,
        expectedCloseAt: opportunities.expectedCloseAt,
        assignedToId: opportunities.assignedToId,
        customerId: opportunities.customerId,
        customerName: customers.displayName,
        customerCompany: customers.companyName,
        propertyId: opportunities.propertyId,
        propertyAddress: properties.addressLine1,
        propertyCity: properties.city,
        propertyState: properties.state,
        estimatorId: opportunities.estimatorId,
        stageKey: opportunityStages.stageKey,
        stageName: opportunityStages.name,
        stageClassification: opportunityStages.classification,
        // Card enrichment (scalar subqueries so one round-trip powers the board).
        ownerName: sql<string | null>`(SELECT name FROM ${teamMembers} WHERE id = ${opportunities.assignedToId})`,
        estimatorName: sql<string | null>`(SELECT name FROM ${teamMembers} WHERE id = ${opportunities.estimatorId})`,
        checklistTotal: sql<number>`(SELECT COUNT(*) FROM ${opportunityChecklistItems} ci WHERE ci.opportunityId = ${opportunities.id})`,
        checklistDone: sql<number>`(SELECT COUNT(*) FROM ${opportunityChecklistItems} ci WHERE ci.opportunityId = ${opportunities.id} AND ci.isComplete = 1)`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM ${opportunityComments} oc WHERE oc.opportunityId = ${opportunities.id} AND oc.deletedAt IS NULL)`,
        documentCount: sql<number>`(SELECT COUNT(*) FROM ${opportunityDocuments} od WHERE od.opportunityId = ${opportunities.id})`,
        categories: sql<string | null>`(SELECT GROUP_CONCAT(pc.category) FROM ${opportunityProjectCategories} pc WHERE pc.opportunityId = ${opportunities.id})`,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .leftJoin(customers, eq(opportunities.customerId, customers.id))
      .leftJoin(properties, eq(opportunities.propertyId, properties.id))
      .leftJoin(opportunityStages, eq(opportunities.stageId, opportunityStages.id))
      .where(where)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset);

    const [agg = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(opportunities)
      .leftJoin(customers, eq(opportunities.customerId, customers.id))
      .leftJoin(properties, eq(opportunities.propertyId, properties.id))
      .where(where);

    const items = rows.map(r => {
      const m = marginView(r.amount as string | null, r.estimatedCost as string | null, r.estimatedGrossMargin as string | null);
      const weighted = m.estimatedValue != null && r.probability != null ? (Number(m.estimatedValue) * Number(r.probability)) / 100 : null;
      const categoriesList = r.categories ? String(r.categories).split(",").filter(Boolean) : [];
      return {
        ...r,
        categoriesList,
        checklistTotal: Number(r.checklistTotal ?? 0),
        checklistDone: Number(r.checklistDone ?? 0),
        commentCount: Number(r.commentCount ?? 0),
        documentCount: Number(r.documentCount ?? 0),
        calculatedMargin: m.calculatedMargin,
        effectiveMargin: m.effectiveMargin,
        marginIsOverridden: m.marginIsOverridden,
        weightedValue: weighted,
      };
    });
    return { items, total: Number(agg.count) };
  }),

  /** Full master-record detail for a commercial opportunity. */
  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw dbUnavailable();
    const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
    assertCommercial(opp); // commercial detail never loads legacy/non-commercial records

    const [stage, customer, primaryContact, property, categories, members, checklist, comments, documents, tasks, appts, salesDocs, linkedJobs, events] =
      await Promise.all([
        opp.stageId ? db.select().from(opportunityStages).where(eq(opportunityStages.id, opp.stageId)).limit(1) : Promise.resolve([]),
        db.select().from(customers).where(eq(customers.id, opp.customerId)).limit(1),
        opp.primaryContactId ? db.select().from(customers).where(eq(customers.id, opp.primaryContactId)).limit(1) : Promise.resolve([]),
        opp.propertyId ? db.select().from(properties).where(eq(properties.id, opp.propertyId)).limit(1) : Promise.resolve([]),
        db.select().from(opportunityProjectCategories).where(eq(opportunityProjectCategories.opportunityId, input.id)),
        db
          .select({ id: opportunityMembers.id, teamMemberId: opportunityMembers.teamMemberId, role: opportunityMembers.role, name: teamMembers.name })
          .from(opportunityMembers)
          .leftJoin(teamMembers, eq(opportunityMembers.teamMemberId, teamMembers.id))
          .where(eq(opportunityMembers.opportunityId, input.id)),
        db.select().from(opportunityChecklistItems).where(eq(opportunityChecklistItems.opportunityId, input.id)).orderBy(asc(opportunityChecklistItems.sortOrder)),
        db
          .select({ id: opportunityComments.id, body: opportunityComments.body, authorId: opportunityComments.authorId, authorName: teamMembers.name, editedAt: opportunityComments.editedAt, createdAt: opportunityComments.createdAt })
          .from(opportunityComments)
          .leftJoin(teamMembers, eq(opportunityComments.authorId, teamMembers.id))
          .where(and(eq(opportunityComments.opportunityId, input.id), sql`${opportunityComments.deletedAt} IS NULL`))
          .orderBy(desc(opportunityComments.createdAt)),
        db.select().from(opportunityDocuments).where(eq(opportunityDocuments.opportunityId, input.id)).orderBy(desc(opportunityDocuments.createdAt)),
        db.select().from(opportunityTasks).where(eq(opportunityTasks.opportunityId, input.id)).orderBy(opportunityTasks.dueAt),
        db.select().from(appointments).where(eq(appointments.customerId, opp.customerId)).orderBy(desc(appointments.scheduledAt)),
        db
          .select({ id: quickbooksSalesDocuments.id, docType: quickbooksSalesDocuments.docType, docNumber: quickbooksSalesDocuments.docNumber, status: quickbooksSalesDocuments.status, totalAmount: quickbooksSalesDocuments.totalAmount, txnDate: quickbooksSalesDocuments.txnDate, sentAt: quickbooksSalesDocuments.sentAt, documentLink: quickbooksSalesDocuments.documentLink })
          .from(quickbooksSalesDocuments)
          .where(eq(quickbooksSalesDocuments.opportunityId, input.id)),
        db.select({ id: jobs.id, jobNumber: jobs.jobNumber, status: jobs.status, title: jobs.title, createdAt: jobs.createdAt }).from(jobs).where(eq(jobs.opportunityId, input.id)).orderBy(jobs.id),
        db.select().from(opportunityEvents).where(eq(opportunityEvents.opportunityId, input.id)).orderBy(desc(opportunityEvents.createdAt)),
      ]);

    const m = marginView(opp.amount, opp.estimatedCost, opp.estimatedGrossMargin);
    const weightedValue = m.estimatedValue != null && opp.probability != null ? ((Number(m.estimatedValue) * opp.probability) / 100).toFixed(2) : null;

    return {
      opportunity: opp,
      stage: stage[0] ?? null,
      customer: customer[0] ?? null,
      primaryContact: primaryContact[0] ?? null,
      property: property[0] ?? null,
      projectCategories: categories.map(c => c.category),
      members,
      checklist,
      comments,
      documents,
      tasks,
      appointments: appts,
      salesDocuments: salesDocs,
      linkedJobs,
      primaryJob: linkedJobs[0] ?? null,
      events,
      financials: {
        estimatedValue: m.estimatedValue,
        estimatedCost: m.estimatedCost,
        calculatedMargin: m.calculatedMargin,
        calculatedMarginPercent: m.calculatedMarginPercent,
        marginOverride: m.marginOverride,
        marginIsOverridden: m.marginIsOverridden,
        effectiveMargin: m.effectiveMargin,
        weightedValue,
      },
    };
  }),

  /** Safe partial update. Only changed fields are written; each logs one event. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().max(5000).nullable().optional(),
        priority: z.enum(OPPORTUNITY_PRIORITIES).nullable().optional(),
        opportunityType: opportunityTypeSchema.nullable().optional(),
        source: z.string().max(64).nullable().optional(),
        customerId: z.number().int().positive().optional(),
        primaryContactId: optionalId,
        propertyId: optionalId,
        assignedToId: optionalId,
        estimatorId: optionalId,
        projectManagerId: optionalId,
        amount: money,
        estimatedCost: money,
        estimatedGrossMargin: money,
        probability: z.number().int().min(0).max(100).nullable().optional(),
        bidDueAt: z.date().nullable().optional(),
        siteVisitAt: z.date().nullable().optional(),
        proposalDueAt: z.date().nullable().optional(),
        proposalSentAt: z.date().nullable().optional(),
        followUpAt: z.date().nullable().optional(),
        expectedCloseAt: z.date().nullable().optional(),
        communicationPlatform: z.string().max(64).nullable().optional(),
        externalReference: z.string().max(128).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.id);
      const existing = (await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
      assertCommercial(existing); // commercial API never mutates legacy/non-commercial records

      // Validate re-parenting references (never create records as a side effect).
      const targetCustomerId = input.customerId ?? existing.customerId;
      if (input.customerId != null && !(await db.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1))[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      if (input.propertyId != null) {
        const prop = (await db.select({ customerId: properties.customerId }).from(properties).where(eq(properties.id, input.propertyId)).limit(1))[0];
        if (!prop || prop.customerId !== targetCustomerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Property does not belong to this customer" });
      }

      const { set, events } = computeOpportunityUpdate(existing as Record<string, unknown>, input as Record<string, unknown>);
      if (!Object.keys(set).length) return { ok: true, changed: 0 };
      await db.update(opportunities).set(set).where(eq(opportunities.id, input.id));
      for (const e of events) await insertEvent(db, input.id, e.type, e.message, e.metadata);
      return { ok: true, changed: events.length };
    }),

  /** Replace an opportunity's project categories (multi-select). */
  setProjectCategories: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), categories: z.array(projectCategory).max(16) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.id);
      const existing = (await db.select({ category: opportunityProjectCategories.category }).from(opportunityProjectCategories).where(eq(opportunityProjectCategories.opportunityId, input.id))).map(r => r.category);
      const next = Array.from(new Set(input.categories));
      const same = existing.length === next.length && existing.every(c => next.includes(c));
      if (same) return { ok: true, changed: false };
      await db.delete(opportunityProjectCategories).where(eq(opportunityProjectCategories.opportunityId, input.id));
      if (next.length) await db.insert(opportunityProjectCategories).values(next.map(category => ({ opportunityId: input.id, category })));
      await insertEvent(db, input.id, "categories_changed", "Project categories updated.", { categories: next });
      return { ok: true, changed: true };
    }),

  /** Server-authoritative commercial stage transition (see planStageTransition). */
  transitionStage: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        toStageId: z.number().int().positive(),
        lostReason: z.string().max(1000).optional(),
        confirmWon: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      await assertCanEdit(db, ctx, input.id);
      const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
      assertCommercial(opp); // stageId pipeline is commercial-only; legacy QBO keeps its classic stage enum
      const to = await resolveStage(db, input.toStageId);
      if (!to) throw new TRPCError({ code: "NOT_FOUND", message: "Target stage not found" });
      const from = await resolveStage(db, opp.stageId);

      let plan;
      try {
        plan = planStageTransition({ from, to, lostReason: input.lostReason, confirmWon: input.confirmWon, now: new Date(), existingAwardedAt: opp.awardedAt });
      } catch (e) {
        if (e instanceof TransitionError) {
          const code = e.code === "STAGE_INACTIVE" ? "BAD_REQUEST" : e.code === "SAME_STAGE" ? "BAD_REQUEST" : "PRECONDITION_FAILED";
          throw new TRPCError({ code, message: e.message });
        }
        throw e;
      }
      await db.update(opportunities).set(plan.set).where(eq(opportunities.id, input.id));
      await insertEvent(db, input.id, plan.event.type, plan.event.message, plan.event.metadata);
      return { ok: true, status: plan.set.status, reopened: plan.reopened };
    }),

  /** Structured Convert-to-Job validation preview (no writes). */
  convertToJobValidate: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), propertyId: z.number().int().positive().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw dbUnavailable();
      const opp = (await db.select().from(opportunities).where(eq(opportunities.id, input.id)).limit(1))[0];
      assertCommercial(opp); // commercial-only, consistent with get/update/transition
      // Same assignment-based authorization as the conversion mutation: an
      // unauthorized user must not reveal conversion-specific validation (or an
      // existing job) for an opportunity they cannot edit.
      await assertCanEdit(db, ctx, input.id);
      const stage = await resolveStage(db, opp.stageId);
      const [customer, propertyCandidates, requiredItems, existing, estimate] = await Promise.all([
        db.select({ id: customers.id }).from(customers).where(eq(customers.id, opp.customerId)).limit(1),
        db.select({ id: properties.id, label: properties.label, addressLine1: properties.addressLine1, city: properties.city, state: properties.state, zip: properties.zip, isPrimary: properties.isPrimary }).from(properties).where(eq(properties.customerId, opp.customerId)),
        db.select({ id: opportunityChecklistItems.id, label: opportunityChecklistItems.label, isComplete: opportunityChecklistItems.isComplete }).from(opportunityChecklistItems).where(and(eq(opportunityChecklistItems.opportunityId, input.id), eq(opportunityChecklistItems.requiredForConversion, true))),
        db.select({ id: jobs.id, jobNumber: jobs.jobNumber, status: jobs.status }).from(jobs).where(eq(jobs.opportunityId, input.id)).orderBy(jobs.id).limit(1),
        db.select({ id: quickbooksSalesDocuments.id }).from(quickbooksSalesDocuments).where(eq(quickbooksSalesDocuments.opportunityId, input.id)).limit(1),
      ]);
      return evaluateCommercialConversion({
        recordType: opp.recordType,
        stageKey: stage?.stageKey ?? null,
        customerId: opp.customerId,
        customerExists: !!customer[0],
        propertyCandidates: propertyCandidates.map(p => ({ ...p, isPrimary: !!p.isPrimary })),
        explicitPropertyId: input.propertyId ?? opp.propertyId ?? null,
        requiredChecklistItems: requiredItems.map(i => ({ id: i.id, label: i.label, isComplete: !!i.isComplete })),
        existingJob: existing[0] ?? null,
        primaryContactId: opp.primaryContactId ?? null,
        linkedEstimateId: estimate[0]?.id ?? null,
      });
    }),
});
