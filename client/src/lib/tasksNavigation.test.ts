import { describe, expect, it } from "vitest";
import { getActiveItemPath, getVisibleDepartments, isInternalRoute } from "./navigation";

describe("dedicated CRM Tasks navigation", () => {
  it("recognizes Tasks as an internal protected CRM route", () => {
    expect(isInternalRoute("/tasks")).toBe(true);
    expect(isInternalRoute("/tasks?status=open")).toBe(true);
    expect(getActiveItemPath("/tasks")).toBe("/tasks");
  });
  it("shows Tasks in Sales navigation without removing Communications", () => {
    const departments = getVisibleDepartments("admin");
    const sales = departments.find(d => d.id === "sales");
    expect(sales?.items.some(item => item.path === "/tasks")).toBe(true);
    expect(sales?.items.some(item => item.path === "/contacts/communications")).toBe(true);
  });
});
