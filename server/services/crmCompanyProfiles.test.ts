import { describe,it,expect } from "vitest";
import {classifyBusinessType,verifiedCompanyDomain} from "./crmCompanyProfiles";
describe("CRM company categorization",()=>{
  it("links only business email domains",()=>{
    expect(verifiedCompanyDomain("person@example.com")).toBe("example.com");
    expect(verifiedCompanyDomain("person@gmail.com")).toBeNull();
    expect(verifiedCompanyDomain("invalid")).toBeNull();
  });
  it("classifies common commercial prospect types",()=>{
    expect(classifyBusinessType("Property Management LLC")).toBe("property-management");
    expect(classifyBusinessType("Condo Association")).toBe("condo-hoa");
    expect(classifyBusinessType("Real Estate Broker")).toBe("real-estate");
    expect(classifyBusinessType("Facilities Engineer")).toBe("building-operations");
  });
});
