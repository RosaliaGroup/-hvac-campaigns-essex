import { describe, it, expect } from "vitest";
import {
  DEPARTMENTS,
  PRODUCTION_ROLES,
  isInternalRoute,
  resolveNavRole,
  getVisibleDepartments,
  getActiveDepartmentId,
  getActiveItemKey,
  getActiveItemPath,
  isDepartmentOpen,
  loadDepartmentOpenState,
  serializeDepartmentOpenState,
  type NavRole,
} from "./navigation";

/* ── Public vs protected route detection ───────────────────────────────── */
// Covers: "public pages show public header and chatbot" and
//         "protected dashboard pages hide public header and chatbot".
// App.tsx renders <Navigation/> per public page and gates <LiveChatWidget/>
// (Jessica) on `!isInternalRoute(location)`, so this predicate is the single
// switch behind both behaviours.

describe("isInternalRoute", () => {
  const publicPaths = [
    "/",
    "/about",
    "/services",
    "/contact",
    "/rebate-guide",
    "/residential",
    "/commercial",
    "/blog",
    "/blog/nj-heat-pump-rebates-2026",
    "/hvac-newark-nj",
    "/lp/heat-pump-rebates",
    "/team-login",
    "/qualify",
  ];

  it.each(publicPaths)("treats %s as a public page (header + Jessica shown)", (p) => {
    expect(isInternalRoute(p)).toBe(false);
  });

  const protectedPaths = [
    "/command-center",
    "/lead-dashboard",
    "/customers",
    "/customers/42",
    "/opportunities",
    "/calendar",
    "/jobs",
    "/jobs/7",
    "/field/today",
    "/marketing-dashboard",
    "/sms-campaigns",
    "/analytics",
    "/takeoff-ai",
    "/takeoff-ai/9",
    "/settings/integrations",
    "/team-management",
    "/admin",
  ];

  it.each(protectedPaths)("treats %s as internal (header + Jessica hidden)", (p) => {
    expect(isInternalRoute(p)).toBe(true);
  });

  it("ignores query strings and hashes", () => {
    expect(isInternalRoute("/command-center?tab=1")).toBe(true);
    expect(isInternalRoute("/about#team")).toBe(false);
  });

  it("does not treat a lookalike public path as internal", () => {
    // "/admin" is internal but "/administrative-services" must not match.
    expect(isInternalRoute("/administrative-services")).toBe(false);
    expect(isInternalRoute("/jobsite-tips")).toBe(false);
  });
});

/* ── Departments render in the expected order ──────────────────────────── */
// Covers: "internal sidebar displays correct departments".

describe("department structure", () => {
  it("defines the eight spec departments in order", () => {
    expect(DEPARTMENTS.map((d) => d.label)).toEqual([
      "Home",
      "Sales",
      "Dispatch & Field",
      "Marketing",
      "Accounting",
      "AI & Automation",
      "Analytics",
      "Administration",
    ]);
  });

  it("puts the expected tools under Sales", () => {
    const sales = DEPARTMENTS.find((d) => d.id === "sales")!;
    expect(sales.items.map((i) => i.label)).toEqual([
      "Lead Inbox",
      "Contacts",
      "Opportunity Center",
      "Lead Scoring",
    ]);
  });

  it("every visible item opens a real route (no disabled placeholders)", () => {
    for (const dept of DEPARTMENTS) {
      for (const item of dept.items) {
        expect(item.path.startsWith("/")).toBe(true);
      }
    }
  });
});

/* ── Role resolution ───────────────────────────────────────────────────── */

