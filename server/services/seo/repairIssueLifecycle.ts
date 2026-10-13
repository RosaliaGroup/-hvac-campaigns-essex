/** Pure decision logic for issue lifecycle. Never closes issues for omitted paths. */
export type AuditPage = { path: string; status: string };
export function seoIssueActions(pages: AuditPage[], openTitles: string[]) {
  if (!pages.length) throw new Error("Empty audit");
  const prefix = "[SEO Repair] ";
  const byPath = new Map(pages.map(p => [p.path, p.status]));
  const existing = new Set(openTitles);
  return {
    create: pages.filter(p => p.status !== "verified_live" && /^\/blog\/[a-z0-9-]+$/.test(p.path) && !existing.has(prefix + p.path)).map(p => prefix + p.path),
    close: openTitles.filter(t => t.startsWith(prefix) && byPath.get(t.slice(prefix.length)) === "verified_live"),
  };
}
