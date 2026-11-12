/**
 * Per-call quality control (QC) — transcribe every recorded rep call, score it
 * against the playbook (shared/callQc.ts), store the review and email a short
 * report per call plus a daily digest.
 *
 * Calls reach QC three ways, all ending as a callLogs row whose recordingUrl is
 * `telnyx-session:<call_session_id>`:
 *   - Browser dialer (server/services/webrtcDialer.ts): the row is created when
 *     the rep dials; the sweep attaches the recording once Telnyx has it.
 *   - PC softphone (a Telnyx SIP credential connection): no CRM involvement at
 *     dial time, so the sweep imports its recordings and creates the rows,
 *     matching the dialed number to a lead/contact.
 *   - Ring-my-mobile click-to-call (clickToCall.ts): rows already carry the
 *     recording reference.
 *
 * Gated by CALL_QC_ENABLED=true (off by default) and needs migration 0085.
 * Config (Railway):
 *   CALL_QC_ENABLED                 true to run the sweep (every 3 minutes)
 *   CALL_QC_CONNECTIONS             comma list of "<telnyx connection id>:<teamMembers.id>"
 *                                   — whose recordings to import, and which rep made them
 *                                   (the softphone and browser-dialer connections)
 *   CALL_QC_REPORT_EMAIL            per-call + daily emails (default sales@mechanicalenterprise.com)
 *   CALL_QC_EMAIL_EACH_CALL         "false" to send only the daily digest
 *   CALL_QC_TRANSCRIBE_MODEL        Telnyx STT model (default deepgram/nova-3)
 *   TELNYX_API_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY — already set
 */
import { and, desc, eq, gte, inArray, isNull, like, sql } from "drizzle-orm";
import { callLogs, callQcReviews, customers, leadCaptures, teamMembers } from "../../drizzle/schema";
import {
  QC_FLAG_LABEL,
  QC_MIN_SECONDS,
  QC_SYSTEM_PROMPT,
  QC_VERDICT_LABEL,
  parseQcResponse,
  type CallQcReview,
} from "../../shared/callQc";
import { callAnthropicModelChain } from "../_core/anthropic";
import { getDb } from "../db";
import { RECORDING_PREFIX } from "./clickToCall";
import { sendEmail } from "./emailService";

const TELNYX_API = "https://api.telnyx.com/v2";
const QC_MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];
const SWEEP_MS = 3 * 60 * 1000;
const MAX_REVIEWS_PER_SWEEP = 4;
const MAX_ATTEMPTS = 3;
const CRM_BASE = "https://mechanicalenterprise.com";

export function callQcEnabled(): boolean {
  return process.env.CALL_QC_ENABLED?.trim().toLowerCase() === "true";
}

/** "<connectionId>:<teamMemberId>" pairs from CALL_QC_CONNECTIONS. */
export function parseConnectionMap(raw: string | undefined): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const part of (raw ?? "").split(",")) {
    const [conn, member] = part.trim().split(":");
    if (!conn) continue;
    const id = member ? parseInt(member, 10) : NaN;
    out.set(conn.trim(), Number.isFinite(id) ? id : null);
  }
  return out;
}

async function telnyxGet(path: string): Promise<any> {
  const res = await fetch(`${TELNYX_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Telnyx GET ${path.split("?")[0]} ${res.status}`);
  return res.json();
}

/** Newest recording for a call session, or null. */
async function recordingForSession(sessionId: string): Promise<any | null> {
  const r = await telnyxGet(`/recordings?filter[call_session_id]=${encodeURIComponent(sessionId)}&page[size]=1`);
  return r?.data?.[0] ?? null;
}

