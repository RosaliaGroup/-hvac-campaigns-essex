/**
 * Warm & Safe — "nominate a senior who needs safe heat" (owner, Nov 11 2026).
 *
 * Public mutation behind the /warm-and-safe page. A nomination is NOT a sales
 * lead (the nominee did not ask to be contacted), so it is NOT written to
 * leadCaptures, never enrolled in speed-to-lead, and never synced to
 * QuickBooks. It is emailed to the sales inbox for a human to review. If the
 * nominator also asks for a free assessment of their OWN home, the page sends
 * that separately through the normal leadCaptures.create flow.
 *
 * Same spam protection as lead capture: rate limit, Turnstile, honeypots,
 * too-fast submit + content scoring. Blocked submissions get a success-shaped
 * response so bots learn nothing.
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { enforceRateLimit, getClientIp, HOUR_MS, publicWriteIpRule } from "../_core/rateLimit";
import { verifyTurnstile, isTurnstileEnforced } from "../_core/turnstile";
import { evaluateSpam } from "@shared/spamGuard";
import { sendEmail } from "../services/emailService";

const INBOX = "sales@mechanicalenterprise.com";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const nominationInput = z.object({
  // Lenient on purpose (Nov 12: owner's test nominations were rejected with a
  // silent 400). Anything the form lets a person type is accepted; a human
  // reads every nomination, so an imperfect email or short answer is fine.
  nominatorName: z.string().trim().min(1).max(200),
  nominatorPhone: z.string().trim().min(1).max(40),
  nominatorEmail: z.string().trim().max(254).optional(),
  relationship: z.string().trim().max(200).optional(),
  nomineeFirstName: z.string().trim().max(120).optional(),
  // Nov 18 (owner): collect what we used to request by text after the fact.
  // Contact fields are only sent when the nominee knows and agreed to be called.
  nomineeFullName: z.string().trim().max(200).optional(),
  nomineeAddress: z.string().trim().max(300).optional(),
  nomineeTown: z.string().trim().min(1).max(120),
  nomineePhone: z.string().trim().max(40).optional(),
  nomineeBestTime: z.string().trim().max(120).optional(),
  nomineeIs65Plus: z.enum(["yes", "no", "unsure"]).optional(),
  nomineeOwnsHome: z.enum(["yes", "no", "unsure"]).optional(),
  heatingSituation: z.string().trim().min(1).max(4000),
  nomineeKnows: z.boolean(),
  wantsOwnAssessment: z.boolean().optional(),
  pageUrl: z.string().max(500).optional(),
  // spam protection (never persisted)
  website: z.string().optional(),
  company_url: z.string().optional(),
  _ts: z.number().optional(),
  cfTurnstileResponse: z.string().optional(),
});
export type NominationInput = z.infer<typeof nominationInput>;

const ans = (v?: "yes" | "no" | "unsure") => (v === "yes" ? "Yes" : v === "no" ? "No" : v === "unsure" ? "Not sure" : null);

/** Flags the public-terms requirements (65+, owns the home, NJ) that need checking. */
export function eligibilityNote(n: NominationInput): string {
  const gaps: string[] = [];
  if (n.nomineeIs65Plus === "no") gaps.push("nominator says they are under 65");
  if (n.nomineeOwnsHome === "no") gaps.push("nominator says they don't own the home");
  if (!n.nomineeIs65Plus || n.nomineeIs65Plus === "unsure") gaps.push("confirm age 65+");
  if (!n.nomineeOwnsHome || n.nomineeOwnsHome === "unsure") gaps.push("confirm they own the home");
  if (n.nomineeKnows && !n.nomineePhone) gaps.push("no phone given for them — ask the nominator");
  if (!n.nomineeAddress) gaps.push("no street address — ask the nominator");
  if (!gaps.length) return "";
  return `<p style="margin:10px 0 0;font-size:13px;color:#8a5a00;background:#fff7e6;padding:8px 10px;border-radius:4px">To check: ${esc(gaps.join("; "))}</p>`;
}

