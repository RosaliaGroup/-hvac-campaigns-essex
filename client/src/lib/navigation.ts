/**
 * Central, framework-free navigation model for the internal CRM dashboard.
 *
 * This module is deliberately free of React / DOM so it can be unit-tested in
 * vitest's `node` environment (see vitest.config.ts include for
 * `client/src/**​/*.test.ts`). The React sidebar (`DashboardLayout`) and the
 * Command Center department cards both consume this single source of truth so
 * they can never drift apart.
 *
 * Icons are referenced by string key and mapped to lucide-react components in
 * the UI layer (keeps this file serializable and test-friendly).
 */

/* ── Roles ─────────────────────────────────────────────────────────────── */

/**
 * Navigation roles.
 *
 * PRODUCTION roles — the only ones the current auth schema can actually produce
 * and the only ones `resolveNavRole` ever returns:
 *   - `admin`   users.role === "admin" OR team session teamRole "admin"
 *   - `viewer`  team session teamRole "viewer" (read-only where supported)
 *   - `member`  everyone else (default operational employee)
 *
 * FUTURE roles — `sales` / `dispatcher` / `technician` / `marketing` are kept as
 * mapping helpers only. `getVisibleDepartments` understands them so the model is
 * ready, but no user currently resolves to them and NO schema/auth change is made
 * here. They activate once a role/department field is added in a later task.
 */
export type NavRole =
  | "admin"
  | "sales"
  | "dispatcher"
  | "technician"
  | "marketing"
  | "member"
  | "viewer";

export const ALL_ROLES: NavRole[] = [
  "admin",
  "sales",
  "dispatcher",
  "technician",
  "marketing",
  "member",
  "viewer",
];

/** Roles a real user can currently be resolved to in production. */
export const PRODUCTION_ROLES: NavRole[] = ["admin", "member", "viewer"];

/* ── Nav model ─────────────────────────────────────────────────────────── */

export type NavItem = {
  label: string;
  /** Route the item links to. Every visible item opens a real, existing route. */
  path: string;
  /** lucide-react icon name (mapped to a component in the UI layer). */
  icon: string;
  /**
   * Non-admin roles that may see this item. `admin` always sees everything and
   * is intentionally omitted from these arrays. An empty array => admin-only.
   */
  roles: NavRole[];
};

export type NavDepartment = {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
};

/**
 * `member` is the generic authenticated employee: full CRM visibility EXCEPT
 * the Administration department. The specialised roles are subsets.
 */
const CRM = "member" as const;

