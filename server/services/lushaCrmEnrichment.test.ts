import { describe, expect, it } from "vitest";
import { validateLushaIdentity, selectVerifiedLushaPhone } from "./lushaCrmEnrichment";

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
  it("rejects a conflicting employer name even if a domain matches",()=>{
    expect(validateLushaIdentity(crm,{
      firstName:"Anil",lastName:"Bansal",company:{name:"TCS",domain:"fncusa.com"},
    })).toBe(false);
  });
  it("does not accept an unrelated company with a similar name",()=>{
    expect(validateLushaIdentity({...crm,company:"First National Bank"},{
      firstName:"Anil",lastName:"Bansal",company:{name:"First National Realty Management",domain:"other.example"},
    })).toBe(false);
  });
});

describe("Lusha phone classification (synthetic test data, no API calls)", () => {
  it("uses a provider-labeled business number over mobile when both are present", () => {
    expect(selectVerifiedLushaPhone([
      {type:"mobile",number:"+12015550111"},
      {type:"direct",number:"201-555-0199"},
    ])).toEqual({number:"201-555-0199",phoneType:"business"});
  });
  it("labels a provider-verified mobile as cell, without implying SMS consent", () => {
    expect(selectVerifiedLushaPhone([{type:"mobile",number:"+12015550111"}]))
      .toEqual({number:"+12015550111",phoneType:"cell"});
  });
  it("does not guess the phone type for unlabeled, malformed, or missing numbers", () => {
    expect(selectVerifiedLushaPhone([{type:"unknown",number:"2015550199"}])).toBeNull();
    expect(selectVerifiedLushaPhone([{type:"direct",number:"555-0199"}])).toBeNull();
    expect(selectVerifiedLushaPhone([{type:"work",number:null}])).toBeNull();
    expect(selectVerifiedLushaPhone([])).toBeNull();
    expect(selectVerifiedLushaPhone(null)).toBeNull();
  });
});
