import { describe, expect, it } from "vitest";
import { teamSessionUserId, uniqueAssignee } from "./crm30DayAssignee";
describe("CRM team owner mapping", () => {
  it("matches the authentication SDK negative team session ID", () => {
    expect(teamSessionUserId(1)).toBe(-1);
    expect(teamSessionUserId(12)).toBe(-12);
  });
  it("rejects invalid team member IDs", () => {
    expect(() => teamSessionUserId(0)).toThrow();
    expect(() => teamSessionUserId(-1)).toThrow();
  });
  it("never guesses between multiple authenticated owners", () => {
    expect(uniqueAssignee([])).toBeNull();
    expect(uniqueAssignee([{id:-1,name:"Sales",email:"sales@example.com"}])).toMatchObject({id:-1});
    expect(uniqueAssignee([{id:-1,name:"Sales",email:"sales@example.com"},{id:-2,name:"Other",email:"other@example.com"}])).toBeNull();
  });
});
