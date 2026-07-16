/**
 * Frontend conversion-event emitter — Batch B1 (core lead-form conversions).
 *
 * This module is the SINGLE place that turns a confirmed lead submission into a
 * GA4 conversion event and (optionally) a Google Ads conversion. It rides the
 * SAME `window.gtag` instance already loaded in `client/index.html` that powers
 * Google Ads (`AW-17768263516`) and GA4 (`G-…`). It NEVER loads a second tag and
 * NEVER emits `page_view` — page views remain owned by `client/src/lib/analytics.ts`.
 *
 * Guarantees:
 *   - No-ops safely when GA4 is unconfigured (`VITE_GA4_MEASUREMENT_ID` unset) or
 *     when `window.gtag` is unavailable (SSR / tests / ad-blocked) — inert, never throws.
 *   - GA4 fires whenever GA4 is configured; the Google Ads call is independent and
 *     only fires when a REAL conversion label is configured (see ADS_CONVERSION_LABELS).
 *   - Strict allowlist PII firewall: only the keys in ALLOWED_PARAM_KEYS can ever
 *     reach GA4/Ads. Names, emails, phones, addresses, and free-text are impossible
 *     to send by construction.
 *   - Deduplicated once per session via `conv:<dedupeKey>` in sessionStorage (with an
 *     in-memory fallback), so retries, React re-renders, and SPA navigation can't
 *     double-count a single conversion.
 */
import { getGa4MeasurementId, toPagePath } from "@/lib/analytics";

/** Google Ads account id — the same one configured in client/index.html. */
const GOOGLE_ADS_ID = "AW-17768263516";

export type ConversionEventName =
  | "contact_form_submit"
  | "quote_request"
  | "repair_request"
  | "installation_request"
  | "replacement_request"
  | "commercial_quote_request"
  | "residential_quote_request"
  | "maintenance_plan_inquiry";

/**
 * The ONLY parameter keys allowed to reach GA4 / Google Ads. Anything else is
 * dropped by {@link sanitizeParams}. Deliberately excludes every PII-bearing
 * field (name/email/phone/address/message).
 */
export const ALLOWED_PARAM_KEYS = [
  "service_type",
  "segment",
  "lead_type",
  "method",
  "plan",
  "page_path",
  "value",
  "currency",
] as const;
type AllowedKey = (typeof ALLOWED_PARAM_KEYS)[number];

export interface ConvParams {
  service_type?: "repair" | "installation" | "replacement" | "maintenance" | "assessment" | "other";
  segment?: "residential" | "commercial";
  lead_type?: string;
  method?: "phone" | "email";
  plan?: string;
  /** Path only — query string and hash are stripped before sending. */
  page_path?: string;
  value?: number;
  currency?: "USD";
}

/**
 * Google Ads conversion LABELS, created in the Google Ads UI (the segment after
 * `AW-17768263516/` in a conversion action's `send_to`). We do NOT invent them:
 * `null` means "not configured yet" → the Ads conversion call is skipped while
 * GA4 still fires. Fill each value in as the account owner supplies the real
 * label. Every event whose label is still `null` is reported as a blocker.
 */
export const ADS_CONVERSION_LABELS: Record<ConversionEventName, string | null> = {
  contact_form_submit: null,
  quote_request: null,
  repair_request: null,
  installation_request: null,
  replacement_request: null,
  commercial_quote_request: null,
  residential_quote_request: null,
  maintenance_plan_inquiry: null,
};

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  const g = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof g === "function" ? g : undefined;
}

function getSessionStorage(): Storage | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    return (window as unknown as { sessionStorage?: Storage }).sessionStorage;
  } catch {
    // Accessing sessionStorage can throw in some privacy modes.
    return undefined;
  }
}

/**
 * In-memory dedupe fallback for environments without sessionStorage. Still
 * prevents double-fire within a single page lifetime (retries / re-renders).
 */
const memoryFired = new Set<string>();

function storageKey(dedupeKey: string): string {
  return `conv:${dedupeKey}`;
}

function hasFired(dedupeKey: string): boolean {
  const k = storageKey(dedupeKey);
  const ss = getSessionStorage();
  if (ss) {
    try {
      return ss.getItem(k) !== null;
    } catch {
      /* fall through to memory */
    }
  }
  return memoryFired.has(k);
}

