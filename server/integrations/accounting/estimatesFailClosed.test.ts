import { describe, it, expect, vi, afterEach } from "vitest";
import { quickbooksProvider } from "./quickbooks";
import * as dbModule from "../../db";
import * as quickbooksModule from "./quickbooks";
import { syncSalesDocuments } from "./salesDocSync";

/**
 * Patch 1 fail-closed proof: after retries are exhausted, a final 429/502/503/504
 * must NOT be read as "0 estimates". It must throw, so the sync records a failed
 * sync-log and does not advance the cursor or process anything.
 */

const SENTINEL_TOKEN = "SENSITIVE_ACCESS_TOKEN_should_never_appear";
const REALM = "realm-XYZ";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchEstimates fails closed on an exhausted retryable status", () => {
  it.each([429, 502, 503, 504])(
    "throws (does not return []) when the query persistently returns %i",
    async status => {
      // Skip the DB/token path; force a real resilientFetch → persistent status.
      vi.spyOn(quickbooksProvider as unknown as { getValidAccessToken: () => Promise<unknown> }, "getValidAccessToken")
        .mockResolvedValue({ accessToken: SENTINEL_TOKEN, realmId: REALM });
      const longBody = "E".repeat(500); // >200 chars → must be truncated in the message
      vi.stubGlobal("fetch", vi.fn(async () => new Response(longBody, { status })));

      await expect(quickbooksProvider.fetchEstimates("SELECT * FROM Estimate")).rejects.toThrow(
        new RegExp(`QBO estimate query failed: ${status}`),
      );
    },
    10_000,
  );

  it("throws a BOUNDED, secret-free error (status + ≤200 body chars; no token/URL/Bearer)", async () => {
    vi.spyOn(quickbooksProvider as unknown as { getValidAccessToken: () => Promise<unknown> }, "getValidAccessToken")
      .mockResolvedValue({ accessToken: SENTINEL_TOKEN, realmId: REALM });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("D".repeat(500), { status: 503 })));

    const err = await quickbooksProvider.fetchEstimates("SELECT * FROM Estimate").catch(e => e as Error);
    const msg = err.message;
    expect(msg).toContain("503");
    // Bounded: prefix + at most 200 body chars.
    expect(msg.length).toBeLessThanOrEqual("QBO estimate query failed: 503 ".length + 200);
    // Secret-free: no access token, no Authorization scheme, no request URL/realm.
    expect(msg).not.toContain(SENTINEL_TOKEN);
    expect(msg.toLowerCase()).not.toContain("bearer");
    expect(msg.toLowerCase()).not.toContain("authorization");
    expect(msg).not.toContain(REALM);
    expect(msg).not.toMatch(/https?:\/\//);
  });
});

describe("syncSalesDocuments fails closed when the estimate query throws", () => {
  it("writes a failed sync-log, does NOT advance the cursor, and processes nothing", async () => {
    const priorCursor = new Date("2020-01-01T00:00:00Z");
    const cursorUpdate = vi.fn();
    const fakeDb = {
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: cursorUpdate })) })),
      insert: vi.fn(() => ({ values: vi.fn() })), // processEstimate would use this — must never fire
      select: vi.fn(),
    };
    vi.spyOn(dbModule, "getDb").mockResolvedValue(fakeDb as never);
    vi.spyOn(quickbooksProvider, "getConnection").mockResolvedValue({
      status: "connected",
      realmId: REALM,
      salesDocCursor: priorCursor,
    } as never);
    // Simulate the fail-closed throw that fetchEstimates now produces on a persistent 5xx.
    const fetchEstimates = vi
      .spyOn(quickbooksProvider, "fetchEstimates")
      .mockRejectedValue(new Error("QBO estimate query failed: 503 service unavailable"));
    const writeSyncLog = vi.spyOn(quickbooksModule, "writeSyncLog").mockResolvedValue(undefined as never);

    const result = await syncSalesDocuments({ mode: "backfill" });

    // (1) fetchEstimates threw → the run failed.
    expect(result.ok).toBe(false);
    expect(result.error).toContain("503");
    expect(fetchEstimates).toHaveBeenCalled();

    // (2) failed sync-log row written with success:false.
    expect(writeSyncLog).toHaveBeenCalledTimes(1);
    expect(writeSyncLog.mock.calls[0][0]).toMatchObject({ success: false });

    // (3) cursor NOT advanced (the db.update in the try is skipped by the throw).
    expect(fakeDb.update).not.toHaveBeenCalled();
    expect(cursorUpdate).not.toHaveBeenCalled();
    expect(result.cursorAdvancedTo).toBeNull();

    // (4) no estimate/customer processing began.
    expect(result.pulled).toBe(0);
    expect(result.created).toBe(0);
    expect(fakeDb.insert).not.toHaveBeenCalled();
  });
});
