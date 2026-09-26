/**
 * Growth-system SMS dispatch — the ONE place cadence/speed-to-lead/review-engine
 * code sends a text. Layers TWO gates before any Telnyx call:
 *   1. gateGrowthSend() (compliance.ts) — consent/DNC, calling hours, per-contact cap.
 *   2. The existing smsCompliance.gateSmsRecipient() — E.164 + STOP opt-out, exactly
 *      the same gate every other SMS sender in this codebase uses, checked again at
 *      dispatch time so a STOP that lands AFTER a cadence task was scheduled is still
 *      honored (mirrors server/integrations/accounting/followups.ts's pattern).
 * Every outcome (sent/failed/blocked/held) is recorded to the growthTouches ledger.
 * A GROWTH_SMS_ENABLED=false kill switch additionally short-circuits before any of
 * this (checked by the caller — see cadenceEngine.ts / speedToLead.ts).
 */
import { getDb } from "../../db";
import { sendAndRecordSms, mechanicalSmsFrom } from "../../services/smsOutbound";
import { gateSmsRecipient, isTerminalBlock } from "../../services/smsCompliance";
import { gateGrowthSend, isTerminalGrowthBlock, type GrowthBlockReason } from "./compliance";
import { recordGrowthTouch, type GrowthChannel } from "./touchLedger";
import type { ConsentStatus } from "../../../shared/growthConsent";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const CHANNEL: GrowthChannel = "sms";

export interface SendGrowthSmsArgs {
  db: Db;
  phone: string | null;
  message: string;
  consentStatus: ConsentStatus;
  campaignType: string;
  cadenceId?: number | null;
  leadTable?: "leads" | "leadCaptures" | "imported" | "customer" | null;
  leadId?: number | null;
  step?: number | null;
  lastTransactionAt?: Date | string | null;
  now?: Date;
}

export type SendGrowthSmsResult =
  | { outcome: "sent"; messageId?: string }
  | { outcome: "failed"; error: string }
  | { outcome: "blocked"; reason: string; terminal: boolean }
  | { outcome: "held"; holdUntil: Date };

export async function sendGrowthSms(args: SendGrowthSmsArgs): Promise<SendGrowthSmsResult> {
  const gate = await gateGrowthSend({
    db: args.db,
    channel: CHANNEL,
    phone: args.phone,
    consentStatus: args.consentStatus,
    lastTransactionAt: args.lastTransactionAt,
    cadenceId: args.cadenceId,
    now: args.now,
  });
  if (!gate.ok) {
    if (gate.reason === "outside_calling_hours") {
      // Hold, don't drop (spec §1.1) — no touch row; the caller retries at holdUntil.
      return { outcome: "held", holdUntil: gate.holdUntil! };
    }
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactPhone: args.phone, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "blocked", blockedReason: gate.reason, body: args.message,
    });
    return { outcome: "blocked", reason: gate.reason, terminal: isTerminalGrowthBlock(gate.reason as GrowthBlockReason) };
  }

  // Second gate: the shared STOP/E.164 check every SMS sender uses.
  const smsGate = await gateSmsRecipient(args.phone ?? "", args.db);
  if (!smsGate.ok) {
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactPhone: args.phone, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "blocked", blockedReason: smsGate.blocked, body: args.message,
    });
    return { outcome: "blocked", reason: smsGate.blocked, terminal: isTerminalBlock(smsGate.blocked) };
  }

  const result = await sendAndRecordSms(args.db, {
    phone: smsGate.to,
    message: args.message,
    source: "growth",
    leadId: args.leadTable === "leads" ? args.leadId ?? null : null,
    sentByName: "Jessica (Growth)",
  });

  await recordGrowthTouch(args.db, {
    channel: CHANNEL, contactPhone: smsGate.to, leadTable: args.leadTable, leadId: args.leadId,
    campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
    status: result.success ? "sent" : "failed",
    blockedReason: result.success ? null : (result.error ?? "send_failed"),
    body: args.message, providerMessageId: result.messageId ?? null,
  });

  if (!result.success) return { outcome: "failed", error: result.error ?? "SMS send failed" };
  return { outcome: "sent", messageId: result.messageId };
}

export { mechanicalSmsFrom };
