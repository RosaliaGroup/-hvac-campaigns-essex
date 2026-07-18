/**
 * Production wiring for sendCallRecap: the Mechanical DB store, the Resend email
 * notifier, and the Telnyx SMS notifier — plus a plain REST route
 * (POST /api/vapi/call-recap) that preserves the legacy Vapi request/response
 * contract while routing everything through Mechanical Enterprise services.
 *
 * No Rosalia dependency, no nodemailer/SMTP, no Textbelt, no Twilio.
 */

import type { Express, Request, Response } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { appointments, callLogs, customers, leadCaptures, properties } from "../../drizzle/schema";
import { sendEmail } from "../services/emailService";
import { sendTelnyxSms } from "../services/telnyxSms";
import {
  buildRecapRecord,
  persistCallRecap,
  type CallRecapInput,
  type RecapDeps,
  type RecapMatch,
  type RecapNotifier,
  type RecapRecord,
  type RecapStore,
} from "./callRecap";

const RECAP_INBOX = "sales@mechanicalenterprise.com";

/** Match a phone column against a normalized last-10 key. */
function phoneMatch(column: unknown, key: string) {
  return sql`RIGHT(REGEXP_REPLACE(${column}, '[^0-9]', ''), 10) = ${key}`;
}

/** Map free-text urgency onto the callLogs leadQuality enum. */
function urgencyToQuality(urgency: string | null): "hot" | "warm" | "cold" | null {
  if (!urgency) return null;
  const u = urgency.toLowerCase();
  if (/(emerg|urgent|asap|today|no heat|no ac|no cooling|no cool)/.test(u)) return "hot";
  if (/(soon|this week|warm)/.test(u)) return "warm";
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────
// DB-backed store
// ─────────────────────────────────────────────────────────────

const store: RecapStore = {
  async findExistingRecap(idempotencyKey) {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    const rows = await db
      .select({ id: callLogs.id })
      .from(callLogs)
      .where(eq(callLogs.callId, idempotencyKey))
      .limit(1);
    return rows[0]?.id ?? null;
  },

  async match(record) {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    const key = record.normalizedPhone;
    const result: RecapMatch = { appointmentId: null, customerId: null, leadId: null, propertyId: null };

    // 1) appointment id (highest priority)
    if (record.appointmentId) {
      const [appt] = await db
        .select({ id: appointments.id, customerId: appointments.customerId, propertyId: appointments.propertyId })
        .from(appointments)
        .where(eq(appointments.id, record.appointmentId))
        .limit(1);
      if (appt) {
        result.appointmentId = appt.id;
        result.customerId = appt.customerId ?? null;
        result.propertyId = appt.propertyId ?? null;
      }
    }

    // 2) normalized phone → appointment / customer / property / lead
    if (key) {
      if (!result.appointmentId) {
        const [appt] = await db
          .select({ id: appointments.id, customerId: appointments.customerId, propertyId: appointments.propertyId })
          .from(appointments)
          .where(phoneMatch(appointments.phone, key))
          .orderBy(desc(appointments.createdAt))
          .limit(1);
        if (appt) {
          result.appointmentId = appt.id;
          result.customerId = result.customerId ?? appt.customerId ?? null;
          result.propertyId = result.propertyId ?? appt.propertyId ?? null;
        }
      }

      // 3) customer — only when the number resolves to exactly one (isolation).
      if (!result.customerId) {
        const custRows = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(phoneMatch(customers.phone, key), sql`${customers.status} <> 'archived'`))
          .limit(2);
        if (custRows.length === 1) result.customerId = custRows[0].id;
      }

      // 4) property (context) for the resolved customer
      if (result.customerId && !result.propertyId) {
        const [prop] = await db
          .select({ id: properties.id })
          .from(properties)
          .where(eq(properties.customerId, result.customerId))
          .orderBy(desc(properties.isPrimary))
          .limit(1);
        if (prop) result.propertyId = prop.id;
      }

      // 5) lead
      if (!result.leadId) {
        const [lead] = await db
          .select({ id: leadCaptures.id })
          .from(leadCaptures)
          .where(phoneMatch(leadCaptures.phone, key))
          .orderBy(desc(leadCaptures.createdAt))
          .limit(1);
        if (lead) result.leadId = lead.id;
      }
    }

    return result;
  },

  async saveCallLog(record, match, recapText) {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    const phoneNumber = (record.normalizedPhone ?? record.rawPhone ?? "").slice(0, 20) || "unknown";
    try {
      const res = await db.insert(callLogs).values({
        callId: record.idempotencyKey,
        direction: "inbound",
        phoneNumber,
        status: record.outcome?.slice(0, 50) ?? "recap",
        serviceType: record.requestedService?.slice(0, 255) ?? null,
        leadQuality: urgencyToQuality(record.urgency),
        transcript: recapText,
        customerId: match.customerId,
        leadId: match.leadId,
      });
      const insertId = (res as unknown as { insertId?: number | string }[])?.[0]?.insertId
        ?? (res as unknown as { insertId?: number | string }).insertId;
      return Number(insertId ?? 0);
    } catch (err) {
      // Unique-key race on callId → another retry won; reuse its row.
      const rows = await db
        .select({ id: callLogs.id })
        .from(callLogs)
        .where(eq(callLogs.callId, record.idempotencyKey))
        .limit(1);
      if (rows[0]) return rows[0].id;
      throw err;
    }
  },

  async attachToAppointment(appointmentId, recapText) {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    await db
      .update(appointments)
      .set({ notes: sql`CONCAT(COALESCE(${appointments.notes}, ''), '\n\n', ${recapText})` })
      .where(eq(appointments.id, appointmentId));
  },

  async attachToLead(leadId, recapText) {
    const db = await getDb();
    if (!db) throw new Error("database unavailable");
    await db
      .update(leadCaptures)
      .set({ notes: sql`CONCAT(COALESCE(${leadCaptures.notes}, ''), '\n\n', ${recapText})` })
      .where(eq(leadCaptures.id, leadId));
  },
};

