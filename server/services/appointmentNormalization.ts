/**
 * Server-side appointment normalization. A single authoritative resolver used by
 * every appointment write path (staff create/update, calendar, Vapi) so that:
 *  - when customerId is supplied, customer fields are resolved from the DB,
 *  - when propertyId is supplied, the linked property + full address are resolved,
 *  - propertyId is validated to belong to customerId (mismatches are rejected),
 *  - missing name/phone/email/propertyAddress are backfilled,
 *  - explicitly-entered user values are never overwritten (backfill-only).
 * Pure field logic (`normalizeAppointmentFields`) is separated from DB access
 * (`resolveAppointmentContext`) so it can be unit-tested without a database.
 */
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { customers, properties, type Customer, type Property } from "../../drizzle/schema";
import { formatPropertyAddress, isCompleteAddress, missingAddressParts } from "@shared/address";
import type { getDb } from "../db";

type FullDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
/** A live DB handle OR a transaction handle — these helpers run in either. */
type Db = FullDb | Parameters<Parameters<FullDb["transaction"]>[0]>[0];

export interface AppointmentContextInput {
  customerId?: number | null;
  propertyId?: number | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  propertyAddress?: string | null;
  propertyType?: "residential" | "commercial" | null;
}

export interface ResolvedAppointmentContext {
  customerId: number | null;
  propertyId: number | null;
  fullName?: string;
  phone?: string;
  email?: string | null;
  propertyAddress?: string | null;
  propertyType?: "residential" | "commercial";
}

type LoadedCustomer = Pick<Customer, "id" | "displayName" | "phone" | "email" | "type">;
type LoadedProperty = Pick<Property, "id" | "customerId" | "addressLine1" | "addressLine2" | "city" | "state" | "zip" | "propertyType">;

const blank = (v?: string | null): boolean => !v || !v.trim();

/** Backfill-only: keep the user's non-empty value; otherwise fall back to authoritative. */
export function fillBlank(userValue: string | null | undefined, authoritative: string | null | undefined): string | undefined {
  if (!blank(userValue)) return userValue!.trim();
  const a = authoritative?.trim();
  return a ? a : undefined;
}

/**
 * PURE: given already-loaded customer/property rows, produce the normalized
 * appointment fields and enforce the property↔customer relationship.
 * Throws TRPCError CONFLICT when the property does not belong to the customer.
 */
export function normalizeAppointmentFields(
  input: AppointmentContextInput,
  loaded: { customer?: LoadedCustomer | null; property?: LoadedProperty | null },
): ResolvedAppointmentContext {
  const customer = loaded.customer ?? null;
  const property = loaded.property ?? null;

  // Reject mismatched customer/property combinations.
  if (property && input.customerId != null && property.customerId !== input.customerId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Property ${property.id} belongs to customer ${property.customerId}, not customer ${input.customerId}.`,
    });
  }

  const customerId = customer?.id ?? property?.customerId ?? input.customerId ?? null;
  const propertyId = property?.id ?? input.propertyId ?? null;

  return {
    customerId,
    propertyId,
    fullName: fillBlank(input.fullName, customer?.displayName),
    phone: fillBlank(input.phone, customer?.phone),
    email: blank(input.email) ? (customer?.email ?? null) : input.email!.trim(),
    // When a property is linked, its formatted address is AUTHORITATIVE — typed text
    // never overrides it. Without a property, use the (trimmed) manual entry.
    propertyAddress: property
      ? formatPropertyAddress(property)
      : (blank(input.propertyAddress) ? (input.propertyAddress ?? null) : input.propertyAddress!.trim()),
    propertyType: (property?.propertyType as "residential" | "commercial" | undefined) ?? input.propertyType ?? undefined,
  };
}

/**
 * DB-backed resolver. Loads the referenced customer/property. When a customer is
 * given without an explicit property AND no address was typed, resolves the
 * customer's primary (then first) property to backfill propertyId + location.
 * Never overwrites a typed address. Throws NOT_FOUND for unknown ids and CONFLICT
 * for mismatched customer/property.
 */
export async function resolveAppointmentContext(db: Db, input: AppointmentContextInput): Promise<ResolvedAppointmentContext> {
  let customer: LoadedCustomer | null = null;
  let property: LoadedProperty | null = null;

  if (input.customerId != null) {
    customer = (await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1))[0] ?? null;
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: `Customer ${input.customerId} not found.` });
  }

  if (input.propertyId != null) {
    property = (await db.select().from(properties).where(eq(properties.id, input.propertyId)).limit(1))[0] ?? null;
    if (!property) throw new TRPCError({ code: "NOT_FOUND", message: `Property ${input.propertyId} not found.` });
    // An explicitly-linked property MUST have a complete service address, otherwise the
    // appointment (and its calendar/ICS location) would carry a partial address. Reject
    // the save and name the missing fields so the property can be completed first.
    const missing = missingAddressParts(property);
    if (missing.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `This property's service address is incomplete — missing ${missing.join(", ")}. Update the property before scheduling.`,
      });
    }
  } else if (customer && blank(input.propertyAddress)) {
    // Auto-resolve the customer's primary → first property to backfill the location,
    // but ONLY link it when its address is complete (never auto-link a partial address).
    const primary = (await db
      .select()
      .from(properties)
      .where(eq(properties.customerId, customer.id))
      .orderBy(desc(properties.isPrimary), desc(properties.createdAt))
      .limit(1))[0] ?? null;
    if (primary && isCompleteAddress(primary)) property = primary;
  }

  return normalizeAppointmentFields(input, { customer, property });
}

