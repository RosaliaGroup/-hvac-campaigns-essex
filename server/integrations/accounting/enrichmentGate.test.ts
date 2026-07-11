import { describe, it, expect } from "vitest";
import {
  CUSTOMER_NAME_ENRICH_FLAG,
  gateIdentityWrites,
  isCustomerNameEnrichEnabled,
  planCustomerEnrichment,
} from "./enrichmentGate";
import type { IncomingCustomerFields, MergeableCustomer } from "./customerMerge";

// --- test doubles -----------------------------------------------------------

/** Deterministic displayName rebuild (structured fields only). */
function buildDisplayName(a: {
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}): string {
  return (
    a.companyName?.trim() ||
    [a.firstName, a.lastName].filter(Boolean).join(" ").trim() ||
    a.email ||
    a.phone ||
    "QuickBooks Customer"
  );
}

const normalizePhone = (v: string | null | undefined): string | null =>
  v == null ? null : v.replace(/\D/g, "") || null;

function crm(over: Partial<MergeableCustomer> = {}): MergeableCustomer & { quickbooksCustomerId: string | null } {
  return {
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    phone: null,
    altPhone: null,
    notes: null,
    status: "active",
    billingLine1: null,
    billingLine2: null,
    billingCity: null,
    billingState: null,
    billingZip: null,
    quickbooksCustomerId: null,
    ...over,
  };
}

