import { describe, expect, it } from "vitest";
import { excludeFromOutreachFollowups, followupDueAt } from "./crmFollowupRules";

describe("CRM outreach follow-up scheduling", () => {
  it("rolls weekend human and email reminders to Monday Eastern", () => {
    const friday = new Date("2026-10-09T15:00:00Z");
    expect(followupDueAt(friday, "human").toISOString()).toBe("2026-10-12T13:00:00.000Z");
    expect(followupDueAt(friday, "email_review").toISOString()).toBe("2026-10-12T14:00:00.000Z");
    expect(followupDueAt(friday, "final_review").toISOString()).toBe("2026-11-11T15:00:00.000Z");
  });
  it("accounts for Eastern daylight-saving transitions", () => {
    const intro = new Date("2026-10-30T16:00:00Z");
    expect(followupDueAt(intro, "human").toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(followupDueAt(intro, "email_review").toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });
  it("excludes opt-out-risk and explicitly blocked recipients", () => {
    expect(excludeFromOutreachFollowups({email:"thomas@vizapropertymanagement.com"})).toBe(true);
    expect(excludeFromOutreachFollowups({email:"jfuller@onyxequities.com"})).toBe(true);
    expect(excludeFromOutreachFollowups({email:"ksaliba@onyxequities.com"})).toBe(true);
    expect(excludeFromOutreachFollowups({email:"other@onyxequities.com"})).toBe(true);
    expect(excludeFromOutreachFollowups({email:"gabriel@abc.com",name:"Gabriel Lopes"})).toBe(true);
    expect(excludeFromOutreachFollowups({email:"person@abc.com",company:"Giga Holdings"})).toBe(true);
    expect(excludeFromOutreachFollowups({email:"property.manager@example.com"})).toBe(false);
  });
});
