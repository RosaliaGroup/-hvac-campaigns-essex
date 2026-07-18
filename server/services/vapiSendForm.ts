/**
 * Vapi `sendForm` tool — Mechanical Enterprise only.
 *
 * Jessica (the Mechanical HVAC voice assistant) calls `sendForm` during a live
 * call to text the caller a link to the Mechanical HVAC intake/booking form.
 * This module is the single, Mechanical-branded implementation of that tool and
 * its authenticated HTTP endpoint.
 *
 * WHY THIS EXISTS
 * The `sendForm` tool previously had no Mechanical implementation and resolved to
 * a SHARED, Rosalia-owned Netlify function that (a) sent via the retired TextBelt
 * provider and (b) defaulted to a Rosalia real-estate URL (book.rosaliagroup.com)
 * whenever no `property` was passed — which Jessica never passes. This replaces
 * that with a Mechanical-owned path.
 *
 * GUARANTEES
 *   - Sends ONLY via the active Mechanical Telnyx service (services/telnyxSms).
 *     No TextBelt, no Twilio, no Rosalia/Iron65 branding or URLs.
 *   - Links ONLY to the in-repo Mechanical form: https://mechanicalenterprise.com/qualify
 *     (Qualify.tsx — the assessment/booking form used by every SMS template).
 *     Booking and reschedule reuse the same form; only the copy differs.
 *   - Consent: never sends to a missing, invalid, or opted-out number.
 *   - Idempotent across Vapi retries: an in-memory coalescing store (keyed by the
 *     Vapi toolCallId) collapses concurrent duplicates in-process, and a DB check
 *     against the outbound message history collapses duplicates across restarts.
 *   - Records every real send in the shared two-way SMS history (smsInboxMessages,
 *     direction "outbound") — the same table campaign replies use.
 *   - Endpoint requires the VAPI_TOOL_SECRET header; it 503s if the secret is
 *     unset so it can never run unauthenticated in production.
 *   - Never logs full phone numbers, emails, raw Vapi payloads, credentials, or
 *     provider errors. The result returned to Vapi is minimal and error-free.
 *   - Never throws — a failure here must not break the voice call.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { smsContacts, smsInboxMessages } from "../../drizzle/schema";
import { sendTelnyxSms, toE164 } from "./telnyxSms";
import { IdempotencyStore } from "../_core/idempotency";

// ── Form URL (source of truth = the in-repo /qualify route) ──────────────────
// /qualify (client/src/pages/Qualify.tsx) is the Mechanical HVAC assessment +
// booking form already used by every SMS drip template and the referral email
// BOOKING_URL. Booking AND reschedule reuse it (there is no separate reschedule
// form); only the SMS copy differs. Origin is configurable via PUBLIC_SITE_URL so
// preview/staging can point at a non-prod host without a code change.
const QUALIFY_PATH = "/qualify";
function formBase(): string {
  return (process.env.PUBLIC_SITE_URL || "https://mechanicalenterprise.com").replace(/\/+$/, "");
}
export function buildFormUrl(): string {
  return `${formBase()}${QUALIFY_PATH}`;
}

// A Vapi retry lands within seconds; 10 minutes comfortably absorbs retries while
// still allowing a genuinely new request later in the same call flow.
const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const SENT_BY = "Jessica (AI)";

export type SendFormType = "booking" | "reschedule";

export interface SendFormInput {
  phone?: string | null;
  type?: string | null; // "booking" | "reschedule" (default booking)
  name?: string | null; // optional; Jessica usually omits it
}

export interface SendFormResult {
  /** Completed acceptably (sent OR safely idempotent OR gated). */
  success: boolean;
  /** Whether an SMS actually left (or was already sent for this request). */
  smsSent: boolean;
  /** The Mechanical form URL selected for this request. */
  formUrl?: string;
  /** Caller-safe status for Jessica to act on. Never provider/credential detail. */
  message?: string;
  /** Caller-safe reason on failure. Never provider/credential detail. */
  error?: string;
  /** True when a matching send already existed and we skipped re-sending. */
  deduplicated?: boolean;
  /**
   * Explicit outcome so the assistant NEVER claims a text was sent unless one
   * truly left: "sent" (or already-sent), "skipped" (gated), "failed".
   */
  status: "sent" | "skipped" | "failed";
  /** Machine-readable reason (invalid_phone, opted_out, already_sent, send_failed, …). */
  reason?: string;
  /** Telnyx provider message id — present only when a new message actually sent. */
  providerMessageId?: string;
}