// ─────────────────────────────────────────────────────────────
// Notifier — Resend email + Telnyx SMS
// ─────────────────────────────────────────────────────────────

function recapEmailHtml(record: RecapRecord, recapText: string): string {
  const row = (label: string, value: string | null) =>
    value ? `<tr><td style="padding:6px 0;color:#666;font-size:14px;width:150px;">${label}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(value)}</td></tr>` : "";
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:18px;">📋 Call Recap — ${escapeHtml(record.callerName)}</h1>
      </div>
      <div style="background:#f9f9f9;padding:20px;border:1px solid #eee;">
        <table style="width:100%;border-collapse:collapse;">
          ${row("Phone", record.normalizedPhone ?? record.rawPhone)}
          ${row("Reason", record.reasonForCall)}
          ${row("Requested service", record.requestedService)}
          ${row("Appointment", record.appointmentDetails)}
          ${row("Property", record.propertyAddress)}
          ${row("Urgency", record.urgency)}
          ${row("Unresolved", record.unresolvedQuestions)}
          ${row("Follow-up", record.followUpRequired ? "Required" : "No")}
        </table>
        ${record.aiSummary ? `<div style="margin-top:16px;padding:14px;background:#fff;border-left:4px solid #ff6b35;border-radius:6px;"><p style="margin:0;font-size:14px;white-space:pre-line;line-height:1.6;">${escapeHtml(record.aiSummary)}</p></div>` : ""}
      </div>
      <div style="background:#eee;padding:10px 20px;border-radius:0 0 8px 8px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;">Mechanical Enterprise LLC · (862) 423-9396</p>
      </div>
    </div>`;
}

const notifier: RecapNotifier = {
  async sendEmail(record, recapText) {
    const subjectBits = [record.requestedService, record.callerName].filter(Boolean).join(": ");
    return sendEmail({
      to: RECAP_INBOX,
      subject: `📋 Call Recap — ${subjectBits || record.callerName}`,
      html: recapEmailHtml(record, recapText),
    });
  },

  async hasSmsConsent(normalizedPhone) {
    const db = await getDb();
    if (!db) return false;
    // Consent = a contact record exists AND has not opted out. Absence of a
    // record is treated as NO consent (conservative default).
    const { smsContacts } = await import("../../drizzle/schema");
    const rows = await db
      .select({ optedOut: smsContacts.optedOut })
      .from(smsContacts)
      .where(phoneMatch(smsContacts.phone, normalizedPhone))
      .limit(1);
    return rows.length > 0 && rows[0].optedOut === false;
  },

  async sendSms(normalizedPhone, record) {
    const firstName = record.callerName.split(" ")[0] || "there";
    const msg =
      `Hi ${firstName}, thanks for calling Mechanical Enterprise. ` +
      (record.followUpRequired
        ? `We're following up on your request and will be in touch shortly. `
        : `We've logged your request and will be in touch if anything's needed. `) +
      `Questions? Call (862) 423-9396. Reply STOP to opt out.`;
    const res = await sendTelnyxSms(normalizedPhone, msg);
    return res.success;
  },
};

export function productionRecapDeps(): RecapDeps {
  return { store, notifier };
}

// ─────────────────────────────────────────────────────────────
// REST route — preserves the legacy Vapi HTTP contract.
// ─────────────────────────────────────────────────────────────

export function registerVapiRecapRoute(app: Express): void {
  app.post("/api/vapi/call-recap", async (req: Request, res: Response) => {
    // Optional shared-secret gate. Enforced ONLY when configured — non-breaking.
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (secret) {
      const header = req.get("authorization") || req.get("x-vapi-secret") || "";
      const provided = header.replace(/^Bearer\s+/i, "").trim();
      if (provided !== secret) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
    }

    const body = (req.body ?? {}) as CallRecapInput;
    const record = buildRecapRecord(body);

    // Preserve the legacy contract: name + phone required.
    if (record.callerName === "Unknown caller" || !record.rawPhone) {
      return res.status(400).json({ success: false, error: "Name and phone are required" });
    }

    try {
      const result = await persistCallRecap(record, productionRecapDeps());
      return res.status(200).json(result);
    } catch (err) {
      // Persistence itself failed — return 500 so Vapi retries (idempotency
      // collapses the retry). Log operational context only, no payload dump.
      console.error(
        "[VapiRecapRoute] recap persistence failed:",
        err instanceof Error ? err.message : "unknown error",
      );
      return res.status(500).json({ success: false, error: "Failed to store recap" });
    }
  });
}
