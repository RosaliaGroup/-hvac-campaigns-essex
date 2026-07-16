/**
 * Frontend conversion-event helper (GA4 + optional Google Ads).
 *
 * Companion to `analytics.ts` (which owns page_view). This module is the SINGLE
 * place the app emits *conversion* events for high-value, confirmed-successful
 * lead submissions. It deliberately reuses `getGa4MeasurementId` and
 * `toPagePath` from `analytics.ts` so page_view behaviour and the "GA4 only when
 * G-… is configured" rule stay identical — `analytics.ts` is NOT modified.
 *
 * Guarantees:
 *   - GA4 events fire ONLY when `VITE_GA4_MEASUREMENT_ID` is a real `G-…` id and
 *     `window.gtag` exists; otherwise every call is an inert no-op (SSR / tests /
 *     builds without the env var never throw).
 *   - Google Ads sends ONLY for events that have a real conversion label in
 *     {@link ADS_CONVERSION_LABELS}. Every label ships as `null` (placeholder),
 *     so GA4 works independently while Ads labels are still unset. The existing
 *     per-landing-page Ads conversions live in the LP components and are NOT
 *     driven by this map — they remain untouched.
 *   - Never sends PII. The outgoing payload is built from a strict allowlist, so
 *     name/email/phone/address/ZIP/message/customer-id can never leak even if a
 *     caller passes them.
 *   - Idempotent. A repeated `dedupeKey` no-ops, so retries, double-clicks,
 *     React re-renders and StrictMode double-invocation can each fire at most one
 *     event per logical conversion.
 */
import { getGa4MeasurementId, toPagePath } from "./analytics";

/**
 * Google Ads account id — the SAME gtag.js instance configured in
 * `client/index.html` (there is no second gtag load). Used only to build a
 * `send_to` of the form `AW-…/<label>` when a real label is supplied.
 */
export const ADS_CONVERSION_ID = "AW-17768263516";

/** Every conversion event this app is allowed to emit. */
export type ConversionEvent =
  | "quote_request"
  | "contact_form_submit"
  | "schedule_service"
  | "commercial_quote_request"
  | "residential_quote_request"
  | "service_request"
  | "repair_request"
  | "installation_request"
  | "replacement_request"
  | "maintenance_plan_inquiry";

/**
 * Google Ads conversion-label mapping — a typed placeholder. Ads fires ONLY for
 * events whose value is a non-empty label string; `null` means "no label
 * supplied yet" (GA4 still fires). DO NOT invent labels — populate these from the
 * Google Ads UI in Batch B2, one verified label per event.
 */
export const ADS_CONVERSION_LABELS: Record<ConversionEvent, string | null> = {
  quote_request: null,
  contact_form_submit: null,
  schedule_service: null,
  commercial_quote_request: null,
  residential_quote_request: null,
  service_request: null,
  repair_request: null,
  installation_request: null,
  replacement_request: null,
  maintenance_plan_inquiry: null,
};

export type CustomerSegment = "residential" | "commercial";

/**
 * The ONLY parameters allowed on a conversion event. Intentionally excludes
 * every PII field (name, email, phone, address, ZIP, message, customer id …).
 */
export interface ConversionParams {
  /** Which form produced the event, e.g. "quick_quote_form". Non-PII. */
  form_type?: string;
  /** Coarse service bucket, e.g. "installation" / "commercial". Non-PII. */
  service_category?: string;
  /** residential | commercial. Non-PII. */
  customer_segment?: CustomerSegment;
  /** Pathname only — query/hash are always stripped. Defaults to current path. */
  page_path?: string;
  /** Where the form lives, e.g. "lp_emergency". Non-PII. */
  lead_source_surface?: string;
  /** Monetary value — pass ONLY when a real, documented value exists. */
  value?: number;
  /** ISO currency — REQUIRED whenever `value` is set; ignored otherwise. */
  currency?: string;
}

export interface TrackConversionOptions {
  /**
   * Idempotency key. A key that has already fired no-ops. Pass a value that is
   * identical for duplicate fires of the SAME logical conversion but distinct
   * across genuinely separate submissions.
   */
  dedupeKey?: string;
}

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  const g = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof g === "function" ? g : undefined;
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location?.pathname ?? "/";
}

/** Keys that have already fired this session (idempotency guard). */
const firedDedupeKeys = new Set<string>();

/**
 * Build the outgoing GA4 payload from a strict allowlist. Anything not named
 * here — including any PII a caller might accidentally pass — is dropped.
 * `page_path` is always present and always sanitised via `toPagePath`.
 * `value`/`currency` are emitted only as a valid pair.
 */
