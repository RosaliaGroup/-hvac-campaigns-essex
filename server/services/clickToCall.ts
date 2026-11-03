/**
 * Recorded click-to-call from the CRM (Telnyx Call Control).
 *
 * Flow — the rep never needs a softphone or headset:
 *   1. Rep taps "Call" on a lead/contact → we create a callLogs row and dial the
 *      REP's own mobile (teamMembers.mobilePhone) from the company number.
 *   2. Rep answers → webhook `call.answered` (leg "rep") → we dial the CLIENT,
 *      linked to the rep's call and bridged the moment the client answers.
 *   3. Client answers → `call.answered` (leg "client") → recording starts
 *      (dual channel mp3, with a beep so both sides hear the call is recorded).
 *   4. `call.hangup` → status + duration saved; `call.recording.saved` → the
 *      recording is linked to the call log. Recordings stay in Telnyx; playback
 *      fetches a fresh short-lived download URL each time (recordingPlaybackUrl).
 *
 * Config (Railway):
 *   TELNYX_API_KEY                — already set (SMS)
 *   TELNYX_CALL_CONTROL_APP_ID    — the Call Control Application's id (Telnyx
 *                                   portal → Voice → Programmable Voice)
 *   TELNYX_VOICE_FROM_NUMBER      — voice-enabled company number assigned to
 *                                   that application (falls back to TELNYX_FROM_NUMBER)
 *   PUBLIC_BASE_URL               — optional, default https://mechanicalenterprise.com
 * Webhooks: POST /api/calls/telnyx (Ed25519-verified with TELNYX_PUBLIC_KEY,
 * the same key the SMS webhook uses).
 */
import type { Express, Request, Response } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { callLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { toE164 } from "./telnyxSms";
import { authorizeTelnyxWebhook } from "./telnyxSignature";

const TELNYX_API = "https://api.telnyx.com/v2";
export const RECORDING_PREFIX = "telnyx-session:";

export function clickToCallConfigured(): boolean {
  return Boolean(
    process.env.TELNYX_API_KEY?.trim() &&
      process.env.TELNYX_CALL_CONTROL_APP_ID?.trim() &&
      voiceFromNumber(),
  );
}

function voiceFromNumber(): string | null {
  return toE164(process.env.TELNYX_VOICE_FROM_NUMBER?.trim() || process.env.TELNYX_FROM_NUMBER?.trim() || null);
}

function webhookUrl(): string {
  const base = (process.env.PUBLIC_BASE_URL?.trim() || "https://mechanicalenterprise.com").replace(/\/+$/, "");
  return `${base}/api/calls/telnyx`;
}

type Leg = "rep" | "client";
export interface CallState {
  logId: number;
  leg: Leg;
  /** Client's E.164 number (carried on the rep leg so we know whom to dial). */
  to?: string;
  /** The rep leg's call_control_id (carried on the client leg). */
  repCcid?: string;
}

export function encodeState(s: CallState): string {
  return Buffer.from(JSON.stringify(s), "utf8").toString("base64");
}
export function decodeState(raw: unknown): CallState | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (typeof v?.logId === "number" && (v.leg === "rep" || v.leg === "client")) return v as CallState;
  } catch {
    /* not ours */
  }
  return null;
}

