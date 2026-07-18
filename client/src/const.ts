export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Where to send a visitor whose session is missing/expired.
 *
 * This app authenticates via the team-member login (`/team-login`), not the
 * Manus OAuth portal — the OAuth `users` table is unused. The previous
 * implementation built `${VITE_OAUTH_PORTAL_URL}/app-auth?appId=${VITE_APP_ID}`,
 * which in production resolved to `https://mechanicalenterprise.com/app-auth?
 * appId=local-dev` (a 404) because those build vars are placeholders. That broke
 * field access on any unauthenticated redirect. We now always redirect to
 * `/team-login` and carry ONLY a safe, same-origin RELATIVE return path (never a
 * full URL, never OAuth). `sanitizeReturnPath` blocks open-redirects.
 */
export function sanitizeReturnPath(rawPathAndSearch: string): string {
  // Accept only a same-origin absolute path like "/field/my-jobs?x=1".
  // Reject protocol-relative ("//evil"), backslash tricks, and absolute URLs.
  if (
    typeof rawPathAndSearch !== "string" ||
    !rawPathAndSearch.startsWith("/") ||
    rawPathAndSearch.startsWith("//") ||
    rawPathAndSearch.startsWith("/\\") ||
    rawPathAndSearch.includes("://")
  ) {
    return "/field/my-jobs";
  }
  return rawPathAndSearch;
}

export const getLoginUrl = () => {
  const current =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/field/my-jobs";
  const returnPath = sanitizeReturnPath(current);
  return `/team-login?return=${encodeURIComponent(returnPath)}`;
};
