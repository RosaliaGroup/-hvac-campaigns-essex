/**
 * Growth-system email dispatch — wraps services/emailService.ts's sendEmail with
 * the growthTouches audit row the build brief calls for (§1e: "confirm email
 * touches are logged... if not, add one"). sendEmail itself writes no log of any
 * kind; every growth-system email touch (cadence day-7, review-engine paths that
 * add email later, etc.) must go through this wrapper instead of calling
 * sendEmail directly, so §10's scoreboard has a complete cross-channel touch
 * record. No compliance gate here — email is allowed even for `unknown` consent
 * (spec §1d/§7: "unknown consent -> email only").
 */
import { getDb } from "../../db";
import { sendEmail } from "../../services/emailService";
import { recordGrowthTouch, type GrowthChannel } from "./touchLedger";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const CHANNEL: GrowthChannel = "email";

export interface SendGrowthEmailArgs {
  db: Db;
  to: string | null;
  subject: string;
  html: string;
  campaignType: string;
  cadenceId?: number | null;
  leadTable?: "leads" | "leadCaptures" | "imported" | "customer" | null;
  leadId?: number | null;
  step?: number | null;
}

export type SendGrowthEmailResult = { outcome: "sent" } | { outcome: "failed"; error: string };

export async function sendGrowthEmail(args: SendGrowthEmailArgs): Promise<SendGrowthEmailResult> {
  if (!args.to) {
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactEmail: args.to, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "blocked", blockedReason: "no_email", subject: args.subject,
    });
    return { outcome: "failed", error: "No email address" };
  }

  const ok = await sendEmail({ to: args.to, subject: args.subject, html: args.html });
  await recordGrowthTouch(args.db, {
    channel: CHANNEL, contactEmail: args.to, leadTable: args.leadTable, leadId: args.leadId,
    campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
    status: ok ? "sent" : "failed", blockedReason: ok ? null : "send_failed",
    subject: args.subject, body: args.html,
  });
  return ok ? { outcome: "sent" } : { outcome: "failed", error: "Email send failed (RESEND_API_KEY unset or Resend error)" };
}
