import { describe, it, expect } from "vitest";
import { buildCustomerInput } from "./quickbooks";
import { writeSyncLog } from "../integrations/accounting/quickbooks";
import type { Customer, Property } from "../../drizzle/schema";

function makeCustomer(over: Partial<Customer> = {}): Customer {
  return {
    id: 42,
    type: "commercial",
    firstName: "Sam",
    lastName: "Rivera",
    companyName: "Rivera Refrigeration",
    displayName: "Rivera Refrigeration",
    email: "sam@rivera.com",
    phone: "862-555-0199",
    altPhone: null,
    status: "active",
    source: null,
    notes: null,
    assignedToId: null,
    quickbooksCustomerId: null,
    quickbooksSyncStatus: "not_synced",
    quickbooksSyncedAt: null,
    quickbooksSyncError: null,
    convertedFromLeadId: null,
    convertedFromCaptureId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Customer;
}

function makeProperty(over: Partial<Property> = {}): Property {
  return {
    id: 7,
    customerId: 42,
    label: "Warehouse",
    addressLine1: "500 Industrial Ave",
    addressLine2: "Unit 4",
    city: "Elizabeth",
    state: "NJ",
    zip: "07201",
    propertyType: "commercial",
    squareFeet: null,
    existingSystem: null,
    systemNotes: null,
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Property;
}

describe("buildCustomerInput", () => {
  it("maps a customer + primary property into provider input", () => {
    const input = buildCustomerInput(makeCustomer(), makeProperty());
    expect(input).toMatchObject({
      localId: 42,
      type: "commercial",
      displayName: "Rivera Refrigeration",
      companyName: "Rivera Refrigeration",
      email: "sam@rivera.com",
      phone: "862-555-0199",
      address: { line1: "500 Industrial Ave", line2: "Unit 4", city: "Elizabeth", state: "NJ", zip: "07201" },
    });
  });

  it("leaves address null when no primary property exists", () => {
    const input = buildCustomerInput(makeCustomer(), null);
    expect(input.address).toBeNull();
  });
});

describe("writeSyncLog", () => {
  it("is a safe no-op when the database is unavailable", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await expect(
      writeSyncLog({ entityType: "customer", entityId: 1, direction: "push", success: true, realmId: null }),
    ).resolves.toBeUndefined();
    if (prev) process.env.DATABASE_URL = prev;
  });
});
