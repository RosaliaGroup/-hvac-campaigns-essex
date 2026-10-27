import { describe, expect, it } from "vitest";
import { uniqueAssignee } from "./crm30DayAssignee";

describe("CRM 30-day follow-up assignee safety", () => {
  const ana = { id: 12, name: "Ana Haynes", email: "ana@example.com" };
  it("selects exactly one verified CRM user", () => {
    expect(uniqueAssignee([ana])).toEqual(ana);
  });
  it("does not guess when no CRM user matches", () => {
    expect(uniqueAssignee([])).toBeNull();
  });
  it("does not assign to one of multiple ambiguous users", () => {
    expect(uniqueAssignee([ana, { id: 13, name: "Ana Haynes", email: "other@example.com" }])).toBeNull();
  });
});
