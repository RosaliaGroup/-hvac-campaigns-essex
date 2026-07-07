import { describe, it, expect, beforeAll } from "vitest";
import {
  mapCustomerToQbo,
  resolveDisplayName,
  collapseRepeatedPhrase,
  buildQboAddress,
  planCustomerPush,
  pickMergeMatch,
  parseTokenResponse,
  buildConnectionUpdate,
  requestTokens,
  qboApiBase,
  escapeQboLiteral,
  signState,
  verifyState,
  type QboConfig,
  type QboCustomer,
} from "./quickbooks";
import { decrypt } from "../../_core/crypto";
import type { AccountingCustomerInput } from "./types";

const base: AccountingCustomerInput = {
  localId: 1,
  type: "residential",
  displayName: "Jane Homeowner",
  firstName: "Jane",
  lastName: "Homeowner",
  companyName: null,
  email: "jane@example.com",
  phone: "(862) 555-0100",
  address: { line1: "12 Main St", line2: null, city: "Newark", state: "NJ", zip: "07102" },
};

const cfg: QboConfig = {
  clientId: "id",
  clientSecret: "secret",
  redirectUri: "https://mechanicalenterprise.com/api/integrations/quickbooks/callback",
  environment: "sandbox",
};

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  process.env.JWT_SECRET = "test-state-secret";
});

describe("mapCustomerToQbo", () => {
  it("maps core fields + BillAddr", () => {
    const p = mapCustomerToQbo(base);
    expect(p.DisplayName).toBe("Jane Homeowner");
    expect(p.GivenName).toBe("Jane");
    expect(p.FamilyName).toBe("Homeowner");
    expect(p.PrimaryEmailAddr).toEqual({ Address: "jane@example.com" });
    expect(p.PrimaryPhone).toEqual({ FreeFormNumber: "(862) 555-0100" });
    expect(p.BillAddr).toMatchObject({ Line1: "12 Main St", City: "Newark", CountrySubDivisionCode: "NJ", PostalCode: "07102" });
  });

  it("uses CompanyName for commercial and omits empty fields", () => {
    const p = mapCustomerToQbo({ ...base, companyName: "Acme HVAC LLC", address: null, phone: null });
    expect(p.CompanyName).toBe("Acme HVAC LLC");
    expect(p.PrimaryPhone).toBeUndefined();
    expect(p.BillAddr).toBeUndefined();
  });
});

describe("mapCustomerToQbo — CompanyName / BillAddr / ShipAddr / Notes / dedupe (mapping fix)", () => {
  const residential: AccountingCustomerInput = {
    localId: 10,
    type: "residential",
    displayName: "Jane Homeowner",
    firstName: "Jane",
    lastName: "Homeowner",
    companyName: null,
    email: "jane@example.com",
    phone: "(862) 555-0100",
    notes: null,
    address: { line1: "12 Main St", line2: "Apt 2", city: "Newark", state: "NJ", zip: "07102" },
  };

  it("residential individual → person DisplayName + names, no CompanyName", () => {
    const p = mapCustomerToQbo({ ...residential, address: null });
    expect(p.DisplayName).toBe("Jane Homeowner");
    expect(p.GivenName).toBe("Jane");
    expect(p.FamilyName).toBe("Homeowner");
    expect("CompanyName" in p).toBe(false);
  });

  it("commercial customer with company name → CompanyName + company DisplayName", () => {
    const p = mapCustomerToQbo({
      ...residential,
      type: "commercial",
      displayName: "Acme HVAC LLC",
      companyName: "Acme HVAC LLC",
      firstName: "Sam",
      lastName: "Rivera",
    });
    expect(p.CompanyName).toBe("Acme HVAC LLC");
    expect(p.DisplayName).toBe("Acme HVAC LLC");
    // Contact person still carried alongside the company.
    expect(p.GivenName).toBe("Sam");
    expect(p.FamilyName).toBe("Rivera");
  });

  it("customer with address → BillAddr AND ShipAddr populated (ship mirrors bill)", () => {
    const p = mapCustomerToQbo(residential) as Record<string, unknown>;
    expect(p.BillAddr).toEqual({
      Line1: "12 Main St",
      Line2: "Apt 2",
      City: "Newark",
      CountrySubDivisionCode: "NJ",
      PostalCode: "07102",
    });
    expect(p.ShipAddr).toEqual(p.BillAddr);
  });

  it("customer without company name → DisplayName falls back to person, no CompanyName key", () => {
    const p = mapCustomerToQbo({ ...residential, companyName: null, address: null });
    expect(p.DisplayName).toBe("Jane Homeowner");
    expect("CompanyName" in p).toBe(false);
  });

  it("de-duplicates a doubled DisplayName / identical first+last (the reported bug)", () => {
    const p = mapCustomerToQbo({
      ...residential,
      address: null,
      displayName: "QBO Test Customer QBO Test Customer",
      firstName: "QBO Test Customer",
      lastName: "QBO Test Customer",
    });
    expect(p.DisplayName).toBe("QBO Test Customer");
    expect(p.GivenName).toBe("QBO Test Customer");
    // FamilyName dropped because it duplicates GivenName.
    expect("FamilyName" in p).toBe(false);
  });

  it("maps Notes when present", () => {
    const p = mapCustomerToQbo({ ...residential, address: null, notes: "Gate code 1234" });
    expect(p.Notes).toBe("Gate code 1234");
  });
});