function markFired(dedupeKey: string): void {
  const k = storageKey(dedupeKey);
  const ss = getSessionStorage();
  if (ss) {
    try {
      ss.setItem(k, "1");
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memoryFired.add(k);
}

/**
 * Copy through ONLY the allowlisted keys, dropping anything else (the PII
 * firewall). `page_path` is normalised to a path — its query string and hash
 * are stripped so tokens/emails in a URL can never leak.
 */
export function sanitizeParams(params?: Record<string, unknown>): Partial<Record<AllowedKey, unknown>> {
  const out: Partial<Record<AllowedKey, unknown>> = {};
  if (!params) return out;
  for (const key of ALLOWED_PARAM_KEYS) {
    const v = params[key];
    if (v === undefined || v === null) continue;
    out[key] = key === "page_path" ? toPagePath(String(v)) : v;
  }
  return out;
}

/** Reject empty / placeholder labels so we never emit a malformed `send_to`. */
function normalizeLabel(label?: string | null): string | undefined {
  if (typeof label !== "string") return undefined;
  const t = label.trim();
  if (!t) return undefined;
  if (/^(null|todo|tbd|xxx+|placeholder)$/i.test(t)) return undefined;
  return t;
}

export interface TrackConversionOptions {
  /** Stable per-conversion key. Deduped once per session as `conv:<dedupeKey>`. */
  dedupeKey: string;
  /** Google Ads label; when absent/placeholder the Ads call is skipped (GA4 still fires). */
  adsLabel?: string | null;
  params?: ConvParams;
}

/**
 * Fire one conversion: a GA4 event (always, when GA4 is configured) and an
 * optional Google Ads conversion (only with a real label). No-ops safely when
 * GA4 is off or gtag is unavailable. Deduped once per session. Returns true iff
 * it actually fired on this call.
 */
export function trackConversion(eventName: string, opts: TrackConversionOptions): boolean {
  const id = getGa4MeasurementId();
  const gtag = getGtag();
  if (!id || !gtag) return false; // GA4 unconfigured / gtag missing → inert
  if (hasFired(opts.dedupeKey)) return false; // retries, re-renders, SPA nav

  const params = sanitizeParams(opts.params as Record<string, unknown> | undefined);

  // GA4 — scoped to the GA4 stream via send_to so it never reaches Google Ads.
  gtag("event", eventName, { send_to: id, ...params });

  // Google Ads — independent; only when a real label is configured.
  const label = normalizeLabel(opts.adsLabel);
  if (label) {
    const ads: Record<string, unknown> = { send_to: `${GOOGLE_ADS_ID}/${label}` };
    if (typeof params.value === "number") {
      ads.value = params.value;
      ads.currency = (params.currency as string | undefined) ?? "USD";
    }
    gtag("event", "conversion", ads);
  }

  markFired(opts.dedupeKey);
  return true;
}

export interface ResolvedConversion {
  event: ConversionEventName;
  params: ConvParams;
}

/**
 * Map a lead submission to exactly ONE conversion event. `source === "contact"`
 * always wins (the Contact page). Otherwise a free-text `intent` — a page-level
 * context (e.g. a ServicePage `service + slug`) or the form's service select —
 * is scanned for keywords, most-specific first, so every action fires a single
 * unambiguous event (no double counting).
 */
export function resolveConversion(input: { source?: "contact"; intent?: string }): ResolvedConversion {
  if (input.source === "contact") return { event: "contact_form_submit", params: {} };

  const hay = (input.intent ?? "").toLowerCase();
  if (hay.includes("replacement")) return { event: "replacement_request", params: { service_type: "replacement" } };
  if (hay.includes("commercial")) return { event: "commercial_quote_request", params: { segment: "commercial" } };
  if (hay.includes("residential")) return { event: "residential_quote_request", params: { segment: "residential" } };
  if (hay.includes("repair") || hay.includes("emergency")) return { event: "repair_request", params: { service_type: "repair" } };
  if (hay.includes("install") || hay.includes("vrv") || hay.includes("vrf")) return { event: "installation_request", params: { service_type: "installation" } };
  if (hay.includes("maintenance")) return { event: "maintenance_plan_inquiry", params: { plan: "maintenance" } };
  return { event: "quote_request", params: { service_type: "other" } };
}

/**
 * Convenience used by lead forms: resolve the event, attach the current
 * `page_path`, and fire — with the event's configured Ads label (or none).
 * MUST be called only after a confirmed, persisted submission.
 */
export function trackLeadConversion(input: {
  source?: "contact";
  intent?: string;
  dedupeKey: string;
  pagePath?: string;
}): boolean {
  const { event, params } = resolveConversion({ source: input.source, intent: input.intent });
  return trackConversion(event, {
    dedupeKey: input.dedupeKey,
    adsLabel: ADS_CONVERSION_LABELS[event],
    params: { ...params, page_path: input.pagePath },
  });
}
