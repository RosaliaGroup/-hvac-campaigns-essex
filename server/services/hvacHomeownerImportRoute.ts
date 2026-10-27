/**
 * One-time guarded transfer of the already-owned Dataman homeowner list from
 * Abrevo Supabase to Mechanical Enterprise's canonical Contacts CRM.
 *
 * No PII is committed to git. This endpoint is active ONLY while the one-time
 * import secret is configured. Direct customer inserts do not enqueue messages,
 * phone calls, email cadences or QuickBooks pushes.
 */
import { timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { customers, properties, leads, leadCaptures } from "../../drizzle/schema";

const item = z.object({
  id: z.number().int().positive(),
  name: z.string().max(255),
  email: z.string().max(320).nullable().optional(),
  phone: z.string().max(50),
  page: z.string().max(255).nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  source: z.literal("hvac-list-07105"),
  role: z.literal("homeowner"),
  status: z.string().max(32).nullable().optional(),
});
const bodySchema = z.object({ items: z.array(item).min(1).max(30) });
const sourceTag = "hvac-list-07105";
const digits10 = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);

function parseServiceAddress(raw: string | null | undefined) {
  const chunks = (raw ?? "").split(",").map(x => x.trim());
  if (chunks.length < 3 || !chunks[0] || !chunks[1]) return null;
  const m = chunks.slice(2).join(",").match(/\b([A-Z]{2})\s+(\d{4,5})(?:-\d{4})?\b/);
  if (!m) return null;
  return { line: chunks[0], city: chunks[1], state: m[1], zip: m[2].padStart(5, "0") };
}

export function registerHvacHomeownerImportRoute(app: Express): void {
  app.post("/api/internal/hvac-homeowner-import", async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    const expected = process.env.HVAC_HOMEOWNER_IMPORT_TOKEN;
    const supplied = req.header("x-hvac-import-token") ?? "";
    // Deliberately fail closed when secret is missing/disabled.
    const a = Buffer.from(supplied, "utf8");
    const b = Buffer.from(expected ?? "", "utf8");
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      return res.status(404).json({ error: "Not found" });
    }
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid import batch" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    let added = 0;
    let existed = 0;
    let invalid = 0;
    const details: Array<{ id: number; result: string }> = [];
    try {
      for (const row of parsed.data.items) {
        const phoneDigits = digits10(row.phone);
        if (phoneDigits.length !== 10) {
          invalid++; details.push({ id: row.id, result: "invalid-phone" }); continue;
        }
        const phone = "+1" + phoneDigits;
        const email = row.email && !row.email.toLowerCase().includes("placeholder.mwbe")
          && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
          ? row.email.trim().toLowerCase() : null;
        const matchCustomer = or(
          sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${phoneDigits}`,
          ...(email ? [sql`LOWER(${customers.email}) = ${email}`] : []),
        );
        const [existing] = await db.select({ id: customers.id }).from(customers).where(matchCustomer).limit(1);
        if (existing) {
          existed++; details.push({ id: row.id, result: "existing-contact" }); continue;
        }
        // Also respect leads and website inquiries that have not yet converted
        // into a canonical customer. Never create duplicate outreach identities.
        const [existingLead] = await db.select({ id: leads.id }).from(leads).where(or(
          and(eq(leads.contactType, "phone"), sql`RIGHT(REGEXP_REPLACE(${leads.contact}, '[^0-9]', ''), 10) = ${phoneDigits}`),
          ...(email ? [and(eq(leads.contactType, "email"), sql`LOWER(${leads.contact}) = ${email}`)] : []),
        )).limit(1);
        const [existingCapture] = await db.select({ id: leadCaptures.id }).from(leadCaptures).where(or(
          sql`RIGHT(REGEXP_REPLACE(${leadCaptures.phone}, '[^0-9]', ''), 10) = ${phoneDigits}`,
          ...(email ? [sql`LOWER(${leadCaptures.email}) = ${email}`] : []),
        )).limit(1);
        if (existingLead || existingCapture) {
          existed++; details.push({ id: row.id, result: "existing-crm-lead" }); continue;
        }

        const words = row.name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
        if (!words.length) { invalid++; details.push({ id: row.id, result: "missing-name" }); continue; }
        const firstName = words[0].replace(/\b\w/g, x => x.toUpperCase());
        const lastName = words.slice(1).join(" ");
        const displayName = [firstName, lastName].filter(Boolean).join(" ").replace(/\b[a-z]/g, x => x.toUpperCase());
        const addr = parseServiceAddress(row.page);
        // Do not propagate income estimates, unproved prior-contact labels, or
        // fabricated opt-in. Source status remains a *historical import label*.
        const extractedYear = (row.message ?? "").match(/Year Built:\s*(\d{4})/i)?.[1];
        const notes = [
          "Imported purchased homeowner prospect (Dataman Group).",
          "Marketing SMS/AI-call consent: UNVERIFIED. Do not autodial/text.",
          "External source: " + sourceTag + "; source row ID: " + row.id,
          "Historical list status (NOT delivery evidence): " + (row.status || "unknown"),
          extractedYear ? "Property year built (vendor-provided): " + extractedYear : "",
        ].filter(Boolean).join("\n");
        const inserted = await db.insert(customers).values({
          type: "residential", firstName, lastName: lastName || null,
          displayName, email, phone, source: sourceTag,
          status: "inactive", notes,
          quickbooksSyncStatus: "not_synced",
        });
        const customerId = Number((inserted as unknown as [{ insertId?: number }])[0]?.insertId ?? 0);
        if (customerId < 1) throw Error("Insert returned no customer id");
        if (addr) {
          await db.insert(properties).values({
            customerId, label: "Home (vendor-reported)", addressLine1: addr.line,
            city: addr.city, state: addr.state, zip: addr.zip,
            propertyType: "residential", isPrimary: true,
          });
        }
        added++;
        details.push({ id: row.id, result: "added" });
      }
      console.info("[HvacHomeownerImport] batch", { attempted: parsed.data.items.length, added, existed, invalid });
      return res.json({ attempted: parsed.data.items.length, added, existed, invalid, details });
    } catch (err) {
      console.error("[HvacHomeownerImport] batch failed", err instanceof Error ? err.message : "unknown");
      return res.status(500).json({ error: "Import interrupted", attempted: parsed.data.items.length, added, existed, invalid, details });
    }
  });
}