describe("resolveDisplayName + collapseRepeatedPhrase + buildQboAddress", () => {
  it("collapses only exact doubled phrases and normalizes whitespace", () => {
    expect(collapseRepeatedPhrase("QBO Test Customer QBO Test Customer")).toBe("QBO Test Customer");
    expect(collapseRepeatedPhrase("Jane Homeowner")).toBe("Jane Homeowner");
    expect(collapseRepeatedPhrase("Bob Bob Bob")).toBe("Bob Bob Bob"); // odd count → not a doubled phrase
    expect(collapseRepeatedPhrase("  extra   spaces  ")).toBe("extra spaces");
  });

  it("prefers company for commercial and person for residential", () => {
    const c = { localId: 1, displayName: "x", companyName: "Acme", firstName: "A", lastName: "B" };
    expect(resolveDisplayName({ ...c, type: "commercial" })).toBe("Acme");
    expect(resolveDisplayName({ ...c, type: "residential" })).toBe("A B");
  });

  it("falls back to 'Customer' when nothing usable is present", () => {
    expect(resolveDisplayName({ localId: 1, type: "residential", displayName: "" })).toBe("Customer");
  });

  it("buildQboAddress returns null when empty, object when populated", () => {
    expect(buildQboAddress(null)).toBeNull();
    expect(buildQboAddress({ line1: null, city: null, zip: null, state: null, line2: null })).toBeNull();
    expect(buildQboAddress({ line1: "1 A St", city: "Newark", state: "NJ", zip: "07102", line2: null })).toEqual({
      Line1: "1 A St",
      City: "Newark",
      CountrySubDivisionCode: "NJ",
      PostalCode: "07102",
    });
  });
});

describe("planCustomerPush — linked customers update by id, no duplicate", () => {
  it("linked customer updates the existing QBO customer by id", () => {
    const plan = planCustomerPush({ ...base, existingRemoteId: "345" });
    expect(plan).toEqual({ action: "update-by-id", qbId: "345" });
  });

  it("unlinked customer still uses duplicate matching", () => {
    expect(planCustomerPush({ ...base, existingRemoteId: null })).toEqual({ action: "match" });
    expect(planCustomerPush(base)).toEqual({ action: "match" }); // existingRemoteId undefined
  });

  it("never creates/matches (no duplicate) when quickbooksCustomerId exists", () => {
    const plan = planCustomerPush({ ...base, existingRemoteId: "58" });
    expect(plan.action).toBe("update-by-id");
    expect(plan.action).not.toBe("match");
    if (plan.action === "update-by-id") expect(plan.qbId).toBe("58");
  });

  it("treats a blank/whitespace id as unlinked (falls back to matching)", () => {
    expect(planCustomerPush({ ...base, existingRemoteId: "   " })).toEqual({ action: "match" });
  });
});

