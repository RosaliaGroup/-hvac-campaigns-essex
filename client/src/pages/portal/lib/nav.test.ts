import { describe, expect, it } from "vitest";
import { PORTAL_NAV } from "./nav";

describe("portal navigation", () => {
  it("exposes the dashboard plus 10 sections (11 total)", () => {
    expect(PORTAL_NAV).toHaveLength(11);
  });

  it("starts with the Dashboard at /portal", () => {
    expect(PORTAL_NAV[0]).toMatchObject({ label: "Dashboard", path: "/portal" });
  });

  it("covers every required section", () => {
    const labels = PORTAL_NAV.map((n) => n.label);
    for (const required of [
      "Estimates",
      "Invoices",
      "Payments",
      "Appointments",
      "Service History",
      "Equipment",
      "Warranties",
      "Maintenance",
      "Documents",
      "Messages",
    ]) {
      expect(labels).toContain(required);
    }
  });

  it("has unique, portal-scoped paths", () => {
    const paths = PORTAL_NAV.map((n) => n.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p.startsWith("/portal")).toBe(true);
  });
});
