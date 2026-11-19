/**
 * Automatic follow-up email after a team member's call.
 * POST /api/team-hub/followup-email   header x-hub-secret: TEAM_HUB_SECRET
 * body: { crm_type: "customer"|"lead", crm_id, result, note, rep, company?, email?, name? }
 *
 * The caller only writes call notes and ticks "Send follow-up email" in the
 * Daily Hub. This writes a short email from the notes, signs it with the
 * owner's signature and sends it through the CRM mailbox (composeGmail), so it
 * is logged on the contact and replies come back to the CRM.
 */
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { crmCommunications, crmExternalContacts, customers, leads } from "../../drizzle/schema";
import { getDb } from "../db";
import { callAnthropicModelChain } from "../_core/anthropic";
import { upsertExternalContact } from "./crmCommunications";
import { composeGmail } from "./gmailCompose";

// The signature is the sales@ mailbox's own Gmail signature (Ana's full signature),
// added by composeGmail with her personal cell replaced by the business line.

const SENDABLE = ["no_answer", "voicemail", "conversation", "follow_up", "visit_booked"];

const WRITER = `You write a short follow-up email from Mechanical Enterprise, a licensed HVAC contractor in Newark, NJ (heating and cooling installations, replacements and maintenance contracts for homes and buildings in New Jersey).
A team member just called this contact. Write the email the owner, Ana, sends after that call, using ONLY facts in the call result and notes. Rules:
- 3 to 5 short sentences, plain and warm, professional US English. Greeting with their first name if known, otherwise "Hello,".
- no_answer / voicemail: say we tried to reach them today, one line on how we help buildings like theirs, and invite them to reply or call (862) 419-1763 to set up a quick walkthrough.
- conversation / follow_up: thank them for the time on the phone with the caller (use the caller's first name), recap what was discussed and the next step exactly as in the notes.
- visit_booked: confirm the day, time and address ONLY if they are in the notes; otherwise just thank them and say we'll confirm the details.
- Never invent facts, numbers, dates, names, prices, rebates, discounts, guarantees or same-day/24-7 claims. No prices at all.
- Do not include a signature or sign-off name; it is added automatically. End with a closing line like "Thank you," on its own line.
Reply with ONLY JSON: {"subject":"...","body":"..."}. Subject under 70 characters, no emojis.`;

function secretOk(req: Request): boolean {
  const want = process.env.TEAM_HUB_SECRET?.trim();
  const got = String(req.headers["x-hub-secret"] ?? "");
  if (!want || want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function registerTeamHubFollowupRoute(app: Express) {
  app.post("/api/team-hub/followup-email", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const b = req.body ?? {};
    const crmType = b.crm_type === "lead" ? "lead" : b.crm_type === "customer" ? "customer" : null;
    const crmId = Number(b.crm_id);
    const result = String(b.result ?? "");
    const note = String(b.note ?? "").slice(0, 1500);
    const rep = String(b.rep ?? "").split(" ")[0].slice(0, 40);
    if (!crmType || !(crmId > 0)) return res.status(400).json({ error: "bad target" });
    if (!SENDABLE.includes(result)) return res.status(400).json({ error: "No follow-up email for this result." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    // Find or create the CRM contact for this customer / lead.
    let contactId: number | null = null;
    let name = String(b.name ?? ""), company = String(b.company ?? ""), email = String(b.email ?? "");
    if (crmType === "customer") {
      const [c] = await db.select().from(customers).where(eq(customers.id, crmId)).limit(1);
      if (c) { name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.displayName; company = c.companyName ?? company; email = c.email ?? email; }
      const [linked] = await db.select().from(crmExternalContacts).where(eq(crmExternalContacts.customerId, crmId)).limit(1);
      if (linked?.email) contactId = linked.id;
      else if (email) contactId = (await upsertExternalContact(db, { name: name || email, company: company || null, email, customerId: crmId, source: "crm" })).id;
    } else {
      const [l] = await db.select().from(leads).where(eq(leads.id, crmId)).limit(1);
      if (l) { name = l.name || name; if (l.contactType === "email") email = l.contact; }
      const [linked] = await db.select().from(crmExternalContacts).where(eq(crmExternalContacts.leadId, crmId)).limit(1);
      if (linked?.email) contactId = linked.id;
      else if (email) contactId = (await upsertExternalContact(db, { name: name || email, company: company || null, email, leadId: crmId, source: "crm" })).id;
    }
    if (!contactId) return res.status(400).json({ error: "This contact has no email address." });

    // One automatic follow-up per contact every 3 days.
    const since = new Date(Date.now() - 3 * 86400_000);
    const [recent] = await db.select({ id: crmCommunications.id }).from(crmCommunications)
      .where(and(eq(crmCommunications.externalContactId, contactId), eq(crmCommunications.channel, "email"),
        eq(crmCommunications.direction, "outbound"), gte(crmCommunications.occurredAt, since)))
      .orderBy(desc(crmCommunications.occurredAt)).limit(1);
    if (recent) return res.json({ ok: true, skipped: "We already emailed this contact in the last 3 days." });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "Email writer unavailable" });
    const r = await callAnthropicModelChain({
      apiKey, models: ["claude-sonnet-5", "claude-haiku-4-5"], system: WRITER, maxTokens: 600,
      messages: [{ role: "user", content: `Contact name: ${name || "unknown"}\nCompany: ${company || "unknown"}\nCaller: ${rep || "our team"}\nCall result: ${result}\nCaller's notes: ${note || "(none)"}` }],
    });
    if (!r.ok) return res.status(502).json({ error: "Email writer unavailable" });
    let draft: { subject?: string; body?: string } | null = null;
    try { const t = r.text ?? ""; draft = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)); } catch { /* null */ }
    const subject = String(draft?.subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);
    const body = String(draft?.body ?? "").trim();
    if (!subject || !body) return res.status(502).json({ error: "Email writer failed" });
    if (/\$\s?\d/.test(body)) return res.status(422).json({ error: "Draft mentioned a price; not sent." });

    try {
      await composeGmail({ externalContactId: contactId, subject, body, action: "send", senderEmail: null, withMailboxSignature: true });
      return res.json({ ok: true, sent: true, subject });
    } catch (e) {
      console.warn("[teamHub] follow-up email failed", e);
      return res.status(502).json({ error: e instanceof Error ? e.message : "send failed" });
    }
  });
}