describe("pickMergeMatch", () => {
  const cust = base;
  it("matches by email first (case-insensitive)", () => {
    const cands: QboCustomer[] = [
      { Id: "9", DisplayName: "Someone Else", PrimaryEmailAddr: { Address: "JANE@example.com" } },
    ];
    expect(pickMergeMatch(cust, cands)).toEqual({ matchedBy: "email", candidate: cands[0] });
  });

  it("matches by phone (normalized last-10) when email differs", () => {
    const cands: QboCustomer[] = [
      { Id: "3", DisplayName: "Jane H", PrimaryEmailAddr: { Address: "other@x.com" }, PrimaryPhone: { FreeFormNumber: "+1 862-555-0100" } },
    ];
    expect(pickMergeMatch(cust, cands)).toEqual({ matchedBy: "phone", candidate: cands[0] });
  });

  it("matches by exact display name when email + phone differ", () => {
    const cands: QboCustomer[] = [
      { Id: "5", DisplayName: "jane homeowner", PrimaryEmailAddr: { Address: "no@x.com" }, PrimaryPhone: { FreeFormNumber: "973-000-0000" } },
    ];
    expect(pickMergeMatch(cust, cands)).toEqual({ matchedBy: "name", candidate: cands[0] });
  });

  it("prefers email over phone over name when several candidates qualify", () => {
    const cands: QboCustomer[] = [
      { Id: "name", DisplayName: "Jane Homeowner" },
      { Id: "phone", DisplayName: "x", PrimaryPhone: { FreeFormNumber: "8625550100" } },
      { Id: "email", DisplayName: "y", PrimaryEmailAddr: { Address: "jane@example.com" } },
    ];
    expect(pickMergeMatch(cust, cands)?.candidate.Id).toBe("email");
  });

  it("returns null when nothing matches", () => {
    expect(pickMergeMatch(cust, [{ Id: "1", DisplayName: "No One", PrimaryEmailAddr: { Address: "no@x.com" } }])).toBeNull();
  });

  it("does not match on empty/absent keys", () => {
    const noContact: AccountingCustomerInput = { ...base, email: null, phone: null, displayName: "" };
    expect(pickMergeMatch(noContact, [{ Id: "1", DisplayName: "" }])).toBeNull();
  });
});

describe("token parsing + refresh-token rotation persistence", () => {
  it("parseTokenResponse captures the rotated refresh token", () => {
    const t = parseTokenResponse({ access_token: "AT1", refresh_token: "RT_NEW", expires_in: 3600, x_refresh_token_expires_in: 8726400 });
    expect(t.accessToken).toBe("AT1");
    expect(t.refreshToken).toBe("RT_NEW");
    expect(t.expiresIn).toBe(3600);
  });

  it("throws when tokens are missing", () => {
    expect(() => parseTokenResponse({ access_token: "only" })).toThrow();
  });

  it("buildConnectionUpdate persists the NEW rotated refresh token (encrypted)", () => {
    const now = new Date("2026-07-06T00:00:00Z");
    const patch = buildConnectionUpdate({ accessToken: "AT2", refreshToken: "RT_ROTATED", expiresIn: 3600, refreshExpiresIn: 8726400 }, now);
    // Critical QuickBooks trap: the rotated refresh token must be what we store.
    expect(decrypt(patch.refreshTokenEncrypted)).toBe("RT_ROTATED");
    expect(decrypt(patch.accessTokenEncrypted)).toBe("AT2");
    expect(patch.expiresAt.getTime()).toBe(now.getTime() + 3600 * 1000);
    expect(patch.status).toBe("connected");
    expect(patch.lastError).toBeNull();
  });

  it("requestTokens (refresh) returns the rotated refresh token via mocked fetch", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ access_token: "AT3", refresh_token: "RT_AFTER_REFRESH", expires_in: 3600, x_refresh_token_expires_in: 8726400 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;
    const t = await requestTokens(cfg, { type: "refresh_token", refreshToken: "RT_BEFORE" }, fakeFetch);
    expect(t.refreshToken).toBe("RT_AFTER_REFRESH");
    expect(t.refreshToken).not.toBe("RT_BEFORE");
  });

  it("requestTokens throws on non-200", async () => {
    const fakeFetch = (async () => new Response("bad", { status: 400 })) as unknown as typeof fetch;
    await expect(requestTokens(cfg, { type: "authorization_code", code: "x" }, fakeFetch)).rejects.toThrow();
  });
});

describe("helpers", () => {
  it("selects the right API base per environment", () => {
    expect(qboApiBase("sandbox")).toContain("sandbox-quickbooks");
    expect(qboApiBase("production")).toBe("https://quickbooks.api.intuit.com");
  });

  it("escapes single quotes for QBO query literals", () => {
    expect(escapeQboLiteral("O'Brien HVAC")).toBe("O''Brien HVAC");
  });

  it("signs and verifies OAuth state, rejects tampering", () => {
    const s = signState("nonce123");
    expect(verifyState(s)).toBe(true);
    expect(verifyState("nonce123.deadbeef")).toBe(false);
    expect(verifyState(undefined)).toBe(false);
  });
});
