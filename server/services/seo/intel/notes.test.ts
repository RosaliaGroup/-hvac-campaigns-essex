import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseNote, loadReportNotes } from "./notes";

const note = (publish: string | null, body = "Body text.", title = "T") =>
  `---\n${publish ? `publish: ${publish}\n` : ""}title: ${title}\n---\n${body}\n`;

describe("parseNote", () => {
  it("reads publish date, title and body", () => {
    expect(parseNote("a", note("2026-10-01", "Line 1\n\nLine 2", "July collapse"))).toEqual({ id: "a", publish: "2026-10-01", title: "July collapse", markdown: "Line 1\n\nLine 2" });
  });
  it("handles CRLF files", () => {
    expect(parseNote("a", note("2026-10-01").replace(/\n/g, "\r\n"))?.publish).toBe("2026-10-01");
  });
  it("falls back to the id when there is no title", () => {
    expect(parseNote("my-note", "---\npublish: 2026-10-01\n---\nHi")?.title).toBe("my-note");
  });
  it("rejects a file with no front matter, no publish date, a malformed date, or an empty body", () => {
    expect(parseNote("a", "just text")).toBeNull();
    expect(parseNote("a", note(null))).toBeNull();
    expect(parseNote("a", note("tomorrow"))).toBeNull();
    expect(parseNote("a", note("2026-10-01", ""))).toBeNull();
  });
});

describe("loadReportNotes", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "intel-notes-"));
  writeFileSync(path.join(dir, "a-today.md"), note("2026-10-01", "Today", "Today note"));
  writeFileSync(path.join(dir, "b-other-day.md"), note("2026-10-02", "Later"));
  writeFileSync(path.join(dir, "c-old.md"), note("2026-09-01", "Old"));
  writeFileSync(path.join(dir, "d-nodate.md"), note(null));
  writeFileSync(path.join(dir, "e-not-markdown.txt"), note("2026-10-01"));

  it("returns only notes whose publish date equals the report date", () => {
    expect(loadReportNotes("2026-10-01", dir)).toEqual([{ id: "a-today", title: "Today note", markdown: "Today" }]);
  });
  it("an old note never leaks into a later report, and later notes wait", () => {
    expect(loadReportNotes("2026-09-01", dir).map((n) => n.id)).toEqual(["c-old"]);
    expect(loadReportNotes("2026-10-03", dir)).toEqual([]);
  });
  it("a missing directory means no notes, not an error", () => {
    expect(loadReportNotes("2026-10-01", path.join(dir, "nope"))).toEqual([]);
  });
  it("the repo's real docs/intel-notes has the July-collapse note scheduled for 2026-10-01 and nothing for other days", () => {
    expect(loadReportNotes("2026-10-01").map((n) => n.id)).toContain("2026-10-01-july-collapse");
    expect(loadReportNotes("2026-10-02")).toEqual([]);
  });
});
