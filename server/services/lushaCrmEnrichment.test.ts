import { describe, expect, it } from "vitest";
import { validateLushaIdentity } from "./lushaCrmEnrichment";

describe("Lusha CRM identity verification", () => {
  const crm={name:"Anil Bansal",company:"First National Realty Management",email:"anil@fncusa.com"};
  it("rejects a different employer even when Lusha found a same-name result",()=>{
    expect(validateLushaIdentity(crm,{
      firstName:"Anil",lastName:"Bansal",
      company:{name:"TCS",domain:"www.calltcs.com"},
    })).toBe(false);
  });
  it("accepts only a matching full name and matching company/domain",()=>{
    expect(validateLushaIdentity(crm,{
      firstName:"Anil",lastName:"Bansal",
      company:{name:"First National Realty Management",domain:"fncusa.com"},
    })).toBe(true);
    expect(validateLushaIdentity(crm,{
      firstName:"Different",lastName:"Bansal",
      company:{name:"First National Realty Management",domain:"fncusa.com"},
    })).toBe(false);
  });
  it("requires a named CRM contact and verified employer",()=>{
    expect(validateLushaIdentity({...crm,name:crm.email}, {
      firstName:"Anil",lastName:"Bansal",company:{name:"First National Realty Management"},
    })).toBe(false);
    expect(validateLushaIdentity({...crm,company:null}, {
      firstName:"Anil",lastName:"Bansal",company:{name:"First National Realty Management"},
    })).toBe(false);
  });
  it("does not accept an unrelated company with a similar name",()=>{
    expect(validateLushaIdentity({...crm,company:"First National Bank"},{
      firstName:"Anil",lastName:"Bansal",company:{name:"First National Realty Management",domain:"other.example"},
    })).toBe(false);
  });
});
