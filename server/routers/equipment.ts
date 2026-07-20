/**
 * Equipment — staff-facing CRUD for installed HVAC units (PR #1).
 *
 * Reuses the existing `customerEquipment` table AS-IS (no migration). Equipment
 * is **property-anchored**: callers pass a `propertyId` and the owning
 * `customerId` is DERIVED from that property (the column is NOT NULL, so we
 * always populate it). Category is validated against the shared HVAC vocabulary
 * (`@shared/equipment` → `SERVICE_TYPES`) — no parallel taxonomy.
 *
 * Scope note: this router NEVER touches the customer portal, jobs, appointments,
 * QuickBooks, or reporting. Linked warranties are returned READ-ONLY (the
 * `equipmentWarranties.equipmentId` link already exists); warranty writes and
 * equipment↔job service history are deferred to a later PR.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { toPatch } from "../_core/zodPatch";
import { customerEquipment, equipmentWarranties, properties } from "../../drizzle/schema";
import { EQUIPMENT_CATEGORY_VALUES } from "@shared/equipment";

/** Editable equipment fields. propertyId is the anchor; customerId is derived, never sent. */
const equipmentBase = z.object({
  propertyId: z.number().int().positive(),
  category: z.enum(EQUIPMENT_CATEGORY_VALUES),
  make: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  serialNumber: z.string().max(120).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  installedAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/** Resolve the owning customerId for a property, or throw if the property is missing. */
async function customerIdForProperty(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  propertyId: number,
): Promise<number> {
  const prop = (
    await db.select({ customerId: properties.customerId }).from(properties).where(eq(properties.id, propertyId)).limit(1)
  )[0];
  if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
  return prop.customerId;
}

export const equipmentRouter = router({
  /**
   * All equipment for a customer (across their properties), each with its
   * READ-ONLY linked warranties. Active units first, then most-recently installed.
   */
  listByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const units = await db
        .select()
        .from(customerEquipment)
        .where(eq(customerEquipment.customerId, input.customerId))
        .orderBy(desc(customerEquipment.installedAt));

      const ids = units.map(u => u.id);
      const warranties = ids.length
        ? await db
            .select()
            .from(equipmentWarranties)
            .where(
              and(eq(equipmentWarranties.customerId, input.customerId), inArray(equipmentWarranties.equipmentId, ids)),
            )
        : [];
      const warrantiesByEquipment = new Map<number, (typeof warranties)[number][]>();
      for (const w of warranties) {
        if (w.equipmentId == null) continue;
        const list = warrantiesByEquipment.get(w.equipmentId) ?? [];
        list.push(w);
        warrantiesByEquipment.set(w.equipmentId, list);
      }

      // Active before retired, keeping the installedAt ordering within each group.
      const items = units
        .map(u => ({ ...u, warranties: warrantiesByEquipment.get(u.id) ?? [] }))
        .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));

      return { items, total: items.length };
    }),

  /** Create a unit under a property; customerId is derived from that property. */
  create: protectedProcedure.input(equipmentBase).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const customerId = await customerIdForProperty(db, input.propertyId);
    const result = await db.insert(customerEquipment).values({ ...input, customerId, status: "active" });
    const id = Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    return { id };
  }),

  /**
   * Patch a unit. If the property changes, the derived customerId is recomputed
   * so equipment can be moved between a customer's properties without orphaning.
   */
  update: protectedProcedure
    .input(toPatch(equipmentBase).extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { id, ...patch } = input;
      const existing = (await db.select().from(customerEquipment).where(eq(customerEquipment.id, id)).limit(1))[0];
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Equipment not found" });

      const next: Record<string, unknown> = { ...patch };
      if (patch.propertyId != null) next.customerId = await customerIdForProperty(db, patch.propertyId);

      await db.update(customerEquipment).set(next).where(eq(customerEquipment.id, id));
      return { success: true };
    }),

  /** Soft-decommission: keep the row (and its history) but mark it retired. */
  retire: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await db.update(customerEquipment).set({ status: "retired" }).where(eq(customerEquipment.id, input.id));
    return { success: true };
  }),

  /** Reverse a retirement (e.g. retired by mistake). */
  reactivate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    await db.update(customerEquipment).set({ status: "active" }).where(eq(customerEquipment.id, input.id));
    return { success: true };
  }),
});