function incoming(over: Partial<IncomingCustomerFields> = {}): IncomingCustomerFields {
  return {
    firstName: null,
    lastName: null,
    companyName: null,
    email: null,
    phone: null,
    altPhone: null,
    notes: null,
    status: null,
    billingLine1: null,
    billingLine2: null,
    billingCity: null,
    billingState: null,
    billingZip: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------

describe("isCustomerNameEnrichEnabled", () => {
  it("defaults OFF when the flag is unset", () => {
    expect(isCustomerNameEnrichEnabled({})).toBe(false);
  });
  it("is ON only for the exact string \"true\"", () => {
    expect(isCustomerNameEnrichEnabled({ [CUSTOMER_NAME_ENRICH_FLAG]: "true" })).toBe(true);
  });
  it("stays OFF for other truthy-looking values", () => {
    for (const v of ["false", "1", "TRUE", "yes", "on", ""]) {
      expect(isCustomerNameEnrichEnabled({ [CUSTOMER_NAME_ENRICH_FLAG]: v })).toBe(false);
    }
  });
});

describe("gateIdentityWrites (flag OFF)", () => {
  const base = {
    nameEnrichEnabled: false,
    existing: crm(),
    buildDisplayName,
  };

  it("strips firstName/lastName/companyName from the write set", () => {
    const res = gateIdentityWrites({
      ...base,
      patch: { firstName: "Colbert", lastName: "Watson", companyName: "Acme" },
    });
    expect(res.setValues.firstName).toBeUndefined();
    expect(res.setValues.lastName).toBeUndefined();
    expect(res.setValues.companyName).toBeUndefined();
    expect(res.suppressedFields.sort()).toEqual(["companyName", "firstName", "lastName"]);
  });

  it("never rebuilds displayName", () => {
    const res = gateIdentityWrites({ ...base, patch: { firstName: "Colbert", lastName: "Watson" } });
    expect("displayName" in res.setValues).toBe(false);
    expect(res.displayNameRebuilt).toBe(false);
  });

  it("preserves non-identity fills (email/phone/notes/billing)", () => {
    const res = gateIdentityWrites({
      ...base,
      patch: { firstName: "Colbert", email: "c@x.com", phone: "5551234", notes: "n", billingCity: "Essex" },
    });
    expect(res.setValues).toEqual({ email: "c@x.com", phone: "5551234", notes: "n", billingCity: "Essex" });
  });

  it("never writes the legacy quickbooksRawDisplayName column", () => {
    const res = gateIdentityWrites({
      ...base,
      patch: { quickbooksRawDisplayName: "PN #163 I Colbert Watson", email: "c@x.com" } as Record<string, string>,
    });
    expect("quickbooksRawDisplayName" in res.setValues).toBe(false);
    expect(res.setValues.email).toBe("c@x.com");
  });
});

describe("gateIdentityWrites (flag ON preserves legacy behavior)", () => {
  it("keeps name fills and rebuilds displayName from structured fields", () => {
    const res = gateIdentityWrites({
      nameEnrichEnabled: true,
      existing: crm(),
      buildDisplayName,
      patch: { firstName: "Colbert", lastName: "Watson", email: "c@x.com" },
    });
    expect(res.setValues.firstName).toBe("Colbert");
    expect(res.setValues.lastName).toBe("Watson");
    expect(res.setValues.email).toBe("c@x.com");
    expect(res.setValues.displayName).toBe("Colbert Watson");
    expect(res.displayNameRebuilt).toBe(true);
  });

  it("does not rebuild displayName when no name field was filled", () => {
    const res = gateIdentityWrites({
      nameEnrichEnabled: true,
      existing: crm({ firstName: "Colbert" }),
      buildDisplayName,
      patch: { email: "c@x.com" },
    });
    expect("displayName" in res.setValues).toBe(false);
    expect(res.displayNameRebuilt).toBe(false);
  });
});

describe("planCustomerEnrichment — flag OFF preserves all NON-name sync behavior", () => {
  const common = {
    quickbooksUpdatedAt: new Date("2026-07-01T00:00:00Z"),
    qbCustomerId: "QB-99",
    matchedByQbId: false,
    now: new Date("2026-07-09T00:00:00Z"),
    nameEnrichEnabled: false,
    buildDisplayName,
    normalizePhone,
  };

  it("fills empty non-name fields but writes NO name/displayName", () => {
    const plan = planCustomerEnrichment({
      ...common,
      existing: crm(), // everything empty
      incoming: incoming({ firstName: "Colbert", lastName: "Watson", email: "c@x.com", phone: "555-1234" }),
    });
    // non-name fills applied
    expect(plan.setValues.email).toBe("c@x.com");
    // buildCustomerFieldUpdate stores the trimmed raw value; normalizePhone is
    // only used for equality comparison, not for the persisted patch.
    expect(plan.setValues.phone).toBe("555-1234");
    // name identity suppressed
    expect(plan.setValues.firstName).toBeUndefined();
    expect(plan.setValues.lastName).toBeUndefined();
    expect("displayName" in plan.setValues).toBe(false);
    expect(plan.suppressedNameFields.sort()).toEqual(["firstName", "lastName"]);
  });

  it("still links the QBO id / status / sync timestamps (estimate-sync bookkeeping)", () => {
    const plan = planCustomerEnrichment({
      ...common,
      existing: crm(),
      incoming: incoming({ firstName: "Colbert" }),
    });
    expect(plan.setValues.quickbooksCustomerId).toBe("QB-99");
    expect(plan.setValues.quickbooksSyncStatus).toBe("synced");
    expect(plan.setValues.quickbooksSyncedAt).toEqual(common.now);
    expect(plan.setValues.quickbooksCustomerUpdatedAt).toEqual(common.quickbooksUpdatedAt);
  });

  it("still records conflicts even though the name write is suppressed", () => {
    // Existing has a DIFFERENT non-empty name → overwrite_prevented must still be logged
    const plan = planCustomerEnrichment({
      ...common,
      existing: crm({ firstName: "Colby", lastName: "W" }),
      incoming: incoming({ firstName: "Colbert", lastName: "Watson" }),
    });
    const names = plan.conflicts.filter((c) => c.fieldName === "firstName" || c.fieldName === "lastName");
    expect(names.length).toBe(2);
    expect(names.every((c) => c.conflictType === "overwrite_prevented")).toBe(true);
    // ...and no name field is written
    expect(plan.setValues.firstName).toBeUndefined();
    expect(plan.setValues.lastName).toBeUndefined();
  });

  it("does not link a QBO id when the customer already has one / matched by id", () => {
    const plan = planCustomerEnrichment({
      ...common,
      matchedByQbId: true,
      existing: crm({ quickbooksCustomerId: "QB-1" }),
      incoming: incoming({ email: "c@x.com" }),
    });
    expect("quickbooksCustomerId" in plan.setValues).toBe(false);
    expect("quickbooksSyncStatus" in plan.setValues).toBe(false);
  });
});

describe("planCustomerEnrichment — flag ON reproduces pre-gate behavior", () => {
  it("writes name fields + rebuilt displayName alongside the non-name fills", () => {
    const plan = planCustomerEnrichment({
      quickbooksUpdatedAt: null,
      qbCustomerId: null,
      matchedByQbId: false,
      now: new Date("2026-07-09T00:00:00Z"),
      nameEnrichEnabled: true,
      buildDisplayName,
      normalizePhone,
      existing: crm(),
      incoming: incoming({ firstName: "Colbert", lastName: "Watson", email: "c@x.com" }),
    });
    expect(plan.setValues.firstName).toBe("Colbert");
    expect(plan.setValues.lastName).toBe("Watson");
    expect(plan.setValues.email).toBe("c@x.com");
    expect(plan.setValues.displayName).toBe("Colbert Watson");
    expect(plan.suppressedNameFields).toEqual([]);
  });
});
