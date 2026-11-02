/**
 * Vapi end-of-call report → ONE complete office email per call.
 *
 * Jessica's mid-call `sendCallRecap` tool runs BEFORE the call ends, so it can
 * never include the full conversation. Vapi posts an `end-of-call-report`
 * server message to the assistant's Server URL after hang-up, carrying the
 * full transcript, Vapi's AI summary, the recording URL and the duration.
 *
 * This module:
 *   1. parses that report (pure, unit-tested),
 *   2. finds the recap row the tool stored for the same call (by Vapi call id,
 *      else same caller phone within the last hour) and appends the summary +
 *      full transcript to it — or stores a new call-log row when the caller hung
 *      up before Jessica sent a recap,
 *   3. sends ONE email: Jessica's recap fields + AI summary + recording link +
 *      the full transcript.
 *
 * Idempotent: a retried report for a call that already has a transcript block
 * is ignored (no second email). Mechanical Enterprise only (Resend email).
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { callLogs } from "../../drizzle/schema";
import { sendEmail } from "../services/emailService";
import { normalizePhone } from "../routers/customers";

const RECAP_INBOX = "sales@mechanicalenterprise.com";
export const TRANSCRIPT_MARKER = "── Full transcript ──";
const MATCH_WINDOW_MS = 60 * 60 * 1000;

export interface EndOfCallReport {
  callId: string;
  direction: "inbound" | "outbound";
  rawPhone: string;
  normalizedPhone: string | null;
  assistantName: string | null;
  endedReason: string | null;
  durationSeconds: number | null;
  summary: string | null;
  transcript: string;
  recordingUrl: string | null;
  startedAt: string | null;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const s = (v: unknown): string | null => {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
};

/** True when the body is a Vapi server message of type end-of-call-report. */
export function isEndOfCallReport(body: unknown): boolean {
  return obj(obj(body).message).type === "end-of-call-report";
}

/** True for any other Vapi server message (status-update, hang, etc.). */
export function isOtherServerMessage(body: unknown): boolean {
  const t = obj(obj(body).message).type;
  return typeof t === "string" && t !== "end-of-call-report";
}

/**
 * Speaker-labelled transcript. Prefers the structured message list (exact
 * turns, tool calls skipped); falls back to Vapi's flat "AI:/User:" text.
 */
export function renderTranscript(messages: unknown, flat: unknown): string {
  if (Array.isArray(messages)) {
    const lines: string[] = [];
    for (const m of messages) {
      const role = s(obj(m).role);
      const text = s(obj(m).message);
      if (!text) continue;
      if (role === "bot" || role === "assistant") lines.push(`Jessica: ${text}`);
      else if (role === "user") lines.push(`Caller: ${text}`);
    }
    if (lines.length) return lines.join("\n");
  }
  const f = s(flat);
  if (!f) return "";
  return f.replace(/^AI:/gm, "Jessica:").replace(/^User:/gm, "Caller:");
}

/** Pure parse of the Vapi end-of-call-report envelope. Returns null if unusable. */
export function parseEndOfCallReport(body: unknown): EndOfCallReport | null {
  const msg = obj(obj(body).message);
  if (msg.type !== "end-of-call-report") return null;
  const call = obj(msg.call);
  const artifact = obj(msg.artifact);
  const analysis = obj(msg.analysis);
  const callId = s(call.id);
  if (!callId) return null;

  const rawPhone = s(obj(call.customer).number) ?? s(obj(msg.customer).number) ?? "";
  const duration = Number(msg.durationSeconds);
  return {
    callId,
    direction: s(call.type) === "outboundPhoneCall" ? "outbound" : "inbound",
    rawPhone,
    normalizedPhone: rawPhone ? normalizePhone(rawPhone) : null,
    assistantName: s(obj(msg.assistant).name),
    endedReason: s(msg.endedReason),
    durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
    summary: s(analysis.summary) ?? s(msg.summary),
    transcript: renderTranscript(artifact.messages ?? msg.messages, artifact.transcript ?? msg.transcript),
    recordingUrl: s(artifact.recordingUrl) ?? s(msg.recordingUrl) ?? s(obj(artifact.recording).stereoUrl),
    startedAt: s(msg.startedAt),
  };
}

function fmtDuration(sec: number | null): string | null {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  return `${m}m ${String(sec % 60).padStart(2, "0")}s`;
}

