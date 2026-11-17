/**
 * Automatic first answer for a team member's question in the Daily Hub.
 * POST /api/team-hub/answer   header x-hub-secret: TEAM_HUB_SECRET
 * body: { question, guide }   guide = the tutorials and tasks that person sees.
 * Answers ONLY from the guide; when the guide doesn't clearly answer it, says
 * so (confident:false), the question waits for the team and, when the hub
 * sends `escalate: {name, source}`, the owner is emailed right away.
 * `escalate_only: true` just emails ("I still need help" on an auto answer).
 */
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { callAnthropicModelChain } from "../_core/anthropic";
import { sendEmail } from "./emailService";

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The system couldn't answer: email the owner so the question never sits unseen. */
export async function escalateToOwner(name: string, source: string, question: string): Promise<void> {
  const who = name || "A team member";
  const where = source === "abrevo" ? "the Abrevo Social Dashboard" : "the Daily Hub";
  await sendEmail({
    to: "sales@mechanicalenterprise.com",
    subject: `Team question needs you: ${who}`.slice(0, 150),
    html: `<p><b>${esc(who)}</b> asked a question in ${where} that the tutorials don't answer:</p>`
      + `<blockquote style="border-left:3px solid #c2501b;margin:0;padding:6px 12px;white-space:pre-wrap">${esc(question)}</blockquote>`
      + `<p>Answer it on the board: <a href="https://mechanicalenterprise.com/p/team-8b159de4">Daily Hub → Questions from the team</a>. Your answer shows in their Questions box.</p>`,
  }).catch((e) => console.warn("[teamHub] escalate email failed", e));
}

