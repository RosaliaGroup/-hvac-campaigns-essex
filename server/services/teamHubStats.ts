/**
 * Daily activity counts for the Team Hub end-of-day report.
 * GET /api/team-hub/stats?email=<rep email>&date=YYYY-MM-DD   header x-hub-secret: TEAM_HUB_SECRET
 * Returns only counts for that one rep and day (America/New_York).
 */
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { appointments, callLogs, smsInboxMessages, teamMembers } from "../../drizzle/schema";
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
}
