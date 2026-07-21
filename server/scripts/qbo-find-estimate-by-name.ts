/**
 * qbo-find-estimate-by-name.ts — READ-ONLY. Locate the QBO customer + estimate
 * for a person/business when the expected CustomerRef has no estimates. Searches
 * QBO customers by DisplayName LIKE (one or more --name terms) and, optionally,
 * by email (in-memory match over active/inactive customers), then lists every
 * Estimate for each candidate customer id. Performs NO writes (uses the QBO
 * /query endpoint, which is SELECT-only).
 *
 * All search terms are supplied as CLI arguments; nothing is hardcoded.
 *
 * Usage:
 *   railway run --service=<service> --environment=<env> \
 *     npx tsx server/scripts/qbo-find-estimate-by-name.ts --name <term> [--name <term> ...] [--email <address>]
 */
import { quickbooksProvider, escapeQboLiteral } from "../integrations/accounting/quickbooks";

const argv = process.argv.slice(2);
const collect = (f: string) => argv.reduce<string[]>((a, cur, i) => (argv[i - 1] === f ? [...a, cur] : a), []);
const names = collect("--name");
const emails = collect("--email").map(e => e.toLowerCase());

if (names.length === 0 && emails.length === 0) {
  console.error("Provide at least one --name <term> and/or --email <address>");
  process.exit(1);
}

type QboCustomerRow = {
  Id: string;
  DisplayName?: string;
  CompanyName?: string | null;
  Active?: boolean;
  Job?: boolean;
  ParentRef?: { value?: string } | null;
  PrimaryEmailAddr?: { Address?: string };
};

async function main() {
  const candidates = new Map<string, QboCustomerRow>();

  for (const n of names) {
    const j = await quickbooksProvider.runReadOnlyQuery(`SELECT * FROM Customer WHERE DisplayName LIKE '%${escapeQboLiteral(n)}%'`);
    for (const c of ((j.QueryResponse?.Customer as QboCustomerRow[]) ?? [])) candidates.set(c.Id, c);
  }
  // Email isn't reliably filterable in QBO's query language → pull a page and match in memory.
  if (emails.length) {
    const j = await quickbooksProvider.runReadOnlyQuery("SELECT * FROM Customer WHERE Active IN (true,false) MAXRESULTS 1000");
    for (const c of ((j.QueryResponse?.Customer as QboCustomerRow[]) ?? [])) {
      const addr = (c.PrimaryEmailAddr?.Address ?? "").toLowerCase();
      if (addr && emails.includes(addr)) candidates.set(c.Id, c);
    }
  }

  console.log(JSON.stringify({ step: "candidateCount", n: candidates.size }));
  for (const c of Array.from(candidates.values())) {
    console.log(
      JSON.stringify({
        step: "candidate",
        Id: c.Id,
        DisplayName: c.DisplayName,
        CompanyName: c.CompanyName ?? null,
        email: c.PrimaryEmailAddr?.Address ?? null,
        Active: c.Active,
        Job: c.Job ?? null,
        ParentRef: c.ParentRef ?? null,
      }),
    );
    const ests = await quickbooksProvider.fetchEstimates(
      `SELECT * FROM Estimate WHERE CustomerRef = '${escapeQboLiteral(c.Id)}' ORDERBY MetaData.LastUpdatedTime`,
    );
    console.log(JSON.stringify({ step: "candidateEstimates", customerId: c.Id, count: ests.length }));
    for (const e of ests) {
      console.log(
        JSON.stringify({
          step: "estimate",
          customerId: c.Id,
          Id: e.Id,
          DocNumber: e.DocNumber ?? null,
          TxnStatus: e.TxnStatus ?? null,
          EmailStatus: e.EmailStatus ?? null,
          TotalAmt: e.TotalAmt ?? null,
          TxnDate: e.TxnDate ?? null,
          LastUpdatedTime: e.MetaData?.LastUpdatedTime ?? null,
          CustomerRef: e.CustomerRef ?? null,
          BillEmail: e.BillEmail?.Address ?? null,
        }),
      );
    }
  }
  console.log(JSON.stringify({ step: "done" }));
  process.exit(0);
}
main().catch(e => {
  console.error("ERROR", (e as Error)?.message ?? e);
  process.exit(1);
});
