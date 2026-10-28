/**
 * Purchased-homeowner email campaign (source hvac-list-07105) from sales@.
 *
 * Runs once per Eastern sending hour (Mon–Fri 9–16), starting at :30 so the
 * commercial prospect cycle (top of the hour) goes first. Shares that cycle's
 * Gmail paced lane / quota cooldown, the 20-per-hour ceiling on ALL sales@
 * outreach (counted from Gmail Sent), and the CRM suppression list.
 *
 * Per contact: one introduction, one in-thread follow-up 5 business days later.
 * Never emails anyone sales@ has emailed before, anyone who has written to us,
 * anyone suppressed/unsubscribed, or any address with a bounce. A reply hands
 * the homeowner to a person (notification) and stops the sequence.
 *
 * Gated: HOMEOWNER_EMAIL_ENABLED=true, HOMEOWNER_EMAIL_POSTAL_ADDRESS set, JWT_SECRET set.
 */
import crypto from "node:crypto";
import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { customers, notifications } from "../../drizzle/schema";
import {
  DEFAULT_HOMEOWNER_PER_DAY, DEFAULT_HOMEOWNER_PER_HOUR, HOMEOWNER_FOLLOW_UP_BUSINESS_DAYS,
  HOMEOWNER_SOURCE, HOMEOWNER_START_MINUTE, firstNameFor, followUpEmail, homeownerAllowance,
  introEmail, isRealEmail, normalizeSignature,
} from "../../shared/homeownerEmail";
import { addBusinessDays, easternHourStartEpochSec, easternParts, sendingHour } from "../../shared/prospectCadence";
import { GmailIncompleteError, GmailStopError, prospectMailbox, type ProspectMailbox } from "./prospectGmail";
import { isOutreachSuppressed, recordOutreachSuppression } from "./outreachSuppression";
import { logCommunication } from "./crmCommunications";
import { recordGrowthTouch } from "./growth/touchLedger";
import { CRM_MAILBOX } from "./gmailCrm";
import { resolveDefaultOwner } from "./prospectWorkflow";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const affected = (r: unknown) => Number((r as any)[0]?.affectedRows ?? 0);
const PUBLIC_BASE = "https://mechanicalenterprise.com";
const MAX_REPLY_CHECKS_PER_RUN = 8;

export type HomeownerConfig = { enabled: boolean; postalAddress: string; secret: string; perHour: number; perDay: number; signature: string; missing: string[] };
export function homeownerConfig(env: NodeJS.ProcessEnv = process.env): HomeownerConfig {
  const postalAddress = (env.HOMEOWNER_EMAIL_POSTAL_ADDRESS ?? "").trim();
  const secret = env.JWT_SECRET ?? "";
  const missing: string[] = [];
  if (env.HOMEOWNER_EMAIL_ENABLED?.trim().toLowerCase() !== "true") missing.push("HOMEOWNER_EMAIL_ENABLED=true");
  if (postalAddress.length < 10) missing.push("HOMEOWNER_EMAIL_POSTAL_ADDRESS (business mailing address)");
  if (secret.length < 16) missing.push("JWT_SECRET");
  const n = (v: string | undefined, d: number, max: number) => {
    const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.min(Math.floor(x), max) : d;
  };
  return {
    enabled: missing.length === 0, postalAddress, secret, missing,
    signature: normalizeSignature(env.HOMEOWNER_EMAIL_SIGNATURE),
    perHour: n(env.HOMEOWNER_EMAIL_PER_HOUR, DEFAULT_HOMEOWNER_PER_HOUR, 15),
    perDay: n(env.HOMEOWNER_EMAIL_PER_DAY, DEFAULT_HOMEOWNER_PER_DAY, 100),
  };
}