async function telnyx(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const res = await fetch(`${TELNYX_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail || json?.errors?.[0]?.title || text.slice(0, 300);
    throw new Error(`Telnyx ${method} ${path} ${res.status}: ${detail}`);
  }
  return json;
}

async function updateLog(logId: number, patch: Partial<typeof callLogs.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(callLogs).set(patch).where(eq(callLogs.id, logId));
}

export interface StartCallArgs {
  repTeamMemberId: number | null;
  repPhone: string | null;
  clientPhone: string | null;
  customerId?: number | null;
  leadCaptureId?: number | null;
}

export type StartCallResult =
  | { ok: true; callLogId: number; repPhone: string }
  | { ok: false; reason: "not_configured" | "no_rep_phone" | "bad_client_phone" | "telnyx_error"; message: string };

export async function startClickToCall(args: StartCallArgs): Promise<StartCallResult> {
  if (!clickToCallConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Calling from the app isn't set up yet (Telnyx voice settings are missing).",
    };
  }
  const rep = toE164(args.repPhone);
  if (!rep) {
    return {
      ok: false,
      reason: "no_rep_phone",
      message: "Add your mobile number to your team profile — the app rings your phone first, then connects the client.",
    };
  }
  const client = toE164(args.clientPhone);
  if (!client) return { ok: false, reason: "bad_client_phone", message: "This contact doesn't have a valid US phone number." };

  const db = await getDb();
  if (!db) return { ok: false, reason: "telnyx_error", message: "Database unavailable." };

  const inserted = await db.insert(callLogs).values({
    direction: "outbound",
    phoneNumber: client,
    status: "ringing_rep",
    customerId: args.customerId ?? null,
    leadCaptureId: args.leadCaptureId ?? null,
    agentTeamMemberId: args.repTeamMemberId,
  });
  const logId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);

  try {
    const resp = await telnyx("/calls", {
      connection_id: process.env.TELNYX_CALL_CONTROL_APP_ID,
      to: rep,
      from: voiceFromNumber(),
      webhook_url: webhookUrl(),
      timeout_secs: 30,
      client_state: encodeState({ logId, leg: "rep", to: client }),
    });
    const sessionId: string | undefined = resp?.data?.call_session_id;
    if (sessionId) await updateLog(logId, { callId: `telnyx:${sessionId}` });
    console.log(`[ClickToCall] log ${logId}: ringing rep ${rep.slice(0, -4)}**** for client ${client.slice(0, -4)}****`);
    return { ok: true, callLogId: logId, repPhone: rep };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ClickToCall] log ${logId}: dial rep failed — ${message}`);
    await updateLog(logId, { status: "failed" });
    return { ok: false, reason: "telnyx_error", message: "The call couldn't be started. Try again in a minute." };
  }
}

function secondsBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const s = (new Date(b).getTime() - new Date(a).getTime()) / 1000;
  return Number.isFinite(s) && s >= 0 ? Math.round(s) : null;
}

/** Handle one Telnyx Call Control event. Exported for tests. */
export async function handleCallEvent(eventType: string, p: any): Promise<void> {
  const state = decodeState(p?.client_state);
  if (!state) return; // not a click-to-call leg
  const ccid: string | undefined = p?.call_control_id;

  switch (eventType) {
    case "call.answered": {
      if (state.leg === "rep" && state.to && ccid) {
        await updateLog(state.logId, { status: "ringing_client" });
        await telnyx("/calls", {
          connection_id: process.env.TELNYX_CALL_CONTROL_APP_ID,
          to: state.to,
          from: voiceFromNumber(),
          webhook_url: webhookUrl(),
          link_to: ccid,
          bridge_on_answer: true,
          bridge_intent: true,
          timeout_secs: 40,
          client_state: encodeState({ logId: state.logId, leg: "client", repCcid: ccid }),
        });
      } else if (state.leg === "client" && state.repCcid) {
        await updateLog(state.logId, { status: "in_progress" });
        await telnyx(`/calls/${encodeURIComponent(state.repCcid)}/actions/record_start`, {
          format: "mp3",
          channels: "dual",
          play_beep: true,
        });
      }
      return;
    }
    case "call.hangup": {
      if (state.leg === "client") {
        const answered = p?.hangup_cause === "normal_clearing" && secondsBetween(p?.start_time, p?.end_time);
        await updateLog(state.logId, {
          status: answered ? "completed" : `no_answer${p?.hangup_cause ? `:${p.hangup_cause}` : ""}`.slice(0, 50),
          duration: secondsBetween(p?.start_time, p?.end_time),
        });
        if (state.repCcid) {
          await telnyx(`/calls/${encodeURIComponent(state.repCcid)}/actions/hangup`, {}).catch(() => undefined);
        }
      } else {
        // Rep leg ended. If the client was never dialed/answered, record why.
        const db = await getDb();
        const row = db ? (await db.select().from(callLogs).where(eq(callLogs.id, state.logId)).limit(1))[0] : null;
        if (row && (row.status === "ringing_rep" || row.status === "ringing_client")) {
          await updateLog(state.logId, { status: row.status === "ringing_rep" ? "rep_no_answer" : "canceled" });
        }
      }
      return;
    }
    case "call.recording.saved": {
      const sessionId: string | undefined = p?.call_session_id;
      if (sessionId) await updateLog(state.logId, { recordingUrl: `${RECORDING_PREFIX}${sessionId}` });
      return;
    }
    default:
      return;
  }
}

