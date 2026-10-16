/** Independent GBP OAuth configuration. Does not modify the shared Google grant. */
import { checkGbpProject } from "../services/gbp/projectPreflight";
export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
export function getDedicatedGbpConfig() {
  const clientId = process.env.GBP_GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GBP_GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GBP_GOOGLE_REDIRECT_URI ?? "";
  const project = checkGbpProject(clientId);
  const expectedCallback = "https://mechanicalenterprise.com/api/integrations/google-business/callback";
  return {
    clientId, clientSecret, redirectUri,
    configured: Boolean(clientSecret && redirectUri === expectedCallback && project.matches),
    reason: !project.matches ? project.reason : !clientSecret ? "GBP client secret missing" : redirectUri !== expectedCallback ? "GBP callback mismatch" : "ready",
  };
}
export function buildDedicatedGbpAuthorizeUrl(state: string) {
  const cfg = getDedicatedGbpConfig();
  if (!cfg.configured) throw new Error("Dedicated GBP OAuth not configured: " + cfg.reason);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GBP_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
}