function buildPayload(params: ConversionParams): Record<string, unknown> {
  const out: Record<string, unknown> = {
    page_path: toPagePath(params.page_path ?? currentPath()),
  };
  if (params.form_type) out.form_type = params.form_type;
  if (params.service_category) out.service_category = params.service_category;
  if (params.customer_segment) out.customer_segment = params.customer_segment;
  if (params.lead_source_surface) out.lead_source_surface = params.lead_source_surface;
  if (
    typeof params.value === "number" &&
    Number.isFinite(params.value) &&
    typeof params.currency === "string" &&
    params.currency.length > 0
  ) {
    out.value = params.value;
    out.currency = params.currency;
  }
  return out;
}

/**
 * Emit one conversion `event`. Returns `true` if anything was sent (GA4 and/or
 * Ads), `false` on a no-op (deduped, GA4 disabled + no Ads label, or gtag
 * unavailable). Safe to call unconditionally — it never throws.
 */
export function trackConversion(
  event: ConversionEvent,
  params: ConversionParams = {},
  options: TrackConversionOptions = {},
): boolean {
  // Idempotency first: record the key even if nothing ends up sending, so a
  // second invocation for the same logical conversion can never double-fire.
  const dedupeKey = options.dedupeKey;
  if (dedupeKey) {
    if (firedDedupeKeys.has(dedupeKey)) return false;
    firedDedupeKeys.add(dedupeKey);
  }

  const gtag = getGtag();
  if (!gtag) return false;

  const payload = buildPayload(params);
  let sent = false;

  // GA4 — scoped to the GA4 stream via send_to, never the Ads account.
  const ga4Id = getGa4MeasurementId();
  if (ga4Id) {
    gtag("event", event, { ...payload, send_to: ga4Id });
    sent = true;
  }

  // Google Ads — only when a real label is configured for this event.
  const label = ADS_CONVERSION_LABELS[event];
  if (label) {
    const adsPayload: Record<string, unknown> = {
      send_to: `${ADS_CONVERSION_ID}/${label}`,
    };
    if (typeof payload.value === "number" && typeof payload.currency === "string") {
      adsPayload.value = payload.value;
      adsPayload.currency = payload.currency;
    }
    gtag("event", "conversion", adsPayload);
    sent = true;
  }

  return sent;
}

export interface ServiceMapping {
  event: ConversionEvent;
  service_category: string;
  customer_segment?: CustomerSegment;
}

function segmentFor(s: string): CustomerSegment | undefined {
  if (/(commercial|vrf|vrv|rtu|warehouse|office|restaurant|property manag)/.test(s)) {
    return "commercial";
  }
  if (
    /(residential|home|house|heat ?pump|mini.?split|air ?condition|\bac\b|a\/c|furnace|heating|emergency|repair|install|replace|maintenance|tune)/.test(
      s,
    )
  ) {
    return "residential";
  }
  return undefined;
}

/**
 * Map a free-text service label (e.g. a <Select> value) to a conversion event
 * plus a non-PII category/segment. Pure, case-insensitive, deterministic; the
 * service string is used only to CLASSIFY and is never forwarded to GA4.
 */
export function mapServiceToConversion(service: string | undefined): ServiceMapping {
  const s = (service ?? "").toLowerCase();
  const has = (...words: string[]) => words.some((w) => s.includes(w));

  if (has("replace")) {
    return { event: "replacement_request", service_category: "replacement", customer_segment: segmentFor(s) };
  }
  if (has("maintenance", "subscription", "tune")) {
    return { event: "maintenance_plan_inquiry", service_category: "maintenance", customer_segment: segmentFor(s) };
  }
  if (has("commercial", "vrf", "vrv", "rtu")) {
    return { event: "commercial_quote_request", service_category: "commercial", customer_segment: "commercial" };
  }
  if (has("emergency", "repair")) {
    return { event: "repair_request", service_category: "repair", customer_segment: segmentFor(s) };
  }
  if (has("install")) {
    return { event: "installation_request", service_category: "installation", customer_segment: segmentFor(s) };
  }
  if (has("residential")) {
    return { event: "residential_quote_request", service_category: "residential", customer_segment: "residential" };
  }
  return { event: "quote_request", service_category: "general", customer_segment: segmentFor(s) };
}

/** Test-only: clear the idempotency guard between cases. Not for app use. */
export function __resetConversionTrackingForTests(): void {
  firedDedupeKeys.clear();
}
