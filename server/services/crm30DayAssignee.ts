/** Resolve a real CRM user, never confuse the outbound Gmail mailbox with a login.
 * Prefer an explicitly configured CRM user email; otherwise require exactly one
 * CRM user whose displayed name is Ana Haynes. Ambiguous matches stay unassigned.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { users, teamMembers } from "../../drizzle/schema";
import { cadenceDatabase, crm30DayTasks } from "./crm30DayTasks";

type Assignee = { id: number; name: string | null; email: string | null };

export function uniqueAssignee(candidates: Assignee[]): Assignee | null {
  return candidates.length === 1 ? candidates[0] : null;
}

export async function resolveCadenceAssignee(): Promise<{
  user: Assignee | null; source: "configured-email" | "exact-name" | "unique-existing-owner" | "active-team-email" | "unresolved";
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
  if (user) return { user, source: "exact-name" };
  // Team membership and OAuth login are stored in different tables.
  // Match only an active team member with an exact verified login email.
  // Do not guess from a name or reuse an orphaned numeric task-owner ID.
  const activeAna = await db.select({ email: teamMembers.email })
    .from(teamMembers)
    .where(and(eq(teamMembers.status, "active"), sql`lower(trim(${teamMembers.name})) = 'ana haynes'`))
    .limit(2);
  if (activeAna.length === 1) {
    const teamEmail = activeAna[0].email.trim().toLowerCase();
    const loginMatches = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${teamEmail}`)
      .limit(2);
    const verified = uniqueAssignee(loginMatches);
    if (verified) return { user: verified, source: "active-team-email" };
  }
  // Reuse an authenticated CRM user only when ALL existing assigned open
  // cadence tasks point to one valid user. Never infer ownership from a label.
  const owners = await db.selectDistinct({ id: crm30DayTasks.assignedToUserId })
    .from(crm30DayTasks)
    .where(and(eq(crm30DayTasks.status, "open"), isNotNull(crm30DayTasks.assignedToUserId)))
    .limit(2);
  if (owners.length === 1 && owners[0].id !== null) {
    const matches = await db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(eq(users.id, owners[0].id)).limit(2);
    const verified = uniqueAssignee(matches);
    if (verified) return { user: verified, source: "unique-existing-owner" };
  }
  console.warn("[CRM 30-Day] Owner lookup unresolved:", JSON.stringify({
    configuredEmailPresent: Boolean(configuredEmail),
    exactNameMatches: matches.length,
    distinctAssignedOwners: owners.length,
    activeAnaTeamMatches: activeAna.length,
    existingOwnerId: owners.length === 1 ? owners[0].id : null,
  }));
  return { user: null, source: "unresolved" };
}
