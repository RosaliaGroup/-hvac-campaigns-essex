/** Read-only GitHub Actions audit visibility for the CRM SEO dashboard.
 * Requires GITHUB_TOKEN and GITHUB_REPO in the server environment.
 * Never exposes credentials to the client.
 */
export async function getLatestSeoPublicationAudit() {
  const token = process.env.GITHUB_TOKEN || process.env.SEO_GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "RosaliaGroup/-hvac-campaigns-essex";
  // Public repository workflow status can be read without a token; artifact downloads still require credentials.
  const headers = { ...(token ? { Authorization: "Bearer " + token } : {}), Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const endpoint = "https://api.github.com/repos/" + repo + "/actions/workflows/seo-daily-live-audit.yml/runs?per_page=10";
  try {
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { status: "unavailable" as const, message: "GitHub HTTP " + response.status };
    const data = await response.json() as { workflow_runs?: Array<{ id: number; status: string; conclusion: string | null; created_at: string; html_url: string }> };
    const run = data.workflow_runs?.find(r => r.status === "completed");
    if (!run) return { status: "pending" as const, message: "No completed SEO audit found" };
    return { status: run.conclusion === "success" ? "passed" as const : "failed" as const,
      runId: run.id, checkedAt: run.created_at, url: run.html_url,
      message: run.conclusion === "success" ? "Latest SEO audit passed" : "Latest SEO audit did not pass; review its report" };
  } catch {
    return { status: "unavailable" as const, message: "GitHub audit status could not be retrieved" };
  }
}
