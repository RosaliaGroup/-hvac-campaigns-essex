/**
 * One-time manual production migration runner for 0081_crm_communications.sql.
 *
 * Safety:
 * - refuses if either target table already exists
 * - executes only the embedded, reviewed 0081 SQL
 * - never invokes drizzle-kit / migration journal
 * - validates tables and indexes after execution
 *
 * Run explicitly: pnpm exec tsx server/scripts/apply0081CrmCommunications.ts
 */
import { createDedicatedConnection } from "../db";

const MIGRATION_SQL = "-- Unified CRM communications: Gmail + SMS/contact timeline.\n-- Additive only. External adapters (ChatGPT/Gmail/Telnyx) can upsert contacts\n-- and append messages without replacing the existing SMS inbox.\nCREATE TABLE IF NOT EXISTS `crmExternalContacts` (\n  `id` int AUTO_INCREMENT NOT NULL,\n  `customerId` int,\n  `leadId` int,\n  `leadCaptureId` int,\n  `name` varchar(255) NOT NULL,\n  `company` varchar(255),\n  `title` varchar(255),\n  `email` varchar(320),\n  `phone` varchar(50),\n  `propertyName` varchar(255),\n  `source` varchar(100),\n  `notes` text,\n  `createdAt` timestamp NOT NULL DEFAULT (now()),\n  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,\n  CONSTRAINT `crmExternalContacts_id` PRIMARY KEY(`id`),\n  KEY `crmExternalContacts_email_idx` (`email`),\n  KEY `crmExternalContacts_phone_idx` (`phone`),\n  KEY `crmExternalContacts_customer_idx` (`customerId`),\n  KEY `crmExternalContacts_lead_idx` (`leadId`)\n);\n\nCREATE TABLE IF NOT EXISTS `crmCommunications` (\n  `id` int AUTO_INCREMENT NOT NULL,\n  `externalContactId` int,\n  `customerId` int,\n  `leadId` int,\n  `channel` enum('email','sms','call') NOT NULL,\n  `direction` enum('inbound','outbound') NOT NULL,\n  `provider` varchar(30) NOT NULL,\n  `providerMessageId` varchar(255),\n  `providerThreadId` varchar(255),\n  `fromAddress` varchar(320),\n  `toAddress` varchar(320),\n  `subject` varchar(500),\n  `body` text,\n  `status` varchar(50),\n  `occurredAt` timestamp NOT NULL DEFAULT (now()),\n  `createdAt` timestamp NOT NULL DEFAULT (now()),\n  CONSTRAINT `crmCommunications_id` PRIMARY KEY(`id`),\n  UNIQUE KEY `crmCommunications_provider_message_uq` (`provider`,`providerMessageId`),\n  KEY `crmCommunications_contact_idx` (`externalContactId`,`occurredAt`),\n  KEY `crmCommunications_customer_idx` (`customerId`,`occurredAt`),\n  KEY `crmCommunications_lead_idx` (`leadId`,`occurredAt`),\n  KEY `crmCommunications_thread_idx` (`providerThreadId`)\n);\n";
const TARGETS = ["crmExternalContacts", "crmCommunications"] as const;

async function main() {
  const conn = await createDedicatedConnection();
  try {
    const [before] = await conn.query<any[]>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (?, ?)
       ORDER BY TABLE_NAME`,
      TARGETS,
    );
    if (before.length) {
      throw new Error(`REFUSING: target table(s) already exist: ${before.map(r => r.TABLE_NAME).join(", ")}`);
    }

    // mysql2 requires multipleStatements for a two-statement migration, so split
    // only at the known top-level delimiter between the two reviewed CREATEs.
    const statements = MIGRATION_SQL
      .split(/;\s*(?=CREATE TABLE IF NOT EXISTS)/i)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.endsWith(";") ? s.slice(0, -1) : s);

    if (statements.length !== 2 || statements.some(s => !/^CREATE TABLE IF NOT EXISTS/i.test(s.replace(/^--[^\n]*\n(?:--[^\n]*\n)*/g, "").trim()))) {
      throw new Error(`REFUSING: expected exactly two CREATE TABLE IF NOT EXISTS statements; got ${statements.length}`);
    }

    for (const statement of statements) await conn.query(statement);

    const [after] = await conn.query<any[]>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (?, ?)
       ORDER BY TABLE_NAME`,
      TARGETS,
    );
    if (after.length !== 2) throw new Error("Migration executed but target table verification failed");

    for (const table of TARGETS) {
      const [createRows] = await conn.query<any[]>(`SHOW CREATE TABLE \`${table}\``);
      const [indexes] = await conn.query<any[]>(`SHOW INDEX FROM \`${table}\``);
      const [countRows] = await conn.query<any[]>(`SELECT COUNT(*) AS rowCount FROM \`${table}\``);
      console.log(JSON.stringify({
        table,
        createTable: createRows[0]?.["Create Table"],
        indexes: indexes.map(r => ({ key: r.Key_name, unique: r.Non_unique === 0, columns: r.Column_name, seq: r.Seq_in_index })),
        rowCount: countRows[0]?.rowCount,
      }, null, 2));
    }
    console.log("0081 CRM communications migration applied and verified.");
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
