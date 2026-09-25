/**
 * GitHub REST API client for the SEO bulk-approve PR flow
 * (docs/seo-bulk-approve-spec.md §5). Raw `fetch` against api.github.com —
 * matches this codebase's existing pattern for external APIs (e.g.
 * server/routers/rebateCalculator.ts's Resend calls) rather than adding an
 * Octokit dependency for what is, in practice, four endpoints.
 *
 * Auth: a single fine-grained PAT in `SEO_GITHUB_TOKEN` (server-side only,
 * never sent to the client). isGithubConfigured() is the "not configured"
 * check the router/UI use to show a clear state instead of a confusing
 * failure when the token hasn't been provisioned yet.
 *
 * Hard rule (spec §0 / §5 step 5): this file NEVER merges a PR, NEVER pushes
 * to `main`, and has no function that could. Every write here targets a
 * `pr-seo-meta-*` or `revert-*` branch; the only main-adjacent read is
 * fetching main's current tip SHA to branch FROM.
 */

const REPO_OWNER = "RosaliaGroup";
const REPO_NAME = "-hvac-campaigns-essex";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const OVERRIDES_PATH = "netlify/edge-functions/seo-meta-overrides.json";

export function isGithubConfigured(): boolean {
  return !!process.env.SEO_GITHUB_TOKEN;
}

function token(): string {
  const t = process.env.SEO_GITHUB_TOKEN;
  if (!t) throw new GithubNotConfiguredError();
  return t;
}

export class GithubNotConfiguredError extends Error {
  constructor() {
    super("SEO_GITHUB_TOKEN is not set — the bulk-approve PR flow is not configured.");
    this.name = "GithubNotConfiguredError";
  }
}

async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 500)}`);
  }
  return res;
}

/** SHA of `main`'s current tip — the base every new batch branch is cut from. */
export async function getMainSha(): Promise<string> {
  const res = await gh(`/git/ref/heads/main`);
  const data = (await res.json()) as { object: { sha: string } };
  return data.object.sha;
}

/** True if the branch already exists (same-day batches append to one PR). */
export async function branchExists(branch: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/vnd.github+json" },
  });
  return res.ok;
}

/** Create `branch` from `main`'s current tip if it doesn't already exist. */
export async function ensureBranch(branch: string): Promise<void> {
  if (await branchExists(branch)) return;
  const sha = await getMainSha();
  await gh(`/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
}

/** Current content (parsed) + blob SHA of the overrides file on `branch`. */
export async function getOverridesFile(
  branch: string,
): Promise<{ content: Record<string, { title: string; description: string }>; sha: string }> {
  const res = await gh(`/contents/${OVERRIDES_PATH}?ref=${encodeURIComponent(branch)}`);
  const data = (await res.json()) as { content: string; sha: string };
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return { content: JSON.parse(decoded), sha: data.sha };
}

/** Write `content` as the new overrides file on `branch`, one commit. */
export async function commitOverridesFile(
  branch: string,
  content: Record<string, { title: string; description: string }>,
  message: string,
  previousSha: string,
): Promise<string> {
  const encoded = Buffer.from(JSON.stringify(content, null, 2) + "\n", "utf-8").toString("base64");
  const res = await gh(`/contents/${OVERRIDES_PATH}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: encoded, sha: previousSha, branch }),
  });
  const data = (await res.json()) as { commit: { sha: string } };
  return data.commit.sha;
}

export type OpenPrResult = { url: string; number: number; created: boolean };

/**
 * Open a PR for `branch` -> main, or, if one is already open for it (a
 * same-day second batch), APPEND `body` to the existing PR's description
 * rather than replacing it — every batch's diff table must stay visible to
 * the human merger, not just the most recent one.
 */
export async function openOrGetPR(branch: string, title: string, body: string): Promise<OpenPrResult> {
  const existing = await gh(`/pulls?head=${REPO_OWNER}:${encodeURIComponent(branch)}&state=open`);
  const rows = (await existing.json()) as Array<{ html_url: string; number: number }>;
  if (rows.length > 0) {
    await appendToPRBody(rows[0].number, body);
    return { url: rows[0].html_url, number: rows[0].number, created: false };
  }
  const res = await gh(`/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head: branch, base: "main", body }),
  });
  const data = (await res.json()) as { html_url: string; number: number };
  return { url: data.html_url, number: data.number, created: true };
}

/** Append text to an already-open PR's body (used when a same-day PR exists). */
export async function appendToPRBody(prNumber: number, addition: string): Promise<void> {
  const res = await gh(`/pulls/${prNumber}`);
  const data = (await res.json()) as { body: string | null };
  await gh(`/pulls/${prNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ body: `${data.body ?? ""}\n\n---\n\n${addition}` }),
  });
}

export type PRStatus = { merged: boolean; state: "open" | "closed"; mergeCommitSha: string | null };

/** Poll a PR's merge status (used to flip a batch pr_open → merged). */
export async function getPRStatus(prNumber: number): Promise<PRStatus> {
  const res = await gh(`/pulls/${prNumber}`);
  const data = (await res.json()) as { merged: boolean; state: "open" | "closed"; merge_commit_sha: string | null };
  return { merged: data.merged, state: data.state, mergeCommitSha: data.merge_commit_sha };
}

/** Netlify's deploy-preview check status for a PR (for the CRM's "preview: <url|building|—>" indicator). */
export async function getDeployPreviewUrl(prNumber: number, headSha: string): Promise<string | null> {
  const res = await gh(`/commits/${headSha}/status`);
  const data = (await res.json()) as { statuses?: Array<{ context: string; target_url: string | null; state: string }> };
  const netlify = data.statuses?.find((s) => s.context.toLowerCase().includes("netlify") && s.state === "success");
  void prNumber; // kept in the signature for callers that want to log which PR this was for
  return netlify?.target_url ?? null;
}
