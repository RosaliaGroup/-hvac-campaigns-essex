/**
 * sendCallRecap — Mechanical Enterprise call-recap persistence + notification.
 *
 * Replaces the legacy standalone Netlify emailer (generic SMTP, no persistence)
 * with a Mechanical-native pipeline that:
 *   1. persists the recap to the best available Mechanical record, and
 *   2. notifies the office via the Mechanical email service (Resend), and
 *   3. optionally texts the caller via Telnyx — only with consent.
 *
 * SCOPE: Mechanical Enterprise ONLY. No Rosalia email/SMS/storage/CRM/API/URL/
 * branding/secret is referenced here. Email = Resend (server/services/
 * emailService), SMS = Telnyx (server/services/telnyxSms). No nodemailer/SMTP,
 * no Textbelt, no Twilio.
 *
 * DURABILITY: the recap is ALWAYS stored (a call-log row is the guaranteed
 * floor) before any notification is attempted. A failed email or SMS never rolls
 * back persistence and never throws out of this module.
 *
 * PRIVACY: only operational fields are ever stored/sent (see RECAP_FIELDS).
 * Raw prompts, system prompts, secrets, tokens, hidden instructions, and any
 * unrelated payload keys are dropped by `buildRecapRecord` — it reads a fixed
 * whitelist and nothing else.
 */

import { normalizePhone } from "../routers/customers";

// ─────────────────────────────────────────────────────────────
// Inbound payload (preserves the existing Vapi request contract:
// snake_case tool args + the legacy caller_* / name/phone aliases).
// ─────────────────────────────────────────────────────────────

export interface CallRecapInput {
  /** Vapi call id — the idempotency key. Aliases accepted. */
  call_id?: string | null;
  vapiCallId?: string | null;

  name?: string | null;
  caller_name?: string | null;
  phone?: string | null;
  caller_phone?: string | null;
  email?: string | null;
  caller_email?: string | null;

  /** Existing appointment this call is about (highest-priority match). */
  appointment_id?: string | number | null;

  reason_for_call?: string | null;
  requested_service?: string | null;
  appointment_type?: string | null;
  appointment_details?: string | null;
  property_address?: string | null;
  urgency?: string | null;
  call_summary?: string | null;
  ai_summary?: string | null;
  unresolved_questions?: string | null;
  follow_up_required?: boolean | string | null;
  outcome?: string | null;

  /** The Mechanical workflow explicitly requests a caller confirmation text. */
  send_customer_sms?: boolean | string | null;
  /** Caller-granted SMS consent captured on the call (belt-and-suspenders). */
  sms_consent?: boolean | string | null;
}

/**
 * The ONLY fields that may be persisted or sent. Anything not listed here is
 * dropped. This is the privacy boundary — keep it operational-only.
 */
export interface RecapRecord {
  idempotencyKey: string;
  callerName: string;
  normalizedPhone: string | null;
  rawPhone: string;
  email: string | null;
  appointmentId: number | null;
  reasonForCall: string | null;
  requestedService: string | null;
  appointmentDetails: string | null;
  propertyAddress: string | null;
  urgency: string | null;
  aiSummary: string | null;
  unresolvedQuestions: string | null;
  followUpRequired: boolean;
  outcome: string | null;
  wantsCustomerSms: boolean;
  callerConsentFlag: boolean;
}

export const RECAP_FIELDS: ReadonlyArray<keyof RecapRecord> = [
  "callerName", "normalizedPhone", "reasonForCall", "requestedService",
  "appointmentDetails", "propertyAddress", "urgency", "aiSummary",
  "unresolvedQuestions", "followUpRequired",
];

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "required";
}

