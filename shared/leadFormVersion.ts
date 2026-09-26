/**
 * Bump this whenever a lead-capture form's TCPA/consent disclosure language
 * changes. `server/routers.ts`'s `leadCaptures.create` only seeds
 * `consentStatus="opt_in"` when the submitting form sent this exact version —
 * see shared/growthConsent.ts. A form that hasn't been updated to send the
 * current version (or any non-form insert path) falls back to "unknown".
 */
export const TCPA_FORM_VERSION = "tcpa-v1-2026-09-26";