function last10(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

/** Lead and contact whose phone matches, newest first. */
async function matchContact(phone: string): Promise<{ leadCaptureId: number | null; customerId: number | null }> {
  const db = await getDb();
  const digits = last10(phone);
  if (!db || digits.length !== 10) return { leadCaptureId: null, customerId: null };
  const lead = await db
    .select({ id: leadCaptures.id })
    .from(leadCaptures)
    .where(sql`RIGHT(REGEXP_REPLACE(${leadCaptures.phone}, '[^0-9]', ''), 10) = ${digits}`)
    .orderBy(desc(leadCaptures.id))
    .limit(1);
  const cust = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`RIGHT(REGEXP_REPLACE(${customers.phone}, '[^0-9]', ''), 10) = ${digits}`)
    .orderBy(desc(customers.id))
    .limit(1);
  return { leadCaptureId: lead[0]?.id ?? null, customerId: cust[0]?.id ?? null };
}

// ── 1. Import recordings from the softphone / browser-dialer connections ──────

/** Create call logs for recordings made outside the CRM (PC softphone). */
export async function importConnectionRecordings(): Promise<number> {
  const db = await getDb();
  const map = parseConnectionMap(process.env.CALL_QC_CONNECTIONS);
  if (!db || map.size === 0) return 0;
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  let created = 0;
  for (const [connectionId, memberId] of Array.from(map.entries())) {
    const resp = await telnyxGet(
      `/recordings?filter[connection_id]=${encodeURIComponent(connectionId)}&filter[created_at][gte]=${encodeURIComponent(since)}&page[size]=50`,
    );
    for (const rec of resp?.data ?? []) {
      const sessionId: string | undefined = rec?.call_session_id;
      if (!sessionId) continue;
      const ref = `${RECORDING_PREFIX}${sessionId}`;
      const existing = await db
        .select({ id: callLogs.id, recordingUrl: callLogs.recordingUrl })
        .from(callLogs)
        .where(sql`${callLogs.callId} = ${`telnyx:${sessionId}`} OR ${callLogs.recordingUrl} = ${ref}`)
        .limit(1);
      const durationSec = rec?.duration_millis ? Math.round(rec.duration_millis / 1000) : null;
      if (existing[0]) {
        if (!existing[0].recordingUrl) {
          await db.update(callLogs).set({ recordingUrl: ref, ...(durationSec ? { duration: durationSec } : {}) }).where(eq(callLogs.id, existing[0].id));
        }
        continue;
      }
      const to = String(rec?.to ?? "").slice(0, 20) || "unknown";
      const match = await matchContact(to);
      await db.insert(callLogs).values({
        callId: `telnyx:${sessionId}`,
        direction: "outbound",
        phoneNumber: to,
        status: "completed",
        duration: durationSec,
        recordingUrl: ref,
        agentTeamMemberId: memberId,
        leadCaptureId: match.leadCaptureId,
        customerId: match.customerId,
      });
      created++;
    }
  }
  return created;
}

/** Browser-dialer calls finish before Telnyx has the recording; attach it later. */
export async function attachPendingRecordings(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db
    .select({ id: callLogs.id, callId: callLogs.callId })
    .from(callLogs)
    .where(and(like(callLogs.callId, "telnyx:%"), isNull(callLogs.recordingUrl), gte(callLogs.createdAt, since)))
    .limit(20);
  let attached = 0;
  for (const r of rows) {
    const sessionId = r.callId!.slice("telnyx:".length);
    const rec = await recordingForSession(sessionId).catch(() => null);
    if (!rec) continue;
    await db
      .update(callLogs)
      .set({
        recordingUrl: `${RECORDING_PREFIX}${sessionId}`,
        ...(rec.duration_millis ? { duration: Math.round(rec.duration_millis / 1000) } : {}),
      })
      .where(eq(callLogs.id, r.id));
    attached++;
  }
  return attached;
}

// ── 2. Transcribe ────────────────────────────────────────────────────────────

