/**
 * Resolve a file in this deployment's own checkout (docs/, netlify.toml, …).
 *
 * Production runs the esbuild bundle (`node dist/index.js`), where import.meta.dirname is `dist/` —
 * not the source folder — so a path written relative to the source file silently points nowhere there
 * (server/seo.ts resolves from `dist/..`). Try, in order: the working directory (Railway starts in the
 * repo root), the bundle layout (`dist/..`), and the source layout (this file is server/services/seo/).
 * Returns null when none exists.
 */
import { existsSync } from "node:fs";
import path from "node:path";

export function resolveRepoPath(...segments: string[]): string | null {
  const candidates = [
    path.resolve(process.cwd(), ...segments),
    path.resolve(import.meta.dirname, "..", ...segments),
    path.resolve(import.meta.dirname, "../../..", ...segments),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}
