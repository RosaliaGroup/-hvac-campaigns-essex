import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
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
            category: item.category || "OTHER",
            description: item.description || "Unknown Item",
            tag: item.tag || "",
            qty: String(Number(item.qty) || 0),
            unit: item.unit || "EA",
            vendor: item.vendor || "",
            model: item.model || "",
            specs: item.specs || "",
            source: item.source || "",
            confidence: item.confidence || 0,
            unitPrice: String(Number(item.unitPrice) || 0),
            notes: item.notes || "",
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
              type: f.type || "info",
              title: f.title || "",
              body: f.body || "",
              source: f.source || "",
            }))
          );
        }
      }

      // Update project timestamp
      await db
        .update(takeoffProjects)
        .set({ updatedAt: new Date() })
        .where(eq(takeoffProjects.id, input.projectId));

      return { success: true };
    }),

  // Run value engineering analysis
  runVE: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const pid = Number(input.projectId);
      console.log("[VE] runVE called with projectId:", input.projectId, "→ pid:", pid, "type:", typeof pid);

      // Check if VE suggestions already exist
      const existing = await db
        .select()
        .from(takeoffVeSuggestions)
        .where(eq(takeoffVeSuggestions.projectId, pid));
      console.log("[VE] Existing suggestions:", existing.length);
      if (existing.length > 0) {
        return { suggestions: existing, cached: true };
      }

      // Get project items
      const items = await db
        .select()
        .from(takeoffItems)
        .where(eq(takeoffItems.projectId, pid));
      console.log("[VE] Found items for project", pid, ":", items?.length ?? 0);

      if (!items || items.length === 0) {
        // Debug: check what projects have items
        const allItems = await db.select({ projectId: takeoffItems.projectId, cnt: sql<number>`count(*)` }).from(takeoffItems).groupBy(takeoffItems.projectId);
        console.log("[VE] Items by project:", JSON.stringify(allItems));
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No items found for project ${pid}. Save items to the take-off before running Value Engineering. (Items exist in projects: ${allItems.map(a => `${a.projectId}(${a.cnt})`).join(', ')})`,
        });
      }

      const [project] = await db
        .select()
        .from(takeoffProjects)
        .where(eq(takeoffProjects.id, pid));

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
          system: `You are a mechanical engineering value engineer specializing in HVAC/MEP systems. Given a take-off, provide 12-18 cost reduction suggestions across these categories:
1. SYSTEM REDESIGN (type: "redesign") — where a different system type would be significantly cheaper while meeting the same performance specs. Examples: switching from VRF to PTACs, downsizing oversized equipment, combining zones, eliminating redundant systems, using a different distribution method.
2. SPEC SUBSTITUTIONS (type: "substitution") — same system, cheaper components (different brand, lower efficiency tier if code still met, standard vs custom sizes).
3. SCOPE REDUCTIONS (type: "scope_reduction") — items that may be over-engineered, redundant, or optional for the base bid (can be listed as alternates).
4. SEQUENCING SAVINGS (type: "sequencing") — items that could be phased or done by owner/GC instead of HVAC sub.

For each suggestion return: {"type":"redesign|substitution|scope_reduction|sequencing","title":"short title","itemDescription":"affected item(s)","currentSpec":"current specification","alternativeSpec":"proposed alternative","vendor":"alt vendor if applicable","model":"alt model if applicable","estimatedSavings":<dollars>,"savingsPercent":<percent of item cost>,"tradeOffs":"description of trade-offs","codeCompliant":true|false,"affectedItems":["item desc 1","item desc 2"],"implementationNotes":"how to implement"}

Order by estimatedSavings descending. Mix all types. Respond ONLY with valid JSON: {"suggestions":[...]}`,
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
            projectId: pid,
            veType: s.type || "substitution",
            itemDescription: s.title || s.itemDescription || "",
            currentSpec: s.currentSpec || "",
            alternativeSpec: s.alternativeSpec || "",
            vendor: s.vendor || "",
            model: s.model || "",
            estimatedSavings: String(s.estimatedSavings || 0),
            savingsPercent: String(s.savingsPercent || 0),
            tradeOffs: s.tradeOffs || "",
            codeCompliant: s.codeCompliant !== false,
            affectedItems: JSON.stringify(s.affectedItems || []),
            implementationNotes: s.implementationNotes || "",
            status: "pending" as const,
          }))
        );
      }

      // Return saved suggestions
      const saved = await db
        .select()
        .from(takeoffVeSuggestions)
        .where(eq(takeoffVeSuggestions.projectId, pid));

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
