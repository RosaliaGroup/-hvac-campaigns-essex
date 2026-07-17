/**
 * Render tests for the PR #41 completion UI (Time / Parts / Signature /
 * Completion). Renders the real components to static HTML with trpc stubbed and
 * asserts the state-driven UI: time totals + gated actions, parts list/lock,
 * signature states, and the completion requirements gate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { fixtures } = vi.hoisted(() => ({ fixtures: {} as Record<string, unknown> }));
vi.mock("@/lib/trpc", () => {
  const proc = (key: string) => ({
    useQuery: () => ({ data: fixtures[key], isLoading: false, isError: false, error: null, refetch() {} }),
    useMutation: () => ({ mutate() {}, mutateAsync: async () => ({}), isPending: false, variables: undefined, reset() {} }),
  });
  const deep = (): unknown => new Proxy(() => {}, { get: () => deep(), apply: () => Promise.resolve() });
  const trpc = new Proxy({}, { get: (_t, ns) => { const s = String(ns); if (s === "useUtils") return () => deep(); return new Proxy({}, { get: (_t2, p) => proc(`${s}.${String(p)}`) }); } });
  return { trpc };
});
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import { WorkOrderTime } from "@/components/field/WorkOrderTime";
import { WorkOrderParts } from "@/components/field/WorkOrderParts";
import { WorkOrderSignature } from "@/components/field/WorkOrderSignature";
import { WorkOrderCompletion } from "@/components/field/WorkOrderCompletion";

const render = (el: any) => renderToStaticMarkup(el);
beforeEach(() => { for (const k of Object.keys(fixtures)) delete fixtures[k]; });

describe("WorkOrderTime", () => {
  it("shows totals and the next actions for the current state", () => {
    // one work_start event → state 'working' → actions Pause / Finish
    fixtures["jobs.fieldListTime"] = { events: [{ id: 1, eventType: "work_start", occurredAt: "2026-07-17T13:00:00Z" }], summary: {} };
    const html = render(createElement(WorkOrderTime, { jobId: 1, locked: false }));
    expect(html).toContain("Time Tracking");
    expect(html).toContain("Travel");
    expect(html).toContain("Labor");
    expect(html).toContain("Pause Work");
    expect(html).toContain("Finish Work");
  });
  it("hides actions and shows a lock message when completed", () => {
    fixtures["jobs.fieldListTime"] = { events: [], summary: {} };
    const html = render(createElement(WorkOrderTime, { jobId: 1, locked: true }));
    expect(html).toContain("locked");
    expect(html).not.toContain("Start Travel");
  });
});

describe("WorkOrderParts", () => {
  it("renders parts + add form when editable", () => {
    fixtures["jobs.fieldListParts"] = { parts: [{ id: 1, partNumber: "CAP-45", description: "Run capacitor", quantity: "2.00", unit: "ea", notes: null }], editable: true };
    const html = render(createElement(WorkOrderParts, { jobId: 1 }));
    expect(html).toContain("Parts Used");
    expect(html).toContain("Run capacitor");
    expect(html).toContain("CAP-45");
    expect(html).toContain("Add Part");
  });
  it("locks parts (no add form) when not editable", () => {
    fixtures["jobs.fieldListParts"] = { parts: [], editable: false };
    const html = render(createElement(WorkOrderParts, { jobId: 1 }));
    expect(html).toContain("locked");
    expect(html).not.toContain("Add Part");
  });
});

describe("WorkOrderSignature", () => {
  it("renders the signature pad when not signed/locked", () => {
    fixtures["jobs.fieldGetSignature"] = { hasSignature: false, dataUrl: null, signedAt: null };
    const html = render(createElement(WorkOrderSignature, { jobId: 1, locked: false }));
    expect(html).toContain("Customer Signature");
    expect(html).toContain("Save Signature");
    expect(html).toContain("<canvas");
  });
  it("renders read-only saved signature when locked", () => {
    fixtures["jobs.fieldGetSignature"] = { hasSignature: true, dataUrl: "data:image/png;base64,AAAA", signedAt: "2026-07-17T13:00:00Z" };
    const html = render(createElement(WorkOrderSignature, { jobId: 1, locked: true }));
    expect(html).toContain("Read-only");
    expect(html).not.toContain("<canvas");
  });
});

describe("WorkOrderCompletion", () => {
  it("gates completion until a note decision is made", () => {
    fixtures["jobs.fieldListNotes"] = { jobCompleted: false, notes: [] }; // no customer note
    fixtures["jobs.getCompletionSettings"] = { requireCompletionSignature: false };
    fixtures["jobs.fieldGetSignature"] = { hasSignature: false };
    const html = render(createElement(WorkOrderCompletion, { jobId: 1, workStatus: "working", onCompleted: () => {} }));
    expect(html).toContain("Complete Job");
    expect(html).toContain("No completion note"); // toggle shown when no customer note
    expect(html).toContain(COMPLETION_NOTE_MSG);
  });
  it("shows a locked banner when already completed", () => {
    fixtures["jobs.fieldListNotes"] = { jobCompleted: true, notes: [] };
    fixtures["jobs.getCompletionSettings"] = { requireCompletionSignature: false };
    fixtures["jobs.fieldGetSignature"] = { hasSignature: false };
    const html = render(createElement(WorkOrderCompletion, { jobId: 1, workStatus: "completed", onCompleted: () => {} }));
    expect(html).toContain("Job completed");
    expect(html).toContain("locked");
  });
});

const COMPLETION_NOTE_MSG = "Add a customer note, or confirm";
