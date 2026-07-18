/**
 * Render tests for the PR #40 work-order Notes + Photos components. Renders the
 * REAL components to static HTML with trpc stubbed, asserting the gallery groups
 * photos by category, the notes timeline shows type/edited badges + author, and
 * empty states render.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { fixtures } = vi.hoisted(() => ({ fixtures: {} as Record<string, unknown> }));

vi.mock("@/lib/trpc", () => {
  const proc = (key: string) => ({
    useQuery: () => ({ data: fixtures[key], isLoading: false, isError: false, error: null, refetch() {} }),
    useMutation: () => ({ mutate() {}, mutateAsync: async () => ({}), isPending: false, reset() {} }),
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
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

import { WorkOrderPhotos } from "@/components/field/WorkOrderPhotos";
import { WorkOrderNotes } from "@/components/field/WorkOrderNotes";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
beforeEach(() => { for (const k of Object.keys(fixtures)) delete fixtures[k]; });

describe("WorkOrderPhotos — gallery grouped by category", () => {
  it("renders category groups with counts and the camera/gallery uploaders", () => {
    fixtures["jobs.fieldListPhotos"] = {
      photos: [
        { id: 1, category: "before", fileName: "b1.jpg", mimeType: "image/jpeg", sizeBytes: 1000, createdAt: "2026-07-17T10:00:00Z", noteId: null, uploaderName: "Tech Alpha" },
        { id: 2, category: "before", fileName: "b2.jpg", mimeType: "image/jpeg", sizeBytes: 1000, createdAt: "2026-07-17T10:01:00Z", noteId: null, uploaderName: "Tech Alpha" },
        { id: 3, category: "after", fileName: "a1.jpg", mimeType: "image/jpeg", sizeBytes: 1000, createdAt: "2026-07-17T12:00:00Z", noteId: null, uploaderName: "Tech Alpha" },
      ],
    };
    const html = render(createElement(WorkOrderPhotos, { jobId: 1 }));
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("(2)"); // before count
    expect(html).toContain("(1)"); // after count
    expect(html).toContain("Camera");
    expect(html).toContain("Gallery");
    expect(html).not.toContain("No photos yet");
  });

  it("shows the empty state when there are no photos", () => {
    fixtures["jobs.fieldListPhotos"] = { photos: [] };
    const html = render(createElement(WorkOrderPhotos, { jobId: 1 }));
    expect(html).toContain("No photos yet");
  });
});

describe("WorkOrderNotes — timeline with type / edited badges", () => {
  it("renders internal + customer notes with badges, author, and edited flag", () => {
    fixtures["jobs.fieldListNotes"] = {
      jobCompleted: false,
      notes: [
        { id: 1, body: "Replaced capacitor.", visibility: "customer", authorId: 5, edited: true, createdAt: "2026-07-17T12:00:00Z", updatedAt: "2026-07-17T12:05:00Z", attachmentId: null, authorName: "Tech Alpha", authorPhoto: null, canEdit: true },
        { id: 2, body: "Gate code 4417.", visibility: "internal", authorId: 5, edited: false, createdAt: "2026-07-17T11:00:00Z", updatedAt: "2026-07-17T11:00:00Z", attachmentId: null, authorName: "Tech Alpha", authorPhoto: null, canEdit: false },
      ],
    };
    const html = render(createElement(WorkOrderNotes, { jobId: 1 }));
    // Two clearly-separated, labeled sections (not adjacent tabs).
    expect(html).toContain("Internal Notes");
    expect(html).toContain("Staff Only");
    expect(html).toContain("Customer Notes");
    expect(html).toContain("Customer Visible");
    expect(html).toContain("Edited");
    expect(html).toContain("Replaced capacitor."); // customer note in the Customer section
    expect(html).toContain("Gate code 4417.");      // internal note in the Internal section
    expect(html).toContain("Tech Alpha");
    expect(html).toContain("Edit"); // editable note shows an Edit control
  });

  it("shows a per-section empty state when there are no notes", () => {
    fixtures["jobs.fieldListNotes"] = { jobCompleted: false, notes: [] };
    const html = render(createElement(WorkOrderNotes, { jobId: 1 }));
    expect(html).toContain("No internal notes yet");
    expect(html).toContain("No customer notes yet");
  });
});
