/** Exact-address outreach suppression shared by CRM Gmail, follow-ups and send paths.
 * Never infer opt-in from an email reply; an opt-out blocks all marketing contact.
 */
import { and, eq, or, sql } from "drizzle-orm";
import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { getDb } from "../db";
import { crmExternalContacts, customers, smsContacts } from "../../drizzle/schema";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type SuppressionReason = "opt_out" | "hard_bounce";

export const KNOWN_OUTREACH_SUPPRESSIONS: ReadonlyArray<{ email: string; reason: SuppressionReason; messageId?: string }> = [
  { email: "dmcconnell@cresa.com", reason: "opt_out", messageId: "1a1224bb5f44aaa7" },
  { email: "jfuller@onyxequities.com", reason: "hard_bounce" },
  { email: "ksaliba@onyxequities.com", reason: "hard_bounce" },
  { email: "leasing@jwelizabeth.com", reason: "hard_bounce" },
  { email: "nat.gambuzza@cbre.com", reason: "hard_bounce" },
  { email: "mals@libertyrealty.com", reason: "hard_bounce" },
  { email: "rzimmerman@libertyrealty.com", reason: "hard_bounce" },
  { email: "contact@baldwinequities.com", reason: "hard_bounce" },
  { email: "info@mjbdevelopment.com", reason: "hard_bounce" },
  { email: "admin@jsbresidences.com", reason: "hard_bounce" },
  { email: "steve.trivedi@cushwake.com", reason: "hard_bounce" },
  { email: "jhunter@hunterhomesnj.com", reason: "hard_bounce" },
  { email: "esangeorge@integramgtcorp.com", reason: "hard_bounce" },
];

export const GMAIL_SUPPRESSION_LABEL_NAMES = new Set([
  "Outreach/Do Not Contact - Opt Out",
  "Outreach/Failed - Do Not Resend",
  "Prospecting - Failed Delivery",
  "HVAC Bounce Processed",
  "Do Not Contact",
  "Unsubscribed",
]);

const known = new Set(KNOWN_OUTREACH_SUPPRESSIONS.map(row => row.email));
// Both numbers are present in Dennis McConnell\'s verified opt-out reply signature.
const knownDoNotContactPhones = new Set(["2019924007", "9082950300"]);
const phone10 = (phone: string) => phone.replace(/\D/g, "").slice(-10);
const normalize = (email: string) => email.trim().toLowerCase();
export function isKnownOutreachSuppression(email: string) {
  return known.has(normalize(email));
}
export function isExplicitOutreachOptOut(body: string | null, subject = "") {
  // Only consider the author's own reply, not quoted earlier correspondence.
  const first = (body ?? "").split(/\n(?:On .{0,180} wrote:|From:|>)/i)[0].slice(0, 2000);
  return /\b(please\s+remove\s+me\s+from\s+your\s+(?:mailing\s+)?list|remove\s+me\s+from\s+your\s+list|do\s+not\s+(?:contact|email)\s+me|stop\s+(?:emailing|contacting)\s+me|unsubscribe\s+me)\b/i.test(first + "\n" + subject);
}

export const crmOutreachSuppressions = mysqlTable("crmOutreachSuppressions", {
  email: varchar("email", { length: 320 }).primaryKey(),
  reason: varchar("reason", { length: 30 }).notNull(),
  sourceMessageId: varchar("sourceMessageId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

let tableReady: Promise<unknown> | undefined;
async function ensureStore(db: Db) {
  tableReady ??= db.execute(sql`
    CREATE TABLE IF NOT EXISTS crmOutreachSuppressions (
      email varchar(320) NOT NULL PRIMARY KEY,
      reason varchar(30) NOT NULL,
      sourceMessageId varchar(255) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).catch(error => { tableReady = undefined; throw error; });
  await tableReady;
}

export async function recordOutreachSuppression(
  db: Db, address: string, reason: SuppressionReason, sourceMessageId?: string,
) {
  const email = normalize(address);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid suppression email");
  await ensureStore(db);
  await db.execute(sql`
    INSERT INTO crmOutreachSuppressions (email, reason, sourceMessageId)
    VALUES (${email}, ${reason}, ${sourceMessageId ?? null})
    ON DUPLICATE KEY UPDATE
      reason = IF(VALUES(reason) = 'opt_out', 'opt_out', reason),
      sourceMessageId = IF(VALUES(reason) = 'opt_out', VALUES(sourceMessageId), sourceMessageId)
  `);
  const [stored] = await db.select().from(crmOutreachSuppressions)
    .where(eq(crmOutreachSuppressions.email, email)).limit(1);
  if (!stored || (reason === "opt_out" && stored.reason !== "opt_out"))
    throw new Error("CRM do-not-contact suppression readback failed");
  return stored;
}

let seeded: Promise<number> | undefined;
export async function seedKnownOutreachSuppressions(db: Db) {
  seeded ??= (async () => {
    for (const row of KNOWN_OUTREACH_SUPPRESSIONS)
      await recordOutreachSuppression(db, row.email, row.reason, row.messageId);
    return KNOWN_OUTREACH_SUPPRESSIONS.length;
  })().catch(error => { seeded = undefined; throw error; });
  return seeded;
}

export async function isOutreachSuppressed(db: Db, address: string) {
  const email = normalize(address);
  if (known.has(email)) return true; // fail closed even before database seeding
  await ensureStore(db);
  const [stored] = await db.select({ email: crmOutreachSuppressions.email })
    .from(crmOutreachSuppressions).where(eq(crmOutreachSuppressions.email, email)).limit(1);
  return Boolean(stored);
}

/** A verified opt-out follows a contact across their saved mobile and work number.
 * This guard also protects phone-only SMS sends, not merely email-linked sends.
 */
export async function isSmsRecipientSuppressed(db: Db, phone: string) {
  const last = phone10(phone);
  if (last.length !== 10) return true; // do not send to unverified numbers
  if (knownDoNotContactPhones.has(last)) return true;
  const [external, customer, smsContact] = await Promise.all([
    db.select({ email: crmExternalContacts.email }).from(crmExternalContacts)
      .where(sql`RIGHT(REGEXP_REPLACE(${crmExternalContacts.phone}, '[^0-9]', ''), 10) = ${last}`).limit(25),
    db.select({ email: customers.email }).from(customers)
      .where(or(
        sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${last}`,
        sql`RIGHT(REGEXP_REPLACE(${customers.altPhone}, '[^0-9]', ''), 10) = ${last}`,
      )).limit(25),
    db.select({ email: smsContacts.email }).from(smsContacts)
      .where(sql`RIGHT(REGEXP_REPLACE(${smsContacts.phone}, '[^0-9]', ''), 10) = ${last}`).limit(25),
  ]);
  for (const record of [...external, ...customer, ...smsContact]) {
    if (record.email && await isOutreachSuppressed(db, record.email)) return true;
  }
  return false;
}

export async function assertOutreachNotSuppressed(db: Db, address: string) {
  if (await isOutreachSuppressed(db, address))
    throw new Error("Recipient is on the CRM outreach do-not-contact/suppression list.");
}
