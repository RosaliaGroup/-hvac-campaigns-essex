/**
 * One-off backfill for the Phase 1 appointment upgrade.
 *
 * 1. Parses legacy preferredDate/preferredTime varchars into `scheduledAt`
 *    for every appointment where scheduledAt IS NULL. Unparseable rows are
 *    SKIPPED and logged — they surface in the calendar's Unscheduled backlog.
 * 2. Auto-links appointments to customers by phone where customerId IS NULL.
 *
 * Safe to run multiple times (only touches NULL columns; never overwrites).
 *
 * Usage:  DATABASE_URL="mysql://..." pnpm tsx scripts/backfill-appointment-dates.ts
 *    or:  pnpm tsx scripts/backfill-appointment-dates.ts   (reads .env)
 */
import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../server/db";
import { appointments } from "../drizzle/schema";
import { parsePreferredDateTime } from "../server/services/appointmentTime";
import { findCustomerIdByPhone } from "../server/routers/customers";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("❌ DATABASE_URL not set or DB unreachable. Aborting.");
    process.exit(1);
  }

  // ── Pass 1: scheduledAt backfill ──────────────────────────
  const unscheduled = await db.select().from(appointments).where(isNull(appointments.scheduledAt));
  console.log(`Found ${unscheduled.length} appointment(s) without scheduledAt.`);

  let parsed = 0;
  const skipped: Array<{ id: number; date: string; time: string }> = [];

  for (const appt of unscheduled) {
    // Anchor "tomorrow"/weekday phrases to when the appointment was BOOKED, not to today.
    const anchor = appt.createdAt ? new Date(appt.createdAt) : new Date();
    const dt = parsePreferredDateTime(appt.preferredDate, appt.preferredTime, anchor);
    if (dt) {
      await db.update(appointments).set({ scheduledAt: dt }).where(eq(appointments.id, appt.id));
      parsed++;
      console.log(`  ✔ #${appt.id}: "${appt.preferredDate}" + "${appt.preferredTime}" → ${dt.toISOString()}`);
    } else {
      skipped.push({ id: appt.id, date: appt.preferredDate, time: appt.preferredTime });
    }
  }

  // ── Pass 2: customer auto-link by phone ───────────────────
  const unlinked = await db
    .select({ id: appointments.id, phone: appointments.phone })
    .from(appointments)
    .where(and(isNull(appointments.customerId)));
  let linked = 0;
  for (const appt of unlinked) {
    const customerId = await findCustomerIdByPhone(appt.phone);
    if (customerId) {
      await db.update(appointments).set({ customerId }).where(eq(appointments.id, appt.id));
      linked++;
    }
  }

  // ── Report ────────────────────────────────────────────────
  console.log("\n════════ BACKFILL SUMMARY ════════");
  console.log(`scheduledAt parsed:   ${parsed}`);
  console.log(`scheduledAt skipped:  ${skipped.length}  (left for the Unscheduled backlog)`);
  console.log(`customers linked:     ${linked}`);
  if (skipped.length) {
    console.log("\nSkipped rows (fix manually via the edit dialog):");
    for (const s of skipped) console.log(`  #${s.id}: date="${s.date}" time="${s.time}"`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
