/** Read-only, independently fetched live-site publication verification.
 * GitHub merge or registry presence alone is never treated as proof of a live URL.
 */
export type LivePageCheck = {
  path: string;
  status: "verified_live" | "not_live" | "unreachable";
  httpStatus: number | null;
  canonical: string | null;
  canonicalMatches: boolean;
  contentPresent: boolean;
  reason: string;
};

export async function verifyLiveBlogPath(path: string): Promise<LivePageCheck> {
  if (!/^\/blog\/[a-z0-9-]+$/.test(path)) throw new Error("Invalid blog path");
  const expected = `https://mechanicalenterprise.com${path}`;
  const base: LivePageCheck = { path, status: "unreachable", httpStatus: null, canonical: null, canonicalMatches: false, contentPresent: false, reason: "" };
  try {
    const response = await fetch(expected, {
      headers: { Accept: "text/html", "User-Agent": "MechanicalEnterprise-LivePublicationVerifier/1.0" },
      redirect: "follow", signal: AbortSignal.timeout(12000),
    });
    base.httpStatus = response.status;
    if (!response.ok) return { ...base, status: "not_live", reason: `HTTP ${response.status}` };
    if (new URL(response.url).pathname !== path) return { ...base, status: "not_live", reason: "Redirected away from expected blog URL" };
    const html = (await response.text()).slice(0, 1024 * 1024);
    const canonicalMatch = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0]
      ?? html.match(/<link\b[^>]*href=["'][^"']+["'][^>]*rel=["']canonical["'][^>]*>/i)?.[0] ?? "";
    const canonical = canonicalMatch.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
    base.canonical = canonical;
    base.canonicalMatches = !!canonical && new URL(canonical, expected).pathname === path;
    // Require slug-specific content in returned HTML, not only a generic SPA shell.
    const slug = path.slice("/blog/".length);
    // Exclude <head> metadata: a generic SPA fallback may contain the slug only in its canonical tag.
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "").replace(/<link\b[^>]*>/gi, "");
    base.contentPresent = body.toLowerCase().includes(slug);
    base.status = base.canonicalMatches && base.contentPresent ? "verified_live" : "not_live";
    base.reason = !canonical ? "Canonical missing from response" : !base.canonicalMatches ? "Canonical points elsewhere" : !base.contentPresent ? "Expected blog slug absent from HTML" : "HTTP 200, expected canonical and slug-specific HTML confirmed";
    return base;
  } catch (error) {
    return { ...base, reason: error instanceof Error ? error.message.slice(0, 180) : "Request failed" };
  }
}
