/**
 * qbo-list-customer-estimates.ts — READ-ONLY QBO estimate lister for one customer.
 *
 * Enumerates every QBO Estimate whose CustomerRef == the given QBO customer id,
 * using the SAME provider (token refresh, HTTP, minor version) the sync uses, and
 * cross-checks each against quickbooksSalesDocuments so you can see which are
 * already imported vs missing. Performs NO application writes. (The provider may
 * refresh its OAuth access token — its normal, required behaviour — which is not
 * application data.)
 *
 * All identifiers are supplied as CLI arguments; nothing is hardcoded.
 *
 * Usage:
 *   railway run --service=<service> --environment=<env> \
 *     npx tsx server/scripts/qbo-list-customer-estimates.ts --qbCustomer <qboCustomerId>
 */
import { getDb } from "../db";
import { quickbooksProvider } from "../integrations/accounting/quickbooks";
import { buildCustomerEstimateQuery } from "../integrations/accounting/estimates";
import { quickbooksSalesDocuments } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";

const argv = process.argv.slice(2);
const val = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const qbCustomerId = val("--qbCustomer");
if (!qbCustomerId) {
  console.error("Missing required --qbCustomer <qboCustomerId>");
  process.exit(1);
}

async function main() {
  const conn = await quickbooksProvider.getConnection();
  console.log(
    JSON.stringify({
      step: "connection",
      realmId: conn?.realmId ?? null,
      companyName: conn?.companyName ?? null,
      status: conn?.status ?? null,
      salesDocCursor: conn?.salesDocCursor ?? null,
    }),
  );

  // Confirm the exact QBO customer record.
  const customer = await quickbooksProvider.fetchQboCustomer(qbCustomerId as string);
  console.log(
    JSON.stringify({
      step: "qboCustomer",
      Id: customer?.Id ?? null,
      DisplayName: customer?.DisplayName ?? null,
      CompanyName: customer?.CompanyName ?? null,
      email: customer?.PrimaryEmailAddr?.Address ?? null,
      Active: customer?.Active ?? null,
    }),
  );

  // Page through every estimate for this customer (same query builder the resync uses).
  const PAGE = 100;
  const all: Array<Record<string, unknown>> = [];
  for (let page = 0; page < 50; page++) {
    const q = buildCustomerEstimateQuery({ quickbooksCustomerId: qbCustomerId as string, startPosition: page * PAGE + 1, pageSize: PAGE });
    const batch = await quickbooksProvider.fetchEstimates(q);
    all.push(...(batch as Array<Record<string, unknown>>));
    if (batch.length < PAGE) break;
  }

  const db = await getDb();
  console.log(JSON.stringify({ step: "summary", totalEstimatesReturned: all.length }));
  for (const e of all) {
    const meta = (e.MetaData ?? {}) as { CreateTime?: string; LastUpdatedTime?: string };
    const cref = (e.CustomerRef ?? {}) as { value?: string; name?: string };
    let inDb: { id: number; customerId: number | null; opportunityId: number | null } | null = null;
    if (db && conn?.realmId) {
      const row = (
        await db
          .select({
            id: quickbooksSalesDocuments.id,
            customerId: quickbooksSalesDocuments.customerId,
            opportunityId: quickbooksSalesDocuments.opportunityId,
          })
          .from(quickbooksSalesDocuments)
          .where(
            and(
              eq(quickbooksSalesDocuments.realmId, conn.realmId),
              eq(quickbooksSalesDocuments.docType, "estimate"),
              eq(quickbooksSalesDocuments.quickbooksId, String(e.Id)),
            ),
          )
          .limit(1)
      )[0];
      inDb = row ?? null;
    }
    console.log(
      JSON.stringify({
        step: "estimate",
        Id: e.Id,
        DocNumber: e.DocNumber ?? null,
        TxnStatus: e.TxnStatus ?? null,
        EmailStatus: e.EmailStatus ?? null,
        TotalAmt: e.TotalAmt ?? null,
        TxnDate: e.TxnDate ?? null,
        LastUpdatedTime: meta.LastUpdatedTime ?? null,
        CustomerRef: cref,
        alreadyInDb: inDb ? { salesDocId: inDb.id, customerId: inDb.customerId, opportunityId: inDb.opportunityId } : null,
      }),
    );
  }
  console.log(JSON.stringify({ step: "done" }));
  process.exit(0);
}

main().catch(e => {
  console.error("ERROR", (e as Error)?.message ?? e);
  process.exit(1);
});
