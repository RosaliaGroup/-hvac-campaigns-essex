/**
 * qbo-scan-recent-estimates.ts — READ-ONLY. Pull every Estimate with TxnDate >=
 * --since and report any whose BillEmail or CustomerRef.name matches one of the
 * supplied --needle terms. Also prints the newest few by LastUpdatedTime for
 * situational awareness. Performs NO writes (uses the SELECT-only /query path).
 *
 * All values are supplied as CLI arguments; nothing is hardcoded.
 *
 * Usage:
 *   railway run --service=<service> --environment=<env> \
 *     npx tsx server/scripts/qbo-scan-recent-estimates.ts --since <YYYY-MM-DD> --needle <term> [--needle <term> ...]
 */
import { quickbooksProvider } from "../integrations/accounting/quickbooks";
import { buildEstimateQuery } from "../integrations/accounting/estimates";

const argv = process.argv.slice(2);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const collect = (f: string) => argv.reduce<string[]>((a, cur, i) => (argv[i - 1] === f ? [...a, cur.toLowerCase()] : a), []);

const since = val("--since");
const needles = collect("--needle");
if (!since || needles.length === 0) {
  console.error("Usage: --since <YYYY-MM-DD> --needle <term> [--needle <term> ...]");
  process.exit(1);
}
const sinceMs = new Date(`${since}T00:00:00Z`).getTime();
if (Number.isNaN(sinceMs)) {
  console.error("--since must be a valid YYYY-MM-DD date");
  process.exit(1);
}
const sinceDays = Math.ceil((Date.now() - sinceMs) / 86_400_000);

async function main() {
  const PAGE = 100;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    // Reuse the SAME query builder the sync uses (backfill shape: TxnDate >= since).
    const q = buildEstimateQuery({ cursor: null, sinceDays, startPosition: page * PAGE + 1, pageSize: PAGE });
    const batch = await quickbooksProvider.fetchEstimates(q);
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  console.log(JSON.stringify({ step: "scanned", since, sinceDays, totalEstimates: all.length }));

  const hit = (s: string | undefined | null) => {
    const v = (s ?? "").toLowerCase();
    return needles.some(n => v.includes(n));
  };
  const matches = all.filter(e => hit(e.BillEmail?.Address) || hit(e.CustomerRef?.name));
  console.log(JSON.stringify({ step: "needleMatches", needles, count: matches.length }));
  for (const e of matches) {
    console.log(JSON.stringify({
      step: "match", Id: e.Id, DocNumber: e.DocNumber, TxnStatus: e.TxnStatus, TotalAmt: e.TotalAmt,
      TxnDate: e.TxnDate, LastUpdatedTime: e.MetaData?.LastUpdatedTime, CustomerRef: e.CustomerRef, BillEmail: e.BillEmail?.Address ?? null,
    }));
  }
  // Newest few for awareness.
  const newest = [...all].sort((a, b) => String(b.MetaData?.LastUpdatedTime).localeCompare(String(a.MetaData?.LastUpdatedTime))).slice(0, 5);
  for (const e of newest) {
    console.log(JSON.stringify({ step: "newest", Id: e.Id, DocNumber: e.DocNumber, CustomerRef: e.CustomerRef?.name, LastUpdatedTime: e.MetaData?.LastUpdatedTime, TxnDate: e.TxnDate }));
  }
  console.log(JSON.stringify({ step: "done" }));
  process.exit(0);
}
main().catch(e => { console.error("ERROR", (e as Error)?.message ?? e); process.exit(1); });
