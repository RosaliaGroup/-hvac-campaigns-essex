/**
 * Parse a POSITIVE integer environment variable, falling back to `fallback`
 * whenever the var is unset, empty, non-numeric, zero, or negative.
 *
 * Used to make auth durations overridable on STAGING (to test expiry in minutes)
 * without changing production, which simply leaves the vars unset and gets the
 * built-in defaults. Read once at module load — set the env before the process
 * starts.
 */
export function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Like {@link envPositiveInt} but with a hard SAFE MAXIMUM. Guarantees a
 * misconfiguration (or a hostile env) can never create an effectively permanent
 * session / idle window / clock tolerance / rate-limit window.
 *
 * Fail-safe (never throws, never blocks startup):
 *  - unset/blank/non-positive/non-numeric → `fallback` (with a warning if the
 *    value was set-but-invalid);
 *  - above `max` → clamped down to `max`, with a warning.
 * Warnings name only the variable and the bound — never any value that could be
 * a secret (these are durations/counts, but we keep the log minimal regardless).
 */
export function envBoundedInt(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[Auth][config] ${name} is not a positive integer; using the built-in default.`);
    return fallback;
  }
  const v = Math.floor(n);
  if (v > max) {
    console.warn(`[Auth][config] ${name} exceeds the safe maximum (${max}); clamping to the maximum.`);
    return max;
  }
  return v;
}
