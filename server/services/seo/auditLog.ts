/**
 * SEO bulk-approve audit log (docs/seo-bulk-approve-spec.md §7). Append-only —
 * every action the workflow takes writes one row here. Viewable in a side
 * panel (client) and exportable as CSV.
 */
import { desc, eq, and, gte, lte, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import { seoAuditLog, type SeoAuditLogRow, SEO_AUDIT_ACTION } from "../../../drizzle/schema";

export type AuditAction = (typeof SEO_AUDIT_ACTION)[number];

export type LogAuditInput = {
  actorId: number | null;
  action: AuditAction;
  batchId: number | null;
  pagePath: string | null;
  before: unknown;
  after: unknown;
  lintResult: unknown;
};

export async function logAudit(input: LogAuditInput): Promise<void> {
  const db = await getDb();
  if (!db) return; // audit logging never blocks the underlying action
  await db.insert(seoAuditLog).values({
    actorId: input.actorId,
    action: input.action,
    batchId: input.batchId,
    pagePath: input.pagePath,
    before: input.before as object | null,
    after: input.after as object | null,
    lintResult: input.lintResult as object | null,
  });
}

export type AuditLogFilter = {
  batchId?: number;
  pagePath?: string;
  action?: AuditAction;
  since?: Date;
  until?: Date;
  limit?: number;
};

export async function listAuditLog(filter: AuditLogFilter = {}): Promise<SeoAuditLogRow[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filter.batchId !== undefined) conditions.push(eq(seoAuditLog.batchId, filter.batchId));
  if (filter.pagePath !== undefined) conditions.push(eq(seoAuditLog.pagePath, filter.pagePath));
  if (filter.action !== undefined) conditions.push(eq(seoAuditLog.action, filter.action));
  if (filter.since !== undefined) conditions.push(gte(seoAuditLog.ts, filter.since));
  if (filter.until !== undefined) conditions.push(lte(seoAuditLog.ts, filter.until));

  const query = db
    .select()
    .from(seoAuditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(seoAuditLog.ts))
    .limit(filter.limit ?? 500);

  return query;
}

/** CSV export (side panel "Export CSV" button). */
export function auditLogToCsv(rows: SeoAuditLogRow[]): string {
  const header = ["id", "ts", "actorId", "action", "batchId", "pagePath", "before", "after", "lintResult"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cells = [
      r.id,
      r.ts instanceof Date ? r.ts.toISOString() : String(r.ts),
      r.actorId ?? "",
      r.action,
      r.batchId ?? "",
      r.pagePath ?? "",
      csvCell(r.before),
      csvCell(r.after),
      csvCell(r.lintResult),
    ];
    lines.push(cells.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function csvEscape(v: unknown): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
