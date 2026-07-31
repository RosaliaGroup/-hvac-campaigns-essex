/**
 * Shared SMS compliance gate — the single check EVERY outbound SMS sender must
 * put a recipient through before dispatch. One obvious thing to call.
 *
 * Enforced in order:
 *   1. Strict E.164 validation (toE164): accept exactly 10 digits, or 11 digits
 *      starting with 1. Anything else is REJECTED outright — never cleaned,
 *      never padded.
 *   2. Opt-out suppression (isPhoneOptedOut): honors smsContacts.optedOut AND
 *      inbound STOP history.
 *
 * FAILS CLOSED on every non-ok result: no send under any circumstance.
 *
 * The blocked reason separates causes the caller must handle differently:
 *   - "invalid_phone" | "opted_out"  → TERMINAL  (the number will never be
 *                                       sendable as-is; do not retry)
 *   - "db_error"                     → TRANSIENT (opt-out status could not be
 *                                       read; a later retry may succeed)
 * Synchronous callers (e.g. the rebate endpoints) can treat any non-ok as
 * "did not send". Queue/retry callers (e.g. follow-up dispatch) MUST NOT retry
 * a terminal result — see isTerminalBlock.
 */
import { getDb } from "../db";
import { toE164 } from "./telnyxSms";
import { isPhoneOptedOut } from "./smsOutbound";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type SmsBlockedReason = "invalid_phone" | "opted_out" | "db_error";

export type SmsGateResult =
  | { ok: true; to: string }
  | { ok: false; blocked: SmsBlockedReason };

/**
 * True when the block is terminal — the recipient will never become sendable
 * without new information (a corrected number, or a fresh opt-in). Callers that
 * retry must cancel terminal tasks rather than re-queue them.
 */
export function isTerminalBlock(reason: SmsBlockedReason): boolean {
  return reason === "invalid_phone" || reason === "opted_out";
}

/**
 * Validate + opt-out-check a recipient. `isOptedOut` is injectable for testing;
 * production callers omit it and get the shared isPhoneOptedOut.
 */
export async function gateSmsRecipient(
  phone: string,
  db: Db | null,
  isOptedOut: (db: Db, phone: string) => Promise<boolean> = isPhoneOptedOut,
): Promise<SmsGateResult> {
  const to = toE164(phone);
  if (!to) return { ok: false, blocked: "invalid_phone" };
  // Fail closed: without a DB we cannot verify opt-out status, so do not send.
  // Transient — the DB may be back on the next attempt.
  if (!db) return { ok: false, blocked: "db_error" };
  try {
    if (await isOptedOut(db, to)) return { ok: false, blocked: "opted_out" };
  } catch {
    // A failed opt-out lookup must NOT result in a send. Transient.
    return { ok: false, blocked: "db_error" };
  }
  return { ok: true, to };
}
