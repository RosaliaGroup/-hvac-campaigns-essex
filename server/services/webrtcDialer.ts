/**
 * Browser dialer — the rep calls from the CRM in her browser with a headset
 * (Telnyx WebRTC). No mobile phone needed, so it works for remote reps.
 *
 * Flow:
 *   1. The browser asks for a login token (calls.webrtcToken). We keep one
 *      Telnyx telephony credential per team member on the dialer's SIP
 *      credential connection and mint a short-lived JWT from it.
 *   2. Rep clicks "Call" → calls.webrtcStart creates the callLogs row (linked to
 *      the lead/contact and the rep) and returns the caller ID to show.
 *   3. The browser places the call (@telnyx/webrtc). When it ends,
 *      calls.webrtcFinish saves the Telnyx call_session_id, status and length.
 *   4. The connection's outbound voice profile records every call; the QC sweep
 *      (callQc.ts) attaches the recording and scores the call.
 *
 * Config (Railway):
 *   TELNYX_WEBRTC_CONNECTION_ID  — the SIP credential connection for the dialer
 *                                  (its outbound voice profile must record calls)
 *   TELNYX_VOICE_FROM_NUMBER     — caller ID (falls back to TELNYX_FROM_NUMBER)
 */
import { and, eq } from "drizzle-orm";
import { callLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { toE164 } from "./telnyxSms";

const TELNYX_API = "https://api.telnyx.com/v2";

export function browserDialerConfigured(): boolean {
  return Boolean(process.env.TELNYX_API_KEY?.trim() && process.env.TELNYX_WEBRTC_CONNECTION_ID?.trim() && callerId());
}

export function callerId(): string | null {
  return toE164(process.env.TELNYX_VOICE_FROM_NUMBER?.trim() || process.env.TELNYX_FROM_NUMBER?.trim() || null);
}

async function telnyx(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${TELNYX_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Telnyx ${init.method ?? "GET"} ${path.split("?")[0]} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

const credentialCache = new Map<number, string>();

/** The member's telephony credential id, created on first use. */
async function credentialFor(memberId: number): Promise<string> {
  const cached = credentialCache.get(memberId);
  if (cached) return cached;
  const name = `me-crm-team-${memberId}`;
  const connectionId = process.env.TELNYX_WEBRTC_CONNECTION_ID!.trim();
  const list: any = await (await telnyx(`/telephony_credentials?filter[name]=${encodeURIComponent(name)}&page[size]=5`)).json();
  let id: string | undefined = list?.data?.find((c: any) => c?.name === name && String(c?.connection_id) === connectionId)?.id;
  if (!id) {
    const created: any = await (
      await telnyx("/telephony_credentials", { method: "POST", body: JSON.stringify({ connection_id: connectionId, name }) })
    ).json();
    id = created?.data?.id;
  }
  if (!id) throw new Error("Telnyx did not return a credential id");
  credentialCache.set(memberId, id);
  return id;
}

/** Short-lived JWT the browser uses to log in to Telnyx WebRTC. */
export async function webrtcLoginToken(memberId: number): Promise<string> {
  const id = await credentialFor(memberId);
  const res = await telnyx(`/telephony_credentials/${encodeURIComponent(id)}/token`, { method: "POST", body: "{}" });
  const token = (await res.text()).trim().replace(/^"|"$/g, "");
  if (!token) throw new Error("Telnyx returned an empty token");
  return token;
}

export async function startBrowserCall(args: {
  memberId: number;
  phone: string;
  customerId?: number | null;
  leadCaptureId?: number | null;
}): Promise<{ callLogId: number; to: string; callerId: string }> {
  const to = toE164(args.phone);
  if (!to) throw new Error("This contact doesn't have a valid US phone number.");
  const from = callerId();
  if (!from) throw new Error("Caller ID number is not set.");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const inserted = await db.insert(callLogs).values({
    direction: "outbound",
    phoneNumber: to,
    status: "dialing",
    customerId: args.customerId ?? null,
    leadCaptureId: args.leadCaptureId ?? null,
    agentTeamMemberId: args.memberId,
  });
  const callLogId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  return { callLogId, to, callerId: from };
}

const SESSION_ID = /^[A-Za-z0-9-]{8,80}$/;

export async function finishBrowserCall(args: {
  memberId: number;
  callLogId: number;
  sessionId?: string | null;
  answered: boolean;
  durationSec: number;
  hangupCause?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const row = (
    await db
      .select({ id: callLogs.id, callId: callLogs.callId })
      .from(callLogs)
      .where(and(eq(callLogs.id, args.callLogId), eq(callLogs.agentTeamMemberId, args.memberId)))
      .limit(1)
  )[0];
  if (!row) return;
  const session = args.sessionId && SESSION_ID.test(args.sessionId) ? args.sessionId : null;
  await db
    .update(callLogs)
    .set({
      status: args.answered ? "completed" : `no_answer${args.hangupCause ? `:${args.hangupCause}` : ""}`.slice(0, 50),
      duration: Math.max(0, Math.min(4 * 3600, Math.round(args.durationSec))),
      ...(session && !row.callId ? { callId: `telnyx:${session}` } : {}),
    })
    .where(eq(callLogs.id, row.id));
}