/** Text block appended to the call log (and used for the email body). */
export function renderReportBlock(r: EndOfCallReport): string {
  const lines = ["── AI summary ──", r.summary ?? "(no summary)"];
  const meta = [
    r.durationSeconds != null ? `Duration: ${fmtDuration(r.durationSeconds)}` : null,
    r.endedReason ? `Ended: ${r.endedReason}` : null,
    r.recordingUrl ? `Recording: ${r.recordingUrl}` : null,
  ].filter(Boolean) as string[];
  if (meta.length) lines.push("", ...meta);
  lines.push("", TRANSCRIPT_MARKER, r.transcript || "(no transcript)");
  return lines.join("\n");
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pull "Caller:"/"Outcome"-style fields out of the stored tool recap text. */
export function recapField(recapText: string | null, label: string): string | null {
  if (!recapText) return null;
  const m = recapText.match(new RegExp(`^${label}: (.+)$`, "m"));
  return m ? m[1].trim() : null;
}

export function endOfCallEmailHtml(r: EndOfCallReport, recapText: string | null): string {
  const transcriptHtml = (r.transcript || "(no transcript)")
    .split("\n")
    .map((line) => {
      const isBot = line.startsWith("Jessica:");
      const [who, ...rest] = line.split(":");
      return `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;"><strong style="color:${
        isBot ? "#1e3a5f" : "#ff6b35"
      };">${esc(who)}:</strong>${esc(rest.join(":"))}</p>`;
    })
    .join("");
  const box = (title: string, inner: string) =>
    `<h2 style="font-size:15px;margin:20px 0 8px;color:#1e3a5f;">${title}</h2>${inner}`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
      <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:18px;">📋 Call Recap — ${esc(
          recapField(recapText, "Caller") ?? (r.normalizedPhone ?? r.rawPhone) ?? "Caller",
        )}</h1>
        <p style="color:#cfe0f5;margin:6px 0 0;font-size:13px;">${esc(
          [r.direction === "outbound" ? "Outbound call" : "Inbound call", r.normalizedPhone ?? r.rawPhone,
            fmtDuration(r.durationSeconds), r.endedReason ? `ended: ${r.endedReason}` : null]
            .filter(Boolean).join(" · "),
        )}</p>
      </div>
      <div style="background:#f9f9f9;padding:20px;border:1px solid #eee;">
        ${box("Summary", `<p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-line;">${esc(r.summary ?? "(no summary)")}</p>`)}
        ${recapText ? box("Jessica's recap", `<pre style="margin:0;font-size:13px;white-space:pre-wrap;font-family:Arial,sans-serif;">${esc(recapText)}</pre>`) : box("Jessica's recap", `<p style="margin:0;font-size:14px;color:#a33;">No recap tool call — the caller may have hung up early.</p>`)}
        ${r.recordingUrl ? `<p style="margin:16px 0 0;font-size:14px;"><a href="${esc(r.recordingUrl)}">▶ Listen to the recording</a></p>` : ""}
        ${box("Full transcript", `<div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #eee;">${transcriptHtml}</div>`)}
      </div>
      <div style="background:#eee;padding:10px 20px;border-radius:0 0 8px 8px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;">Mechanical Enterprise LLC · Vapi call ${esc(r.callId)}</p>
      </div>
    </div>`;
}

export interface EndOfCallResult {
  success: boolean;
  deduped: boolean;
  callLogId: number | null;
  emailed: boolean;
}

/** DB-backed handler. Never throws for notification failures. */
export async function handleEndOfCallReport(r: EndOfCallReport): Promise<EndOfCallResult> {
  const db = await getDb();
  if (!db) throw new Error("database unavailable");

  // 1) The tool's recap row: exact Vapi call id first, else same phone in the last hour.
  let row: { id: number; transcript: string | null } | undefined;
  [row] = await db
    .select({ id: callLogs.id, transcript: callLogs.transcript })
    .from(callLogs)
    .where(eq(callLogs.callId, r.callId))
    .limit(1);
  if (!row && r.normalizedPhone) {
    [row] = await db
      .select({ id: callLogs.id, transcript: callLogs.transcript })
      .from(callLogs)
      .where(
        and(
          sql`RIGHT(REGEXP_REPLACE(${callLogs.phoneNumber}, '[^0-9]', ''), 10) = ${r.normalizedPhone.replace(/\D/g, "").slice(-10)}`,
          gte(callLogs.createdAt, new Date(Date.now() - MATCH_WINDOW_MS)),
          sql`(${callLogs.transcript} IS NULL OR ${callLogs.transcript} NOT LIKE ${"%" + TRANSCRIPT_MARKER + "%"})`,
        ),
      )
      .orderBy(desc(callLogs.createdAt))
      .limit(1);
  }

  if (row?.transcript?.includes(TRANSCRIPT_MARKER)) {
    console.info(`[VapiEndOfCall] duplicate report for call-log #${row.id} — ignored`);
    return { success: true, deduped: true, callLogId: row.id, emailed: false };
  }

  const recapText = row?.transcript ?? null;
  const block = renderReportBlock(r);
  let callLogId: number;
  if (row) {
    await db
      .update(callLogs)
      .set({
        // Re-key to the Vapi call id so a retried report hits the exact-id dedupe above.
        callId: r.callId,
        transcript: recapText ? `${recapText}\n\n${block}` : block,
        recordingUrl: r.recordingUrl,
        duration: r.durationSeconds,
      })
      .where(eq(callLogs.id, row.id));
    callLogId = row.id;
  } else {
    const res = await db.insert(callLogs).values({
      callId: r.callId,
      direction: r.direction,
      phoneNumber: (r.normalizedPhone ?? r.rawPhone ?? "unknown").slice(0, 20) || "unknown",
      status: (r.endedReason ?? "no_recap").slice(0, 50),
      transcript: block,
      recordingUrl: r.recordingUrl,
      duration: r.durationSeconds,
    });
    const insertId = (res as unknown as { insertId?: number }[])?.[0]?.insertId
      ?? (res as unknown as { insertId?: number }).insertId;
    callLogId = Number(insertId ?? 0);
  }

  // Very short no-conversation calls (silence, instant hang-up) are stored but not emailed.
  const callerSpoke = r.transcript.includes("Caller:");
  let emailed = false;
  if (callerSpoke || recapText) {
    const who = recapField(recapText, "Caller") ?? r.normalizedPhone ?? r.rawPhone ?? "Caller";
    const what = recapField(recapText, "Requested service") ?? recapField(recapText, "Reason");
    try {
      emailed = await sendEmail({
        to: RECAP_INBOX,
        subject: `📋 Call Recap — ${[what, who].filter(Boolean).join(": ")}`,
        html: endOfCallEmailHtml(r, recapText),
      });
    } catch (err) {
      console.error("[VapiEndOfCall] email threw:", err instanceof Error ? err.message : "unknown");
    }
  }
  console.info(`[VapiEndOfCall] call-log #${callLogId} updated (matchedRecap=${!!row}) emailed=${emailed}`);
  return { success: true, deduped: false, callLogId, emailed };
}
