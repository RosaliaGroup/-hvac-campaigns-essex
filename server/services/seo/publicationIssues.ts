/** Read-only per-article audit issues from the latest GitHub Actions JSON artifact. */
import { inflateRawSync } from "node:zlib";

function unzipArtifact(buffer: Buffer): Buffer {
  // ZIP local file header. GitHub Actions artifact has a single JSON report.
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    if (name.endsWith("publication-audit.json")) {
      if (compressed > 10_000_000) throw new Error("Audit artifact too large");
      return method === 0 ? buffer.subarray(start, start + compressed) : inflateRawSync(buffer.subarray(start, start + compressed));
    }
    if (!compressed) break;
    offset = start + compressed;
  }
  throw new Error("Audit report missing from artifact");
}

export async function getSeoPublicationIssues() {
  const token = process.env.GITHUB_TOKEN || process.env.SEO_GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "RosaliaGroup/-hvac-campaigns-essex";
  if (!token) return { status: "unconfigured" as const, issues: [], message: "GitHub token not configured (GITHUB_TOKEN or SEO_GITHUB_TOKEN)" };
  const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };
  try {
    const runsResponse = await fetch("https://api.github.com/repos/" + repo + "/actions/workflows/seo-daily-live-audit.yml/runs?per_page=20", { headers, signal: AbortSignal.timeout(10000) });
    if (!runsResponse.ok) throw new Error("Audit runs HTTP " + runsResponse.status);
    const runs = await runsResponse.json() as { workflow_runs?: Array<{ id: number; status: string }> };
    const latest = runs.workflow_runs?.find(run => run.status === "completed");
    if (!latest) return { status: "pending" as const, issues: [], message: "No completed audit yet" };
    const artifactsResponse = await fetch("https://api.github.com/repos/" + repo + "/actions/runs/" + latest.id + "/artifacts", { headers, signal: AbortSignal.timeout(10000) });
    if (!artifactsResponse.ok) throw new Error("Audit artifacts HTTP " + artifactsResponse.status);
    const artifacts = await artifactsResponse.json() as { artifacts?: Array<{ id: number; name: string; expired: boolean }> };
    const artifact = artifacts.artifacts?.find(a => a.name === "seo-publication-audit" && !a.expired);
    if (!artifact) return { status: "unavailable" as const, issues: [], message: "Audit report artifact unavailable" };
    const archive = await fetch("https://api.github.com/repos/" + repo + "/actions/artifacts/" + artifact.id + "/zip", { headers, signal: AbortSignal.timeout(15000) });
    if (!archive.ok) throw new Error("Audit archive HTTP " + archive.status);
    const report = JSON.parse(unzipArtifact(Buffer.from(await archive.arrayBuffer())).toString()) as {
      checkedAt: string; total: number; failureStreaks?: Record<string, number>;
      results: Array<{ path: string; status: string; reason: string; attempts?: number; httpStatus?: number | null }>;
    };
    return { status: "ready" as const, checkedAt: report.checkedAt, total: report.total,
      issues: report.results.filter(r => r.status !== "verified_live").map(r => ({
        ...r, consecutiveFailures: report.failureStreaks?.[r.path] ?? 1,
        recommendedAction: r.httpStatus === 404 ? "Check page deployment and routing" :
          r.reason.includes("Canonical") ? "Correct canonical metadata" :
          r.status === "unreachable" ? "Check hosting and connectivity" : "Inspect published article HTML"
      })) };
  } catch (error) {
    return { status: "unavailable" as const, issues: [], message: error instanceof Error ? error.message : "Audit unavailable" };
  }
}