// ─────────────────────────────────────────────────────────────
// Property ↔ appointment linking (user-driven; never silent)
// ─────────────────────────────────────────────────────────────

/**
 * PURE decision for linking a property to an appointment. Mirrors the
 * normalizeAppointmentFields pattern: the router loads the rows, this function
 * validates ownership + decides between reuse and create so the logic is
 * unit-tested without a database. Enforces the data-integrity rules:
 *  - a property must belong to the appointment's (resolved) customer — never
 *    link across customers,
 *  - an existing address match is REUSED, never duplicated (dedupe/idempotency),
 *  - a linkable customer must exist.
 */
export interface PropertyLinkDecisionInput {
  /** Customer that will own the property, after phone-resolution in the router. */
  resolvedCustomerId: number | null;
  mode: "existing" | "create";
  /** Mode "existing": the loaded property row (null when the id was not found). */
  existingProperty?: { id: number; customerId: number } | null;
  /** Mode "create": id of a property whose addressLine1 already matches (dedupe hit), or null. */
  dedupeMatchId?: number | null;
}

export type PropertyLinkDecision =
  | { action: "link"; propertyId: number }
  | { action: "create" };

export function decidePropertyLink(input: PropertyLinkDecisionInput): PropertyLinkDecision {
  if (input.resolvedCustomerId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This appointment isn't linked to a customer yet. Link it to a customer before adding a property.",
    });
  }

  if (input.mode === "existing") {
    const prop = input.existingProperty ?? null;
    if (!prop) throw new TRPCError({ code: "NOT_FOUND", message: "Property not found." });
    if (prop.customerId !== input.resolvedCustomerId) {
      throw new TRPCError({ code: "CONFLICT", message: "That property belongs to a different customer." });
    }
    return { action: "link", propertyId: prop.id };
  }

  // mode === "create": reuse an address-matched property (dedupe), else create.
  if (input.dedupeMatchId != null) return { action: "link", propertyId: input.dedupeMatchId };
  return { action: "create" };
}

/** Resolve a customer's primary (then first) property id, or null. Never throws. */
export async function findPrimaryPropertyId(db: Db, customerId: number): Promise<number | null> {
  try {
    const rows = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.customerId, customerId))
      .orderBy(desc(properties.isPrimary), desc(properties.createdAt))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Find a property by (customerId, case-insensitive addressLine1) for dedupe. */
export async function findPropertyByAddress(db: Db, customerId: number, addressLine1: string): Promise<number | null> {
  const key = addressLine1.trim().toLowerCase();
  if (!key) return null;
  const rows = await db
    .select({ id: properties.id, addressLine1: properties.addressLine1 })
    .from(properties)
    .where(eq(properties.customerId, customerId));
  return rows.find(r => (r.addressLine1 ?? "").trim().toLowerCase() === key)?.id ?? null;
}

/**
 * Match one of a customer's properties against a free-text address (e.g. a Vapi
 * `property_address` string). Matches when the property's street line appears in
 * the free text, or the full formatted address contains it. Returns the property
 * row (id + address parts) or null. Never throws.
 */
export async function matchPropertyByFreeText(
  db: Db,
  customerId: number,
  freeText: string,
): Promise<LoadedProperty | null> {
  const text = freeText.trim().toLowerCase();
  if (!text) return null;
  try {
    const rows = await db.select().from(properties).where(eq(properties.customerId, customerId));
    for (const p of rows) {
      const line1 = (p.addressLine1 ?? "").trim().toLowerCase();
      const full = formatPropertyAddress(p).toLowerCase();
      if (line1 && (text.includes(line1) || full === text || (full && text.includes(full)))) {
        return p as LoadedProperty;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * FORWARD-FILL for NEW bookings only. Given the booking's resolved customer and
 * service address, return a property id to link — reusing an existing one when a
 * match is safe, otherwise creating and returning a new property. Rules enforced:
 *  - same-customer only (all reads/inserts are scoped to `customerId`),
 *  - deduplicated (free-text match, then case-insensitive addressLine1 match),
 *  - idempotent (the same address always resolves to the same property),
 *  - never links across customers.
 *
 * MUST be called from inside the booking's insert transaction (pass the tx as
 * `db`) so the property and appointment commit atomically. This is NOT a
 * historical backfill: it acts only on the single current booking's address and
 * never scans or mutates other appointments. Returns null on blank address; best
 * effort on unexpected DB errors (booking proceeds with a null property).
 */
export async function ensurePropertyForBooking(
  db: Db,
  customerId: number,
  freeTextAddress: string | null | undefined,
  propertyType?: "residential" | "commercial" | null,
): Promise<number | null> {
  const text = freeTextAddress?.trim();
  if (!text) return null;
  try {
    const matched = await matchPropertyByFreeText(db, customerId, text);
    if (matched) return matched.id;
    // addressLine1 is varchar(255); cap the free-text line and dedupe on the capped value.
    const line1 = text.slice(0, 255);
    const existing = await findPropertyByAddress(db, customerId, line1);
    if (existing) return existing;
    const hasAny = (
      await db.select({ id: properties.id }).from(properties).where(eq(properties.customerId, customerId)).limit(1)
    ).length > 0;
    const ins = await db.insert(properties).values({
      customerId,
      addressLine1: line1,
      propertyType: propertyType ?? "residential",
      isPrimary: !hasAny,
    });
    const id = Number((ins as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    return id > 0 ? id : null;
  } catch {
    return null;
  }
}
