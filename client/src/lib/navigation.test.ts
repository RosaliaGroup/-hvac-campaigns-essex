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
  getDepartmentPrimaryPath,
  isDepartmentOpen,
  initialDepartmentOpenState,
  toggleDepartmentOpen,
  type NavRole,
} from "./navigation";

// Every route the dashboard nav is allowed to link to. Mirrors the protected
// routes registered in App.tsx — a visible item pointing anywhere else would be
// a dead link. Kept here so "no visible item points to a missing route" is
// enforced by the test suite.
const KNOWN_ROUTES = new Set<string>([
  "/command-center",
  "/lead-dashboard",
  "/customers",
  "/opportunities",
  "/lead-scoring",
  "/calendar",
  "/jobs",
  "/field/today",
  "/marketing-dashboard",
  "/marketing/analytics",
  "/seo-intelligence",
  "/revenue-attribution",
  "/local-seo",
  "/sms-campaigns",
  "/campaign-performance",
  "/google-ads-campaigns",
  "/facebook-campaigns",
  "/settings/integrations",
  "/ai-va-dashboard",
  "/ai-script-manager",
  "/ai-va-settings",
  "/marketing-autopilot",
  "/analytics",
  "/takeoff-ai",
  "/team-management",
  "/admin",
]);

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

  it("Home has a single child named Dashboard → /command-center", () => {
    const home = DEPARTMENTS.find((d) => d.id === "home")!;
    expect(home.items).toHaveLength(1);
    expect(home.items[0].label).toBe("Dashboard");
    expect(home.items[0].path).toBe("/command-center");
  });

  it("every visible item opens a real, registered route (no dead links)", () => {
    for (const dept of DEPARTMENTS) {
      for (const item of dept.items) {
        expect(item.path.startsWith("/")).toBe(true);
        expect(KNOWN_ROUTES.has(item.path)).toBe(true);
      }
    }
  });

  it("every department's primary route is a real, registered route", () => {
    for (const dept of DEPARTMENTS) {
      expect(KNOWN_ROUTES.has(dept.primaryPath)).toBe(true);
    }
  });

  it("maps each department card title to its primary route", () => {
    const primary = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d.primaryPath]));
    expect(primary).toEqual({
      home: "/command-center",
      sales: "/lead-dashboard",
      dispatch: "/calendar",
      marketing: "/marketing-dashboard",
      accounting: "/opportunities",
      ai: "/ai-va-dashboard",
      analytics: "/analytics",
      admin: "/team-management",
    });
    expect(getDepartmentPrimaryPath("marketing")).toBe("/marketing-dashboard");
    expect(getDepartmentPrimaryPath("nope")).toBeNull();
  });

  it("does not duplicate a route across departments except by deliberate shared-route rule", () => {
    // /calendar (Calendar+Appointments, same dept) and /opportunities
    // (Opportunity Center in Sales + Estimates in Accounting) are the only
    // intentional shared routes. Nothing else should repeat.
    const seen = new Map<string, string[]>();
    for (const dept of DEPARTMENTS) {
      for (const item of dept.items) {
        seen.set(item.path, [...(seen.get(item.path) ?? []), `${dept.id}::${item.label}`]);
      }
    }
    const shared = [...seen.entries()].filter(([, owners]) => owners.length > 1).map(([p]) => p);
    expect(shared.sort()).toEqual(["/calendar", "/opportunities"]);
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
      "SEO Intelligence",
      "Revenue Attribution",
      "SMS Campaigns",
      "Campaign Performance",
      "Google Ads",
      "Facebook/Instagram",
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

  it("resolves the integrations route to Accounting (its sole owner)", () => {
    // Integrations is now owned by Accounting (QuickBooks / Integrations) and is
    // no longer duplicated under Administration.
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
    // /settings/integrations => the QuickBooks / Integrations entry under Accounting.
    expect(getActiveItemKey(admin, "/settings/integrations")).toBe("accounting::QuickBooks / Integrations");
  });

  it("resolves the integrations route the same for members (Accounting owns it)", () => {
    const member = getVisibleDepartments("member");
    expect(getActiveItemKey(member, "/settings/integrations")).toBe("accounting::QuickBooks / Integrations");
  });

  it("resolves nested routes and returns null off-route", () => {
    expect(getActiveItemKey(admin, "/customers/42")).toBe("sales::Contacts");
    expect(getActiveItemKey(admin, "/about")).toBeNull();
  });
});

/* ── Accordion department behaviour ────────────────────────────────────── */
// Covers: "active department auto-expands", "clicking the row expands/collapses",
// and reduced clutter (only the active section open by default; not persisted).

describe("accordion departments", () => {
  it("auto-expands ONLY the active department by default", () => {
    const state = initialDepartmentOpenState("sales");
    expect(isDepartmentOpen("sales", state)).toBe(true);
    expect(isDepartmentOpen("marketing", state)).toBe(false);
    expect(isDepartmentOpen("admin", state)).toBe(false);
    // Off-route: nothing forced open.
    expect(initialDepartmentOpenState(null)).toEqual({});
  });

  it("toggles a department open/closed when its row is clicked", () => {
    let state = initialDepartmentOpenState("sales"); // { sales: true }
    // Clicking a collapsed department opens it.
    state = toggleDepartmentOpen(state, "marketing");
    expect(isDepartmentOpen("marketing", state)).toBe(true);
    // Clicking it again collapses it.
    state = toggleDepartmentOpen(state, "marketing");
    expect(isDepartmentOpen("marketing", state)).toBe(false);
    // Clicking the active department collapses it too (full-row toggle).
    state = toggleDepartmentOpen(state, "sales");
    expect(isDepartmentOpen("sales", state)).toBe(false);
  });

  it("does not keep every visited section open (state resets per active route)", () => {
    // Simulate navigating sales -> marketing: the previous open section is gone.
    const afterSales = initialDepartmentOpenState("sales");
    const afterMarketing = initialDepartmentOpenState("marketing");
    expect(isDepartmentOpen("sales", afterMarketing)).toBe(false);
    expect(Object.keys(afterMarketing)).toEqual(["marketing"]);
  });
});
