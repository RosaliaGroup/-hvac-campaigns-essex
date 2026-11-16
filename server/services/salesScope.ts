/**
 * What a sales login may see: only the contacts and leads assigned to that
 * person in the Daily Hub, and only the batch released to them so far
 * (assignedIdsForEmail reads the same list the hub shows). Not a sales user →
 * null (no limit). Lookup failure → an empty scope, so nothing leaks.
 */
import { isSalesUser } from "@shared/salesAccess";

export type SalesScope = { customers: Set<number>; leads: Set<number> };

export async function salesScopeFor(user: { teamRole?: string | null; email?: string | null } | null | undefined): Promise<SalesScope | null> {
  if (!isSalesUser(user)) return null;
  const { assignedIdsForEmail } = await import("../routers/teamHub");
  const own = await assignedIdsForEmail(String(user?.email ?? "")).catch(() => null);
  return own ? { customers: own.customers, leads: own.leads } : { customers: new Set(), leads: new Set() };
}

export function inScope(scope: SalesScope | null, type: "customer" | "lead", id: number): boolean {
  if (!scope) return true;
  return (type === "customer" ? scope.customers : scope.leads).has(id);
}
