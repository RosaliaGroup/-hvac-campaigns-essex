/**
 * Leak guard (#1): Internal notes (jobNotes with visibility='internal') are
 * STAFF-ONLY and must never reach a customer-facing surface.
 *
 * Protection model: `jobNotes` is read ONLY by the staff job router
 * (server/routers/jobs.ts), which is access-controlled (resolveFieldJobAccess /
 * office procedures). No customer-facing code path (portal / SMS / email /
 * invoice / appointment confirmation / export / AI context) reads jobNotes at
 * all. This structural test fails the build if any OTHER server module starts
 * referencing `jobNotes`, forcing a security review before internal notes could
 * ever leak. Complements shared/jobMedia filterCustomerVisibleNotes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const SERVER_DIR = join(process.cwd(), "server");

/** The ONLY server file permitted to reference jobNotes (staff job workflow). */
const ALLOWED = "server/routers/jobs.ts";
const rel = (f: string) => relative(process.cwd(), f).split(sep).join("/");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...collectTsFiles(p));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

describe("internal notes never leak to customer-facing server code", () => {
  it("jobNotes is referenced ONLY by the staff job router (server/routers/jobs.ts)", () => {
    const files = collectTsFiles(SERVER_DIR);
    const offenders = files
      .filter(f => rel(f) !== ALLOWED && /\bjobNotes\b/.test(readFileSync(f, "utf8")))
      .map(rel);
    // If this fails: a NON-staff module started reading jobNotes. Route any
    // customer-facing note display through filterCustomerVisibleNotes and add it
    // to an explicit allow-list ONLY after a security review.
    expect(offenders).toEqual([]);
  });
});
