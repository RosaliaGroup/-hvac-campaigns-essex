/**
 * Growth-system tRPC surface (docs/growth-system-spec.md): §7 CSV import admin +
 * §10 scoreboard. Speed-to-lead (§1), the cadence engine (§2), and the review
 * engine (§5) are background services (server/services/growth/*) with no direct
 * end-user procedures beyond what's exposed here for visibility/control.
 */
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contactImportBatches, importedContacts, growthCadences } from "../../drizzle/schema";
import { parseImportCsv, validateHeaders, importContactsCsv, removeImportedContact, rollbackImportBatch, releaseImportBatch } from "../services/growth/contactImport";
import { buildScoreboard } from "../services/growth/scoreboard";

import { prospectWorkflowRouter } from "./prospectWorkflow";

export const growthRouter = router({
  prospecting: prospectWorkflowRouter,
  scoreboard: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    return buildScoreboard(db);
  }),

  cadences: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(growthCadences).orderBy(desc(growthCadences.createdAt)).limit(input?.limit ?? 50);
      }),
  }),

  contactImport: router({
    /** Upload + parse a CSV, insert a pending_review batch (§7's 24h owner review window). */
    upload: adminProcedure
      .input(z.object({ filename: z.string().min(1).max(255), csv: z.string().min(1).max(5_000_000) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { headers, rows } = parseImportCsv(input.csv);
        const missing = validateHeaders(headers);
        if (missing.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `CSV is missing required column(s): ${missing.join(", ")}` });
        }
        const importedById = typeof ctx.user?.id === "number" ? ctx.user.id : null;
        return importContactsCsv(db, { filename: input.filename, rows, importedById });
      }),

    listBatches: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(contactImportBatches).orderBy(desc(contactImportBatches.createdAt)).limit(100);
    }),

    listRows: protectedProcedure
      .input(z.object({ batchId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(importedContacts).where(eq(importedContacts.batchId, input.batchId));
      }),

    /** Owner removes one row during the 24h review window. */
    removeRow: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await removeImportedContact(db, input.id);
        return { success: true };
      }),

    /** Manual early release (normally the 24h sweep does this automatically). */
    releaseNow: adminProcedure
      .input(z.object({ batchId: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        return releaseImportBatch(db, input.batchId);
      }),

    /** Roll back a bad import batch wholesale (spec §7: "a bad import can be rolled back as a batch"). */
    rollback: adminProcedure
      .input(z.object({ batchId: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        return rollbackImportBatch(db, input.batchId);
      }),
  }),
});
