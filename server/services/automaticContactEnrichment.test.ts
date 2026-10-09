import { describe, expect, it } from "vitest";
import { approvedContactSource, contactCompleteness } from "./automaticContactEnrichment";
import { validateContactIntake } from "./crmContactIntake";
import { addresses } from "./gmailCrm";

describe("CRM contact intake eligibility", () => {
  it("only auto-enriches TASK-sourced or explicitly imported contacts", () => {
    for (const source of ["gmail-prospecting","verified-hvac-prospect","crm-manual","gmail-selected"])
      expect(approvedContactSource(source)).toBe(true);
    for (const source of ["gmail","Gmail Sent","telnyx","web-lead","crm",null,undefined,""])
      expect(approvedContactSource(source)).toBe(false);
  });
  it("never treats a record as a completed contact without both email and phone", () => {
    expect(contactCompleteness({email:"person@building.com",phone:"(201) 555-0199"}).complete).toBe(true);
    expect(contactCompleteness({email:"person@building.com"})).toMatchObject({
      complete:false,missing:["phone"],
    });
    expect(contactCompleteness({phone:"2015550199"})).toMatchObject({
      complete:false,missing:["email"],
    });
    expect(contactCompleteness({email:"invalid",phone:"2015550199"}).complete).toBe(false);
    expect(contactCompleteness({email:"person@building.com",phone:"555"}).complete).toBe(false);
  });
  it("requires complete, verified manual or Gmail-selected contact fields", () => {
    expect(validateContactIntake({
      name:"  Dana Smith ",email:"DANA@BUILDING.COM",phone:"201-555-0199",
    })).toMatchObject({name:"Dana Smith",email:"dana@building.com"});
    expect(()=>validateContactIntake({
      name:"Dana Smith",email:"dana@building.com",phone:"",
    })).toThrow(/email and a phone/);
    expect(()=>validateContactIntake({
      name:"dana@building.com",email:"dana@building.com",phone:"2015550199",
    })).toThrow(/verified contact name/);
  });
  it("parses Gmail correspondents without treating them as CRM contacts", () => {
    expect(addresses('Dana Smith <DANA@BUILDING.COM>, another@building.com'))
      .toEqual(["dana@building.com","another@building.com"]);
    // The UI requires an explicit selected Gmail correspondent plus phone
    // before calling the protected addSelectedContact endpoint.
  });
});