/** A fresh, short-lived mp3 URL for a click-to-call recording, or null. */
export async function recordingPlaybackUrl(recordingRef: string | null | undefined): Promise<string | null> {
  if (!recordingRef) return null;
  if (!recordingRef.startsWith(RECORDING_PREFIX)) {
    return /^https:\/\//.test(recordingRef) ? recordingRef : null; // e.g. Vapi recording links
  }
  if (!process.env.TELNYX_API_KEY) return null;
  const sessionId = recordingRef.slice(RECORDING_PREFIX.length);
  const resp = await telnyx(`/recordings?filter[call_session_id]=${encodeURIComponent(sessionId)}&page[size]=1`);
  const rec = resp?.data?.[0];
  return rec?.download_urls?.mp3 ?? rec?.download_urls?.wav ?? null;
}

/** Calls for one lead or contact (by id, or by phone as a fallback), newest first. */
export async function listCallsForContact(args: { customerId?: number | null; leadCaptureId?: number | null; phone?: string | null }) {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (args.customerId) conds.push(eq(callLogs.customerId, args.customerId));
  if (args.leadCaptureId) conds.push(eq(callLogs.leadCaptureId, args.leadCaptureId));
  const digits = (args.phone ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length === 10) conds.push(sql`RIGHT(REGEXP_REPLACE(${callLogs.phoneNumber}, '[^0-9]', ''), 10) = ${digits}`);
  if (conds.length === 0) return [];
  const rows = await db
    .select({
      id: callLogs.id,
      direction: callLogs.direction,
      phoneNumber: callLogs.phoneNumber,
      status: callLogs.status,
      duration: callLogs.duration,
      recordingUrl: callLogs.recordingUrl,
      agentTeamMemberId: callLogs.agentTeamMemberId,
      createdAt: callLogs.createdAt,
    })
    .from(callLogs)
    .where(or(...conds))
    .orderBy(desc(callLogs.createdAt))
    .limit(50);
  // The client gets "hasRecording", never the raw reference.
  return rows.map(({ recordingUrl, ...r }) => ({ ...r, hasRecording: Boolean(recordingUrl) }));
}

export async function getCallLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(callLogs).where(and(eq(callLogs.id, id))).limit(1))[0] ?? null;
}

export function registerClickToCallRoutes(app: Express): void {
  app.post("/api/calls/telnyx", async (req: Request, res: Response) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const auth = authorizeTelnyxWebhook({
      signature: req.header("telnyx-signature-ed25519"),
      timestamp: req.header("telnyx-timestamp"),
      rawBody,
    });
    if (!auth.ok) return res.status(auth.code).json({ error: auth.reason });
    // Ack fast; Telnyx retries slow webhooks.
    res.status(200).json({ ok: true });
    const data = (req.body as any)?.data;
    try {
      await handleCallEvent(String(data?.event_type ?? ""), data?.payload ?? {});
    } catch (err) {
      console.error(`[ClickToCall] ${data?.event_type} failed:`, err instanceof Error ? err.message : err);
    }
  });
}