/** Two-channel transcript with "Channel N:" labels, via Telnyx speech-to-text. */
export async function transcribeRecording(downloadUrl: string): Promise<string> {
  const form = new FormData();
  form.append("model", process.env.CALL_QC_TRANSCRIBE_MODEL?.trim() || "deepgram/nova-3");
  form.append("file_url", downloadUrl);
  form.append("response_format", "verbose_json");
  form.append("model_config", JSON.stringify({ multichannel: true, utterances: true, smart_format: true, punctuate: true }));
  const res = await fetch(`${TELNYX_API}/ai/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  return formatTranscript(j);
}

/** Exported for tests. */
export function formatTranscript(j: any): string {
  const segs: any[] = Array.isArray(j?.segments) ? j.segments : [];
  if (segs.length === 0) return String(j?.text ?? "").trim();
  return segs
    .slice()
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
    .map((s) => {
      const ch = Array.isArray(s.channel) ? s.channel[0] : s.channel;
      const who = ch === undefined || ch === null ? "Speaker" : `Channel ${Number(ch) + 1}`;
      const t = Math.max(0, Math.floor(s.start ?? 0));
      return `[${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}] ${who}: ${String(s.text ?? "").trim()}`;
    })
    .filter((l) => !/:\s*$/.test(l))
    .join("\n");
}

// ── 3. Review ────────────────────────────────────────────────────────────────

async function reviewTranscript(transcript: string, context: string): Promise<{ review: CallQcReview; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const result = await callAnthropicModelChain({
    apiKey,
    models: QC_MODELS,
    system: QC_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `${context}\n\nTRANSCRIPT:\n${transcript.slice(0, 60_000)}` }],
    maxTokens: 2000,
  });
  if (!result.ok || !result.text) throw new Error(result.error ?? "QC model returned nothing");
  const review = parseQcResponse(result.text);
  if (!review) throw new Error("QC reply was not valid JSON");
  return { review, model: result.model ?? QC_MODELS[0] };
}

async function upsertReview(callLogId: number, patch: Partial<typeof callQcReviews.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: callQcReviews.id }).from(callQcReviews).where(eq(callQcReviews.callLogId, callLogId)).limit(1);
  if (existing[0]) await db.update(callQcReviews).set(patch).where(eq(callQcReviews.id, existing[0].id));
  else await db.insert(callQcReviews).values({ callLogId, ...patch });
}

/** QC one call log. Records the outcome on callQcReviews; never throws. */
export async function runQcForCall(callLogId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const log = (await db.select().from(callLogs).where(eq(callLogs.id, callLogId)).limit(1))[0];
  if (!log) return;
  const prev = (await db.select().from(callQcReviews).where(eq(callQcReviews.callLogId, callLogId)).limit(1))[0];
  const attempts = (prev?.attempts ?? 0) + 1;

  if ((log.duration ?? 0) < QC_MIN_SECONDS) {
    await upsertReview(callLogId, { agentTeamMemberId: log.agentTeamMemberId, status: "skipped", outcome: "no_conversation", attempts, error: "Too short to review" });
    return;
  }
  const sessionId = log.recordingUrl?.startsWith(RECORDING_PREFIX) ? log.recordingUrl.slice(RECORDING_PREFIX.length) : null;
  if (!sessionId) return;

  try {
    const rec = await recordingForSession(sessionId);
    const url = rec?.download_urls?.mp3 ?? rec?.download_urls?.wav;
    if (!url) throw new Error("Recording not available yet");
    const transcript = await transcribeRecording(url);
    if (transcript.replace(/\W/g, "").length < 20) {
      await upsertReview(callLogId, { agentTeamMemberId: log.agentTeamMemberId, status: "skipped", outcome: "no_conversation", transcript, attempts, error: "No speech in the recording" });
      return;
    }
    const lead = log.leadCaptureId
      ? (await db.select({ name: leadCaptures.name }).from(leadCaptures).where(eq(leadCaptures.id, log.leadCaptureId)).limit(1))[0]
      : null;
    const context = `Call: outbound to ${log.phoneNumber}${lead?.name ? ` (${lead.name})` : ""}, ${log.duration ?? "?"} seconds, ${log.createdAt.toISOString()}.`;
    const { review, model } = await reviewTranscript(transcript, context);
    await upsertReview(callLogId, {
      agentTeamMemberId: log.agentTeamMemberId,
      status: "done",
      score: review.score,
      verdict: review.verdict,
      outcome: review.outcome,
      review,
      transcript,
      model,
      attempts,
      error: null,
    });
    await emailCallReport(callLogId).catch((e) => console.error("[CallQC] email failed:", e instanceof Error ? e.message : e));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CallQC] call ${callLogId} attempt ${attempts}: ${message}`);
    await upsertReview(callLogId, {
      agentTeamMemberId: log.agentTeamMemberId,
      status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      attempts,
      error: message.slice(0, 500),
    });
  }
}

