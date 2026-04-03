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

      // Compact items list: max 50 items, pipe-separated, max 500 chars
      const compactItems = items
        .slice(0, 50)
        .map((i) => `${i.description} x${i.qty} @ $${i.unitPrice}`)
        .join(" | ")
        .slice(0, 500);
      const totalCost = items.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice), 0);

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
          max_tokens: 6000,
          system: `You are an HVAC value engineer. Given this take-off, provide exactly 8 cost-saving suggestions. Mix types: redesign, substitution, scope_reduction, sequencing. Order by estimatedSavings descending.

Return ONLY this JSON with exactly 8 items in the array — no more, no preamble, no explanation:
{"suggestions":[
{"type":"redesign","title":"...","currentSpec":"...","alternativeSpec":"...","estimatedSavings":0,"savingsPercent":0,"tradeOffs":"...","codeCompliant":true,"affectedItems":["..."],"implementationNotes":"..."},
...7 more...
]}`,
          messages: [
            {
              role: "user",
              content: `Project: ${project?.name || "HVAC"}\nLocation: ${project?.location || "NJ"}\n\nTAKE-OFF SUMMARY:\n${compactItems}\n\nTOTAL DIRECT COST: $${totalCost.toFixed(0)}\n\nProvide exactly 8 value engineering suggestions as JSON.`,
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
      console.log("[VE] Response length:", text.length, "Last 100 chars:", text.slice(-100));

      // Check how many type fields exist in response
      const typeFields = text.match(/"type"\s*:\s*"[^"]+"/g);
      console.log("[VE] Type fields found:", typeFields?.length);

      let parsed: any;
      try {
        // Try full JSON parse first
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] };
      } catch {
        console.log("[VE] Full JSON parse failed, trying fallback extraction");
        // Robust fallback: extract individual suggestion objects
        try {
          const suggestions: any[] = [];
          const objRegex = /\{[^{}]*"type"\s*:\s*"[^"]*"[^{}]*"title"\s*:[^{}]*\}/g;
          let match;
          while ((match = objRegex.exec(text)) !== null) {
            try {
              const s = JSON.parse(match[0]);
              if (s.type && s.title) suggestions.push(s);
            } catch {}
          }
          parsed = { suggestions };
          console.log("[VE] Fallback parser extracted", suggestions.length, "suggestions");
        } catch {
          parsed = { suggestions: [] };
          console.log("[VE] JSON parse failed completely, raw text length:", text.length);
        }
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
