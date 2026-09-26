/**
 * National DNC scrub provider seam (docs/growth-system-spec.md §0/§11).
 *
 * No scrub provider is integrated today — this is deliberately a seam, not a fake
 * integration. `checkDnc` returns:
 *   - true  → the number IS on the National DNC registry (block automated calls
 *             unless the existing-customer 18-month exemption applies).
 *   - false → confirmed NOT on the registry.
 *   - null  → unknown (no provider configured, or the provider couldn't answer).
 *             Callers MUST fail closed on null exactly like a positive hit, per
 *             the "no scrub provider exists yet -> default to safe" rule.
 *
 * Wiring a real provider later: implement DncScrubProvider, register it in
 * `PROVIDERS` below keyed by its name, and set `DNC_SCRUB_PROVIDER` to that name.
 */
export interface DncScrubProvider {
  readonly name: string;
  checkDnc(phone: string): Promise<boolean | null>;
}

/** Always-unknown provider — the default until a real scrub integration exists. */
export class NullDncProvider implements DncScrubProvider {
  readonly name = "null";
  async checkDnc(_phone: string): Promise<boolean | null> {
    return null;
  }
}

const PROVIDERS: Record<string, () => DncScrubProvider> = {
  null: () => new NullDncProvider(),
  // Future: "real-scrub-vendor": () => new RealScrubProvider(...),
};

/**
 * Selects the configured provider via `DNC_SCRUB_PROVIDER` (defaults to "null" —
 * i.e. NullDncProvider — when unset or unrecognized). Never throws.
 */
export function getDncScrubProvider(): DncScrubProvider {
  const name = (process.env.DNC_SCRUB_PROVIDER ?? "null").trim().toLowerCase();
  const factory = PROVIDERS[name] ?? PROVIDERS.null;
  return factory();
}