/** Recorded rep calls from the last 3 days with no finished review. */
async function callsNeedingQc(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  const rows = await db
    .select({ id: callLogs.id, status: callQcReviews.status, attempts: callQcReviews.attempts })
    .from(callLogs)
    .leftJoin(callQcReviews, eq(callQcReviews.callLogId, callLogs.id))
    .where(
      and(
        like(callLogs.recordingUrl, `${RECORDING_PREFIX}%`),
        sql`${callLogs.agentTeamMemberId} IS NOT NULL`,
        gte(callLogs.createdAt, since),
        sql`(${callQcReviews.id} IS NULL OR (${callQcReviews.status} = 'pending' AND ${callQcReviews.attempts} < ${MAX_ATTEMPTS}))`,
      ),
    )
    .orderBy(callLogs.createdAt)
    .limit(MAX_REVIEWS_PER_SWEEP);
  return rows.map((r) => r.id);
}

// ── 4. Reports ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function reportEmail(): string {
  return process.env.CALL_QC_REPORT_EMAIL?.trim() || "sales@mechanicalenterprise.com";
}

async function repName(memberId: number | null): Promise<string> {
  const db = await getDb();
  if (!db || !memberId) return "Rep";
  const m = (await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1))[0];
  return m?.name || "Rep";
}