export function nominationEmailHtml(n: NominationInput, when: string): string {
  const row = (k: string, v?: string | null) =>
    v ? `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${esc(v)}</td></tr>` : "";
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">
  <div style="background:#1e3a5f;color:#fff;padding:18px 20px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:18px">🔥 Warm &amp; Safe nomination — ${esc(n.nomineeTown)}</h1>
    <p style="margin:6px 0 0;color:#cfe0f5;font-size:13px">${esc(when)} · review before contacting the nominee</p>
  </div>
  <div style="background:#f9f9f9;padding:18px 20px;border:1px solid #eee;font-size:14px">
    <h2 style="font-size:15px;margin:0 0 6px;color:#1e3a5f">Nominee</h2>
    <table>${row("Name", n.nomineeFullName || n.nomineeFirstName)}${row("Address", n.nomineeAddress)}${row("Town", n.nomineeTown)}${row("Phone", n.nomineeKnows ? n.nomineePhone : null)}${row("Best time to call", n.nomineeKnows ? n.nomineeBestTime : null)}${row("65 or older", ans(n.nomineeIs65Plus))}${row("Owns the home", ans(n.nomineeOwnsHome))}${row("Knows about nomination", n.nomineeKnows ? "Yes — agreed we can contact them" : "NO — ask the nominator to get their OK before calling")}</table>
    ${eligibilityNote(n)}
    <h2 style="font-size:15px;margin:16px 0 6px;color:#1e3a5f">Their heating situation</h2>
    <p style="margin:0;white-space:pre-line;background:#fff;border-left:4px solid #ff6b35;padding:10px 12px">${esc(n.heatingSituation)}</p>
    <h2 style="font-size:15px;margin:16px 0 6px;color:#1e3a5f">Nominated by</h2>
    <table>${row("Name", n.nominatorName)}${row("Phone", n.nominatorPhone)}${row("Email", n.nominatorEmail || null)}${row("Relationship", n.relationship)}${row("Also wants a free assessment for their own home", n.wantsOwnAssessment ? "Yes (sent separately as a lead)" : "No")}</table>
    <p style="margin:16px 0 0;color:#a33;font-size:13px">If the situation sounds unsafe (no heat, gas smell, CO alarm, space heaters near bedding), call the nominator today.</p>
  </div></div>`;
}

export const warmSafeRouter = router({
  nominate: publicProcedure.input(nominationInput).mutation(async ({ input, ctx }) => {
    const ip = getClientIp(ctx);
    enforceRateLimit(
      [{ bucket: "warmSafe.ip", key: ip, max: 10, windowMs: HOUR_MS }, publicWriteIpRule(ip)],
      { route: "/warm-and-safe", ip },
    );

    const ts = await verifyTurnstile(input.cfTurnstileResponse, ip);
    if (!ts.success && (isTurnstileEnforced() || input.cfTurnstileResponse)) {
      console.warn(`[warm-safe] turnstile reject ip=${ip}`);
      return { success: true };
    }
    const guard = evaluateSpam({
      name: input.nominatorName,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.nominatorEmail ?? "") ? input.nominatorEmail : undefined,
      phone: input.nominatorPhone,
      website: input.website,
      company_url: input.company_url,
      ts: input._ts,
    });
    if (guard.blocked) {
      console.warn(`[warm-safe] spam blocked score=${guard.score} reasons=${guard.reasons.join(",")}`);
      return { success: true };
    }

    if (!input.nomineeKnows) {
      // Without the nominee's OK we don't keep their phone.
      input = { ...input, nomineePhone: undefined, nomineeBestTime: undefined };
    }
    const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });
    const emailed = await sendEmail({
      to: INBOX,
      subject: `🔥 Warm & Safe nomination — ${input.nomineeTown}`,
      html: nominationEmailHtml(input, when),
    }).catch(() => false);
    if (!emailed) {
      // Last-resort record so a nomination is never silently lost (no phone/email in logs).
      console.error(`[warm-safe] EMAIL FAILED — nomination for ${input.nomineeTown} from ${input.nominatorName.split(" ")[0]} at ${when}`);
    } else {
      console.info(`[warm-safe] nomination emailed (town=${input.nomineeTown})`);
    }
    return { success: true };
  }),
});
