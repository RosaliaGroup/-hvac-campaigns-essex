/**
 * rollback-qbo-repair.ts — undo one repair run by its runId.
 *
 * Preview by default. It reads qboRepairAuditLog for the given runId and, for
 * each recorded change, restores the customer field to its before-value ONLY
 * when the current value still equals the recorded after-value (else it refuses
 * that row). Properties created by the run are deleted only when nothing
 * depends on them. It NEVER touches estimates, invoices, or any sync cursor.
 * The rollback logic lives in rollbackRun() (qboRepairCore.ts) and is unit-tested.
 *
 * Usage:
 *   pnpm exec tsx scripts/rollback-qbo-repair.ts --run-id <id>            # preview
 *   pnpm exec tsx scripts/rollback-qbo-repair.ts --run-id <id> --apply --prod-write-ack
 */
import { rollbackRun } from "../server/integrations/accounting/qboRepairCore";
import { connect, makeRollbackPort } from "./qboRepairDb";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const runId = val("--run-id");
if (!runId) { console.error("REFUSED: pass --run-id <value>."); process.exit(2); }
const write = has("--apply") && has("--prod-write-ack");
if (has("--apply") && !has("--prod-write-ack")) { console.error("REFUSED: --apply requires --prod-write-ack."); process.exit(2); }
const dryRun = !write;

async function main() {
  const conn = await connect();
  const port = makeRollbackPort(conn);
  const actor = process.env.USER || process.env.USERNAME || "cli";
  try {
    console.log(`ROLLBACK — runId=${runId} mode=${dryRun ? "PREVIEW" : "APPLY"}\n`);
    const lines = await rollbackRun(port, runId, { dryRun, actor });
    if (!lines.length) { console.log("  (no repair audit rows for this runId)"); }
    for (const l of lines) {
      console.log(`  CRM #${l.customerId}  ${l.field}  ${l.action.toUpperCase()}  ${JSON.stringify(l.after)} → ${JSON.stringify(l.before)}  (${l.reason})`);
    }
    const refused = lines.filter(l => l.action === "refuse").length;
    console.log(`\n================ ROLLBACK SUMMARY ================`);
    console.log(`  rows=${lines.length} refused=${refused} restorable=${lines.length - refused}`);
    console.log(`\nMODE: ${dryRun ? "PREVIEW — nothing changed." : "APPLIED — restores committed per-row and audited."} No estimates/invoices/cursor touched.`);
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
