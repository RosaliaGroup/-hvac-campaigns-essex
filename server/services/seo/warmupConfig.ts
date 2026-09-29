/**
 * Warm-up default counts, env-var-configurable (owner decision 2026-09-29:
 * default both lanes to 0 — i.e. auto-merge eligible immediately once every
 * other gate, e.g. SEO_AUTOPUBLISH_ENABLED + the circuit breaker, allows it —
 * rather than the original hardcoded meta=2/content=8 manual-batches-first
 * requirement). Used both to seed a fresh seoAutopublishState row
 * (autopublishStateRepo.ts) and as the cap `resetWarmupByHalf` restores
 * toward after a veto/revert (warmupGate.ts).
 *
 * A leaf module (no imports from warmupGate.ts/autopublishStateRepo.ts) so
 * both of those can import this without a circular dependency.
 */

export type AutopublishLane = "meta" | "content";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export const WARMUP_DEFAULTS: Record<AutopublishLane, number> = {
  meta: envInt("SEO_META_WARMUP_DEFAULT", 0),
  content: envInt("SEO_CONTENT_WARMUP_DEFAULT", 0),
};
