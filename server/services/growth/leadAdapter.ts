/**
 * The I/O side of the leads/leadCaptures bridge (see shared/growthLead.ts for the
 * type side). `leads` and `leadCaptures` are NOT unified in the database — this
 * module is a code-level adapter/union-query, so growth-system code reads/writes
 * "a lead" through ONE interface (`UnifiedLead`) regardless of which table a given
 * row actually lives in. See the build report for why a small migration (adding
 * `consentStatus` to BOTH tables) was still needed even though this bridge itself
 * required no migration.
 */
import { desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../db";
import { leads, leadCaptures } from "../../../drizzle/schema";
import type { UnifiedLead, LeadSourceTable } from "../../../shared/growthLead";
import { DEFAULT_INBOUND_CONSENT } from "../../../shared/growthConsent";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function fromLeadsRow(row: typeof leads.$inferSelect): UnifiedLead {
  return {
    table: "leads",
    id: row.id,
    firstName: null,
    lastName: null,
    name: row.name,
    phone: row.contactType === "phone" ? row.contact : null,
    email: row.contactType === "email" ? row.contact : null,
    needRaw: row.service,
    source: row.source,
    consentStatus: row.consentStatus ?? DEFAULT_INBOUND_CONSENT,
    customerId: row.customerId ?? null,
    createdAt: row.createdAt,
  };
}

function fromLeadCapturesRow(row: typeof leadCaptures.$inferSelect): UnifiedLead {
  return {
    table: "leadCaptures",
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: row.name,
    phone: row.phone,
    email: row.email,
    needRaw: row.message,
    source: row.captureType,
    consentStatus: row.consentStatus ?? DEFAULT_INBOUND_CONSENT,
    customerId: row.customerId ?? null,
    createdAt: row.createdAt,
  };
}

export async function fetchUnifiedLead(db: Db, table: LeadSourceTable, id: number): Promise<UnifiedLead | null> {
  if (table === "leads") {
    const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return row ? fromLeadsRow(row) : null;
  }
  const [row] = await db.select().from(leadCaptures).where(eq(leadCaptures.id, id)).limit(1);
  return row ? fromLeadCapturesRow(row) : null;
}

/** Union query across both tables — e.g. for the §10 scoreboard's "leads MTD". */
export async function listUnifiedLeadsSince(db: Db, since: Date): Promise<UnifiedLead[]> {
  const [leadRows, captureRows] = await Promise.all([
    db.select().from(leads).where(gte(leads.createdAt, since)).orderBy(desc(leads.createdAt)),
    db.select().from(leadCaptures).where(gte(leadCaptures.createdAt, since)).orderBy(desc(leadCaptures.createdAt)),
  ]);
  return [...leadRows.map(fromLeadsRow), ...captureRows.map(fromLeadCapturesRow)].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}
