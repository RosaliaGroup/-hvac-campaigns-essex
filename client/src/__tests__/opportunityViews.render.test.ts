/**
 * Render tests for the Opportunity Center data views (Overview / Pipeline /
 * All). Uses the repo's render-test convention: real components rendered to
 * static markup with trpc stubbed, asserting the state-driven UI. The focus is
 * the bug this session fixed — a *failed* query must render a distinct error
 * state, never fall through and look like an empty board / "no results" — plus
 * the pipeline card's keyboard/screen-reader affordances.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type QueryResult = { data?: unknown; isLoading?: boolean; isError?: boolean; error?: { message: string } | null };
const { queries } = vi.hoisted(() => ({ queries: {} as Record<string, QueryResult> }));

vi.mock("@/lib/trpc", () => {
  const DEFAULT: QueryResult = { data: undefined, isLoading: false, isError: false, error: null };
  const proc = (key: string) => ({
    useQuery: () => ({ refetch() {}, ...DEFAULT, ...(queries[key] ?? {}) }),
    useMutation: () => ({ mutate() {}, mutateAsync: async () => ({}), isPending: false, reset() {} }),
  });
  const deep = (): unknown => new Proxy(() => {}, { get: () => deep(), apply: () => Promise.resolve() });
  const trpc = new Proxy({}, {
    get: (_t, ns) => {
      const s = String(ns);
      if (s === "useUtils") return () => deep();
      return new Proxy({}, { get: (_t2, p) => proc(`${s}.${String(p)}`) });
    },
  });
  return { trpc };
});

import PipelineBoard from "@/components/opportunity/PipelineBoard";
import OverviewTab from "@/components/opportunity/OverviewTab";
import AllOpportunitiesTab from "@/components/opportunity/AllOpportunitiesTab";

const render = (el: any) => renderToStaticMarkup(el);
beforeEach(() => { for (const k of Object.keys(queries)) delete queries[k]; });

const oneRow = {
  items: [{ id: 7, stage: "new", amount: 1000, customerName: "Acme Corp", customerCompany: null, workCategory: "commercial", docNumber: "1042", docTypeLabel: "estimate", docStatus: "pending", daysPending: 5, nextAction: "Call back" }],
  total: 1,
  totals: { count: 1, totalValue: 1000, weightedValue: 100, quickbooksTotal: 1000 },
};
const emptyList = { items: [], total: 0, totals: { count: 0, totalValue: 0, weightedValue: 0, quickbooksTotal: 0 } };

describe("PipelineBoard states", () => {
  it("shows a distinct error state (not an empty board) when the list query fails", () => {
    queries["opportunities.list"] = { isError: true, error: { message: "network down" } };
    const html = render(createElement(PipelineBoard, { onOpen: () => {} }));
    expect(html).toContain("Couldn’t load opportunities");
    expect(html).toContain("network down");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Drop here"); // columns must not render on error
  });

  it("renders a loading state while the query is in flight", () => {
    queries["opportunities.list"] = { isLoading: true };
    const html = render(createElement(PipelineBoard, { onOpen: () => {} }));
    expect(html).toContain("Loading…");
    expect(html).toContain('role="status"');
  });

  it("renders keyboard- and screen-reader-accessible cards when ready", () => {
    queries["opportunities.list"] = { data: oneRow };
    const html = render(createElement(PipelineBoard, { onOpen: () => {} }));
    expect(html).toContain("Acme Corp");
    expect(html).toContain('role="button"');           // card is operable, not a bare div
    expect(html).toContain('tabindex="0"');            // reachable by keyboard
    expect(html).toContain("Open opportunity for Acme Corp"); // aria-label for screen readers
    expect(html).toContain("draggable=\"true\"");
    expect(html).toContain("Move to another stage");   // dropdown trigger aria-label
  });
});

describe("OverviewTab states", () => {
  it("shows an error state instead of a perpetual spinner when overview fails", () => {
    queries["opportunities.overview"] = { isError: true, error: { message: "boom" } };
    const html = render(createElement(OverviewTab, {}));
    expect(html).toContain("Couldn’t load opportunities");
    expect(html).not.toContain("Open pipeline"); // KPI grid must not render on error
  });
});

describe("AllOpportunitiesTab states", () => {
  it("distinguishes a failed load from an empty result set", () => {
    queries["opportunities.list"] = { isError: true, error: { message: "500" } };
    queries["opportunities.salespeople"] = { data: [] };
    const html = render(createElement(AllOpportunitiesTab, { onOpen: () => {} }));
    expect(html).toContain("Couldn’t load opportunities");
    expect(html).not.toContain("No opportunities");
  });

  it("shows an empty (not error) message when there are genuinely no opportunities", () => {
    queries["opportunities.list"] = { data: emptyList };
    queries["opportunities.salespeople"] = { data: [] };
    const html = render(createElement(AllOpportunitiesTab, { onOpen: () => {} }));
    expect(html).toContain("No opportunities yet.");
    expect(html).not.toContain("Couldn’t load opportunities");
  });
});
