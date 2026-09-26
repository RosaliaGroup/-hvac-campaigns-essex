/**
 * Speed-to-lead (docs/growth-system-spec.md §1) — the entry point called right
 * after a new lead is created (leads.create / leadCaptures.create in
 * server/routers.ts). Fire-and-forget from the caller, matching the existing
 * enqueueLeadCustomerSync convention — never blocks or fails lead creation.
 *
 * 1. Enrolls the lead in the §2 cadence engine (which materializes the day-0
 *    SMS + call, day-1/3/7/14 touches).
 * 2. Dispatches the day-0 SMS INLINE, right here, so it goes out well within the
 *    60-second bound (spec §1.2) instead of waiting for the next 60s poll tick.
 *    The day-0 CALL (due at +2 minutes) and every later step are left to the
 *    cadence poller (server/services/growth/cadenceEngine.ts).
 * 3. Raises the owner SMS alert (§1.5) for commercial/bid/portfolio leads or any
 *    lead mentioning "a quote from another company" — via notify()'s
 *    OWNER_SMS_ALERT_TYPES channel, which bypasses the customer compliance gate.
 */
import { getDb } from "../../db";
import { fetchUnifiedLead } from "./leadAdapter";
import { enrollLeadCadence, dispatchDay0SmsNow } from "./cadenceEngine";
import { normalizeLeadNeed, isB2bNeed } from "../../../shared/growthCadencePlan";
import type { LeadSourceTable } from "../../../shared/growthLead";
import { notify } from "../../routers/notifications";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const COMPETITOR_MENTION_RE = /quote from (another|a different|other) compan/i;

export async function enrollSpeedToLead(args: { table: LeadSourceTable; id: number }): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const lead = await fetchUnifiedLead(db, args.table, args.id);
    if (!lead) return;

    const need = normalizeLeadNeed(lead.needRaw);
    const b2b = isB2bNeed(need);
    const mentionsCompetitor = COMPETITOR_MENTION_RE.test(lead.needRaw ?? "");

    // §1.5 owner alert — fires regardless of whether enrollment/cadence succeeds.
    if (b2b) {
      await notify(db, {
        teamMemberIds: [], // owner-SMS-only alert; no in-app recipient list required
        type: "growth_b2b_lead",
        title: `Commercial/bid lead: ${lead.name ?? lead.firstName ?? "New lead"}`,
        body: `${lead.phone ?? lead.email ?? "no contact info"} — ${lead.needRaw ?? need}`,
      });
    }
    if (mentionsCompetitor) {
      await notify(db, {
        teamMemberIds: [],
        type: "growth_competitor_mention",
        title: `Lead mentions a competitor quote: ${lead.name ?? lead.firstName ?? "New lead"}`,
        body: `${lead.phone ?? lead.email ?? "no contact info"} — ${lead.needRaw ?? ""}`.slice(0, 300),
      });
    }

    const enrollment = await enrollLeadCadence(db, { table: args.table, lead });
    if ("skipped" in enrollment) {
      console.log(`[growth] speed-to-lead enrollment skipped for ${args.table}#${args.id}: ${enrollment.skipped}`);
      return;
    }

    await dispatchDay0SmsNow(db, enrollment.cadenceId);
  } catch (err) {
    console.error("[growth] speed-to-lead enrollment failed:", err);
  }
}
