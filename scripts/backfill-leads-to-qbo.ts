/**
 * backfill-leads-to-qbo.ts — one-off backfill of EXISTING leads into QuickBooks
 * customers, mirroring the live lead→QBO auto-sync policy (every lead becomes a
 * QB customer, auto-LINKED on any phone/email/name match, NEVER duplicated).
 *
 * Two lead sources are swept: the `leads` table (Lead Tracker / phone|email) and
 * the `leadCaptures` table (public forms incl. Quick Quote, and the Meta Lead-Ads
 * webhook). Each candidate is resolved-or-created into a CRM customer and then
 * pushed with resolution="link" — exactly what `runLeadCustomerSync` does at
 * capture time. Execution reuses that same worker, so behaviour is identical.
 *
 * DRY-RUN IS THE DEFAULT. It performs ONLY read-only QBO queries (findMatches) to
 * predict, per lead, whether the push would LINK to an existing QBO customer or
 * CREATE a new one, and whether the CRM side would CONVERT (new customer) or PUSH
 * an existing unsynced customer. It writes NOTHING.
 *
 * A real run requires BOTH `--execute` and `--yes-write-live-qbo` (this repo's
 * QUICKBOOKS_ENVIRONMENT is production — writes hit the live company). It is
 * sequential with a modest delay so we never hammer the QBO API.
 *
 * Usage (read-only report):
 *   railway run --service=<svc> --environment=production \
 *     npx tsx scripts/backfill-leads-to-qbo.ts [--source all|leads|captures] [--limit N]
 *
 * Usage (live write, after the report is approved):
 *   railway run --service=<svc> --environment=production \
 *     npx tsx scripts/backfill-leads-to-qbo.ts --execute --yes-write-live-qbo [--limit N] [--delay 400]
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { leads, leadCaptures, customers } from "../drizzle/schema";
import { findExistingCustomer, buildDisplayName, splitName } from "../server/routers/customers";
import { buildCustomerInput } from "../server/routers/quickbooks";
import { quickbooksProvider, pickMergeMatch } from "../server/integrations/accounting/quickbooks";
import { runLeadCustomerSync } from "../server/services/leadCustomerAutoSync";
import { isLeadPushable } from "../shared/leadQuality";
import type { AccountingCustomerInput } from "../server/integrations/accounting/types";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const EXECUTE = has("--execute");
const ACK = has("--yes-write-live-qbo");
const SOURCE = (val("--source") ?? "all").toLowerCase(); // all | leads | captures
const LIMIT = Number(val("--limit") ?? "0") || 0;        // 0 = no limit
const DELAY = Number(val("--delay") ?? "400") || 400;    // ms between records

if (EXECUTE && !ACK) {
  console.error("REFUSED: --execute writes to LIVE production QuickBooks. Re-run with --execute --yes-write-live-qbo once the dry-run report is approved.");
  process.exit(2);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const last10 = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);

interface Candidate {
  origin: string;               // e.g. "leads#12" / "leadCaptures#34"
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string;               // marketing source stamped on a new customer
  syncOrigin: string;           // origin label passed to the worker
  linkedCustomerId: number | null; // lead.customerId if already converted
}

/** Build a synthetic AccountingCustomerInput for a lead that has no CRM customer yet. */
function syntheticInput(c: Candidate): AccountingCustomerInput {
  const named = c.firstName || c.lastName ? { firstName: c.firstName, lastName: c.lastName } : splitName(c.name);
  const displayName = buildDisplayName({ firstName: named.firstName, lastName: named.lastName, email: c.email, phone: c.phone });
  return {
    localId: 0,
    existingRemoteId: null,
    type: "residential",
    displayName,
    firstName: named.firstName,
    lastName: named.lastName,
    companyName: null,
    email: c.email,
    phone: c.phone,
    notes: null,
    address: null,
  };
}