function secretOk(req: Request): boolean {
  const want = process.env.TEAM_HUB_SECRET?.trim();
  const got = String(req.headers["x-hub-secret"] ?? "");
  if (!want || want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * Help desk: fixes for problems the team actually runs into. Added to every
 * guide, so questions and chat messages about these get solved right away.
 */
export const HELPDESK = `# Help desk (how to fix common problems)
## Work tracker (browser extension)
- Download: https://me-team-hub-4q8z2w.netlify.app/work-tracker.zip (paste the link in Chrome's address bar). If Chrome warns "unusual download" or "can't be verified", click the download icon (top right) and choose Keep / Download anyway. It is our own file.
- Install: right-click the zip → Extract All. Then type chrome://extensions in the address bar → turn on Developer mode (top right) → Load unpacked → choose the unzipped "work-tracker" folder → click the puzzle icon by the address bar → pin "Daily Hub Work Tracker" → click the tracker icon in the toolbar → paste your code (starts with trk-) → Connect. Edge works the same with edge://extensions.
- Stuck on "Checking…" or "Not installed yet": the file was opened directly. Install it with Load unpacked as above and open it from the toolbar icon, never by double-clicking the file.
- "This tracker code isn't valid": paste the full code from your Daily Hub messages, nothing before or after it.
- Green ON = tracking (clocked in). OFF = clocked out (nothing recorded). It records only the website name each minute you're active; no links, content, screenshots or keystrokes.
## CRM calls (browser dialer)
- Use a headset. The first time, the browser asks for the microphone: click Allow. If they can't hear you: click the lock icon left of the address bar → Microphone → Allow, then refresh the page (F5).
- Extensions and phone menus ("press 1"): during the call press Keypad (next to Mute) and tap the numbers, or type the numbers on your keyboard.
- After every call, log the result in My contacts (no answer, voicemail, conversation, follow-up, visit booked, not interested, do not call, bad number) with a short note.
- Call only 9 AM–8 PM. Anyone who says don't call: mark "do not call" and never contact them again.
- If the dialer shows an error: refresh the page (F5) and try again; if it still fails, say what the error says.
## Daily Hub
- Clock in when you start, Break / Back from break for breaks, Clock out at the end. Breaks are not counted as work time.
- My contacts shows 50 contacts at a time; more open when fewer than 10 are left. Start at the top.
- Notes save only when you press a button (Start/Done/Blocked/Save). Write the reason in the note when you press Blocked.
- End-of-day report: Daily tab → End-of-day report, before clocking out.
## Social accounts (Moses)
- Facebook: log in as salesabrevo@gmail.com (not your personal profile). Business Suite (business.facebook.com): top-left menu switches between Mechanical Enterprise and Rosalia Group. To follow or like other pages: on facebook.com click the profile picture → See all profiles → choose Mechanical Enterprise (or Rosalia Group Real Estate), then open the page and click Follow.
- Instagram: on instagram.com log in with the USERNAME (mechanical_enterprise or rosalia_group), not the Gmail, with the password Ana sent. Switch accounts with the profile icon → Switch accounts. If Instagram asks for a security code, ask Ana in Messages (she receives it).
- Never change passwords or security settings. No ads or payments.
## CRM login
- Forgot password: on the CRM login page press "Forgot password?" and follow the email.
`;

const SYSTEM = `You answer questions from a new team member (call setter or outreach rep) using ONLY the guide below: their tutorials and their task list.

Rules:
- If the guide clearly answers the question, give a short, plain-English answer (2-4 sentences), say what to do, and name the tutorial or task it comes from.
- If the guide does not clearly answer it, or the question is about pay, hours, contracts, personal matters, prices or policies not in the guide, or needs a judgment call by the owner, do NOT guess: set confident to false.
- If two parts of the guide disagree, set confident to false.
- Never invent prices, promises, phone numbers, people or steps.
- If the question is too vague to act on (e.g. "some pages don't work", "I can't log in", "it's not working" without saying which page, account or task, or what error they see), set confident to false and put in "clarify" one short, friendly reply asking for exactly what's missing: which page/account/task (name or link) and what happens when they try (the exact error or what they see). Otherwise "clarify" is "".
Reply with JSON only: {"confident": true|false, "answer": "...", "clarify": "..."} (answer is "" when not confident).`;

const CHAT_RULE = `

This is a message in the team chat, not always a question. If it asks for nothing (thanks, ok, a status update like "back from break" or "I'm starting calls"), set confident false and add "no_reply": true. If it reports a problem or asks for help, answer it like a question: give the exact fix steps from the guide (help desk section first), friendly and short.`;

export function parseAnswer(text: string | undefined): { confident: boolean; answer: string; clarify: string; noReply?: boolean } {
  const m = (text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return { confident: false, answer: "", clarify: "" };
  try {
    const j = JSON.parse(m[0]);
    const answer = typeof j.answer === "string" ? j.answer.trim().slice(0, 1500) : "";
    const clarify = typeof j.clarify === "string" ? j.clarify.trim().slice(0, 800) : "";
    const confident = j.confident === true && answer.length > 0;
    const out: { confident: boolean; answer: string; clarify: string; noReply?: boolean } = { confident, answer: confident ? answer : "", clarify: confident ? "" : clarify };
    if (!confident && j.no_reply === true) out.noReply = true;
    return out;
  } catch {
    return { confident: false, answer: "", clarify: "" };
  }
}

export function registerTeamHubAnswerRoute(app: Express) {
  // Clock-in / clock-out emails to the owner (built by the Daily Hub).
  app.post("/api/team-hub/notify", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const subject = String(req.body?.subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 150);
    const html = String(req.body?.html ?? "").slice(0, 60_000);
    if (!subject || !html) return res.status(400).json({ error: "subject and html required" });
    try {
      const sent = await sendEmail({ to: "sales@mechanicalenterprise.com", subject, html });
      return sent ? res.json({ ok: true }) : res.status(502).json({ error: "send failed" });
    } catch (e) {
      console.warn("[teamHub] notify failed", e);
      return res.status(502).json({ error: "send failed" });
    }
  });

  app.post("/api/team-hub/answer", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const question = String(req.body?.question ?? "").trim().slice(0, 2000);
    const guide = (String(req.body?.guide ?? "").slice(0, 78_000) + "\n\n" + HELPDESK);
    // chat: a message in the team chat (may be a statement, not a question).
    const chat = req.body?.mode === "chat";
    if (!question) return res.status(400).json({ error: "question required" });
    // Optional: who asked, so an unanswered question is emailed to the owner.
    const asker = req.body?.escalate && typeof req.body.escalate === "object"
      ? { name: String(req.body.escalate.name ?? "").slice(0, 80), source: String(req.body.escalate.source ?? "hub").slice(0, 20) }
      : null;
    const giveUp = async (clarify = "", noReply = false) => {
      if (asker && !noReply) await escalateToOwner(asker.name, asker.source, question);
      return res.json({ confident: false, answer: "", clarify, no_reply: noReply, escalated: !!asker && !noReply });
    };
    if (req.body?.escalate_only === true) return giveUp();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return giveUp();
    const r = await callAnthropicModelChain({
      apiKey,
      models: ["claude-sonnet-5", "claude-haiku-4-5"],
      system: `${SYSTEM}${chat ? CHAT_RULE : ""}\n\n<guide>\n${guide}\n</guide>`,
      messages: [{ role: "user", content: question }],
      maxTokens: 600,
    });
    if (!r.ok) {
      console.warn(JSON.stringify({ evt: "teamHub.answer.failed", code: r.code, status: r.status }));
      return giveUp();
    }
    const out = parseAnswer(r.text);
    if (!out.confident) return giveUp(out.clarify, chat && out.noReply);
    return res.json(out);
  });
}
