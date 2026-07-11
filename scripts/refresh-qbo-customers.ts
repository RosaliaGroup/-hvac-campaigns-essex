/**
 * refresh-qbo-customers.ts — standalone QBO customer refresh CLI.
 *
 * Fetches the QBO Customer for explicitly listed CRM ids and fills EMPTY CRM
 * fields only. It NEVER touches estimates, invoices, the sales-doc cursor, or
 * lastQboSyncAt — that isolation is enforced by refreshCustomers() in
 * server/integrations/accounting/qboCustomerRefresh.ts.
 *
 * Dry-run by default. A real write requires --apply --prod-write-ack.
 *
 * Usage:
 *   pnpm exec tsx scripts/refresh-qbo-customers.ts --ids 7,8,10 [--max 25]
 *   pnpm exec tsx scripts/refresh-qbo-customers.ts --ids 7 --apply --prod-write-ack --run-id r1
 *
 * `--allow-composite` is the reviewed-repair escape hatch and is OFF by default,
 * so a raw composite DisplayName is never copied onto a clean CRM name.
 */
import { refreshCustomers, type QboCustomerLite } from "../server/integrations/accounting/qboCustomerRefresh";
import { connect, makeRefreshPort } from "./qboRepairDb";
import { quickbooksProvider } from "../server/integrations/accounting/quickbooks";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const idsRaw = val("--ids");
if (!idsRaw) { console.error("REFUSED: pass --ids <comma-separated CRM customer ids>."); process.exit(2); }
const ids = idsRaw.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n));
if (!ids.length) { console.error("REFUSED: --ids parsed to zero valid ids."); process.exit(2); }

const maxBatch = Number(val("--max") ?? "25");
const allowComposite = has("--allow-composite");
const write = has("--apply") && has("--prod-write-ack");
if (has("--apply") && !has("--prod-write-ack")) { console.error("REFUSED: --apply requires --prod-write-ack."); process.exit(2); }
const runId = val("--run-id") ?? `refresh-${ids.join("-")}`;
const dryRun = !write;

async function main() {
  const conn = await connect();
  const port = makeRefreshPort(conn);
  const fetchQbo = (qboId: string) => quickbooksProvider.fetchQboCustomer(qboId) as Promise<QboCustomerLite | null>;
  try {
    console.log(`REFRESH — ids=[${ids.join(",")}] runId=${runId} mode=${dryRun ? "DRY-RUN" : "WRITE"} allowComposite=${allowComposite}\n`);
    const summary = await refreshCustomers(port, fetchQbo, ids, { runId, dryRun, maxBatch, allowComposite });
    for (const r of summary.results) {
      console.log(`  CRM #${r.customerId}  QBO ${r.quickbooksCustomerId ?? "-"}  ${r.status.toUpperCase()}  ${r.reason}  [${r.changedFields.join(",") || "-"}]`);
    }
    console.log(`\n================ REFRESH TOTALS ================`);
    console.log(`  requested=${summary.requested} fetched=${summary.fetched} changed=${summary.changed} unchanged=${summary.unchanged} skipped=${summary.skipped} conflicts=${summary.conflicts} failures=${summary.failures}`);
    console.log(`\nMODE: ${dryRun ? "DRY-RUN — no rows modified." : "WRITE — empty fields filled; checkedAt/updatedAt set."} No estimates/invoices/cursor touched.`);
  } finally {
    await conn.end();
  }
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
