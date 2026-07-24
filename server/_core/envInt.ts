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
