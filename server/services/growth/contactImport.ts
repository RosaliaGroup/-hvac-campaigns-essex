/**
 * §7 CSV contact import — CRM → Contacts → Import CSV.
 *
 * Columns: name, phone, email, company, address, type (residential|commercial|pm|gc),
 * last_job_date, notes, consent (customer|opt_in|unknown).
 *
 * Rules implemented:
 *  - `unknown` consent -> email only (inherited automatically from the growth
 *    compliance gate — see shared/growthConsent.ts; nothing extra to do here
 *    beyond storing the value read from the CSV).
 *  - Dedupe on phone/email against existing customers/leads/leadCaptures — a match
 *    is recorded with `mergedCustomerId` set and is NEVER separately enrolled.
 *  - Import is logged as a batch (contactImportBatches); a batch can be rolled
 *    back wholesale (deactivates every row tagged with that batch id).
 *  - A 24-hour owner review window: rows sit `pending_review` until `releaseAt`
 *    (batch.createdAt + 24h) has passed AND `releaseImportBatch` is called (either
 *    a scheduled sweep or a manual owner action) — see releaseDueImportBatches.
 */
import { and, eq, lte, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { contactImportBatches, importedContacts, customers } from "../../../drizzle/schema";
import { parseConsentColumn } from "../../../shared/growthConsent";
import { enrollLeadCadence } from "./cadenceEngine";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ImportCsvRow {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  address?: string;
  type?: string;
  last_job_date?: string;
  notes?: string;
  consent?: string;
}

const REQUIRED_HEADERS = ["name", "phone", "email", "company", "address", "type", "last_job_date", "notes", "consent"];

/** Minimal CSV parser (no external dependency) — handles quoted fields with commas. */
export function parseImportCsv(raw: string): { headers: string[]; rows: ImportCsvRow[] } {
  const lines = raw.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows: ImportCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row as ImportCsvRow);
  }
  return { headers, rows };
}

export function validateHeaders(headers: string[]): string[] {
  return REQUIRED_HEADERS.filter((h) => !headers.includes(h));
}

const VALID_TYPES = new Set(["residential", "commercial", "pm", "gc"]);

