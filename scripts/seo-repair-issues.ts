import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

type Audit = { results: Array<{ path: string; status: string; reason: string; httpStatus: number | null; repairPlan?: { action: string; reason: string } }> };
const report = JSON.parse(readFileSync("artifacts/seo/publication-audit.json", "utf8")) as Audit;
const existing = JSON.parse(execFileSync("gh", ["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title"], { encoding: "utf8" })) as Array<{number:number;title:string}>;
const prefix = "[SEO Repair] ";
const failed = report.results.filter(r => r.status !== "verified_live");
const seen = new Set<string>();
for (const item of failed.slice(0, 30)) {
  if (!/^\/blog\/[a-z0-9-]+$/.test(item.path)) continue;
  const title = prefix + item.path;
  seen.add(title);
  const body = [
    "Automated SEO publication diagnosis (no production changes applied).",
    "", "URL: https://mechanicalenterprise.com" + item.path,
    "HTTP status: " + (item.httpStatus ?? "unreachable"),
    "Failure: " + item.reason,
    "Recovery classification: " + (item.repairPlan?.action ?? "manual_review"),
    "Recommended action: " + (item.repairPlan?.reason ?? "Investigate source and deployment"),
    "", "Do not auto-edit claims, canonical tags, routes or page content without source verification.",
  ].join("\n");
  const issue = existing.find(x => x.title === title);
  if (issue) continue;
  execFileSync("gh", ["issue", "create", "--title", title, "--body", body], { stdio: "inherit" });
}
for (const issue of existing.filter(x => x.title.startsWith(prefix))) {
  if (!seen.has(issue.title) && report.results.some(r => prefix + r.path === issue.title && r.status === "verified_live")) {
    execFileSync("gh", ["issue", "close", String(issue.number), "--comment", "The latest production audit verified this URL; issue closed automatically."], { stdio: "inherit" });
  }
}