// ── Unsubscribe tokens ────────────────────────────────────────────────────────
export function unsubscribeToken(email: string, secret: string) {
  return crypto.createHmac("sha256", secret).update("unsub:" + email.trim().toLowerCase()).digest("base64url").slice(0, 32);
}
export function unsubscribeUrl(email: string, secret: string) {
  const e = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${PUBLIC_BASE}/api/email/unsubscribe?e=${e}&t=${unsubscribeToken(email, secret)}`;
}
export function verifyUnsubscribe(e: unknown, t: unknown, secret: string): string | null {
  if (typeof e !== "string" || typeof t !== "string" || !secret) return null;
  let email: string;
  try { email = Buffer.from(e, "base64url").toString("utf8").trim().toLowerCase(); } catch { return null; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const expected = Buffer.from(unsubscribeToken(email, secret));
  const given = Buffer.from(t);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? email : null;
}

// ── Store ─────────────────────────────────────────────────────────────────────
let ready: Promise<unknown> | undefined;
export async function ensureHomeownerStore(db: Db) {
  ready ??= Promise.all([
    db.execute(sql`CREATE TABLE IF NOT EXISTS homeownerEmailSends (
      customerId int NOT NULL PRIMARY KEY,
      email varchar(320) NOT NULL,
      status varchar(24) NOT NULL,
      step int NOT NULL DEFAULT 0,
      note varchar(500) NULL,
      threadId varchar(64) NULL,
      lastMessageId varchar(64) NULL,
      subject varchar(255) NULL,
      firstSentAt timestamp NULL,
      lastSentAt timestamp NULL,
      lastCheckedAt timestamp NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY homeownerEmailSends_email (email),
      INDEX homeownerEmailSends_status (status, lastSentAt)
    )`),
    db.execute(sql`CREATE TABLE IF NOT EXISTS homeownerEmailRuns (
      hour varchar(16) NOT NULL PRIMARY KEY,
      startedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      summary text NULL
    )`),
  ]).catch(e => { ready = undefined; throw e; });
  await ready;
}

type SendRow = { customerId: number; email: string; status: string; step: number; threadId: string | null; subject: string | null; lastSentAt: Date | null; firstName: string | null; displayName: string };

async function upsertState(db: Db, customerId: number, email: string, patch: Record<string, unknown>) {
  const cols = Object.keys(patch);
  const vals = cols.map(c => patch[c] ?? null);
  await db.execute(sql`INSERT INTO homeownerEmailSends (customerId, email, ${sql.raw(cols.join(", "))})
    VALUES (${customerId}, ${email}, ${sql.join(vals.map(v => sql`${v}`), sql`, `)})
    ON DUPLICATE KEY UPDATE ${sql.raw(cols.map(c => `${c} = VALUES(${c})`).join(", "))}`);
}

async function notifyReply(db: Db, row: { customerId: number; displayName: string; email: string }) {
  const ownerId = await resolveDefaultOwner(db);
  if (!ownerId) return;
  await db.insert(notifications).values({
    teamMemberId: ownerId, type: "homeowner_email_reply",
    title: `Homeowner replied: ${row.displayName}`,
    body: `${row.displayName} (${row.email}) replied to the homeowner HVAC email. Read the reply in sales@ and follow up personally.`,
    entityType: "customer", entityId: row.customerId, link: `/customers/${row.customerId}`,
  });
}

async function logSent(db: Db, row: { customerId: number; email: string }, sent: { id: string; threadId: string }, subject: string, body: string, kind: "intro" | "follow_up", now: Date) {
  await logCommunication(db, {
    customerId: row.customerId, channel: "email", direction: "outbound", provider: "gmail",
    providerMessageId: sent.id, providerThreadId: sent.threadId, fromAddress: CRM_MAILBOX,
    toAddress: row.email, subject, body, status: "sent", occurredAt: now,
  });
  await recordGrowthTouch(db, {
    channel: "email", contactEmail: row.email, leadTable: "customer", leadId: row.customerId,
    campaignType: kind === "intro" ? "homeowner_intro" : "homeowner_follow_up",
    step: kind === "intro" ? 1 : 2, status: "sent", subject, providerMessageId: sent.id, body,
  });
}

export type HomeownerRunResult = {
  hour: string | null; skipped?: string; sentIntro: number; sentFollowUp: number;
  skippedContacts: Array<{ email: string; reason: string }>; replies: number; error?: string;
};

/** One hourly run. `mailbox`/`now` injectable for tests. */
export async function runHomeownerEmailHour(db: Db, opts: { now?: Date; mailbox?: ProspectMailbox; env?: NodeJS.ProcessEnv } = {}): Promise<HomeownerRunResult> {
  const now = opts.now ?? new Date();
  const cfg = homeownerConfig(opts.env);
  const hour = sendingHour(now);
  const result: HomeownerRunResult = { hour, sentIntro: 0, sentFollowUp: 0, skippedContacts: [], replies: 0 };
  if (!cfg.enabled) return { ...result, skipped: "not_configured" };
  if (!hour) return { ...result, skipped: "outside_sending_hours" };
  if (easternParts(now).minute < HOMEOWNER_START_MINUTE) return { ...result, skipped: "waiting_for_commercial_cycle" };
  await ensureHomeownerStore(db);
  const claim = await db.execute(sql`INSERT IGNORE INTO homeownerEmailRuns (hour) VALUES (${hour})`);
  if (affected(claim) !== 1) return { ...result, skipped: "hour_already_run" };

  try {
    const mailbox = opts.mailbox ?? await prospectMailbox();
    await mailbox.verifyIdentity();
    const sentThisHour = await mailbox.outreachSentSince(easternHourStartEpochSec(now)).catch(e => {
      if (e instanceof GmailIncompleteError) return null; throw e;
    });
    const dayStart = new Date(now.getTime() - (easternParts(now).hour * 3600 + easternParts(now).minute * 60) * 1000);
    const [{ n: sentToday }] = await db.execute(sql`SELECT
        COALESCE(SUM(firstSentAt >= ${dayStart}), 0) + COALESCE(SUM(step >= 2 AND lastSentAt >= ${dayStart} AND lastSentAt > firstSentAt), 0) n
      FROM homeownerEmailSends`).then((r: any) => r[0] as Array<{ n: number }>);
    let allowance = homeownerAllowance({ perHour: cfg.perHour, perDay: cfg.perDay,
      sentThisHourAllOutreach: sentThisHour, homeownerSentToday: Number(sentToday ?? 0) });

    // 1) Reply / bounce check on recently emailed homeowners (bounded).
    const toCheck = await db.execute(sql`SELECT h.customerId, h.email, h.threadId, c.displayName FROM homeownerEmailSends h
      JOIN customers c ON c.id = h.customerId
      WHERE h.status = 'active' AND h.threadId IS NOT NULL AND h.lastSentAt >= ${new Date(now.getTime() - 45 * 86_400_000)}
      ORDER BY COALESCE(h.lastCheckedAt, '1970-01-01') ASC LIMIT ${MAX_REPLY_CHECKS_PER_RUN}`).then((r: any) => r[0] as any[]);
    for (const row of toCheck) {
      try {
        const state = await mailbox.threadState(row.threadId, row.email);
        if (state.replied) {
          await upsertState(db, row.customerId, row.email, { status: "replied", note: "Homeowner replied — handed to a person", lastCheckedAt: now });
          await notifyReply(db, row); result.replies++;
        } else if (state.bounced) {
          await recordOutreachSuppression(db, row.email, "hard_bounce");
          await upsertState(db, row.customerId, row.email, { status: "bounced", lastCheckedAt: now });
        } else {
          await upsertState(db, row.customerId, row.email, { lastCheckedAt: now, step: Math.max(1, state.outboundCount) });
        }
      } catch (e) {
        if (e instanceof GmailStopError) throw e;
      }
    }

    // 2) Due follow-ups first (one in-thread follow-up per homeowner).
    const due = await db.execute(sql`SELECT h.customerId, h.email, h.status, h.step, h.threadId, h.subject, h.lastSentAt,
        c.firstName, c.displayName FROM homeownerEmailSends h JOIN customers c ON c.id = h.customerId
      WHERE h.status = 'active' AND h.step = 1 AND h.lastSentAt <= ${new Date(now.getTime() - HOMEOWNER_FOLLOW_UP_BUSINESS_DAYS * 86_400_000)}
      ORDER BY h.lastSentAt ASC LIMIT 10`).then((r: any) => r[0] as SendRow[]);
    for (const row of due) {
      if (allowance <= 0) break;
      if (!row.lastSentAt || addBusinessDays(new Date(row.lastSentAt), HOMEOWNER_FOLLOW_UP_BUSINESS_DAYS) > now || !row.threadId) continue;
      if (await isOutreachSuppressed(db, row.email)) {
        await upsertState(db, row.customerId, row.email, { status: "unsubscribed" }); continue;
      }
      const state = await mailbox.threadState(row.threadId, row.email);
      if (state.replied) { await upsertState(db, row.customerId, row.email, { status: "replied" }); await notifyReply(db, row); result.replies++; continue; }
      if (state.bounced) { await recordOutreachSuppression(db, row.email, "hard_bounce"); await upsertState(db, row.customerId, row.email, { status: "bounced" }); continue; }
      if (state.outboundCount >= 2) { await upsertState(db, row.customerId, row.email, { step: 2 }); continue; }
      if (!state.lastMessageIdHeader) { result.skippedContacts.push({ email: row.email, reason: "cannot thread follow-up" }); continue; }
      const mail = followUpEmail({ firstName: firstNameFor(row.firstName, row.displayName),
        unsubscribeUrl: unsubscribeUrl(row.email, cfg.secret), postalAddress: cfg.postalAddress, signature: cfg.signature,
        originalSubject: state.originalSubject || row.subject || "" });
      const sent = await mailbox.send({ to: row.email, subject: mail.subject, body: mail.body,
        threadId: row.threadId, inReplyTo: state.lastMessageIdHeader, extraHeaders: listUnsubHeaders(row.email, cfg.secret) });
      allowance--;
      // Stays 'active' so replies to the follow-up are still detected for 45 days.
      await upsertState(db, row.customerId, row.email, { step: 2, lastSentAt: now, lastMessageId: sent.id });
      if (await mailbox.isInSent(sent.id)) result.sentFollowUp++;
      await logSent(db, row, sent, mail.subject, mail.body, "follow_up", now);
    }

    // 3) New introductions.
    if (allowance > 0) {
      const pool = await db.select({ customerId: customers.id, email: customers.email, firstName: customers.firstName, displayName: customers.displayName })
        .from(customers)
        .where(and(
          eq(customers.source, HOMEOWNER_SOURCE),
          or(eq(customers.status, "active"), eq(customers.status, "inactive")),
          sql`${customers.email} LIKE '%@%.%' AND ${customers.email} NOT LIKE '%placeholder%'`,
          sql`NOT EXISTS (SELECT 1 FROM homeownerEmailSends h WHERE h.customerId = ${customers.id} OR h.email = LOWER(TRIM(${customers.email})))`,
        )).orderBy(asc(customers.id)).limit(allowance * 4);
      for (const c of pool) {
        if (allowance <= 0) break;
        const email = (c.email ?? "").trim().toLowerCase();
        if (!isRealEmail(email)) continue;
        const skip = async (status: string, note: string) => {
          await upsertState(db, c.customerId, email, { status, note });
          result.skippedContacts.push({ email, reason: note });
        };
        if (await isOutreachSuppressed(db, email)) { await skip("unsubscribed", "On CRM suppression / unsubscribe list"); continue; }
        if (await mailbox.hasSent(email)) { await skip("skipped", "Already emailed from sales@ before this campaign"); continue; }
        if (await mailbox.hasInboundFrom(email)) { await skip("replied", "Has written to sales@ — handled by a person"); continue; }
        if (await mailbox.hasBounce(email)) { await recordOutreachSuppression(db, email, "hard_bounce"); await skip("bounced", "Previous delivery failure"); continue; }
        const mail = introEmail({ firstName: firstNameFor(c.firstName, c.displayName),
          unsubscribeUrl: unsubscribeUrl(email, cfg.secret), postalAddress: cfg.postalAddress, signature: cfg.signature });
        // Reserve the row before sending so a crash can never cause a duplicate intro.
        await upsertState(db, c.customerId, email, { status: "sending", step: 0, subject: mail.subject });
        const sent = await mailbox.send({ to: email, subject: mail.subject, body: mail.body, extraHeaders: listUnsubHeaders(email, cfg.secret) });
        allowance--;
        await upsertState(db, c.customerId, email, { status: "active", step: 1, threadId: sent.threadId, lastMessageId: sent.id,
          firstSentAt: now, lastSentAt: now });
        if (await mailbox.isInSent(sent.id)) result.sentIntro++;
        await logSent(db, { customerId: c.customerId, email }, sent, mail.subject, mail.body, "intro", now);
      }
    }
  } catch (e) {
    result.error = e instanceof GmailStopError ? e.message : (e instanceof Error ? e.message : "unknown error");
  }
  await db.execute(sql`UPDATE homeownerEmailRuns SET summary = ${JSON.stringify(result).slice(0, 60000)} WHERE hour = ${hour}`);
  return result;
}

function listUnsubHeaders(email: string, secret: string) {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(email, secret)}>, <mailto:${CRM_MAILBOX}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ── Status for the CRM dashboard ─────────────────────────────────────────────
export async function homeownerEmailStatus(db: Db) {
  await ensureHomeownerStore(db);
  const cfg = homeownerConfig();
  const [pool] = await db.execute(sql`SELECT
      COUNT(*) total,
      SUM(email LIKE '%@%.%' AND email NOT LIKE '%placeholder%') withEmail
    FROM customers WHERE source = ${HOMEOWNER_SOURCE} AND status <> 'archived'`).then((r: any) => r[0]);
  const byStatus = await db.execute(sql`SELECT status, COUNT(*) n FROM homeownerEmailSends GROUP BY status`).then((r: any) => r[0] as any[]);
  const [sent] = await db.execute(sql`SELECT
      SUM(firstSentAt IS NOT NULL) introsSent,
      SUM(step >= 2 AND lastSentAt IS NOT NULL AND lastSentAt > firstSentAt) followUpsSent
    FROM homeownerEmailSends`).then((r: any) => r[0]);
  const runs = await db.execute(sql`SELECT hour, summary FROM homeownerEmailRuns ORDER BY hour DESC LIMIT 8`).then((r: any) => r[0] as any[]);
  const statusCounts = Object.fromEntries(byStatus.map(r => [r.status, Number(r.n)]));
  const handled = byStatus.reduce((a, r) => a + Number(r.n), 0);
  return {
    enabled: cfg.enabled, missing: cfg.missing, perHour: cfg.perHour, perDay: cfg.perDay,
    contactsWithEmail: Number(pool?.withEmail ?? 0), notYetContacted: Math.max(0, Number(pool?.withEmail ?? 0) - handled),
    introsSent: Number(sent?.introsSent ?? 0), followUpsSent: Number(sent?.followUpsSent ?? 0),
    statusCounts,
    recentRuns: runs.map(r => ({ hour: r.hour, summary: (() => { try { return JSON.parse(r.summary ?? "null"); } catch { return null; } })() })),
  };
}

// ── Unsubscribe endpoint (GET link + RFC 8058 one-click POST) ────────────────
export function registerHomeownerUnsubscribeRoute(app: Express) {
  const handle = async (req: Request, res: Response) => {
    const q = { ...(req.query ?? {}), ...(typeof req.body === "object" ? req.body : {}) } as Record<string, unknown>;
    const email = verifyUnsubscribe(q.e, q.t, process.env.JWT_SECRET ?? "");
    if (!email) return res.status(400).type("html").send(page("This unsubscribe link is not valid. Reply \"unsubscribe\" to our email and we will remove you."));
    try {
      const db = await getDb();
      if (!db) throw new Error("db");
      await recordOutreachSuppression(db, email, "opt_out", "unsubscribe-link");
      await ensureHomeownerStore(db);
      await db.execute(sql`UPDATE homeownerEmailSends SET status = 'unsubscribed', note = 'Unsubscribed via link' WHERE email = ${email}`);
      return res.status(200).type("html").send(page("You have been unsubscribed. Mechanical Enterprise will not email you again."));
    } catch {
      return res.status(500).type("html").send(page("Something went wrong. Please reply \"unsubscribe\" to our email and we will remove you."));
    }
  };
  app.get("/api/email/unsubscribe", handle);
  app.post("/api/email/unsubscribe", handle);
}
const page = (msg: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="font-family:system-ui;max-width:520px;margin:48px auto;padding:0 16px"><h1 style="font-size:20px">Mechanical Enterprise</h1><p>${msg}</p></body>`;

export function startHomeownerEmailLane() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const db = await getDb();
      if (db) {
        const r = await runHomeownerEmailHour(db);
        if (!r.skipped) console.log("[homeowner-email]", JSON.stringify({ hour: r.hour, intro: r.sentIntro, followUp: r.sentFollowUp, replies: r.replies, skipped: r.skippedContacts.length, error: r.error }));
      }
    } catch (e) {
      console.warn("[homeowner-email]", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 60_000);
}