export const DEPARTMENTS: NavDepartment[] = [
  {
    id: "home",
    label: "Home",
    icon: "Home",
    items: [
      { label: "Command Center", path: "/command-center", icon: "LayoutDashboard", roles: ["sales", "dispatcher", "technician", "marketing", CRM] },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "Users",
    items: [
      { label: "Lead Inbox", path: "/lead-dashboard", icon: "Inbox", roles: ["sales", "marketing", CRM] },
      { label: "Contacts", path: "/customers", icon: "UserRound", roles: ["sales", "dispatcher", CRM] },
      { label: "Opportunity Center", path: "/opportunities", icon: "Target", roles: ["sales", CRM] },
      { label: "Lead Scoring", path: "/lead-scoring", icon: "Star", roles: ["sales", CRM] },
    ],
  },
  {
    id: "dispatch",
    label: "Dispatch & Field",
    icon: "CalendarClock",
    items: [
      { label: "Calendar", path: "/calendar", icon: "CalendarClock", roles: ["sales", "dispatcher", "technician", CRM] },
      // No dedicated appointments route exists — appointments live on the calendar.
      { label: "Appointments", path: "/calendar", icon: "CalendarCheck", roles: ["dispatcher", "technician", CRM] },
      { label: "Jobs", path: "/jobs", icon: "Briefcase", roles: ["dispatcher", "technician", CRM] },
      { label: "Field Today", path: "/field/today", icon: "MapPin", roles: ["dispatcher", "technician", CRM] },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: "Megaphone",
    items: [
      { label: "Marketing Dashboard", path: "/marketing-dashboard", icon: "Megaphone", roles: ["marketing", CRM] },
      { label: "SMS Campaigns", path: "/sms-campaigns", icon: "MessageSquare", roles: ["marketing", CRM] },
      { label: "Campaign Performance", path: "/campaign-performance", icon: "BarChart3", roles: ["marketing", CRM] },
      { label: "Google Ads", path: "/google-ads-campaigns", icon: "Search", roles: ["marketing", CRM] },
      { label: "Facebook Ads", path: "/facebook-campaigns", icon: "Facebook", roles: ["marketing", CRM] },
    ],
  },
  {
    id: "accounting",
    label: "Accounting",
    icon: "Calculator",
    items: [
      // QuickBooks lives on the Integrations page; estimates/proposals are managed
      // in the Opportunity Center. Invoices/Sync Logs are hidden until real pages
      // exist (no placeholder links shown to users).
      { label: "QuickBooks", path: "/settings/integrations", icon: "Calculator", roles: [CRM] },
      { label: "Estimates / Proposals", path: "/opportunities", icon: "FileText", roles: [CRM] },
    ],
  },
  {
    id: "ai",
    label: "AI & Automation",
    icon: "Bot",
    items: [
      { label: "AI VA Dashboard", path: "/ai-va-dashboard", icon: "Bot", roles: [CRM] },
      { label: "AI Script Manager", path: "/ai-script-manager", icon: "FileText", roles: [CRM] },
      { label: "AI VA Settings", path: "/ai-va-settings", icon: "Settings", roles: [CRM] },
      { label: "Automations", path: "/marketing-autopilot", icon: "Zap", roles: [CRM] },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "BarChart3",
    items: [
      { label: "Analytics & Reports", path: "/analytics", icon: "BarChart3", roles: ["marketing", CRM] },
      { label: "AI Take-Off", path: "/takeoff-ai", icon: "Ruler", roles: [CRM] },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    icon: "ShieldCheck",
    items: [
      // Admin-only: empty `roles` array means no non-admin role qualifies.
      { label: "Team Members", path: "/team-management", icon: "Users", roles: [] },
      { label: "Settings", path: "/admin", icon: "Settings", roles: [] },
      { label: "Integrations", path: "/settings/integrations", icon: "Plug", roles: [] },
    ],
  },
];

/* ── Internal-route detection ──────────────────────────────────────────── */

/**
 * Route prefixes that belong to the internal CRM dashboard. When the current
 * location matches one of these the public website chrome (header, footer,
 * Jessica chatbot) is hidden and the dashboard sidebar is shown instead.
 */
export const INTERNAL_ROUTE_PREFIXES: string[] = [
  "/command-center",
  "/marketing-autopilot",
  "/marketing-dashboard",
  "/leads",
  "/lead-dashboard",
  "/customers",
  "/contacts",
  "/settings",
  "/calendar",
  "/field",
  "/jobs",
  "/opportunities",
  "/campaign-performance",
  "/google-ads-campaigns",
  "/facebook-campaigns",
  "/facebook-ads-campaigns",
  "/email-sms-campaigns",
  "/sms-campaigns",
  "/campaign-generator",
  "/ai-va-dashboard",
  "/ai-va-settings",
  "/lead-scoring",
  "/ai-assistant-prompts",
  "/ai-script-manager",
  "/admin",
  "/team-management",
  "/assessment-submissions",
  "/analytics",
  "/takeoff-ai",
];

/** Strip query string / hash and normalise a location to its pathname. */
function toPathname(location: string): string {
  if (!location) return "/";
  const path = location.split(/[?#]/)[0];
  return path || "/";
}

/** True when `location` is inside the protected internal CRM dashboard. */
export function isInternalRoute(location: string): boolean {
  const path = toPathname(location);
  return INTERNAL_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/* ── Role resolution ───────────────────────────────────────────────────── */

type UserLike =
  | {
      role?: string | null;
      teamRole?: string | null;
    }
  | null
  | undefined;

/**
 * Map an authenticated user to a PRODUCTION navigation role. Only `admin`,
 * `viewer` and `member` are ever returned, matching what the auth schema stores
 * today (`users.role` "user"|"admin"; team sessions add teamRole
 * "admin"|"member"|"viewer"). The specialised sales/dispatcher/technician/
 * marketing roles are intentionally NOT produced here — no user resolves to them
 * until a role/department field is added in a later task. Never throws.
 */
export function resolveNavRole(user: UserLike): NavRole {
  if (!user) return "member";
  if (user.role === "admin" || user.teamRole === "admin") return "admin";
  if (user.teamRole === "viewer") return "viewer";
  return "member";
}

/* ── Filtering ─────────────────────────────────────────────────────────── */

function itemVisibleForRole(item: NavItem, role: NavRole): boolean {
  if (role === "admin") return true;
  // Viewer is read-only but sees the same operational departments as a member.
  const effective: NavRole = role === "viewer" ? "member" : role;
  return item.roles.includes(effective);
}

/**
 * Departments (and their items) visible to `role`. Departments with no visible
 * items are dropped entirely, so e.g. a technician never sees an empty
 * "Marketing" heading.
 */
export function getVisibleDepartments(role: NavRole): NavDepartment[] {
  return DEPARTMENTS.map((dept) => ({
    ...dept,
    items: dept.items.filter((item) => itemVisibleForRole(item, role)),
  })).filter((dept) => dept.items.length > 0);
}

/* ── Active-department detection ────────────────────────────────────────── */

/** Does `path` match this item's route (exact or nested child route)? */
function itemMatchesPath(item: NavItem, path: string): boolean {
  if (!item.path) return false;
  return path === item.path || path.startsWith(`${item.path}/`);
}

/**
 * The id of the department that owns the current location, or null if none.
 * Handles nested routes (e.g. /customers/42 → "sales", /jobs/7 → "dispatch").
 * Prefers the longest matching item path so /settings/integrations resolves to
 * Administration rather than a shorter accidental prefix.
 */
export function getActiveDepartmentId(location: string): string | null {
  const path = toPathname(location);
  let bestDeptId: string | null = null;
  let bestLen = -1;
  for (const dept of DEPARTMENTS) {
    for (const item of dept.items) {
      if (itemMatchesPath(item, path) && item.path.length > bestLen) {
        bestLen = item.path.length;
        bestDeptId = dept.id;
      }
    }
  }
  return bestDeptId;
}

/**
 * Canonical active item, as a stable `${deptId}::${label}` key, chosen from an
 * already role-filtered department list. When two items point at the same route
 * (e.g. Calendar + Appointments → /calendar, or Opportunity Center + Estimates →
 * /opportunities) only ONE — the primary, in the same department that
 * `getActiveDepartmentId` expands — is highlighted. Returns null off-route.
 */
export function getActiveItemKey(
  departments: NavDepartment[],
  location: string
): string | null {
  const path = toPathname(location);
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const dept of departments) {
    for (const item of dept.items) {
      if (itemMatchesPath(item, path) && item.path.length > bestLen) {
        bestLen = item.path.length;
        bestKey = `${dept.id}::${item.label}`;
      }
    }
  }
  return bestKey;
}

/** The active item's exact path (for highlighting), or null. */
export function getActiveItemPath(location: string): string | null {
  const path = toPathname(location);
  let best: string | null = null;
  let bestLen = -1;
  for (const dept of DEPARTMENTS) {
    for (const item of dept.items) {
      if (itemMatchesPath(item, path) && item.path.length > bestLen) {
        bestLen = item.path.length;
        best = item.path;
      }
    }
  }
  return best;
}

/* ── Collapsible-department state (persisted to localStorage) ───────────── */

export const NAV_COLLAPSE_STORAGE_KEY = "me-nav-open-departments";

/** Map of departmentId -> explicit user open/closed choice. */
export type DepartmentOpenState = Record<string, boolean>;

/** Parse persisted open-state; tolerant of missing/corrupt data. */
export function loadDepartmentOpenState(raw: string | null): DepartmentOpenState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: DepartmentOpenState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeDepartmentOpenState(state: DepartmentOpenState): string {
  return JSON.stringify(state);
}

/**
 * Whether a department section should render expanded.
 *
 * Rules (spec §3):
 *  - an explicit user choice always wins (remembered collapsed state);
 *  - otherwise the department that owns the current page is expanded;
 *  - every other department is collapsed by default (never expand everything).
 */
export function isDepartmentOpen(
  deptId: string,
  activeDeptId: string | null,
  userState: DepartmentOpenState
): boolean {
  if (Object.prototype.hasOwnProperty.call(userState, deptId)) {
    return userState[deptId];
  }
  return deptId === activeDeptId;
}
