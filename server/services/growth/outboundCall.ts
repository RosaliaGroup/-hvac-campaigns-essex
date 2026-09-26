/**
 * Growth-system outbound calling — the ONE place cadence/speed-to-lead code
 * places a Jessica (Vapi) outbound call. Gated by gateGrowthSend() exactly like
 * SMS (see sms.ts's doc), AND by isVapiOutboundConfigured() (see below). Uses
 * server/integrations/vapi.ts's makeOutboundCall, which had NO callers anywhere
 * on main before this — this is its first real caller.
 *
 * Credential-presence gate (distinct from the GROWTH_CALLS_ENABLED kill switch —
 * BOTH must pass for a call to actually go out): production has none of
 * VAPI_API_KEY / VAPI_OUTBOUND_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID set today, and
 * there is no DB-stored fallback for growth-system outbound calling specifically
 * (the generic aiVaCredentials("vapi") store is a separate, inbound-call-oriented
 * config surface — this module deliberately does not read it, to keep "is growth
 * outbound calling live" answerable from three env vars alone). When unconfigured,
 * every call attempt is skipped (not errored) and the step falls back to
 * SMS/email-only — see cadenceEngine.ts's handling of the "not_configured" outcome.
 * server/services/growth/scoreboard.ts surfaces `callsConfigured` so the owner can
 * see at a glance that calling is inert until those three vars are set.
 */
import { getDb } from "../../db";
import { createCallLog } from "../../db";
import { makeOutboundCall, type VapiCredentials } from "../../integrations/vapi";
import { gateGrowthSend, isTerminalGrowthBlock, type GrowthBlockReason } from "./compliance";
import { recordGrowthTouch, type GrowthChannel } from "./touchLedger";
import type { ConsentStatus } from "../../../shared/growthConsent";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const CHANNEL: GrowthChannel = "call";

/** True only when ALL THREE required env vars are present and non-empty. This is a
 *  hard credential-presence gate, separate from GROWTH_CALLS_ENABLED (a kill switch
 *  that defaults true) — a call needs GROWTH_CALLS_ENABLED=true AND this to be true. */
export function isVapiOutboundConfigured(): boolean {
  return Boolean(
    process.env.VAPI_API_KEY?.trim() &&
    process.env.VAPI_OUTBOUND_ASSISTANT_ID?.trim() &&
    process.env.VAPI_PHONE_NUMBER_ID?.trim(),
  );
}

function vapiCredentialsFromEnv(): VapiCredentials {
  return {
    apiKey: process.env.VAPI_API_KEY as string,
    assistantId: process.env.VAPI_OUTBOUND_ASSISTANT_ID as string,
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID as string,
  };
}

export interface MakeGrowthCallArgs {
  db: Db;
  phone: string | null;
  /** Free-text purpose passed to Vapi metadata (e.g. "speed_to_lead_day0", "cadence_day3_voicemail"). */
  purpose: string;
  consentStatus: ConsentStatus;
  campaignType: string;
  cadenceId?: number | null;
  leadTable?: "leads" | "leadCaptures" | "imported" | "customer" | null;
  leadId?: number | null;
  step?: number | null;
  lastTransactionAt?: Date | string | null;
  now?: Date;
}

export type MakeGrowthCallResult =
  | { outcome: "sent"; callId?: string }
  | { outcome: "failed"; error: string }
  | { outcome: "blocked"; reason: string; terminal: boolean }
  | { outcome: "held"; holdUntil: Date }
  /** VAPI_API_KEY/VAPI_OUTBOUND_ASSISTANT_ID/VAPI_PHONE_NUMBER_ID aren't all set —
   *  skip this call step (never error/crash); the caller falls back to SMS/email only. */
  | { outcome: "not_configured" };

export async function makeGrowthOutboundCall(args: MakeGrowthCallArgs): Promise<MakeGrowthCallResult> {
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
      return { outcome: "held", holdUntil: gate.holdUntil! };
    }
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactPhone: args.phone, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "blocked", blockedReason: gate.reason,
    });
    return { outcome: "blocked", reason: gate.reason, terminal: isTerminalGrowthBlock(gate.reason as GrowthBlockReason) };
  }

  if (!isVapiOutboundConfigured()) {
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactPhone: args.phone, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "blocked", blockedReason: "calls_not_configured", body: args.purpose,
    });
    return { outcome: "not_configured" };
  }

  try {
    const call = await makeOutboundCall(vapiCredentialsFromEnv(), args.phone as string, args.purpose);
    const callId: string | undefined = call?.id;

    await createCallLog({ callId: callId ?? `growth-${Date.now()}`, direction: "outbound", phoneNumber: args.phone as string, status: "in_progress" });
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactPhone: args.phone, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "sent", providerMessageId: callId ?? null, body: args.purpose,
    });
    return { outcome: "sent", callId };
  } catch (err) {
    const message = (err as Error).message || "Vapi outbound call failed";
    await recordGrowthTouch(args.db, {
      channel: CHANNEL, contactPhone: args.phone, leadTable: args.leadTable, leadId: args.leadId,
      campaignType: args.campaignType, cadenceId: args.cadenceId, step: args.step,
      status: "failed", blockedReason: message.slice(0, 60), body: args.purpose,
    });
    return { outcome: "failed", error: message };
  }
}