describe("resolveNavRole", () => {
  it("returns member for anonymous / unknown users", () => {
    expect(resolveNavRole(null)).toBe("member");
    expect(resolveNavRole(undefined)).toBe("member");
    expect(resolveNavRole({ role: "user" })).toBe("member");
    expect(resolveNavRole({ role: "user", teamRole: "member" })).toBe("member");
  });

  it("recognises admins by user role or team role", () => {
    expect(resolveNavRole({ role: "admin" })).toBe("admin");
    expect(resolveNavRole({ role: "user", teamRole: "admin" })).toBe("admin");
  });

  it("resolves viewer team sessions to the read-only viewer role", () => {
    expect(resolveNavRole({ role: "user", teamRole: "viewer" })).toBe("viewer");
  });

  it("only ever returns a production role (never a specialised one)", () => {
    const samples = [
      null,
      undefined,
      { role: "user" },
      { role: "admin" },
      { role: "user", teamRole: "admin" },
      { role: "user", teamRole: "viewer" },
      { role: "user", teamRole: "member" },
    ];
    for (const s of samples) {
      expect(PRODUCTION_ROLES).toContain(resolveNavRole(s));
    }
    expect(PRODUCTION_ROLES).toEqual(["admin", "member", "viewer"]);
  });
});

/* ── Role-based visibility ─────────────────────────────────────────────── */
// Covers: "role-based navigation items are filtered correctly".

describe("getVisibleDepartments", () => {
  const deptIds = (role: NavRole) => getVisibleDepartments(role).map((d) => d.id);
  const itemLabels = (role: NavRole, deptId: string) =>
    getVisibleDepartments(role)
      .find((d) => d.id === deptId)
      ?.items.map((i) => i.label) ?? [];

  it("admin sees every department including Administration", () => {
    expect(deptIds("admin")).toEqual([
      "home",
      "sales",
      "dispatch",
      "marketing",
      "accounting",
      "ai",
      "analytics",
      "admin",
    ]);
  });

  it("non-admins never see the Administration department", () => {
    for (const role of ["sales", "dispatcher", "technician", "marketing", "member"] as NavRole[]) {
      expect(deptIds(role)).not.toContain("admin");
    }
  });

  it("member sees the full CRM minus Administration", () => {
    expect(deptIds("member")).toEqual([
      "home",
      "sales",
      "dispatch",
      "marketing",
      "accounting",
      "ai",
      "analytics",
    ]);
  });

  it("viewer (read-only) sees the same operational departments as a member", () => {
    // Viewer is a production role: same visibility as member, read-only enforced
    // by the app layer (not navigation).
    expect(deptIds("viewer")).toEqual(deptIds("member"));
  });

  // The four tests below exercise the FUTURE role mapping helpers. No real user
  // resolves to these roles yet (resolveNavRole only returns admin/member/viewer);
  // they are kept and tested so the mechanism is ready when a role field is added.

  it("sales sees Sales tools, Calendar and Command Center — not Marketing or Dispatch jobs", () => {
    expect(deptIds("sales")).toEqual(["home", "sales", "dispatch"]);
    expect(itemLabels("sales", "sales")).toEqual([
      "Lead Inbox",
      "Contacts",
      "Opportunity Center",
      "Lead Scoring",
    ]);
    // Only the Calendar leaks into Dispatch for a salesperson.
    expect(itemLabels("sales", "dispatch")).toEqual(["Calendar"]);
    expect(deptIds("sales")).not.toContain("marketing");
  });

  it("dispatcher sees Dispatch & Field plus Contacts", () => {
    expect(deptIds("dispatcher")).toEqual(["home", "sales", "dispatch"]);
    expect(itemLabels("dispatcher", "sales")).toEqual(["Contacts"]);
    expect(itemLabels("dispatcher", "dispatch")).toEqual([
      "Calendar",
      "Appointments",
      "Jobs",
      "Field Today",
    ]);
  });

  it("technician only sees Command Center and their field tools", () => {
    expect(deptIds("technician")).toEqual(["home", "dispatch"]);
    expect(itemLabels("technician", "dispatch")).toEqual([
      "Calendar",
      "Appointments",
      "Jobs",
      "Field Today",
    ]);
    expect(deptIds("technician")).not.toContain("sales");
    expect(deptIds("technician")).not.toContain("marketing");
  });

  it("marketing sees Marketing, Lead Inbox and Analytics", () => {
    expect(deptIds("marketing")).toEqual(["home", "sales", "marketing", "analytics"]);
    expect(itemLabels("marketing", "sales")).toEqual(["Lead Inbox"]);
    expect(itemLabels("marketing", "marketing")).toEqual([
      "Marketing Dashboard",
      "SMS Campaigns",
      "Campaign Performance",
      "Google Ads",
      "Facebook Ads",
    ]);
  });
});

