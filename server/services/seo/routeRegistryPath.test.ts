import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveRepoFile, loadRoutesManifest, registrableRoutes, manifestPath } from "./routeRegistry";

// Production runs the bundle dist/index.js, where import.meta.dirname is <repo>/dist — NOT the source layout
// (server/services/seo). "../../.." from dist points outside the repo, so the registry never found its manifest.
const REL = "netlify/edge-functions/routes-manifest.json";
const REPO = path.resolve(import.meta.dirname, "../../..");

describe("resolveRepoFile — finds the repo file under both the source and the bundled layouts", () => {
  it("source layout (dev / tsx / tests): the repo root is three directories up from server/services/seo", () => {
    const src = path.resolve("/repo/server/services/seo", "../../..", REL);
    expect(resolveRepoFile(REL, "/repo/server/services/seo", "/anywhere", (p) => p === src)).toBe(src);
  });

  it("bundled layout (production): dirname is <repo>/dist, so it falls back to the working directory (the repo root)", () => {
    const fromCwd = path.resolve("/app", REL);
    const fromDist = path.resolve("/app/dist", "../../..", REL); // what the old code computed: outside the repo
    expect(fromDist).not.toBe(fromCwd);
    expect(resolveRepoFile(REL, "/app/dist", "/app", (p) => p === fromCwd)).toBe(fromCwd);
  });

  it("prefers the source-layout path when both exist", () => {
    const src = path.resolve("/repo/server/services/seo", "../../..", REL);
    expect(resolveRepoFile(REL, "/repo/server/services/seo", "/other", () => true)).toBe(src);
  });

  it("when neither exists it returns the first candidate, so the ENOENT names a sensible path", () => {
    expect(resolveRepoFile(REL, "/app/dist", "/app", () => false)).toBe(path.resolve("/app/dist", "../../..", REL));
  });
});

describe("against the real checkout, simulating the production layout", () => {
  it("manifestPath() resolves to a readable manifest in this checkout", () => {
    expect(loadRoutesManifest(manifestPath()).length).toBeGreaterThan(100);
  });

  it("with dirname = <repo>/dist and cwd = the repo root (how Railway runs it), the real manifest loads and includes the pinned pages", () => {
    const file = resolveRepoFile(REL, path.join(REPO, "dist"), REPO);
    expect(file).toBe(path.resolve(REPO, REL));
    const routes = registrableRoutes(loadRoutesManifest(file));
    for (const p of ["/warranty", "/commercial/property-managers", "/commercial/hvac-service-contracts"]) expect(routes, p).toContain(p);
  });

  it("with the OLD resolution (dirname-only) the production layout cannot find the file — the bug this fixes", () => {
    const old = path.resolve(path.join(REPO, "dist"), "../../..", REL);
    expect(() => loadRoutesManifest(old)).toThrow();
  });
});