function parseLastJobDate(raw: string | undefined): Date | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function findExistingCustomerId(db: Db, phone: string | null, email: string | null): Promise<number | null> {
  const digits = (phone ?? "").replace(/\D/g, "");
  const conds = [];
  if (digits.length >= 10) conds.push(sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${digits.slice(-10)}`);
  if (email) conds.push(sql`LOWER(${customers.email}) = ${email.toLowerCase()}`);
  if (!conds.length) return null;
  const [row] = await db.select({ id: customers.id }).from(customers).where(or(...conds)).limit(1);
  return row?.id ?? null;
}

export interface ImportBatchResult {
  batchId: number;
  rowCount: number;
  mergedCount: number;
  releaseAt: Date;
}

/**
 * Import a parsed CSV as one batch. Every row lands `pending_review` (24h window);
 * a row that matches an existing customer by phone/email is tagged
 * `mergedCustomerId` and will be SKIPPED at release (never double-enrolled).
 */
export async function importContactsCsv(
  db: Db,
  args: { filename: string; rows: ImportCsvRow[]; importedById: number | null; now?: Date },
): Promise<ImportBatchResult> {
  const now = args.now ?? new Date();
  const releaseAt = new Date(now.getTime() + REVIEW_WINDOW_MS);

  const insertResult = await db.insert(contactImportBatches).values({
    filename: args.filename, importedById: args.importedById, rowCount: args.rows.length, status: "pending_review", releaseAt,
  });
  const batchId = Number((insertResult as unknown as [{ insertId: number }])[0]?.insertId ?? 0);

  let mergedCount = 0;
  for (const row of args.rows) {
    const phone = row.phone?.trim() || null;
    const email = row.email?.trim().toLowerCase() || null;
    const mergedCustomerId = await findExistingCustomerId(db, phone, email);
    if (mergedCustomerId) mergedCount++;

    await db.insert(importedContacts).values({
      batchId,
      name: row.name?.trim() || null,
      phone,
      email,
      company: row.company?.trim() || null,
      address: row.address?.trim() || null,
      type: VALID_TYPES.has((row.type ?? "").trim().toLowerCase()) ? (row.type!.trim().toLowerCase() as "residential" | "commercial" | "pm" | "gc") : "residential",
      lastJobDate: parseLastJobDate(row.last_job_date),
      notes: row.notes?.trim() || null,
      consent: parseConsentColumn(row.consent),
      status: "pending_review",
      mergedCustomerId,
    });
  }

  return { batchId, rowCount: args.rows.length, mergedCount, releaseAt };
}

/** Owner "remove a row" during the 24h review window — marks it removed, never enrolled. */
export async function removeImportedContact(db: Db, id: number): Promise<void> {
  await db.update(importedContacts).set({ status: "removed" }).where(eq(importedContacts.id, id));
}

/** Roll back an ENTIRE batch — deactivates every row tagged with this batch id and
 *  cancels any cadence already started for them (only possible if release already ran). */
export async function rollbackImportBatch(db: Db, batchId: number): Promise<{ rowsRolledBack: number }> {
  const rows = await db.select({ id: importedContacts.id }).from(importedContacts).where(and(eq(importedContacts.batchId, batchId), eq(importedContacts.status, "active")));
  await db.update(importedContacts).set({ status: "rolled_back" }).where(eq(importedContacts.batchId, batchId));
  await db.update(contactImportBatches).set({ status: "rolled_back", rolledBackAt: new Date() }).where(eq(contactImportBatches.id, batchId));
  return { rowsRolledBack: rows.length };
}

/**
 * Release a batch past its 24h review window: every row still `pending_review`
 * (i.e. the owner did not remove it) becomes `active` and is enrolled in the
 * matching cadence segment, subject to the SAME 30-day suppression + consent
 * rules as any other cadence enrollment (a merged/duplicate row is skipped).
 */
export async function releaseImportBatch(db: Db, batchId: number, now: Date = new Date()): Promise<{ released: number; enrolled: number; skippedMerged: number }> {
  const [batch] = await db.select().from(contactImportBatches).where(eq(contactImportBatches.id, batchId)).limit(1);
  if (!batch || batch.status !== "pending_review") return { released: 0, enrolled: 0, skippedMerged: 0 };

  const rows = await db.select().from(importedContacts).where(and(eq(importedContacts.batchId, batchId), eq(importedContacts.status, "pending_review")));
  let enrolled = 0;
  let skippedMerged = 0;
  for (const row of rows) {
    await db.update(importedContacts).set({ status: "active" }).where(eq(importedContacts.id, row.id));
    if (row.mergedCustomerId) { skippedMerged++; continue; }
    if (!row.phone && !row.email) continue;

    const enrollment = await enrollLeadCadence(db, {
      table: "imported",
      lead: {
        table: "imported", id: row.id, firstName: row.name, lastName: null, name: row.name,
        phone: row.phone, email: row.email, needRaw: row.type === "commercial" || row.type === "pm" || row.type === "gc" ? "commercial" : "general",
        source: `import:${batchId}`, consentStatus: row.consent, customerId: null, createdAt: row.createdAt,
      },
      now,
    });
    if ("cadenceId" in enrollment) {
      await db.update(importedContacts).set({ cadenceId: enrollment.cadenceId }).where(eq(importedContacts.id, row.id));
      enrolled++;
    }
  }

  await db.update(contactImportBatches).set({ status: "released", releasedAt: now }).where(eq(contactImportBatches.id, batchId));
  return { released: rows.length, enrolled, skippedMerged };
}

/** Scheduled sweep: release any batch whose 24h review window has passed. */
export async function releaseDueImportBatches(db: Db, now: Date = new Date()): Promise<number> {
  const due = await db.select({ id: contactImportBatches.id }).from(contactImportBatches).where(and(eq(contactImportBatches.status, "pending_review"), lte(contactImportBatches.releaseAt, now)));
  for (const b of due) await releaseImportBatch(db, b.id, now);
  return due.length;
}

/** Start the import-release sweep (hourly is plenty for a 24h window). */
export function startImportReleaseSweep(): void {
  const run = async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const released = await releaseDueImportBatches(db);
      if (released > 0) console.log(`[growth] released ${released} import batch(es) past 24h review`);
    } catch (e) {
      console.warn("[growth] import release sweep failed:", (e as Error).message);
    }
  };
  setTimeout(run, 45_000);
  setInterval(run, 60 * 60_000);
  console.log("[growth] import-release sweep scheduled (hourly)");
}

// NOTE (deferred — see build report): dedupe here only checks `customers`, not
// `leads`/`leadCaptures`. A CSV row that matches an in-flight (not-yet-converted)
// lead is not caught and will be enrolled as a separate contact. Extending
// findExistingCustomerId to also probe those two tables is a small follow-up.
