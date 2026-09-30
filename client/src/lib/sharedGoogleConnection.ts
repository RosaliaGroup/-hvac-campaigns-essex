/**
 * Where the ONE shared Google connection is managed. Google Calendar, Search
 * Console, GA4 and Google Business Profile reads all reuse this single OAuth
 * grant (see server/integrations/google/calendar.ts, ga4.ts, gbp.ts — "There is
 * NO second OAuth flow"), and its connect / reconnect / disconnect control is the
 * Google card on the Integrations settings page. Legacy per-service Google
 * credential forms (AI VA Settings → Google Business) link here instead of
 * offering their own connection flow.
 */
export const SHARED_GOOGLE_CONNECTION_PATH = "/settings/integrations";
