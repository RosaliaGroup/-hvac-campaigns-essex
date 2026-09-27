/**
 * §4/§7 import-graph enforcement (docs/market-intel-spec.md): "The intel job
 * has no direct write path to production, the overrides file, blogPosts.ts,
 * the facts file, or the Vapi prompt — it can only call
 * approveBatchToPR/publishPost/openPagePR." Static source-text scan (no
 * runtime import graph tool exists in this repo — this mirrors how the
 * codebase already enforces similar one-way rules by comment/convention, made
 * mechanically checkable here) over the ORCHESTRATION layer only
 * (report.ts/adjustments.ts/job.ts) — pagePr.ts is a sanctioned LANE
 * IMPLEMENTATION (like bulkApprove.ts and contentPipeline.ts already are) and
 * is explicitly allowed to import server/services/seo/github.ts.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ORCHESTRATION_FILES = ["report.ts", "adjustments.ts", "job.ts", "guardrails.ts", "searchDemand.ts", "competitorWatch.ts", "positioning.ts", "ownerDecision.ts", "revert.ts"];

const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "server/services/seo/github.ts (direct GitHub write API)", re: /from\s+["']\.\.\/github["']|from\s+["'].*services\/seo\/github["']/ },
  { label: "client/src/data/blogPosts.ts (direct content-file write target)", re: /data\/blogPosts["']/ },
  { label: "client/src/data/pageProposals.ts (direct page-registry write target — must go through openPagePR)", re: /data\/pageProposals["']/ },
  { label: "client/src/pages/AIAssistantPrompts.tsx (the Vapi prompt module)", re: /AIAssistantPrompts/ },
];

/** Only the actual `import ...` statement lines — doc comments are free to NAME a forbidden module (to explain why it's forbidden) without tripping the check. */
function importLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

describe("market-intel import graph (§4 write-path enforcement)", () => {
  for (const file of ORCHESTRATION_FILES) {
    it(`${file} never imports a forbidden direct-write target`, () => {
      const filePath = path.resolve(__dirname, file);
      const imports = importLines(fs.readFileSync(filePath, "utf-8"));
      for (const { label, re } of FORBIDDEN_PATTERNS) {
        // pagePr.ts itself is the one file allowed to reference pageProposals — skip that self-check.
        if (file === "pagePr.ts" && label.includes("pageProposals")) continue;
        expect(imports, `${file} must not import ${label}`).not.toMatch(re);
      }
    });
  }

  it("adjustments.ts only reaches lane writes through approveBatchToPR/proposeTopic (never openPagePR automatically — see file header)", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "adjustments.ts"), "utf-8");
    expect(source).toMatch(/approveBatchToPR/);
    expect(source).toMatch(/proposeTopic/);
    // openPagePR is intentionally NOT auto-invoked from the daily job — see adjustments.ts's own header comment.
    expect(source).not.toMatch(/\bopenPagePR\(/);
  });

  it("pagePr.ts (the page-PR lane implementation) is the only intel file allowed to import github.ts directly", () => {
    const imports = importLines(fs.readFileSync(path.resolve(__dirname, "pagePr.ts"), "utf-8"));
    expect(imports).toMatch(/from\s+["']\.\.\/github["']/);
  });

  it("report.ts routes execution only through adjustments.ts's executeItem (not github.ts/bulkApprove.ts directly)", () => {
    const imports = importLines(fs.readFileSync(path.resolve(__dirname, "report.ts"), "utf-8"));
    expect(imports).not.toMatch(/from\s+["']\.\.\/bulkApprove["']/);
    expect(imports).not.toMatch(/from\s+["']\.\.\/github["']/);
    expect(imports).toMatch(/from\s+["']\.\/adjustments["']/);
  });
});