export async function emailCallReport(callLogId: number): Promise<void> {
  if (process.env.CALL_QC_EMAIL_EACH_CALL?.trim().toLowerCase() === "false") return;
  const db = await getDb();
  if (!db) return;
  const row = (await db.select().from(callQcReviews).where(eq(callQcReviews.callLogId, callLogId)).limit(1))[0];
  const log = (await db.select().from(callLogs).where(eq(callLogs.id, callLogId)).limit(1))[0];
  if (!row || !log || row.status !== "done" || row.emailedAt) return;
  const review = row.review as CallQcReview;
  const name = await repName(log.agentTeamMemberId);
  const lead = log.leadCaptureId
    ? (await db.select({ name: leadCaptures.name }).from(leadCaptures).where(eq(leadCaptures.id, log.leadCaptureId)).limit(1))[0]
    : null;
  const who = lead?.name ? `${lead.name} (${log.phoneNumber})` : log.phoneNumber;
  const verdict = QC_VERDICT_LABEL[review.verdict];
  const subject = `Call QC: ${name} → ${lead?.name ?? log.phoneNumber} — ${review.score ?? "–"}/100 ${verdict}`;
  const link = log.leadCaptureId ? `${CRM_BASE}/lead-dashboard?lead=${log.leadCaptureId}` : log.customerId ? `${CRM_BASE}/customers/${log.customerId}` : `${CRM_BASE}/call-qc`;
  const html = `
  <div style="font-family:Arial,sans-serif;font-size:14px;color:#15202b;max-width:640px">
    <h2 style="margin:0 0 4px">${esc(name)} · ${review.score ?? "–"}/100 · ${esc(verdict)}</h2>
    <p style="margin:0 0 12px;color:#56636f">${esc(who)} · ${Math.round((log.duration ?? 0) / 60)} min · ${log.createdAt.toLocaleString("en-US", { timeZone: "America/New_York" })} ET · outcome: ${esc(review.outcome.replace(/_/g, " "))}</p>
    ${review.flags.length ? `<div style="background:#fbe7e5;padding:10px;border-radius:6px;margin-bottom:12px"><b>Flags</b><ul>${review.flags.map((f) => `<li>${esc(QC_FLAG_LABEL[f.code])}${f.quote ? `: "${esc(f.quote)}"` : ""}</li>`).join("")}</ul></div>` : ""}
    <p>${esc(review.summary)}</p>
    <table style="border-collapse:collapse;width:100%">${review.scores.map((s) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #ddd">${esc(s.label)}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${s.score}/${s.max}</td><td style="padding:4px 8px;border-bottom:1px solid #ddd;color:#56636f">${esc(s.note)}</td></tr>`).join("")}</table>
    ${review.strengths.length ? `<p><b>Did well:</b></p><ul>${review.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${review.coaching.length ? `<p><b>Coaching:</b></p><ul>${review.coaching.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <p><a href="${link}">Open in the CRM</a> to play the recording.</p>
  </div>`;
  const ok = await sendEmail({ to: reportEmail(), subject, html });
  if (ok) await db.update(callQcReviews).set({ emailedAt: new Date() }).where(eq(callQcReviews.id, row.id));
}

/** Weekday digest: every rep's calls today, average score, flags. */
export async function sendDailyQcDigest(now = new Date()): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const dayStart = new Date(now.getTime() - 24 * 3600 * 1000);
  const rows = await db
    .select({
      callLogId: callLogs.id,
      agent: callLogs.agentTeamMemberId,
      duration: callLogs.duration,
      status: callQcReviews.status,
      score: callQcReviews.score,
      verdict: callQcReviews.verdict,
      outcome: callQcReviews.outcome,
      review: callQcReviews.review,
    })
    .from(callLogs)
    .leftJoin(callQcReviews, eq(callQcReviews.callLogId, callLogs.id))
    .where(and(sql`${callLogs.agentTeamMemberId} IS NOT NULL`, eq(callLogs.direction, "outbound"), gte(callLogs.createdAt, dayStart)));
  if (rows.length === 0) return;
  const byAgent = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byAgent.get(r.agent!) ?? [];
    list.push(r);
    byAgent.set(r.agent!, list);
  }
  const sections: string[] = [];
  for (const [agent, list] of Array.from(byAgent.entries())) {
    const scored = list.filter((r) => r.status === "done" && r.score !== null);
    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) : null;
    const talkMin = Math.round(list.reduce((s, r) => s + (r.duration ?? 0), 0) / 60);
    const booked = scored.filter((r) => (r.review as CallQcReview | null)?.appointmentBooked).length;
    const flags = scored.flatMap((r) => (r.review as CallQcReview | null)?.flags ?? []);
    const coaching = scored.flatMap((r) => (r.review as CallQcReview | null)?.coaching ?? []).slice(0, 4);
    sections.push(`
      <h3 style="margin:16px 0 4px">${esc(await repName(agent))}</h3>
      <p style="margin:0">${list.length} calls · ${talkMin} min talk time · ${scored.length} scored · average ${avg ?? "–"}/100 · ${booked} booked · ${scored.filter((r) => r.verdict === "fail").length} failed QC</p>
      ${flags.length ? `<p style="margin:6px 0;color:#a3312b"><b>Flags:</b> ${flags.map((f) => esc(QC_FLAG_LABEL[f.code])).join(", ")}</p>` : ""}
      ${coaching.length ? `<ul>${coaching.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}`);
  }
  await sendEmail({
    to: reportEmail(),
    subject: `Call QC daily — ${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" })}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#15202b;max-width:640px"><h2 style="margin:0">Call quality — today</h2>${sections.join("")}<p><a href="${CRM_BASE}/call-qc">Open Call QC in the CRM</a></p></div>`,
  });
}

// ── 5. Sweep ─────────────────────────────────────────────────────────────────

let running = false;
let lastDigestDay = "";