function parseAppointmentId(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Small, stable, non-cryptographic hash (djb2). Used only to derive a
 * deterministic idempotency key when Vapi does not supply a call id — the same
 * retry payload hashes to the same key, so retries still de-duplicate.
 */
function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/**
 * Pure: turn an arbitrary inbound payload into a whitelisted operational recap.
 * Reads ONLY known keys — prompts/secrets/tokens/extra payload cannot survive.
 */
export function buildRecapRecord(input: CallRecapInput): RecapRecord {
  const callerName = str(input.name) ?? str(input.caller_name) ?? "Unknown caller";
  const rawPhone = str(input.phone) ?? str(input.caller_phone) ?? "";
  const normalizedPhone = normalizePhone(rawPhone);
  const email = str(input.email) ?? str(input.caller_email);

  const reasonForCall = str(input.reason_for_call) ?? str(input.outcome);
  const requestedService = str(input.requested_service) ?? str(input.appointment_type);
  const appointmentDetails = str(input.appointment_details);
  const propertyAddress = str(input.property_address);
  const urgency = str(input.urgency);
  const aiSummary = str(input.ai_summary) ?? str(input.call_summary);
  const unresolvedQuestions = str(input.unresolved_questions);
  const followUpRequired = bool(input.follow_up_required);
  const outcome = str(input.outcome);

  const explicitKey = str(input.call_id) ?? str(input.vapiCallId);
  // Deterministic fallback so retries without a call id still collapse together.
  const derivedKey = `recap:${stableHash(
    [normalizedPhone ?? rawPhone, aiSummary ?? "", requestedService ?? "", outcome ?? ""].join("|"),
  )}`;

  return {
    idempotencyKey: explicitKey || derivedKey,
    callerName,
    normalizedPhone,
    rawPhone,
    email,
    appointmentId: parseAppointmentId(input.appointment_id),
    reasonForCall,
    requestedService,
    appointmentDetails,
    propertyAddress,
    urgency,
    aiSummary,
    unresolvedQuestions,
    followUpRequired,
    outcome,
    wantsCustomerSms: bool(input.send_customer_sms),
    callerConsentFlag: bool(input.sms_consent),
  };
}

/** Human-readable recap block appended to a record's notes / used in email. */
export function renderRecapText(r: RecapRecord, now: Date): string {
  const lines: string[] = [
    `── Call recap (${now.toISOString()}) ──`,
    `Caller: ${r.callerName}`,
    `Phone: ${r.normalizedPhone ?? (r.rawPhone || "n/a")}`,
  ];
  if (r.reasonForCall) lines.push(`Reason: ${r.reasonForCall}`);
  if (r.requestedService) lines.push(`Requested service: ${r.requestedService}`);
  if (r.appointmentDetails) lines.push(`Appointment: ${r.appointmentDetails}`);
  if (r.propertyAddress) lines.push(`Property: ${r.propertyAddress}`);
  if (r.urgency) lines.push(`Urgency: ${r.urgency}`);
  if (r.aiSummary) lines.push(`Summary: ${r.aiSummary}`);
  if (r.unresolvedQuestions) lines.push(`Unresolved: ${r.unresolvedQuestions}`);
  lines.push(`Follow-up required: ${r.followUpRequired ? "yes" : "no"}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Matching + persistence — abstracted behind an injectable store so
// the orchestration is unit-testable without a live DB.
// ─────────────────────────────────────────────────────────────

export type MatchedRecordType =
  | "appointment"
  | "customer"
  | "lead"
  | "call_log";

export interface RecapMatch {
  appointmentId: number | null;
  customerId: number | null;
  leadId: number | null;
  /** True when phone/appointment resolved to a single property (context only). */
  propertyId: number | null;
}

/** Injectable persistence + lookup boundary. Prod impl wraps getDb + drizzle. */
export interface RecapStore {
  /** Idempotency: return the id of an already-stored recap for this key, else null. */
  findExistingRecap(idempotencyKey: string): Promise<number | null>;
  /**
   * Resolve the best Mechanical records for this recap, in the required lookup
   * order: appointment id → normalized phone → customer → property → lead → call log.
   */
  match(record: RecapRecord): Promise<RecapMatch>;
  /** Store the durable call-log recap (the guaranteed floor). Returns its id. */
  saveCallLog(record: RecapRecord, match: RecapMatch, recapText: string): Promise<number>;
  /** Attach the recap to a matched appointment (append to notes). Best-effort. */
  attachToAppointment(appointmentId: number, recapText: string): Promise<void>;
  /** Attach the recap to a matched lead (append to notes). Best-effort. */
  attachToLead(leadId: number, recapText: string): Promise<void>;
}

export interface RecapNotifier {
  /** Mechanical email service (Resend). Returns true on success, never throws. */
  sendEmail(record: RecapRecord, recapText: string): Promise<boolean>;
  /** True if the caller's number has valid, non-opted-out SMS consent. */
  hasSmsConsent(normalizedPhone: string): Promise<boolean>;
  /** Telnyx send. Returns true on success, never throws. */
  sendSms(normalizedPhone: string, record: RecapRecord): Promise<boolean>;
}

export interface RecapDeps {
  store: RecapStore;
  notifier: RecapNotifier;
  now?: () => Date;
}

export interface CallRecapResult {
  success: boolean;
  deduped: boolean;
  recapId: number | null;
  matchedRecordType: MatchedRecordType;
  persisted: boolean;
  emailed: boolean;
  smsSent: boolean;
  smsSkippedReason?: string;
}

function highestPriorityType(match: RecapMatch): MatchedRecordType {
  if (match.appointmentId) return "appointment";
  if (match.customerId) return "customer";
  if (match.leadId) return "lead";
  return "call_log";
}

/**
 * Persist a call recap and fire notifications.
 *
 * Ordering guarantees:
 *  - Idempotency is checked FIRST: a duplicate Vapi retry (same key) never
 *    persists again, never re-emails, never re-texts.
 *  - The recap is PERSISTED before any notification. Notification failures are
 *    caught and logged; they never roll back persistence and never throw.
 */
export async function persistCallRecap(
  record: RecapRecord,
  deps: RecapDeps,
): Promise<CallRecapResult> {
  const now = (deps.now ?? (() => new Date()))();
  const { store, notifier } = deps;

  // 1) Idempotency — collapse duplicate retries.
  const existing = await store.findExistingRecap(record.idempotencyKey);
  if (existing != null) {
    console.info(
      `[VapiTools][sendCallRecap] duplicate recap ${maskKey(record.idempotencyKey)} → reusing #${existing}, no re-send`,
    );
    return {
      success: true,
      deduped: true,
      recapId: existing,
      matchedRecordType: "call_log",
      persisted: true,
      emailed: false,
      smsSent: false,
      smsSkippedReason: "duplicate",
    };
  }

  // 2) Match Mechanical records (never throws out — matching failure ⇒ floor only).
  let match: RecapMatch = { appointmentId: null, customerId: null, leadId: null, propertyId: null };
  try {
    match = await store.match(record);
  } catch (err) {
    console.error(`[VapiTools][sendCallRecap] match failed, storing to call-log floor:`, errMsg(err));
  }
  if (record.appointmentId && !match.appointmentId) match.appointmentId = record.appointmentId;

  const recapText = renderRecapText(record, now);

  // 3) Persist the durable floor. If THIS fails the whole call fails (so Vapi
  //    retries) — but nothing partial is left and no notification has fired.
  const recapId = await store.saveCallLog(record, match, recapText);

  // Attach to the best higher-priority record (best-effort; never fatal).
  if (match.appointmentId) {
    try {
      await store.attachToAppointment(match.appointmentId, recapText);
    } catch (err) {
      console.error(`[VapiTools][sendCallRecap] appointment attach failed (recap still saved):`, errMsg(err));
    }
  } else if (match.leadId) {
    try {
      await store.attachToLead(match.leadId, recapText);
    } catch (err) {
      console.error(`[VapiTools][sendCallRecap] lead attach failed (recap still saved):`, errMsg(err));
    }
  }

  const matchedRecordType = highestPriorityType(match);

  // 4) Notifications — persistence is already committed. Failures are isolated.
  let emailed = false;
  try {
    emailed = await notifier.sendEmail(record, recapText);
    if (!emailed) {
      console.error(`[VapiTools][sendCallRecap] email delivery failed — recap #${recapId} remains saved`);
    }
  } catch (err) {
    console.error(`[VapiTools][sendCallRecap] email threw (recap still saved):`, errMsg(err));
  }

  // 5) SMS — only if the workflow requires it AND consent exists. Idempotent
  //    because we only reach here on a FRESH (non-deduped) recap.
  let smsSent = false;
  let smsSkippedReason: string | undefined;
  if (!record.wantsCustomerSms) {
    smsSkippedReason = "not_requested";
  } else if (!record.normalizedPhone) {
    smsSkippedReason = "no_valid_phone";
  } else {
    try {
      const consent = record.callerConsentFlag || (await notifier.hasSmsConsent(record.normalizedPhone));
      if (!consent) {
        smsSkippedReason = "no_consent";
      } else {
        smsSent = await notifier.sendSms(record.normalizedPhone, record);
        if (!smsSent) smsSkippedReason = "send_failed";
      }
    } catch (err) {
      smsSkippedReason = "send_error";
      console.error(`[VapiTools][sendCallRecap] SMS threw (recap still saved):`, errMsg(err));
    }
  }

  console.info(
    `[VapiTools][sendCallRecap] stored recap #${recapId} ` +
      `match=${matchedRecordType} emailed=${emailed} smsSent=${smsSent}` +
      (smsSkippedReason ? ` smsSkip=${smsSkippedReason}` : ""),
  );

  return {
    success: true,
    deduped: false,
    recapId,
    matchedRecordType,
    persisted: true,
    emailed,
    smsSent,
    ...(smsSkippedReason ? { smsSkippedReason } : {}),
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

/** Mask the idempotency key for logs (never log full call ids). */
export function maskKey(key: string): string {
  if (key.length <= 6) return "***";
  return `${key.slice(0, 4)}…${key.slice(-2)}`;
}
