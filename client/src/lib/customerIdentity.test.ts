import { describe, it, expect } from "vitest";
import { resolveCustomerIdentity } from "./customerIdentity";

describe("resolveCustomerIdentity — PDC (customer 9) rendering", () => {
  const pdc = resolveCustomerIdentity({
    displayName: "PN#132 I PDC I 828 Summer Ave Newark NJ",
    firstName: "PN#132 I PDC I 828 Summer Ave Newark",
    lastName: "NJ",
    companyName: null,
    quickbooksRawDisplayName: null,
  });
  it("displays the customer/company as PDC (not the composite)", () => {
    expect(pdc.name).toBe("PDC");
  });
  it("surfaces project reference PN#132", () => {
    expect(pdc.projectReference).toBe("PN#132");
  });
  it("surfaces the service address 828 Summer Ave / Newark / NJ", () => {
    expect(pdc.serviceAddress).toMatch(/828 Summer Ave/);
    expect(pdc.serviceAddress).toMatch(/Newark/);
    expect(pdc.serviceAddress).toMatch(/NJ/);
  });
  it("is flagged as derived from a composite name", () => {
    expect(pdc.derivedFromComposite).toBe(true);
  });
});

describe("resolveCustomerIdentity — Marco (customer 23)", () => {
  it("uses the clean structured name when displayName is not composite", () => {
    const marco = resolveCustomerIdentity({
      displayName: "Marco Weber", firstName: "Marco", lastName: "Weber", companyName: null, quickbooksRawDisplayName: null,
    });
    expect(marco.name).toBe("Marco Weber");
    expect(marco.projectReference).toBeNull();
    expect(marco.derivedFromComposite).toBe(false);
  });
  it("recovers name + project + address when only the raw composite is present", () => {
    const raw = resolveCustomerIdentity({
      displayName: "Marco Weber", firstName: "Marco", lastName: "Weber", companyName: null,
      quickbooksRawDisplayName: "PN-173-B I Marco Weber I 9005 Smith Ave, North Bergen, NJ 07047 I Basement I",
    });
    expect(raw.name).toBe("Marco Weber");
    expect(raw.projectReference).toBe("PN-173-B");
    expect(raw.serviceAddress).toMatch(/9005 Smith Ave/);
  });
});

describe("resolveCustomerIdentity — other composite + plain rows", () => {
  it("splits a composite person name (NATANYA L PHIPPS)", () => {
    const r = resolveCustomerIdentity({
      displayName: "PN#160 I NATANYA L PHIPPS I 351 CENTRAL AVE HALEDON", firstName: null, lastName: null, companyName: null, quickbooksRawDisplayName: null,
    });
    expect(r.name).toBe("NATANYA L PHIPPS");
    expect(r.projectReference).toBe("PN#160");
  });
  it("prefers companyName for a plain commercial row", () => {
    const r = resolveCustomerIdentity({ displayName: "Rosalia Roqueirr LLC", companyName: "Rosalia Roqueirr LLC", firstName: null, lastName: null });
    expect(r.name).toBe("Rosalia Roqueirr LLC");
    expect(r.derivedFromComposite).toBe(false);
  });
  it("falls back to Unknown only when nothing is available", () => {
    const r = resolveCustomerIdentity({});
    expect(r.name).toBe("Unknown");
  });
});
