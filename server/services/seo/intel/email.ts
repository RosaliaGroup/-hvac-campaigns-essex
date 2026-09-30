/**
 * §5 daily email digest (docs/market-intel-spec.md). Gated by `SEO_ALERT_EMAIL`
 * (same env var the autopublish hold/nightly-summary emails already use —
 * server/services/seo/autoMerge.ts, nightlyDraftJob.ts). §7: "a report with
 * zero material items... sends no email unless SEO_INTEL_ALWAYS_EMAIL=true."
 */
import { sendEmail } from "../../emailService";

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
