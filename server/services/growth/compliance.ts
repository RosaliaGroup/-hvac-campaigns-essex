/**
 * THE growth-system compliance gate (docs/growth-system-spec.md §0/§1/§11).
 *
 * Every SMS/call the growth system sends MUST go through gateGrowthSend() first —
 * it is called INSIDE the send wrappers themselves (server/services/growth/sms.ts,
 * outboundCall.ts), not left to individual cadence/review-engine/speed-to-lead
 * callers to remember. Order of checks (first failure wins):
 *   1. Consent / National DNC default-safe rule (§0/§11) — "unknown" consent
 *      blocks automated call/sms outright (email-only).
 *   2. Calling hours (§0/§1.1) — 9:00–19:00 ET Mon–Sat. Outside the window this
 *      returns a HOLD (not a drop) with the next valid window's start time.
 *   3. Per-contact per-campaign cap (§0/§11) — 2 calls / 3 texts per cadence.
 * Email is not subject to 1–3 (spec: unknown consent still gets email; there is
 * no calling-hours or cap rule for email in the spec).
 *
 * FAILS CLOSED: any DB error while evaluating a check is treated as BLOCKED, never
 * as "allow the send".
 */
import { isWithinCallingHours, nextCallingWindowStart } from "../../../shared/callingHours";
import { isAutomatedContactAllowed, isRecentCustomerTransaction, type ConsentStatus } from "../../../shared/growthConsent";
import { getDncScrubProvider } from "../../../shared/dncScrubProvider";
import { getDb } from "../../db";
import { countCadenceChannelAttempts, maxAttemptsFor, type GrowthChannel } from "./touchLedger";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type GrowthBlockReason =
  | "consent_unknown"
  | "national_dnc"
  | "outside_calling_hours"
  | "cap_reached"
  | "no_phone"
  | "db_error";

export type GrowthGateResult =
  | { ok: true }
  | { ok: false; reason: GrowthBlockReason; holdUntil?: Date };

export interface GateGrowthSendArgs {
  db: Db;
  channel: GrowthChannel;
  phone: string | null;
  consentStatus: ConsentStatus;
  /** Existing-customer 18-month exemption input (§0). Null/undefined = not a customer transaction. */
  lastTransactionAt?: Date | string | null;
  /** The cadence instance whose per-campaign cap this touch counts against. Omit for
   *  one-off sends (owner alerts, review-engine asks) that have no cap. */
  cadenceId?: number | null;
  /** Evaluate at this instant instead of now() — for tests. */
  now?: Date;
}

/**
 * The one gate every growth SMS/call dispatch must call before sending. Email
 * touches do not call this — see the module doc.
 */
export async function gateGrowthSend(args: GateGrowthSendArgs): Promise<GrowthGateResult> {
  const now = args.now ?? new Date();
  try {
    if (!args.phone) return { ok: false, reason: "no_phone" };

    // 1. Consent / National-DNC-default-safe rule (§0/§11).
    if (!isAutomatedContactAllowed(args.consentStatus)) {
      return { ok: false, reason: "consent_unknown" };
    }
    // Layered future check: once a real scrub provider is wired, a positive DNC hit
    // blocks even a consented contact UNLESS the 18-month existing-customer exemption
    // applies. NullDncProvider always returns null (unknown) today, so this branch is
    // inert until a provider is configured — see shared/dncScrubProvider.ts.
    const dncHit = await getDncScrubProvider().checkDnc(args.phone);
    if (dncHit === true && !isRecentCustomerTransaction(args.lastTransactionAt ?? null, now)) {
      return { ok: false, reason: "national_dnc" };
    }

    // 2. Calling hours (§0/§1.1) — hold, don't drop.
    if (!isWithinCallingHours(now)) {
      return { ok: false, reason: "outside_calling_hours", holdUntil: nextCallingWindowStart(now) };
    }

    // 3. Per-contact per-campaign cap (§0/§11).
    if (args.cadenceId != null) {
      const max = maxAttemptsFor(args.channel);
      if (max != null) {
        const count = await countCadenceChannelAttempts(args.db, args.cadenceId, args.channel);
        if (count >= max) return { ok: false, reason: "cap_reached" };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("[growth] compliance gate failed closed (db_error):", err);
    return { ok: false, reason: "db_error" };
  }
}

/** True for a block that will never resolve itself (retrying is pointless) — vs.
 *  a hold/transient block a poller should retry later. Mirrors smsCompliance.ts's
 *  isTerminalBlock for the same reason: callers must not busy-loop retrying these. */
export function isTerminalGrowthBlock(reason: GrowthBlockReason): boolean {
  return reason === "consent_unknown" || reason === "national_dnc" || reason === "no_phone";
}