/* ── Active-department detection ────────────────────────────────────────── */
// Covers: "active department expands" + active-page highlighting.

describe("getActiveDepartmentId", () => {
  it("resolves top-level and nested routes to their department", () => {
    expect(getActiveDepartmentId("/command-center")).toBe("home");
    expect(getActiveDepartmentId("/lead-dashboard")).toBe("sales");
    expect(getActiveDepartmentId("/customers/42")).toBe("sales");
    expect(getActiveDepartmentId("/jobs/7")).toBe("dispatch");
    expect(getActiveDepartmentId("/takeoff-ai/9")).toBe("analytics");
    expect(getActiveDepartmentId("/team-management")).toBe("admin");
  });

  it("resolves a route shared by two departments to the first that owns it", () => {
    // QuickBooks (Accounting) and Integrations (Administration) both link to
    // /settings/integrations; Accounting appears first in the sidebar.
    expect(getActiveDepartmentId("/settings/integrations")).toBe("accounting");
  });

  it("returns null for unknown / public routes", () => {
    expect(getActiveDepartmentId("/about")).toBeNull();
  });

  it("highlights the owning item path", () => {
    expect(getActiveItemPath("/customers/42")).toBe("/customers");
    expect(getActiveItemPath("/analytics")).toBe("/analytics");
  });
});

/* ── De-duplicated active highlight (routes reused across departments) ──── */
// Covers: "no duplicated nav highlight" — when two items share a route only the
// primary one (matching the auto-expanded department) is highlighted.

describe("getActiveItemKey", () => {
  const admin = getVisibleDepartments("admin");

  it("picks a single primary item when a route is shared", () => {
    // /calendar => Calendar (primary), not Appointments.
    expect(getActiveItemKey(admin, "/calendar")).toBe("dispatch::Calendar");
    // /opportunities => Opportunity Center (Sales), not Estimates (Accounting).
    expect(getActiveItemKey(admin, "/opportunities")).toBe("sales::Opportunity Center");
    // /settings/integrations => QuickBooks (Accounting appears before Admin).
    expect(getActiveItemKey(admin, "/settings/integrations")).toBe("accounting::QuickBooks");
  });

  it("respects role filtering (member can't match an admin-only owner)", () => {
    const member = getVisibleDepartments("member");
    // Member never sees Administration, so the integrations route resolves to
    // the Accounting/QuickBooks entry they can actually see.
    expect(getActiveItemKey(member, "/settings/integrations")).toBe("accounting::QuickBooks");
  });

  it("resolves nested routes and returns null off-route", () => {
    expect(getActiveItemKey(admin, "/customers/42")).toBe("sales::Contacts");
    expect(getActiveItemKey(admin, "/about")).toBeNull();
  });
});

/* ── Collapsible department behaviour ──────────────────────────────────── */
// Covers: "active department expands", collapse memory, and (as the data layer
// behind) the mobile drawer, whose sections use the same open-state helpers.

describe("collapsible departments", () => {
  it("expands the active department by default and collapses the rest", () => {
    expect(isDepartmentOpen("sales", "sales", {})).toBe(true);
    expect(isDepartmentOpen("marketing", "sales", {})).toBe(false);
  });

  it("remembers an explicit user choice over the active-department default", () => {
    // User collapsed the active department -> stays collapsed.
    expect(isDepartmentOpen("sales", "sales", { sales: false })).toBe(false);
    // User expanded a non-active department -> stays open.
    expect(isDepartmentOpen("marketing", "sales", { marketing: true })).toBe(true);
  });

  it("round-trips persisted state and tolerates corrupt data", () => {
    const state = { sales: false, marketing: true };
    expect(loadDepartmentOpenState(serializeDepartmentOpenState(state))).toEqual(state);
    expect(loadDepartmentOpenState(null)).toEqual({});
    expect(loadDepartmentOpenState("{not json")).toEqual({});
    expect(loadDepartmentOpenState('{"sales":"nope"}')).toEqual({});
  });
});
