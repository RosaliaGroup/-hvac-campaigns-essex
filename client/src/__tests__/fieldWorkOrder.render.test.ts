/**
 * Render-level tests for the technician Work Order page (PR #39).
 * Renders the REAL FieldWorkOrder to static HTML (react-dom/server) with trpc,
 * wouter and toasts stubbed, then asserts on the markup for the conditional-UI
 * requirements: quick actions only when data exists (phone → Call/Text, address
 * → Directions), empty history states, emergency prominence, and the mobile
 * (max-w-xl, no-fixed-width) responsive shell.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { wo } = vi.hoisted(() => ({ wo: { data: null as unknown } }));

vi.mock("@/lib/trpc", () => {
  // FieldWorkOrder now embeds the Notes + Photos sections, which call several
  // procedures + useUtils. A proxy handles them all; the work-order query reads
  // `wo.data`, and the embedded sections default to empty.
  const q = (key: string) => {
    if (key === "jobs.fieldWorkOrder") return { data: wo.data, isLoading: false, isError: false, error: null, refetch() {} };
    if (key === "jobs.fieldListNotes") return { data: { jobCompleted: false, notes: [] }, isLoading: false, isError: false, error: null, refetch() {} };
    if (key === "jobs.fieldListPhotos") return { data: { photos: [] }, isLoading: false, isError: false, error: null, refetch() {} };
    return { data: undefined, isLoading: false, isError: false, error: null, refetch() {} };
  };
  const proc = (key: string) => ({
    useQuery: () => q(key),
    useMutation: () => ({ mutate() {}, mutateAsync: async () => ({}), isPending: false, variables: undefined, reset() {} }),
  });
  const deep = (): unknown => new Proxy(() => {}, { get: () => deep(), apply: () => Promise.resolve() });
  const trpc = new Proxy({}, {
    get: (_t, ns) => {
      const s = String(ns);
      if (s === "useUtils" || s === "useContext") return () => deep();
      return new Proxy({}, { get: (_t2, p) => proc(`${s}.${String(p)}`) });
    },
  });
  return { trpc };
});
vi.mock("wouter", () => ({
  useParams: () => ({ id: "1" }),
  useLocation: () => ["/field/jobs/1", () => {}],
}));
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import FieldWorkOrder from "@/pages/FieldWorkOrder";

type Deep = Record<string, unknown>;
function makeData(over: Deep = {}): Deep {
  return {
    isAdmin: false,
    job: {
      id: 1, jobNumber: "ME-2026-0001", title: "No-Heat Repair", description: "Second floor no heat.",
      priority: "normal", customerId: 7, technicianWorkStatus: "working", scheduledStartAt: "2026-07-17T13:00:00Z",
    },
    customer: { displayName: "Dana Whitfield", phone: "(862) 555-0142", email: "dana@example.com" },
    property: { address: "112 Bloomfield Ave, Montclair, NJ 07042", directionsAvailable: true },
    appointment: {
      appointmentType: "service_call", serviceType: "no_heat", priority: "normal",
      description: "No heat on second floor.", scheduledAt: "2026-07-17T13:00:00Z",
      dispatcherNotes: "Gate code 4417.", source: "phone",
    },
    assignee: { id: 1, name: "Tech Alpha" },
    history: { visits: [], notes: [], photos: [] },
    workStatusEvents: [],
    ...over,
  };
}
const render = () => renderToStaticMarkup(createElement(FieldWorkOrder));

describe("FieldWorkOrder — quick actions appear only when data exists", () => {
  it("shows Call + Text (tel:/sms:) and Directions when phone and address exist", () => {
    wo.data = makeData();
    const html = render();
    expect(html).toContain("Dana Whitfield");
    expect(html).toContain('href="tel:8625550142"');
    expect(html).toContain('href="sms:8625550142"');
    expect(html).toContain("maps/dir"); // Directions link
  });

  it("hides Call/Text and shows 'No phone number' when the phone is missing", () => {
    wo.data = makeData({ customer: { displayName: "Dana Whitfield", phone: null, email: "dana@example.com" } });
    const html = render();
    expect(html).not.toContain("href=\"tel:");
    expect(html).not.toContain("href=\"sms:");
    expect(html).toContain("No phone number");
  });

  it("hides Directions and shows 'No service address' when the address is missing", () => {
    wo.data = makeData({ property: { address: null, directionsAvailable: false } });
    const html = render();
    expect(html).not.toContain("maps/dir");
    expect(html).toContain("No service address");
  });
});

describe("FieldWorkOrder — empty history states", () => {
  it("renders empty states when there is no history", () => {
    wo.data = makeData({ history: { visits: [], notes: [], photos: [] } });
    const html = render();
    expect(html).toContain("No prior visits.");
    expect(html).toContain("No notes yet."); // Notes section (PR #40) empty state
    expect(html).toContain("No photos yet"); // Photos section (PR #40) empty state
  });
});

describe("FieldWorkOrder — emergency is visually obvious", () => {
  it("shows the emergency banner for emergency priority", () => {
    wo.data = makeData({ job: { ...(makeData().job as Deep), priority: "emergency" } });
    const html = render();
    expect(html).toContain("Emergency — respond immediately");
    expect(html).toContain("bg-red-600");
  });
  it("does NOT show the emergency banner for normal priority", () => {
    wo.data = makeData();
    const html = render();
    expect(html).not.toContain("Emergency — respond immediately");
  });
});

describe("FieldWorkOrder — responsive mobile shell", () => {
  it("uses the max-w-xl mobile column and no fixed pixel width", () => {
    wo.data = makeData();
    const html = render();
    expect(html).toContain("max-w-xl");
    expect(html).not.toMatch(/width:\s*\d{3,}px/); // no hard-coded desktop width
  });
  it("renders a sticky bottom action bar when actions exist", () => {
    wo.data = makeData();
    const html = render();
    expect(html).toContain("fixed inset-x-0 bottom-0");
  });
});
