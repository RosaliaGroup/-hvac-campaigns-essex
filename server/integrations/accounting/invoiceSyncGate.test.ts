import { describe, it, expect, afterEach } from "vitest";
import { syncInvoices, isInvoiceSyncEnabled } from "./invoiceSync";
import type { LockConnection } from "./dbSyncLock";

/**
 * The M0 hotfix adds `force` so the MANUAL "Sync from QuickBooks" per-customer
 * action reconciles invoices regardless of QBO_INVOICE_SYNC_ENABLED (which only
 * gates the automatic background poller). These tests pin that gate contract.
 *
 * A fake lock connection grants the advisory lock immediately so a forced run
 * gets PAST the feature gate — it then stops at the first real dependency
 * (DB/QBO connection), proving the gate itself no longer short-circuits it.
 */
const fakeLockConn = (): LockConnection => ({
  async query(sql: string) {
    // GET_LOCK / RELEASE_LOCK both succeed (v=1).
    return [[{ v: 1 }], []] as [unknown, unknown];
  },
  async end() {},
  destroy() {},
  on() {},
});

const prev = process.env.QBO_INVOICE_SYNC_ENABLED;
afterEach(() => {
  if (prev === undefined) delete process.env.QBO_INVOICE_SYNC_ENABLED;
  else process.env.QBO_INVOICE_SYNC_ENABLED = prev;
});

describe("invoice sync feature gate — force bypass (M0 hotfix)", () => {
  it("isInvoiceSyncEnabled reflects the env flag", () => {
    process.env.QBO_INVOICE_SYNC_ENABLED = "true";
    expect(isInvoiceSyncEnabled()).toBe(true);
    process.env.QBO_INVOICE_SYNC_ENABLED = "false";
    expect(isInvoiceSyncEnabled()).toBe(false);
    delete process.env.QBO_INVOICE_SYNC_ENABLED;
    expect(isInvoiceSyncEnabled()).toBe(false);
  });

  it("the automatic poller (no force) is refused while the flag is off", async () => {
    delete process.env.QBO_INVOICE_SYNC_ENABLED;
    const res = await syncInvoices({ lockConnectionFactory: fakeLockConn });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/disabled/i);
    // Gated off BEFORE any lock/DB/QBO work.
    expect(res.pulled).toBe(0);
  });

  it("a forced manual sync runs past the gate even with the flag off", async () => {
    delete process.env.QBO_INVOICE_SYNC_ENABLED;
    const res = await syncInvoices({ mode: "backfill", force: true, lockConnectionFactory: fakeLockConn });
    // It must NOT be refused with the "disabled" message — it proceeded past the
    // gate and stopped at the first real dependency (no DB/QBO in the test env).
    expect(res.error ?? "").not.toMatch(/disabled/i);
  });
});
