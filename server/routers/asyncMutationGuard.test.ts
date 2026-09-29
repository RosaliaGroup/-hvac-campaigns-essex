/**
 * Gateway-timeout guard (static half).
 *
 * The proxy in front of the app 504s any request that runs past ~20s. A tRPC
 * mutation that awaits a slow operation (AI drafting, Search Console sync, a
 * bulk fan-out) inline therefore 504s the client while the work keeps running
 * server-side — and the retried click starts a duplicate. Fixed by hand for the
 * lane "Run now" buttons (#136) and then, again, for the SEO page's Optimize /
 * Optimize Selected / Regenerate / Sync mutations. This test makes it
 * impossible to regress by construction:
 *
 *   - A service function that is expected to exceed 20s carries a `@slow`
 *     JSDoc tag (that is the ONLY declaration needed — this test discovers the
 *     tagged functions by scanning server/ with the TypeScript compiler).
 *   - No `.mutation(...)` handler under server/routers.ts or server/routers/**
 *     may reference a `@slow` function, EXCEPT inside a function passed to
 *     `startJob(...)` / `startLaneJob(...)` (server/services/asyncLaneJob.ts),
 *     which returns immediately and lets the client poll.
 *
 * Fix for a failure here: wrap the slow call in startJob and return
 * `{ jobId, started }` — see seo.bulkGenerateOptimization for the pattern.
 *
 * The runtime half — a warning for any mutation that actually runs past 20s —
 * is the gateway-guard middleware in server/_core/trpc.ts (its own test).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SERVER_ROOT = path.resolve(import.meta.dirname, "..");
const SAFE_STARTERS = new Set(["startJob", "startLaneJob"]);

/** Known-slow operations that MUST stay tagged — deleting a tag can't silently un-guard them. */
const MUST_BE_TAGGED = [
  "generateOptimization",
  "runOptimizationJob",
  "runBulkOptimization",
  "regenerateUnlockedDrafts",
  "runSeoSync",
  "runWeeklyContentJob",
  "runNightlyDraftJob",
  "runMarketIntelReport",
  "draftContentPost",
  "runCriticPass",
];

function walkTs(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(full, out);
    else if (/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TS);
}

/** Names of functions carrying a `@slow` JSDoc tag. */
export function collectSlowNames(sf: ts.SourceFile): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (ts.getJSDocTags(node).some((t) => t.tagName.text === "slow")) names.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

export type Violation = { file: string; line: number; name: string };

/** `.mutation(handler)` handlers that reference a slow function outside startJob/startLaneJob. */
export function findSlowCallViolations(sf: ts.SourceFile, slow: ReadonlySet<string>): Violation[] {
  const violations: Violation[] = [];

  const isSafelyWrapped = (id: ts.Node, handler: ts.Node): boolean => {
    let prev: ts.Node = id;
    let cur: ts.Node | undefined = id.parent;
    while (cur && cur !== handler.parent) {
      if (
        ts.isCallExpression(cur) &&
        ts.isIdentifier(cur.expression) &&
        SAFE_STARTERS.has(cur.expression.text) &&
        cur.arguments.some((a) => a === prev)
      ) {
        return true;
      }
      prev = cur;
      cur = cur.parent;
    }
    return false;
  };

  const scanHandler = (handler: ts.Node) => {
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && slow.has(node.text)) {
        // Skip import specifiers / declarations — only references inside the handler body matter, and the handler
        // subtree contains none of those.
        if (!isSafelyWrapped(node, handler)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          violations.push({ file: sf.fileName, line: line + 1, name: node.text });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(handler);
  };

  const find = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "mutation" &&
      node.arguments.length > 0 &&
      (ts.isArrowFunction(node.arguments[0]) || ts.isFunctionExpression(node.arguments[0]))
    ) {
      scanHandler(node.arguments[0]);
    }
    ts.forEachChild(node, find);
  };
  find(sf);
  return violations;
}

const allServerFiles = walkTs(SERVER_ROOT);
const slowNames = new Set<string>(
  allServerFiles.flatMap((f) => collectSlowNames(parse(f, fs.readFileSync(f, "utf8")))),
);
const routerFiles = allServerFiles.filter((f) => {
  const rel = path.relative(SERVER_ROOT, f).replace(/\\/g, "/");
  return rel === "routers.ts" || rel.startsWith("routers/");
});

describe("gateway-timeout guard: slow work in tRPC mutations must be async", () => {
  it("keeps every known-slow operation tagged @slow", () => {
    const missing = MUST_BE_TAGGED.filter((n) => !slowNames.has(n));
    expect(missing, `these lost their @slow tag (or were renamed): ${missing.join(", ")}`).toEqual([]);
  });

  it("no .mutation() handler awaits a @slow operation inline — wrap it in startJob/startLaneJob", () => {
    const violations = routerFiles.flatMap((f) => findSlowCallViolations(parse(f, fs.readFileSync(f, "utf8")), slowNames));
    const report = violations
      .map((v) => `  ${path.relative(SERVER_ROOT, v.file).replace(/\\/g, "/")}:${v.line} calls ${v.name}() synchronously`)
      .join("\n");
    expect(violations, `Mutations that would 504 the gateway (>20s):\n${report}\nWrap in startJob(...) and return { jobId, started }.`).toEqual([]);
  });

  describe("the checker itself (so a green run means something)", () => {
    const slow = new Set(["runSlowThing"]);
    const check = (src: string) => findSlowCallViolations(parse("fixture.ts", src), slow);

    it("flags a slow call awaited directly in a mutation", () => {
      const v = check(`
        export const r = router({
          go: adminProcedure.mutation(async () => {
            const out = await runSlowThing();
            return out;
          }),
        });`);
      expect(v).toHaveLength(1);
      expect(v[0].name).toBe("runSlowThing");
    });

    it("flags a slow call reached through a non-job wrapper (try/catch, then())", () => {
      const v = check(`
        export const r = router({
          go: adminProcedure.mutation(async () => {
            try { return await runSlowThing(); } catch (e) { throw e; }
          }),
        });`);
      expect(v).toHaveLength(1);
    });

    it("allows the slow call inside startJob's fn", () => {
      expect(
        check(`
        export const r = router({
          go: adminProcedure.mutation(async () =>
            startJob({ kind: "k", key: "k", fn: async () => runSlowThing() })),
        });`),
      ).toEqual([]);
    });

    it("allows the slow call inside startLaneJob's fn", () => {
      expect(
        check(`
        export const r = router({
          go: adminProcedure.mutation(async () => {
            const { started } = startLaneJob("content", () => runSlowThing());
            return { started };
          }),
        });`),
      ).toEqual([]);
    });

    it("does NOT treat the slow call as safe merely because startJob appears elsewhere in the handler", () => {
      const v = check(`
        export const r = router({
          go: adminProcedure.mutation(async () => {
            startJob({ kind: "k", key: "k", fn: async () => 1 });
            return await runSlowThing();
          }),
        });`);
      expect(v).toHaveLength(1);
    });

    it("ignores slow calls outside mutations (queries, services)", () => {
      expect(
        check(`
        export const r = router({
          peek: adminProcedure.query(async () => runSlowThing()),
        });
        export async function helper() { return runSlowThing(); }`),
      ).toEqual([]);
    });

    it("discovers @slow-tagged functions by JSDoc", () => {
      const sf = parse("svc.ts", `
        /** @slow AI-backed */
        export async function tagged() {}
        /** just docs */
        export async function untagged() {}`);
      expect(collectSlowNames(sf)).toEqual(["tagged"]);
    });
  });
});
