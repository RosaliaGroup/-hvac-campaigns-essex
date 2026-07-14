/**
 * Defensive interpretation of API responses from the Netlify → Railway proxy.
 *
 * tRPC always answers with JSON (including its own error envelopes). When the
 * proxy itself fails — e.g. Netlify rejects an over-cap request body with an
 * empty-body 400, or a gateway returns an HTML 502/504 — the body is empty or
 * non-JSON. Parsing that as JSON yields the opaque "Unexpected end of JSON
 * input". This helper turns such a response into a clear, actionable message.
 *
 * It never includes request data (prompts, images, documents, keys) — only the
 * server's own status, content-type, and a short snippet of the *response* body.
 */

const MAX_SNIPPET = 200;

/**
 * Returns a user-facing error message if `response` is a non-JSON / empty-body
 * failure that tRPC could not have produced, or `null` if the response is a
 * normal JSON response (success or a proper tRPC error envelope) that should be
 * handled by tRPC as usual.
 */
export function describeProxyFailure(
  status: number,
  contentType: string | null,
  bodyText: string,
): string | null {
  const isJson = (contentType ?? "").toLowerCase().includes("application/json");
  const body = bodyText.trim();

  // Proper JSON response (2xx data or a tRPC error envelope) → let tRPC handle it.
  if (isJson && body.length > 0) return null;

  // Anything else on a non-2xx status is a proxy/gateway failure, not a tRPC
  // response. Empty JSON bodies also fall through to here.
  if (status >= 200 && status < 300 && isJson) return null;

  const where =
    status === 413 || status === 400
      ? " The request was likely too large for the API proxy — try selecting fewer pages."
      : status === 502 || status === 503 || status === 504
        ? " The API gateway did not return a response — please try again."
        : " Please try again.";

  const snippet = body.length > 0 ? `: ${body.slice(0, MAX_SNIPPET)}` : " (empty response)";
  const ct = contentType ? `, ${contentType}` : "";
  return `The server returned a non-JSON response (HTTP ${status}${ct})${snippet}.${where}`;
}

/**
 * True when an error message indicates a gateway/proxy timeout (HTTP 502/503/504
 * or an aborted/timed-out request) — the signal to retry the same idempotent
 * batch and then subdivide, rather than repeat the identical slow request.
 */
export function isGatewayTimeoutMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\bHTTP 50[234]\b/.test(message) || /\bgateway\b/i.test(message) || /\btimed?[\s-]?out\b/i.test(message);
}