async function collectCandidates(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<Candidate[]> {
  const out: Candidate[] = [];
  if (SOURCE === "all" || SOURCE === "leads") {
    const rows = await db.select().from(leads).orderBy(asc(leads.id));
    for (const l of rows) {
      out.push({
        origin: `leads#${l.id}`,
        name: l.name ?? null,
        firstName: null,
        lastName: null,
        email: l.contactType === "email" ? l.contact : null,
        phone: l.contactType === "phone" ? l.contact : null,
        source: `lead:${l.source}`,
        syncOrigin: `backfill:leads#${l.id}`,
        linkedCustomerId: l.customerId ?? null,
      });
    }
  }
  if (SOURCE === "all" || SOURCE === "captures") {
    const rows = await db.select().from(leadCaptures).orderBy(asc(leadCaptures.id));
    for (const c of rows) {
      out.push({
        origin: `leadCaptures#${c.id}`,
        name: c.name ?? null,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        source: `web:${c.captureType}`,
        syncOrigin: `backfill:leadCaptures#${c.id}`,
        linkedCustomerId: c.customerId ?? null,
      });
    }
  }
  return LIMIT ? out.slice(0, LIMIT) : out;
}

async function main() {
  const db = await getDb();
  if (!db) { console.error("REFUSED: database unavailable."); process.exit(2); }

  const conn = await quickbooksProvider.getConnection().catch(() => null);
  const connected = !!conn && conn.status === "connected";
  console.log(JSON.stringify({ step: "start", mode: EXECUTE ? "EXECUTE (LIVE QBO WRITES)" : "DRY-RUN (read-only)", source: SOURCE, limit: LIMIT || "none", qboConnected: connected, realmId: conn?.realmId ?? null }));
  if (!connected) console.log("WARNING: QuickBooks is not connected — pushes would be skipped (customers left unsynced), and link-vs-create cannot be predicted.");

  const candidates = await collectCandidates(db);

  const seen = new Set<string>();
  const tally = { total: candidates.length, skippedQuality: 0, alreadySynced: 0, dedupe: 0, convert: 0, pushExisting: 0, link: 0, createInQbo: 0, executed: 0, execErrors: 0 };
  const skippedByRule: Record<string, number> = {};
  const skippedList: Array<{ origin: string; rule: string; reason: string; name: string | null }> = [];

  for (const c of candidates) {
    const phone = c.phone?.trim() || null;
    const email = c.email?.trim() || null;

    // Quality gate — the SAME isLeadPushable used by the live auto-push path, so this
    // dry-run predicts exactly what the live path will (and won't) push.
    const gate = isLeadPushable({ name: c.name, firstName: c.firstName, lastName: c.lastName, email, phone });
    if (!gate.pushable) {
      tally.skippedQuality++;
      skippedByRule[gate.rule!] = (skippedByRule[gate.rule!] ?? 0) + 1;
      skippedList.push({ origin: c.origin, rule: gate.rule!, reason: gate.reason ?? "", name: c.name });
      console.log(`SKIPQ ${c.origin} [${gate.rule}] "${c.name ?? "(no name)"}" — ${gate.reason}`);
      continue;
    }

    const key = last10(phone) || `e:${email!.toLowerCase()}`;
    if (seen.has(key)) { tally.dedupe++; console.log(`DEDUPE ${c.origin} — same contact as an earlier lead (${key})`); continue; }
    seen.add(key);

    // Resolve the CRM customer: prefer an explicit lead→customer link, else dedupe by phone/email.
    const existing = c.linkedCustomerId
      ? (await db.select().from(customers).where(eq(customers.id, c.linkedCustomerId)).limit(1))[0] ?? null
      : await findExistingCustomer(db, phone, email);

    if (existing?.quickbooksCustomerId) { tally.alreadySynced++; console.log(`SKIP  ${c.origin} — CRM customer #${existing.id} already synced (qb ${existing.quickbooksCustomerId})`); continue; }

    const crmAction = existing ? "push-existing" : "convert";
    if (existing) tally.pushExisting++; else tally.convert++;

    // Predict link-vs-create against LIVE QBO (read-only).
    let qboAction = "create-in-qbo";
    let matchNote = "";
    if (connected) {
      const input = existing ? buildCustomerInput(existing) : syntheticInput(c);
      try {
        const match = pickMergeMatch(input, await quickbooksProvider.findMatches(input));
        if (match) { qboAction = "link"; matchNote = ` → qb #${match.candidate.Id} (by ${match.matchedBy})`; }
      } catch (e) {
        matchNote = ` (match probe failed: ${(e as Error).message})`;
      }
    }
    if (qboAction === "link") tally.link++; else tally.createInQbo++;

    console.log(`${EXECUTE ? "PUSH " : "WOULD"} ${c.origin} "${c.name ?? "(no name)"}" phone=${phone ?? "-"} email=${email ?? "-"} | CRM:${crmAction} | QBO:${qboAction}${matchNote}`);

    if (EXECUTE) {
      try {
        await runLeadCustomerSync({ name: c.name, firstName: c.firstName, lastName: c.lastName, email, phone, source: c.source, origin: c.syncOrigin });
        tally.executed++;
      } catch (e) {
        tally.execErrors++;
        console.error(`  ERROR ${c.origin}: ${(e as Error).message}`);
      }
      if (DELAY) await sleep(DELAY);
    }
  }

  console.log(JSON.stringify({ step: "summary", ...tally }, null, 2));
  if (!EXECUTE) console.log("Dry-run only — nothing written. Re-run with --execute --yes-write-live-qbo to apply.");
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
