/**
 * #6 — the admin technician-preview control must carry a visible label
 * ("Preview technician:") so it is discoverable; the ambiguous unlabeled
 * "👁 My jobs ▾" dropdown was mistaken for "no preview exists".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(process.cwd(), "client/src/pages/FieldMyJobs.tsx"), "utf8");

describe("#6 technician preview control has a visible label", () => {
  it("renders a visible 'Preview technician:' label", () => {
    expect(src).toContain("Preview technician:");
  });
  it("associates the label with the picker and keeps it admin-gated", () => {
    expect(src).toContain('htmlFor="preview-technician"');
    expect(src).toContain('id="preview-technician"');
    expect(src).toMatch(/isAdmin\s*\?/);
  });
});
