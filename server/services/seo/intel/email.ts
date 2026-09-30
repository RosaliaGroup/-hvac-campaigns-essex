/**
 * §5 daily email digest (docs/market-intel-spec.md). Gated by `SEO_ALERT_EMAIL`
 * (same env var the autopublish hold/nightly-summary emails already use —
 * server/services/seo/autoMerge.ts, nightlyDraftJob.ts). §7: "a report with
 * zero material items... sends no email unless SEO_INTEL_ALWAYS_EMAIL=true."
 */
import { sendEmail } from "../../emailService";
import type { CrawlCheckResult } from "../../../../shared/marketIntelTypes";

export type DigestInput = {
  reportId: number;
  date: string;
  itemCount: number;
  executed: number;
  summary: string;
  circuitClear: boolean;
  /** Pages flagged "possibly de-indexed" in this report. Informational — never makes an empty digest material. */
  possiblyDeindexed?: number;
};

function siteUrl(): string {
  return (process.env.PUBLIC_SITE_URL ?? "https://mechanicalenterprise.com").replace(/\/+$/, "");
}

/** Returns true iff an email was actually sent. */
export async function sendDailyDigest(input: DigestInput): Promise<boolean> {
  const to = process.env.SEO_ALERT_EMAIL;
  if (!to) return false;

  const isMaterial = input.itemCount > 0;
  if (!isMaterial && process.env.SEO_INTEL_ALWAYS_EMAIL !== "true") return false;

  const highCount = 0; // no severity scoring implemented in this first pass — see build report.
  const subject = `Market intel — ${input.date} — ${input.itemCount} suggestion${input.itemCount === 1 ? "" : "s"} (${highCount} high)`;
  const link = `${siteUrl()}/market-intel?report=${input.reportId}`;

  const html = [
    `<p>${input.summary}</p>`,
    input.circuitClear ? "" : `<p><b>Paused: suggestions only.</b></p>`,
    input.possiblyDeindexed ? `<p><b>${input.possiblyDeindexed} page${input.possiblyDeindexed === 1 ? "" : "s"} possibly de-indexed</b> — URL Inspection links are in the full report.</p>` : "",
    `<p><a href="${link}">Full report in the CRM</a></p>`,
  ].join("");

  const sent = await sendEmail({ to, subject, html }).catch(() => false);
  return !!sent;
}

export type CrawlAlertInput = { reportId: number; date: string; result: CrawlCheckResult };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sent immediately when the daily Googlebot-style crawl check finds anything — separate from the digest,
 * which stays quiet on an empty day. Returns true iff an email was actually sent.
 */
export async function sendCrawlCheckAlert(input: CrawlAlertInput): Promise<boolean> {
  const to = process.env.SEO_ALERT_EMAIL;
  if (!to || input.result.anomalies.length === 0) return false;
  const n = input.result.anomalies.length;
  const shown = input.result.anomalies.slice(0, 30);
  const rows = shown.map((a) => `<li><b>${esc(a.kind)}</b> — <a href="${esc(a.url)}">${esc(a.url)}</a>: ${esc(a.detail)}</li>`).join("");
  const html = [
    `<p>The daily Googlebot-style crawl check found <b>${n} issue${n === 1 ? "" : "s"}</b> across ${input.result.checked} URLs (${input.date}).</p>`,
    `<ul>${rows}</ul>`,
    n > shown.length ? `<p>…and ${n - shown.length} more in the full report.</p>` : "",
    `<p><a href="${siteUrl()}/market-intel?report=${input.reportId}">Full report in the CRM</a></p>`,
  ].join("");
  const sent = await sendEmail({ to, subject: `Crawl check — ${n} issue${n === 1 ? "" : "s"} — ${input.date}`, html }).catch(() => false);
  return !!sent;
}