export async function runCallQcSweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await importConnectionRecordings().catch((e) => console.error("[CallQC] import failed:", e instanceof Error ? e.message : e));
    await attachPendingRecordings().catch((e) => console.error("[CallQC] attach failed:", e instanceof Error ? e.message : e));
    for (const id of await callsNeedingQc()) await runQcForCall(id);

    // Daily digest at ~6:30 PM ET on weekdays.
    const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.toISOString().slice(0, 10);
    const weekday = et.getDay() >= 1 && et.getDay() <= 5;
    if (weekday && et.getHours() === 18 && et.getMinutes() >= 30 && lastDigestDay !== day) {
      lastDigestDay = day;
      await sendDailyQcDigest().catch((e) => console.error("[CallQC] digest failed:", e instanceof Error ? e.message : e));
    }
  } finally {
    running = false;
  }
}

export function startCallQcSweep(): void {
  if (!callQcEnabled()) return;
  if (!process.env.TELNYX_API_KEY?.trim()) {
    console.warn("[CallQC] CALL_QC_ENABLED but TELNYX_API_KEY missing — not starting");
    return;
  }
  console.log("[CallQC] sweep started (every 3 min)");
  setTimeout(() => void runCallQcSweep(), 30_000);
  setInterval(() => void runCallQcSweep(), SWEEP_MS);
}

// ── 6. Reads for the UI ──────────────────────────────────────────────────────

export async function qcForCallLog(callLogId: number) {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(callQcReviews).where(eq(callQcReviews.callLogId, callLogId)).limit(1))[0];
  if (!row) return null;
  return {
    status: row.status,
    score: row.score,
    verdict: row.verdict,
    outcome: row.outcome,
    review: (row.review as CallQcReview | null) ?? null,
    transcript: row.transcript,
    error: row.status === "failed" || row.status === "skipped" ? row.error : null,
  };
}

/** Scores for a set of call logs (for badges in call history). */
export async function qcSummaries(callLogIds: number[]) {
  const db = await getDb();
  if (!db || callLogIds.length === 0) return new Map<number, { status: string; score: number | null; verdict: string | null }>();
  const rows = await db
    .select({ callLogId: callQcReviews.callLogId, status: callQcReviews.status, score: callQcReviews.score, verdict: callQcReviews.verdict })
    .from(callQcReviews)
    .where(inArray(callQcReviews.callLogId, callLogIds));
  return new Map(rows.map((r) => [r.callLogId, { status: r.status, score: r.score, verdict: r.verdict }]));
}

/** Admin list: recent reviewed calls, optionally for one rep. */
export async function listQcReviews(args: { agentTeamMemberId?: number; days?: number }) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - (args.days ?? 14) * 24 * 3600 * 1000);
  const conds = [gte(callQcReviews.createdAt, since)];
  if (args.agentTeamMemberId) conds.push(eq(callQcReviews.agentTeamMemberId, args.agentTeamMemberId));
  const rows = await db
    .select({
      callLogId: callQcReviews.callLogId,
      agentTeamMemberId: callQcReviews.agentTeamMemberId,
      agentName: teamMembers.name,
      status: callQcReviews.status,
      score: callQcReviews.score,
      verdict: callQcReviews.verdict,
      outcome: callQcReviews.outcome,
      review: callQcReviews.review,
      phoneNumber: callLogs.phoneNumber,
      duration: callLogs.duration,
      leadCaptureId: callLogs.leadCaptureId,
      customerId: callLogs.customerId,
      createdAt: callLogs.createdAt,
    })
    .from(callQcReviews)
    .innerJoin(callLogs, eq(callLogs.id, callQcReviews.callLogId))
    .leftJoin(teamMembers, eq(teamMembers.id, callQcReviews.agentTeamMemberId))
    .where(and(...conds))
    .orderBy(desc(callLogs.createdAt))
    .limit(300);
  return rows.map(({ review, ...r }) => {
    const rv = review as CallQcReview | null;
    return { ...r, summary: rv?.summary ?? "", flags: rv?.flags ?? [], appointmentBooked: rv?.appointmentBooked ?? false };
  });
}
