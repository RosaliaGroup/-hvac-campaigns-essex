/** Resolve a real CRM user, never confuse the outbound Gmail mailbox with a login.
 * Prefer an explicitly configured CRM user email; otherwise require exactly one
 * CRM user whose displayed name is Ana Haynes. Ambiguous matches stay unassigned.
 */
import { sql } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { cadenceDatabase } from "./crm30DayTasks";

type Assignee = { id: number; name: string | null; email: string | null };

export function uniqueAssignee(candidates: Assignee[]): Assignee | null {
  return candidates.length === 1 ? candidates[0] : null;
}

export async function resolveCadenceAssignee(): Promise<{
  user: Assignee | null; source: "configured-email" | "exact-name" | "unresolved";
}> {
  const db = await cadenceDatabase();
  const configuredEmail = process.env.CRM_FOLLOWUP_ASSIGNEE_EMAIL?.trim().toLowerCase();
  if (configuredEmail) {
    const matches = await db.select({id:users.id,name:users.name,email:users.email})
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${configuredEmail}`)
      .limit(2);
    const user = uniqueAssignee(matches);
    if (user) return {user,source:"configured-email"};
  }
  const matches = await db.select({id:users.id,name:users.name,email:users.email})
    .from(users)
    .where(sql`lower(trim(${users.name})) = 'ana haynes'`)
    .limit(2);
  const user = uniqueAssignee(matches);
  return {user,source:user?"exact-name":"unresolved"};
}
