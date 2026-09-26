/**
 * Real, DB-backed EngagementRepoDeps for engagement.ts (docs/social-lane-spec.md §4).
 */
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { teamMembers } from "../../../drizzle/schema";
import * as dbModule from "../../db";
import { notify } from "../../routers/notifications";
import type { EngagementRepoDeps, IncomingInteraction } from "./engagement";

export function defaultEngagementRepoDeps(): EngagementRepoDeps {
  return {
    logInteraction: async (row) => {
      const result = await dbModule.createSocialInteraction(row as any);
      return Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    },
    createLead: async (row) => {
      const result = await dbModule.createLead(row as any);
      return Number((result as unknown as [{ insertId: number }])[0]?.insertId ?? 0);
    },
    notifyOwnerOfComplaint: async (interaction: IncomingInteraction) => {
      const db = await getDb();
      if (!db) return;
      const admins = await db.select({ id: teamMembers.id }).from(teamMembers).where(eq(teamMembers.role, "admin"));
      if (admins.length === 0) return;
      await notify(db, {
        teamMemberIds: admins.map((a) => a.id),
        type: "social_complaint",
        title: `Negative ${interaction.kind} on ${interaction.platform}`,
        body: interaction.content.slice(0, 500),
        entityType: "socialInteraction",
        entityId: interaction.postId,
      });
    },
  };
}
