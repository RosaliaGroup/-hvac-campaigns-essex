import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import {
  takeoffProjects,
  takeoffItems,
  takeoffFindings,
  takeoffVeSuggestions,
  takeoffFiles,
} from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

const itemSchema = z.object({
  category: z.string(),
  description: z.string().default(""),
  tag: z.string().default(""),
  qty: z.number().default(1),
  unit: z.string().default("EA"),
  vendor: z.string().default(""),
  model: z.string().default(""),
  specs: z.string().default(""),
  source: z.string().default(""),
  confidence: z.number().default(0),
  unitPrice: z.number().default(0),
  notes: z.string().default(""),
});

const findingSchema = z.object({
  type: z.string().default("info"),
  title: z.string().default(""),
  body: z.string().default(""),
  source: z.string().default(""),
});

export const takeoffsRouter = router({
  // List all projects
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const projects = await db
      .select()
      .from(takeoffProjects)
      .orderBy(desc(takeoffProjects.updatedAt));

    // Get item counts and costs for each project
    const result = await Promise.all(
      projects.map(async (p) => {
        const items = await db
          .select()
          .from(takeoffItems)
          .where(eq(takeoffItems.projectId, p.id));
        const directCost = items.reduce(
          (s, i) => s + Number(i.qty) * Number(i.unitPrice),
          0
        );
        return { ...p, itemCount: items.length, directCost };
      })
    );
    return result;
  }),

  // Create new project
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        location: z.string().default(""),
        discipline: z.string().default("HVAC"),
        notes: z.string().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(takeoffProjects).values({
        name: input.name,
        location: input.location,
        discipline: input.discipline,
        notes: input.notes,
        createdBy: ctx.user.email || ctx.user.name || "unknown",
      });
      return { id: result.insertId };
    }),

  // Get project with items + findings + VE suggestions
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [project] = await db
        .select()
        .from(takeoffProjects)
        .where(eq(takeoffProjects.id, input.id));
      if (!project) throw new Error("Project not found");

      const items = await db
        .select()
        .from(takeoffItems)
        .where(eq(takeoffItems.projectId, input.id));

      const findings = await db
        .select()
        .from(takeoffFindings)
        .where(eq(takeoffFindings.projectId, input.id));

      const veSuggestions = await db
        .select()
        .from(takeoffVeSuggestions)
        .where(eq(takeoffVeSuggestions.projectId, input.id));

      const files = await db
        .select()
        .from(takeoffFiles)
        .where(eq(takeoffFiles.projectId, input.id));

      return { project, items, findings, veSuggestions, files };
    }),

  // Update project
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        location: z.string().optional(),
        discipline: z.string().optional(),
        status: z.enum(["draft", "complete"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;
      await db
        .update(takeoffProjects)
        .set(updates)
        .where(eq(takeoffProjects.id, id));
      return { success: true };
    }),

  // Delete project and all related data
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(takeoffItems).where(eq(takeoffItems.projectId, input.id));
      await db.delete(takeoffFindings).where(eq(takeoffFindings.projectId, input.id));
      await db.delete(takeoffVeSuggestions).where(eq(takeoffVeSuggestions.projectId, input.id));
      await db.delete(takeoffFiles).where(eq(takeoffFiles.projectId, input.id));
      await db.delete(takeoffProjects).where(eq(takeoffProjects.id, input.id));
      return { success: true };
    }),

  // Save/replace all items for a project
  saveItems: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        items: z.array(itemSchema),
        findings: z.array(findingSchema).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete existing items
      await db.delete(takeoffItems).where(eq(takeoffItems.projectId, input.projectId));

      // Insert new items
      if (input.items.length > 0) {
        await db.insert(takeoffItems).values(
          input.items.map((item) => ({
            projectId: input.projectId,
            category: item.category,
            description: item.description,
            tag: item.tag,
            qty: String(item.qty),
            unit: item.unit,
            vendor: item.vendor,
            model: item.model,
            specs: item.specs,
            source: item.source,
            confidence: item.confidence,
            unitPrice: String(item.unitPrice),
            notes: item.notes,
          }))
        );
      }

      // Replace findings if provided
      if (input.findings) {
        await db.delete(takeoffFindings).where(eq(takeoffFindings.projectId, input.projectId));
        if (input.findings.length > 0) {
          await db.insert(takeoffFindings).values(
            input.findings.map((f) => ({
              projectId: input.projectId,
              type: f.type,
              title: f.title,
              body: f.body,
              source: f.source,
            }))
          );
        }
      }

      // Update project timestamp
      await db
        .update(takeoffProjects)
        .set({})
        .where(eq(takeoffProjects.id, input.projectId));

      return { success: true };
    }),

  // Run value engineering analysis
  runVE: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if VE suggestions already exist
      const existing = await db
        .select()
        .from(takeoffVeSuggestions)
        .where(eq(takeoffVeSuggestions.projectId, input.projectId));
      if (existing.length > 0) {
        return { suggestions: existing, cached: true };
      }

      // Get project items
      const items = await db
        .select()
        .from(takeoffItems)
        .where(eq(takeoffItems.projectId, input.projectId));

      if (items.length === 0) throw new Error("No items to analyze");

      const [project] = await db
        .select()
        .from(takeoffProjects)
        .where(eq(takeoffProjects.id, input.projectId));

      const itemsSummary = items
        .map(
          (i) =>
            `- ${i.category}: ${i.description} | ${i.tag || "no tag"} | Qty ${i.qty} ${i.unit} | $${i.unitPrice}/ea | Vendor: ${i.vendor || "TBD"} | Model: ${i.model || "TBD"} | Specs: ${i.specs || "N/A"}`
        )
        .join("\n");

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: `You are a mechanical engineering value engineer specializing in HVAC/MEP systems. Given a take-off, identify 8-12 opportunities to reduce cost while maintaining performance and code compliance. For each: specify the exact line item description, current spec, alternative spec, estimated cost savings in dollars, and trade-offs. Respond ONLY with valid JSON: {"suggestions":[{"itemDescription":"...","currentSpec":"...","alternativeSpec":"...","vendor":"...","model":"...","estimatedSavings":<number>,"tradeOffs":"..."}]}`,
          messages: [
            {
              role: "user",
              content: `Project: ${project?.name || "HVAC"}\nLocation: ${project?.location || "NJ"}\nDiscipline: ${project?.discipline || "HVAC"}\n\nTake-off items:\n${itemsSummary}\n\nProvide value engineering suggestions.`,
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic API error: ${err}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let parsed: any;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] };
      } catch {
        parsed = { suggestions: [] };
      }

      const suggestions = parsed.suggestions || [];

      // Save to DB
      if (suggestions.length > 0) {
        await db.insert(takeoffVeSuggestions).values(
          suggestions.map((s: any) => ({
            projectId: input.projectId,
            itemDescription: s.itemDescription || "",
            currentSpec: s.currentSpec || "",
            alternativeSpec: s.alternativeSpec || "",
            vendor: s.vendor || "",
            model: s.model || "",
            estimatedSavings: String(s.estimatedSavings || 0),
            tradeOffs: s.tradeOffs || "",
            status: "pending" as const,
          }))
        );
      }

      // Return saved suggestions
      const saved = await db
        .select()
        .from(takeoffVeSuggestions)
        .where(eq(takeoffVeSuggestions.projectId, input.projectId));

      return { suggestions: saved, cached: false };
    }),

  // Apply or reject a VE suggestion
  updateVE: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["applied", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(takeoffVeSuggestions)
        .set({ status: input.status })
        .where(eq(takeoffVeSuggestions.id, input.id));
      return { success: true };
    }),

  // Clear VE suggestions to allow re-running
  clearVE: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(takeoffVeSuggestions)
        .where(eq(takeoffVeSuggestions.projectId, input.projectId));
      return { success: true };
    }),
});
