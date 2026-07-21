/**
 * Render-level tests for the CRM title-case formatter wiring.
 *
 * Lightweight: renders the REAL page/components to static HTML via
 * react-dom/server (no jsdom, no browser, no E2E) with the data layer (trpc),
 * router (wouter), toasts, layout chrome, and DOM-portal UI primitives stubbed.
 * We assert on the rendered markup string: names/addresses are title-cased,
 * while emails / phones / URLs / QuickBooks ids / CSS classes / <a> links /
 * <table> structure are untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import path from "path";

// Mutable fixture map the trpc mock reads, keyed by "namespace.procedure".
const { fixtures } = vi.hoisted(() => ({ fixtures: {} as Record<string, unknown> }));

// ── Data layer: any trpc.<ns>.<proc>.useQuery() returns fixtures[ns.proc]. ─────
vi.mock("@/lib/trpc", () => {
  const proc = (key: string) => ({
    useQuery: () => ({ data: fixtures[key], isLoading: false, isError: false, error: null, refetch() {} }),
    useMutation: () => ({ mutate() {}, mutateAsync: async () => ({}), isPending: false, isError: false, reset() {} }),
    useInfiniteQuery: () => ({ data: { pages: [] }, isLoading: false, hasNextPage: false, fetchNextPage() {} }),
  });
  const deep = (): unknown => {
    const f: unknown = () => {};
    return new Proxy(f as object, { get: () => deep(), apply: () => Promise.resolve() });
  };
  const trpc = new Proxy({}, {
    get: (_t, ns) => {
      const s = String(ns);
      if (s === "useContext" || s === "useUtils") return () => deep();
      if (s === "Provider") return (p: { children?: unknown }) => p?.children;
      return new Proxy({}, { get: (_t2, p) => proc(`${s}.${String(p)}`) });
    },
  });
  return { trpc };
});

// ── Router / toast / layout chrome ─────────────────────────────────────────────
vi.mock("wouter", async () => {
  const { createElement } = await import("react");
  return {
    useLocation: () => ["/", () => {}],
    useParams: () => ({ id: "1" }),
    useRoute: () => [false, {}],
    useSearch: () => "",
    Link: (p: { href?: string; to?: string; children?: unknown }) =>
      createElement("a", { href: p.href ?? p.to ?? "#" }, p.children),
    Redirect: () => null,
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => {} }), toast: () => {} }));
// useAuth touches localStorage in a useMemo — stub it for static SSR rendering
// (CustomerDetail's QuickBooks card reads the current user to gate an admin action).
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false, isAuthenticated: false }) }));
vi.mock("@/components/DashboardLayout", async () => {
  const { createElement } = await import("react");
  return { default: (p: { children?: unknown }) => createElement("div", null, p.children) };
});
vi.mock("@/components/InternalNav", () => ({ default: () => null }));

// ── DOM-portal UI primitives → simple passthrough stubs ────────────────────────
async function passthroughModule(names: string[]) {
  const { createElement } = await import("react");
  const pass = (p: { children?: unknown }) => createElement("div", null, p?.children);
  return Object.fromEntries(names.map((n) => [n, pass]));
}
vi.mock("@/components/ui/dialog", async () => ({
  ...(await passthroughModule(["Dialog", "DialogContent", "DialogHeader", "DialogFooter", "DialogTitle", "DialogTrigger", "DialogDescription"])),
  // The shared Input reads this optional composition context; a no-op is fine.
  useDialogComposition: () => undefined,
}));
vi.mock("@/components/ui/select", () =>
  passthroughModule(["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue", "SelectGroup", "SelectLabel"]));
vi.mock("@/components/ui/tabs", () =>
  passthroughModule(["Tabs", "TabsList", "TabsTrigger", "TabsContent"]));
vi.mock("@/components/ui/sheet", () =>
  passthroughModule(["Sheet", "SheetContent", "SheetHeader", "SheetFooter", "SheetTitle", "SheetTrigger", "SheetDescription"]));

// Real components under test (import AFTER mocks; vitest hoists mocks anyway).
import Customers from "@/pages/Customers";
import Jobs from "@/pages/Jobs";
import CustomerDetail from "@/pages/CustomerDetail";
import JobDetail from "@/pages/JobDetail";
import AllOpportunitiesTab from "@/components/opportunity/AllOpportunitiesTab";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

beforeEach(() => {
  for (const k of Object.keys(fixtures)) delete fixtures[k];
});

describe("Customers list — names title-cased, contact info untouched", () => {
  beforeEach(() => {
    fixtures["customers.stats"] = { total: 5 };
    fixtures["customers.list"] = {
      total: 5,
      items: [
        { id: 1, type: "residential", displayName: "ANA HAYNES", relationship: "lead", phone: "2015551234", email: "ana@Example.COM", source: "quickbooks", status: "active" },
        { id: 2, type: "residential", displayName: "ana haynes", relationship: "lead", phone: null, email: null, source: "web", status: "active" },
        { id: 3, type: "commercial", displayName: "55 WEST 21 STREET LLC", relationship: "customer", phone: "+1 (201) 555-9000", email: "ops@Example.COM", source: "quickbooks", status: "active" },
        { id: 4, type: "commercial", displayName: "PDC LLC", relationship: "customer", phone: null, email: null, source: "quickbooks", status: "active" },
        { id: 5, type: "residential", displayName: "McDonald", relationship: "lead", phone: null, email: null, source: "web", status: "active" },
      ],
    };
  });

  it("title-cases customer names but preserves acronyms / mixed case", () => {
    const html = render(h(Customers));
    expect(html).toContain("Ana Haynes");        // ANA HAYNES → Ana Haynes
    expect(html).toContain("55 West 21 Street LLC"); // company + acronym
    expect(html).toContain("PDC LLC");            // acronyms preserved
    expect(html).toContain("McDonald");           // mixed case preserved
    expect(html).not.toContain("ANA HAYNES");
    expect(html).not.toContain("55 WEST 21 STREET LLC");
  });

  it("leaves emails and phone numbers byte-for-byte", () => {
    const html = render(h(Customers));
    expect(html).toContain("ana@Example.COM");
    expect(html).toContain("ops@Example.COM");
    expect(html).toContain("2015551234");
    expect(html).toContain("+1 (201) 555-9000");
  });

  it("preserves table structure and CSS classes", () => {
    const html = render(h(Customers));
    expect(html).toContain("<table");
    expect(html).toContain("<tbody");
    expect(html).toContain("<tr");
    expect(html).toMatch(/class="[^"]*capitalize[^"]*"/); // enum column class untouched
  });
});

describe("Jobs list — customer name title-cased", () => {
  beforeEach(() => {
    fixtures["jobs.stats"] = { total: 1, scheduled: 0, inProgress: 0, completed: 0 };
    fixtures["appointments.assignees"] = [];
    fixtures["jobs.list"] = {
      total: 1,
      items: [
        {
          job: { id: 1, jobNumber: "J-1001", title: "AC Repair", priority: "normal", archivedAt: null, scheduledStartAt: null, status: "scheduled" },
          customerName: "NATANYA L PHIPPS",
          assigneeName: null,
          lineTotal: 100,
        },
      ],
    };
  });

  it("renders the customer name in Title Case and keeps the job number id", () => {
    const html = render(h(Jobs));
    expect(html).toContain("Natanya L Phipps"); // NATANYA L PHIPPS → Natanya L Phipps
    expect(html).not.toContain("NATANYA L PHIPPS");
    expect(html).toContain("J-1001"); // identifier untouched
    expect(html).toContain("<table");
  });
});

describe("Opportunities table — company/customer title-cased", () => {
  beforeEach(() => {
    fixtures["opportunities.salespeople"] = [];
    fixtures["opportunities.list"] = {
      total: 1,
      totals: { count: 1, totalValue: 1000, weightedValue: 500, quickbooksTotal: 1000 },
      items: [
        {
          id: 1, customerCompany: "55 WEST 21 STREET LLC", customerName: "ANA HAYNES",
          workCategory: "hvac", amount: "1000", stage: "lead", docStatus: "pending",
          sentAt: null, daysPending: 3, agingBucket: "fresh", nextActionDueAt: null,
          valueDiffersFromQuickbooks: false, assignedToId: null,
        },
      ],
    };
  });

  it("title-cases the company name and preserves the LLC acronym", () => {
    const html = render(h(AllOpportunitiesTab, { onOpen: () => {} }));
    expect(html).toContain("55 West 21 Street LLC");
    expect(html).not.toContain("55 WEST 21 STREET LLC");
    expect(html).toContain("<table");
  });
});

describe("Customer Detail + Properties — name, company, address, state code", () => {
  beforeEach(() => {
    fixtures["jobs.list"] = { items: [], total: 0 };
    fixtures["quickbooks.getStatus"] = { connected: false };
    fixtures["customers.getById"] = {
      customer: {
        id: 1, type: "commercial", firstName: null, lastName: null,
        companyName: "55 WEST 21 STREET LLC", displayName: "55 WEST 21 STREET LLC",
        email: "ops@Example.COM", phone: "+1 (201) 555-9000", altPhone: null, notes: null,
        status: "active", source: "quickbooks", quickbooksSyncStatus: "synced",
        quickbooksCustomerId: "QB-42", quickbooksRawDisplayName: null,
      },
      properties: [
        { id: 10, label: "MAIN OFFICE", propertyType: "commercial", addressLine1: "12 MAPLE CT", addressLine2: null, city: "STAMFORD", state: "CT", zip: "06901", isPrimary: true, squareFeet: null, existingSystem: null },
      ],
      appointments: [], leads: [], captures: [], callLogs: [], rebateCalculations: [],
      opportunities: [], estimates: [], invoices: [],
      counts: { properties: 1, jobs: 0, opportunities: 0, estimates: 0, invoices: 0 },
      summary: { activeJobs: 0, openOpportunities: 0, estimates: 0, invoices: 0, properties: 1, collectedRevenue: 0, invoicedTotal: 0, wonOpportunityValue: 0, outstandingBalance: 0, lastActivityAt: null },
    };
  });

  it("title-cases the company/header name and preserves the LLC acronym", () => {
    const html = render(h(CustomerDetail));
    expect(html).toContain("55 West 21 Street LLC");
    expect(html).not.toContain("55 WEST 21 STREET LLC");
  });

  it("formats the property address and keeps CT as the Connecticut state code", () => {
    const html = render(h(CustomerDetail));
    expect(html).toContain("12 Maple Ct");   // CT = Court (street suffix)
    expect(html).toContain("Stamford");
    expect(html).toContain("CT");            // CT = Connecticut (state field, uppercase)
    expect(html).toContain("06901");
    expect(html).not.toContain("12 MAPLE CT");
    expect(html).not.toContain("STAMFORD");
  });

  it("leaves the email, phone and QuickBooks id untouched", () => {
    const html = render(h(CustomerDetail));
    expect(html).toContain("ops@Example.COM");
    expect(html).toContain("+1 (201) 555-9000");
    expect(html).toContain("QB-42");
  });
});

describe("Job Detail — customer name + property address formatted", () => {
  beforeEach(() => {
    fixtures["appointments.assignees"] = [];
    fixtures["jobs.getById"] = {
      job: {
        id: 1, jobNumber: "J-1001", title: "AC Repair", description: null, equipmentServiced: null,
        internalNotes: null, customerVisibleNotes: null, completionSummary: null, assignedToId: null,
        priority: "normal", warrantyStatus: "none", status: "scheduled", jobType: "repair",
        scheduledStartAt: null, scheduledEndAt: null, actualArrivalAt: null, actualCompletionAt: null,
        completedAt: null, archivedAt: null, quickbooksSyncStatus: "not_synced",
      },
      customer: { id: 1, displayName: "ANA HAYNES", phone: "2015551234", email: "ana@x.com", type: "residential" },
      property: { id: 5, addressLine1: "45 N BROAD ST STE 201", city: "NEWARK", state: "NJ", zip: "07102" },
      lineItems: [], appointments: [], assignee: null, opportunity: null, labor: [], parts: [],
      notes: [], attachments: [], additionalTechnicians: [], statusHistory: [], estimates: [], invoices: [],
      lineTotal: 0, partsTotal: 0,
    };
  });

  it("renders the customer name in Title Case and the property address abbreviations", () => {
    const html = render(h(JobDetail));
    expect(html).toContain("Ana Haynes");            // ANA HAYNES → Ana Haynes
    expect(html).toContain("45 N Broad St Ste 201");  // directional + street + unit preserved
    expect(html).toContain("Newark");
    expect(html).not.toContain("ANA HAYNES");
    expect(html).toContain("J-1001");                 // identifier untouched
  });
});

// ── Static wiring proof: every modified file imports & uses the shared formatter ─
describe("wiring — all modified surfaces use @shared/nameFormat (no inline casing)", () => {
  const root = path.resolve(__dirname, "..", "..", "..");
  const WIRED = [
    "client/src/pages/Customers.tsx",
    "client/src/pages/CustomerDetail.tsx",
    "client/src/pages/OpportunityDetail.tsx",
    "client/src/pages/Jobs.tsx",
    "client/src/pages/JobDetail.tsx",
    "client/src/pages/FieldToday.tsx",
    "client/src/pages/LeadTracker.tsx",
    "client/src/components/opportunity/AllOpportunitiesTab.tsx",
    "client/src/components/opportunity/OpportunityDetailDrawer.tsx",
    "client/src/components/opportunity/PipelineBoard.tsx",
    "client/src/components/opportunity/ConvertToJobControl.tsx",
  ];

  it("each wired file imports from @shared/nameFormat and calls a formatter", () => {
    for (const rel of WIRED) {
      const src = readFileSync(path.join(root, rel), "utf8");
      expect(src, `${rel} imports @shared/nameFormat`).toMatch(/from ["']@shared\/nameFormat["']/);
      expect(src, `${rel} calls a formatter`).toMatch(/format(DisplayName|CompanyName|Address|StateCode)\(/);
    }
  });

  it("no wired file reintroduces inline title-casing on rendered fields", () => {
    for (const rel of WIRED) {
      const src = readFileSync(path.join(root, rel), "utf8");
      // crude but effective: a manual "charAt(0).toUpperCase() + ...slice(1)" title-case
      expect(src, `${rel} has no inline title-casing`).not.toMatch(/charAt\(0\)\.toUpperCase\(\)\s*\+/);
    }
  });
});