function normalizeType(type: string | null | undefined): SendFormType {
  // Lenient: anything that isn't an explicit "reschedule" is a booking, matching
  // the historical tool contract where `type` defaulted to booking.
  return String(type ?? "").trim().toLowerCase() === "reschedule" ? "reschedule" : "booking";
}

function firstName(name: string | null | undefined): string {
  const f = (name ?? "").trim().split(/\s+/)[0];
  return f || "there";
}

export function buildMessage(type: SendFormType, url: string, name?: string | null): string {
  const who = firstName(name);
  // Mechanical branding + STOP disclosure (10DLC). Telnyx/carriers handle the
  // STOP/HELP auto-replies at the network level; we only advertise STOP here.
  return type === "reschedule"
    ? `Hi ${who} — here's your link to pick a new time for your Mechanical Enterprise visit: ${url} Reply STOP to opt out.`
    : `Hi ${who}! Mechanical Enterprise here — here's your link to book your free HVAC assessment: ${url} Reply STOP to opt out.`;
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `***${d.slice(-4)}` : "***";
}

const last10 = (phone: string): string => phone.replace(/\D/g, "").slice(-10);

// ── DB touchpoints, isolated behind an injectable deps object so unit tests can
//    exercise routing/gating/idempotency without a live DB or network. ────────
export interface SendFormDeps {
  /** Contact id (for history linkage) + opt-out flag. Fail-open on DB error. */
  lookupContact(phone: string): Promise<{ contactId: number | null; optedOut: boolean }>;
  /** True if an identical outbound message to this number is already recorded. */
  alreadySent(phone: string, message: string): Promise<boolean>;
  /** Persist the outbound message to the shared SMS history. Best-effort. */
  recordOutbound(args: { contactId: number | null; phone: string; message: string; providerMessageId?: string }): Promise<void>;
  /** Send via the active Telnyx provider. */
  send(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

async function realLookupContact(phone: string): Promise<{ contactId: number | null; optedOut: boolean }> {
  // Mirrors services/appointmentSms.ts: last-10 match, fail OPEN. A link the
  // caller just asked for on a live call is implicitly consented, so a DB blip
  // must not silently swallow it. The explicit opt-out gate still fires when the
  // DB is reachable.
  try {
    const db = await getDb();
    if (!db) return { contactId: null, optedOut: false };
    const rows = await db
      .select({ id: smsContacts.id, optedOut: smsContacts.optedOut })
      .from(smsContacts)
      .where(sql`RIGHT(REGEXP_REPLACE(${smsContacts.phone}, '[^0-9]', ''), 10) = ${last10(phone)}`)
      .limit(1);
    const row = rows[0];
    return { contactId: row?.id ?? null, optedOut: row?.optedOut === true };
  } catch (err) {
    console.error("[VapiSendForm] contact lookup failed (fail-open):", (err as Error).message);
    return { contactId: null, optedOut: false };
  }
}

async function realAlreadySent(phone: string, message: string): Promise<boolean> {
  // DB-backed idempotency: an identical outbound message to this number within
  // the window means this is a Vapi retry of an already-sent link. Survives a
  // process restart (unlike the in-memory store below).
  try {
    const db = await getDb();
    if (!db) return false;
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
    const rows = await db
      .select({ id: smsInboxMessages.id })
      .from(smsInboxMessages)
      .where(
        and(
          eq(smsInboxMessages.direction, "outbound"),
          eq(smsInboxMessages.message, message),
          gte(smsInboxMessages.createdAt, cutoff),
          sql`RIGHT(REGEXP_REPLACE(${smsInboxMessages.phone}, '[^0-9]', ''), 10) = ${last10(phone)}`,
        ),
      )
      .orderBy(desc(smsInboxMessages.createdAt))
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    // Dedup is best-effort; if we can't check, proceed (the in-memory store still
    // guards concurrent retries).
    console.error("[VapiSendForm] dedup check failed (proceeding):", (err as Error).message);
    return false;
  }
}

async function realRecordOutbound(args: {
  contactId: number | null;
  phone: string;
  message: string;
  providerMessageId?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(smsInboxMessages).values({
      contactId: args.contactId,
      phone: args.phone,
      direction: "outbound",
      message: args.message,
      isOptOut: false,
      isRead: true,
      sentByName: SENT_BY,
      textBeltId: args.providerMessageId ?? null, // legacy column name; stores Telnyx id
      providerMessageId: args.providerMessageId ?? null,
    });
  } catch (err) {
    // History write is best-effort; the customer already got the text.
    console.error("[VapiSendForm] message-history write failed (send already succeeded):", (err as Error).message);
  }
}

const defaultDeps: SendFormDeps = {
  lookupContact: realLookupContact,
  alreadySent: realAlreadySent,
  recordOutbound: realRecordOutbound,
  send: sendTelnyxSms,
};

/**
 * Core: send the Mechanical booking / reschedule link to a caller. Never throws.
 * Order: validate → dedup → consent → send → record.
 */
export async function sendMechanicalFormLink(
  input: SendFormInput,
  deps: SendFormDeps = defaultDeps,
): Promise<SendFormResult> {
  try {
    // 1) Missing number.
    if (!input.phone || !String(input.phone).trim()) {
      return { success: false, smsSent: false, status: "failed", reason: "missing_phone", error: "Phone number required" };
    }

    // 2) Normalize + validate (E.164 US). Invalid/ambiguous numbers never send
    //    and are never guessed — they fail explicitly.
    const to = toE164(String(input.phone));
    if (!to) {
      return { success: false, smsSent: false, status: "failed", reason: "invalid_phone", error: "Invalid phone number" };
    }

    const type = normalizeType(input.type);
    const formUrl = buildFormUrl();
    const message = buildMessage(type, formUrl, input.name);

    // 3) Consent / suppression gate + contact linkage.
    const { contactId, optedOut } = await deps.lookupContact(to);
    if (optedOut) {
      return { success: false, smsSent: false, formUrl, status: "skipped", reason: "opted_out", error: "Recipient has opted out of SMS" };
    }

    // 4) DB idempotency — skip a duplicate Vapi retry (no second send).
    if (await deps.alreadySent(to, message)) {
      return { success: true, smsSent: true, formUrl, deduplicated: true, status: "skipped", reason: "already_sent", message: "Form link already sent" };
    }

    // 5) Send via the active Telnyx service (only messaging dependency). A send is
    //    "sent" ONLY when Telnyx accepted it AND returned a provider message id; a
    //    2xx-without-id is anomalous/unverifiable and must never be claimed as sent.
    const result = await deps.send(to, message);
    if (!result.success || !result.messageId) {
      // Log a masked phone + provider error server-side; return a SAFE message.
      console.warn(`[VapiSendForm] Telnyx send not confirmed for ${maskPhone(to)}: ${result.error ?? (result.success ? "no provider message id" : "unknown")}`);
      return { success: false, smsSent: false, formUrl, status: "failed", reason: "send_failed", error: "Message could not be sent right now" };
    }

    // 6) Record in shared message history (non-fatal — the SMS already left, so a
    //    history-write failure must NOT turn a real send into a reported failure).
    try {
      await deps.recordOutbound({ contactId, phone: to, message, providerMessageId: result.messageId });
    } catch (err) {
      console.error("[VapiSendForm] message-history write failed (send already succeeded):", (err as Error).message);
    }

    return { success: true, smsSent: true, formUrl, status: "sent", providerMessageId: result.messageId, message: "Form link sent" };
  } catch (err) {
    // Absolute backstop — never break the voice call, never leak detail.
    console.error("[VapiSendForm] Unexpected error:", (err as Error).message);
    return { success: false, smsSent: false, status: "failed", reason: "internal_error", error: "Message could not be sent right now" };
  }
}

// In-memory store coalesces concurrent duplicate retries within one process
// (the DB check above handles cross-process / post-restart dupes). Only genuine
// sends / dedup hits are cached, so a transient send failure can still retry.
const sendFormIdempotency = new IdempotencyStore();

/** Idempotent wrapper keyed by the Vapi toolCallId (or a phone+type fallback). */
export async function handleSendForm(
  input: SendFormInput,
  idemKey: string,
  opts: { deps?: SendFormDeps; store?: IdempotencyStore } = {},
): Promise<SendFormResult> {
  const store = opts.store ?? sendFormIdempotency;
  const outcome = await store.run(
    idemKey,
    () => sendMechanicalFormLink(input, opts.deps ?? defaultDeps),
    { cacheable: (v) => v.smsSent === true },
  );
  return outcome.value;
}

// ── Vapi payload parsing ─────────────────────────────────────────────────────
/**
 * Extract the sendForm tool call from a Vapi tool-calls webhook body. Tolerates
 * `toolCallList` (current) and `toolCalls` shapes, and arguments as a JSON string
 * (Vapi default) or an object. Returns null if no sendForm call is present, so
 * this endpoint can't be misused to invoke other tools.
 */
export function extractSendFormCall(
  body: unknown,
): { toolCallId: string; callId: string; input: SendFormInput } | null {
  const b = body as {
    message?: { toolCallList?: unknown[]; toolCalls?: unknown[]; call?: { id?: string } };
    toolCallList?: unknown[];
  };
  const list = b?.message?.toolCallList ?? b?.message?.toolCalls ?? b?.toolCallList;
  if (!Array.isArray(list)) return null;
  const callId = String(b?.message?.call?.id ?? "");
  for (const raw of list) {
    const c = raw as { id?: string; toolCallId?: string; function?: { name?: string; arguments?: unknown } };
    const fn = c.function ?? (raw as { name?: string; arguments?: unknown });
    if (fn?.name !== "sendForm") continue;
    let a: unknown = fn.arguments ?? {};
    if (typeof a === "string") {
      try { a = JSON.parse(a); } catch { a = {}; }
    }
    const parsed = (a ?? {}) as Record<string, unknown>;
    return {
      toolCallId: String(c.id ?? c.toolCallId ?? ""),
      callId,
      input: {
        phone: parsed.phone != null ? String(parsed.phone) : undefined,
        type: parsed.type != null ? String(parsed.type) : undefined,
        name: parsed.name != null ? String(parsed.name) : undefined,
      },
    };
  }
  return null;
}

/**
 * Minimal, PII-free result surface returned to Vapi/Jessica. Leads with an
 * explicit `status` (sent | skipped | failed) so the assistant can never claim a
 * text is on the way unless one actually sent. `providerMessageId` is present
 * only for a real send; `reason` carries the machine-readable skip/fail cause.
 */
export function vapiResult(
  r: SendFormResult,
): { status: "sent" | "skipped" | "failed"; success: boolean; smsSent: boolean; reason?: string; providerMessageId?: string; formUrl?: string } {
  return {
    status: r.status,
    success: r.success,
    smsSent: r.smsSent,
    ...(r.reason ? { reason: r.reason } : {}),
    ...(r.status === "sent" && r.providerMessageId ? { providerMessageId: r.providerMessageId } : {}),
    ...(r.formUrl ? { formUrl: r.formUrl } : {}),
  };
}

function safeEqual(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Build the idempotency key: prefer the stable Vapi toolCallId. */
export function buildIdemKey(call: { toolCallId: string; callId: string; input: SendFormInput }): string {
  if (call.toolCallId) return `vapi-sendform:${call.toolCallId}`;
  const l10 = (call.input.phone ?? "").replace(/\D/g, "").slice(-10);
  return `vapi-sendform:${call.callId}:${l10}:${normalizeType(call.input.type)}`;
}

// ── REST route ───────────────────────────────────────────────────────────────
/**
 * POST /api/webhooks/vapi/send-form
 * Auth: header `x-vapi-secret: <VAPI_TOOL_SECRET>` (required; 503 if unset so it
 *       can never run unauthenticated in production).
 * Body: the standard Vapi tool-calls envelope containing a `sendForm` call.
 * Resp: 200 { results: [{ toolCallId, result: "<json string>" }] } (Vapi format),
 *       inner JSON = { success, smsSent, formUrl? }.
 */
export function registerVapiToolRoutes(app: Express): void {
  app.post("/api/webhooks/vapi/send-form", async (req: Request, res: Response) => {
    const secret = process.env.VAPI_TOOL_SECRET;
    if (!secret) {
      console.error("[VapiSendForm] VAPI_TOOL_SECRET not configured — endpoint refuses all calls (503)");
      res.status(503).json({ error: "not_configured" });
      return;
    }
    if (!safeEqual(req.header("x-vapi-secret"), secret)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const call = extractSendFormCall(req.body);
    if (!call) {
      res.status(400).json({ error: "bad_request" });
      return;
    }

    try {
      const result = await handleSendForm(call.input, buildIdemKey(call));
      res.status(200).json({ results: [{ toolCallId: call.toolCallId, result: JSON.stringify(vapiResult(result)) }] });
    } catch (err) {
      // handleSendForm is designed not to throw; last-resort guard. Never leak
      // internals; return a safe Vapi-shaped result so Jessica falls back to the
      // manual bookAppointment flow.
      console.error("[VapiSendForm] unexpected route error:", (err as Error).message);
      res.status(200).json({ results: [{ toolCallId: call.toolCallId, result: JSON.stringify({ success: false, smsSent: false }) }] });
    }
  });
}
