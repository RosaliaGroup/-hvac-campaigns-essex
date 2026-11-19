/**
 * Daily activity counts for the Team Hub end-of-day report.
 * GET /api/team-hub/stats?email=<rep email>&date=YYYY-MM-DD   header x-hub-secret: TEAM_HUB_SECRET
 * Returns only counts for that one rep and day (America/New_York).
 */
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { prospectWorkflowQueue, appointments, callLogs, crmCommunications, crmExternalContacts, customers, leadCaptures, properties, smsInboxMessages, teamMembers } from "../../drizzle/schema";
import { getDb } from "../db";

function secretOk(req: Request): boolean {
  const want = process.env.TEAM_HUB_SECRET?.trim();
  const got = String(req.headers["x-hub-secret"] ?? "");
  if (!want || want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** UTC bounds of one New York calendar day. */
export function nyDayBounds(date: string): [Date, Date] {
  const [y, m, d] = date.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
    .formatToParts(noon)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const hours = Number(tz.replace("GMT", "") || "0");
  const start = new Date(Date.UTC(y, m - 1, d) - hours * 3600 * 1000);
  return [start, new Date(start.getTime() + 24 * 3600 * 1000)];
}

export function registerTeamHubStatsRoute(app: Express) {
  /**
   * Email outreach report for partner updates (read-only, hub secret).
   * GET /api/team-hub/email-report?days=60
   * Outbound email count, and every distinct outside sender who emailed us back, with their contact record.
   */
  // Read-only: prospects whose email came from Apollo (for credit claims on bounces).
  app.get("/api/team-hub/apollo-prospects", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });
    try {
      const rows = await db.select({ email: prospectWorkflowQueue.email, company: prospectWorkflowQueue.company, state: prospectWorkflowQueue.state, createdAt: prospectWorkflowQueue.createdAt, lastError: prospectWorkflowQueue.lastError })
        .from(prospectWorkflowQueue).where(sql`${prospectWorkflowQueue.evidence} LIKE 'Apollo.io verified%'`).orderBy(prospectWorkflowQueue.createdAt).limit(5000);
      return res.json({ count: rows.length, rows: rows.map((r) => ({ ...r, lastError: r.lastError ? String(r.lastError).slice(0, 120) : null })) });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "failed" });
    }
  });

  app.get("/api/team-hub/email-report", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const days = Math.min(Math.max(Number(req.query.days ?? 60) || 60, 1), 365);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });
    try {
      const since = new Date(Date.now() - days * 86400 * 1000);
      const sent = await db
        .select({ n: sql<number>`COUNT(*)`, people: sql<number>`COUNT(DISTINCT LOWER(${crmCommunications.toAddress}))` })
        .from(crmCommunications)
        .where(and(eq(crmCommunications.channel, "email"), eq(crmCommunications.direction, "outbound"), gte(crmCommunications.occurredAt, since)));
      const inbound = await db
        .select({
          from: crmCommunications.fromAddress,
          subject: crmCommunications.subject,
          body: crmCommunications.body,
          at: crmCommunications.occurredAt,
          contactId: crmCommunications.externalContactId,
          name: crmExternalContacts.name,
          company: crmExternalContacts.company,
          title: crmExternalContacts.title,
          source: crmExternalContacts.source,
        })
        .from(crmCommunications)
        .leftJoin(crmExternalContacts, eq(crmExternalContacts.id, crmCommunications.externalContactId))
        .where(and(eq(crmCommunications.channel, "email"), eq(crmCommunications.direction, "inbound"), gte(crmCommunications.occurredAt, since)))
        .orderBy(desc(crmCommunications.occurredAt))
        .limit(2000);
      const skip = /(mechanicalenterprise\.com|rosaliagroup\.com|abrevo\.co|no-?reply|mailer-daemon|postmaster|notifications?@|google\.com|facebookmail|meta\.com|thumbtack|quickbooks|intuit|stripe|telnyx|railway|github)/i;
      const seen = new Map<string, unknown>();
      for (const r of inbound) {
        const addr = String(r.from ?? "").toLowerCase().replace(/.*</, "").replace(/>.*/, "").trim();
        if (!addr || skip.test(addr) || seen.has(addr)) continue;
        seen.set(addr, {
          email: addr, name: r.name ?? null, company: r.company ?? null, title: r.title ?? null, source: r.source ?? null,
          subject: r.subject ?? null, preview: String(r.body ?? "").replace(/\s+/g, " ").slice(0, 240), at: r.at, linked: !!r.contactId,
        });
      }
      res.json({ days, sentEmails: Number(sent[0]?.n ?? 0), sentPeople: Number(sent[0]?.people ?? 0), replies: Array.from(seen.values()) });
    } catch (err) {
      console.error("[TeamHubEmailReport]", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "failed" });
    }
  });

  app.get("/api/team-hub/stats", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const email = String(req.query.email ?? "").trim().toLowerCase();
    const date = String(req.query.date ?? "");
    if (!email || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "email and date required" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });
    try {
      const member = (
        await db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(sql`LOWER(${teamMembers.email}) = ${email}`).limit(1)
      )[0];
      if (!member) return res.json({ found: false });
      const [from, to] = nyDayBounds(date);
      const calls = await db
        .select({ duration: callLogs.duration, status: callLogs.status })
        .from(callLogs)
        .where(and(eq(callLogs.agentTeamMemberId, member.id), gte(callLogs.createdAt, from), lt(callLogs.createdAt, to)));
      const texts = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(smsInboxMessages)
        .where(and(eq(smsInboxMessages.direction, "outbound"), eq(smsInboxMessages.sentByName, member.name), gte(smsInboxMessages.createdAt, from), lt(smsInboxMessages.createdAt, to)));
      const visits = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(appointments)
        .where(and(eq(appointments.bookedBy, member.name), gte(appointments.createdAt, from), lt(appointments.createdAt, to)));
      const conversations = calls.filter((c) => (c.duration ?? 0) >= 45).length;
      const talkSec = calls.reduce((a, c) => a + (c.duration ?? 0), 0);
      res.json({
        found: true,
        calls: calls.length,
        conversations,
        talkMinutes: Math.round(talkSec / 60),
        texts: Number(texts[0]?.n ?? 0),
        visits: Number(visits[0]?.n ?? 0),
      });
    } catch (err) {
      console.error("[TeamHubStats]", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "failed" });
    }
  });

  /**
   * Contact list for assigning work to setters in the Team Hub (same secret).
   * Commercial customers, past customers and recent leads; counts only what a
   * setter needs to plan the work. Never includes financial data.
   */
  app.get("/api/team-hub/contacts", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });
    try {
      const custRows = await db
        .select({
          id: customers.id,
          type: customers.type,
          firstName: customers.firstName,
          lastName: customers.lastName,
          companyName: customers.companyName,
          displayName: customers.displayName,
          email: customers.email,
          phone: customers.phone,
          status: customers.status,
          source: customers.source,
          notes: customers.notes,
          qbo: customers.quickbooksCustomerId,
          createdAt: customers.createdAt,
        })
        .from(customers);
      const props = await db.select({ customerId: properties.customerId, propertyType: properties.propertyType, city: properties.city }).from(properties);
      const propBy = new Map<number, { propertyType: string | null; city: string | null }>();
      for (const p of props) if (p.customerId && !propBy.has(p.customerId)) propBy.set(p.customerId, { propertyType: (p.propertyType as string) ?? null, city: p.city ?? null });
      const lastCall = await db
        .select({ customerId: callLogs.customerId, at: sql<Date>`MAX(${callLogs.createdAt})` })
        .from(callLogs)
        .where(isNotNull(callLogs.customerId))
        .groupBy(callLogs.customerId);
      const callBy = new Map(lastCall.map((c) => [c.customerId, c.at]));
      const since = new Date(Date.now() - 120 * 864e5);
      const leads = await db
        .select({
          id: leadCaptures.id,
          name: leadCaptures.name,
          firstName: leadCaptures.firstName,
          lastName: leadCaptures.lastName,
          email: leadCaptures.email,
          phone: leadCaptures.phone,
          status: leadCaptures.status,
          channel: leadCaptures.channel,
          captureType: leadCaptures.captureType,
          message: leadCaptures.message,
          customerId: leadCaptures.customerId,
          assignedTo: leadCaptures.assignedTo,
          createdAt: leadCaptures.createdAt,
        })
        .from(leadCaptures)
        .where(gte(leadCaptures.createdAt, since))
        .orderBy(desc(leadCaptures.createdAt));
      res.json({
        customers: custRows.map((c) => ({
          ...c,
          notes: (c.notes ?? "").slice(0, 400),
          dnc: /do\s*not\s*(call|contact)/i.test(c.notes ?? ""),
          propertyType: propBy.get(c.id)?.propertyType ?? null,
          city: propBy.get(c.id)?.city ?? null,
          lastCallAt: callBy.get(c.id) ?? null,
        })),
        leads: leads.map((l) => ({ ...l, message: (l.message ?? "").slice(0, 300) })),
      });
    } catch (err) {
      console.error("[TeamHubContacts]", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "failed" });
    }
  });
}
