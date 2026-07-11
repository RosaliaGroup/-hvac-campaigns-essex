/**
 * mysql2-backed adapters that satisfy the injectable ports in
 * server/integrations/accounting/qboRepairCore.ts and qboCustomerRefresh.ts.
 *
 * This is the ONLY layer that touches a real database. The safety logic lives in
 * the core modules and is exercised by unit tests with in-memory ports; these
 * adapters are thin translations to SQL. Nothing here is invoked unless a CLI
 * explicitly wires it with the required production-write acknowledgement flags.
 */
import fs from "node:fs";
import mysql from "mysql2/promise";
import type { RepairPort, RollbackPort, RepairCustomerRow, AuditRow } from "../server/integrations/accounting/qboRepairCore";
import type { RefreshPort, RefreshCustomerRow } from "../server/integrations/accounting/qboCustomerRefresh";
import type { CustomerIdentity, PropertyRow } from "../shared/qboCustomerRepair";

export function envDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Fallback to a local .env in the working directory only; no user-specific paths.
  try { const m = fs.readFileSync(".env", "utf8").match(/DATABASE_URL=(.+)/); if (m) return m[1].trim(); } catch { /* ignore */ }
  throw new Error("DATABASE_URL not set (export it or provide a .env in the working directory)");
}

export async function connect(): Promise<mysql.Connection> {
  return mysql.createConnection({ uri: envDatabaseUrl(), timezone: "Z", multipleStatements: false });
}

const q = async (c: mysql.Connection, s: string, p: unknown[] = []) => (await c.query(s, p))[0] as Record<string, unknown>[];

async function readCustomer(c: mysql.Connection, id: number): Promise<RepairCustomerRow | null> {
  const rows = await q(c, `SELECT id, displayName, firstName, lastName, companyName, email, phone, altPhone, quickbooksCustomerId FROM customers WHERE id = ?`, [id]);
  const r = rows[0];
  return r ? (r as unknown as RepairCustomerRow) : null;
}

export function makeRepairPort(c: mysql.Connection): RepairPort {
  return {
    getCustomer: id => readCustomer(c, id),
    getAllIdentities: async () => (await q(c, `SELECT id, quickbooksCustomerId, email, phone, altPhone, displayName, companyName FROM customers WHERE quickbooksCustomerId IS NOT NULL`)) as unknown as CustomerIdentity[],
    getPropertiesForCustomer: async customerId => (await q(c, `SELECT id, customerId, addressLine1, city, zip FROM properties WHERE customerId = ?`, [customerId])) as unknown as PropertyRow[],
    getOpportunityIdsForCustomer: async customerId => (await q(c, `SELECT id FROM opportunities WHERE customerId = ?`, [customerId])).map(r => r.id as number),
    updateCustomerFields: async (id, patch) => {
      const keys = Object.keys(patch); if (!keys.length) return;
      await c.query(`UPDATE customers SET ${keys.map(k => `\`${k}\` = ?`).join(", ")} WHERE id = ?`, [...keys.map(k => patch[k]), id]);
    },
    createProperty: async row => {
      const res = (await c.query(
        `INSERT INTO properties (customerId, addressLine1, addressLine2, city, state, zip, propertyType, systemNotes) VALUES (?,?,?,?,?,?,?,?)`,
        [row.customerId, row.addressLine1, row.addressLine2, row.city, row.state ?? "NJ", row.zip, row.propertyType, row.systemNotes],
      ))[0] as mysql.ResultSetHeader;
      return res.insertId;
    },
    setOpportunityProjectReference: async (opportunityId, projectReference) => { await c.query(`UPDATE opportunities SET projectReference = ? WHERE id = ?`, [projectReference, opportunityId]); },
    insertAudit: async (r: AuditRow) => { await c.query(
      `INSERT INTO qboRepairAuditLog (runId, kind, actor, parserVersion, manifestHash, customerId, quickbooksCustomerId, fieldName, beforeValue, afterValue, createdPropertyId, opportunityId, result, reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.runId, r.kind, r.actor, r.parserVersion, r.manifestHash, r.customerId, r.quickbooksCustomerId, r.fieldName, r.beforeValue, r.afterValue, r.createdPropertyId, r.opportunityId, r.result, r.reason],
    ); },
    transaction: async fn => { await c.beginTransaction(); try { const out = await fn(); await c.commit(); return out; } catch (e) { await c.rollback(); throw e; } },
  };
}

export function makeRollbackPort(c: mysql.Connection): RollbackPort {
  return {
    getAuditRows: async runId => (await q(c, `SELECT * FROM qboRepairAuditLog WHERE runId = ? AND kind = 'repair' ORDER BY id ASC`, [runId])) as unknown as AuditRow[],
    getCustomer: id => readCustomer(c, id),
    getCustomerFieldValue: async (id, field) => { const r = (await q(c, `SELECT \`${field}\` AS v FROM customers WHERE id = ?`, [id]))[0]; return r ? ((r.v as string) ?? null) : null; },
    restoreCustomerField: async (id, field, value) => { await c.query(`UPDATE customers SET \`${field}\` = ? WHERE id = ?`, [value, id]); },
    clearOpportunityProjectReference: async (opportunityId, expected) => {
      const res = (await c.query(`UPDATE opportunities SET projectReference = NULL WHERE id = ? AND projectReference = ?`, [opportunityId, expected]))[0] as mysql.ResultSetHeader;
      return res.affectedRows > 0;
    },
    propertyHasDependencies: async propertyId => {
      const j = (await q(c, `SELECT COUNT(*) AS n FROM jobs WHERE propertyId = ?`, [propertyId]))[0];
      return Number(j?.n ?? 0) > 0;
    },
    deleteProperty: async propertyId => { await c.query(`DELETE FROM properties WHERE id = ?`, [propertyId]); },
    insertAudit: async (r: AuditRow) => { await c.query(
      `INSERT INTO qboRepairAuditLog (runId, kind, actor, parserVersion, manifestHash, customerId, quickbooksCustomerId, fieldName, beforeValue, afterValue, createdPropertyId, opportunityId, result, reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.runId, r.kind, r.actor, r.parserVersion, r.manifestHash, r.customerId, r.quickbooksCustomerId, r.fieldName, r.beforeValue, r.afterValue, r.createdPropertyId, r.opportunityId, r.result, r.reason],
    ); },
    transaction: async fn => { await c.beginTransaction(); try { const out = await fn(); await c.commit(); return out; } catch (e) { await c.rollback(); throw e; } },
  };
}

export function makeRefreshPort(c: mysql.Connection): RefreshPort {
  return {
    getCustomer: async id => { const r = (await q(c, `SELECT id, displayName, firstName, lastName, companyName, email, phone, quickbooksCustomerId FROM customers WHERE id = ?`, [id]))[0]; return r ? (r as unknown as RefreshCustomerRow) : null; },
    updateCustomerFields: async (id, patch) => {
      const keys = Object.keys(patch); if (!keys.length) return;
      await c.query(`UPDATE customers SET ${keys.map(k => `\`${k}\` = ?`).join(", ")} WHERE id = ?`, [...keys.map(k => patch[k]), id]);
    },
    acquireLock: async runId => { const r = (await q(c, `SELECT GET_LOCK('qbo_customer_refresh', 0) AS ok`, []))[0]; return Number(r?.ok ?? 0) === 1; },
    releaseLock: async () => { await c.query(`SELECT RELEASE_LOCK('qbo_customer_refresh')`); },
    now: () => new Date(),
  };
}
