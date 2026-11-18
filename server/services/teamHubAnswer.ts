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


const ROLEPLAY_SCENARIOS: Record<string, string> = {
  pm: `You are Linda Torres, property manager for 3 garden-style apartment buildings in Bloomfield, NJ (48 units total). The buildings have gas boilers about 20 years old; tenants complained about heat last winter and you had two emergency repair calls. You already use a small local HVAC contractor for repairs. Big spending decisions need the building owner, Mr. Feld. You are busy and a little guarded, but fair. If the rep is professional, asks good questions and makes it easy, you agree to a walkthrough.
Objections to raise naturally, roughly in this order and only one per reply: (1) "I'm busy, what is this about?" (2) "We already have an HVAC guy." (3) "Can you just send me a price?" (4) "I'd have to run it by the owner." Only after they handle these well, ask "OK, when could someone come look?"
If the rep quotes a price or a number, push on it ("So it's that much?") and become more skeptical. If they badmouth your current contractor, get colder. If they ask good discovery questions (number of buildings, units, equipment type, age, problems, who decides, timeline), answer them with the facts above.`,
  owner: `You are Raj Patel, owner of a 2-story office building in Kearny, NJ with 3 rooftop units about 18 years old. One unit shut off twice on hot days last summer. You worry about cost and disruption to tenants, and you decide together with your business partner. You are friendly but short on time.
Objections, one per reply: (1) "How did you get my number?" (2) "Is it going to cost me a fortune?" (3) "Can't you just repair them?" (4) "My partner has to agree." Only after they handle these well, ask when someone can come look.`,
};
const ROLEPLAY_RULES = `
This is a sales training role-play for an appointment setter at Mechanical Enterprise, a licensed HVAC contractor in Newark, NJ that sells replacements, new installations and maintenance contracts. You play ONLY the prospect, on a phone call. Rules:
- Reply in 1 to 3 short spoken sentences, like a real person on the phone. No narration, no stage directions, no lists.
- Stay in character. Never coach, never mention that this is a role-play or that you are an AI.
- Raise the objections as described, one at a time, and react realistically to what the rep actually says.
- When the rep has booked a specific day and time with you and confirmed it, say a short goodbye and end your message with [CALL ENDED].
- If the rep is rude, pushy, or keeps quoting prices, end the call politely and end your message with [CALL ENDED].`;
const ROLEPLAY_GRADER = `You are a sales coach scoring an appointment-setter's practice call for Mechanical Enterprise (HVAC replacements, installs and maintenance contracts in New Jersey). The rep must NOT quote prices or diagnose equipment; the walkthrough or assessment produces the proposal.
Score 0-10 on each: opening (name, company, reason within 15 seconds), discovery (buildings/units, equipment, age, problems, decision maker, timeline), objections (handled each one calmly, no criticizing other contractors), rules (no prices, no diagnoses, no promises), booking (specific day and time from two options, repeated back, email confirmation offered, decision maker included), language (clear, professional English).
Reply with ONLY JSON: {"scores":{"opening":n,"discovery":n,"objections":n,"rules":n,"booking":n,"language":n},"total":n,"strengths":["..."],"improve":["..."],"booked":true|false}. total is the sum (max 60). Give 2-3 strengths and 2-3 specific improvements, each one short sentence quoting or pointing to what the rep said.`;

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
  /**
   * Practice call with an AI prospect.
   * POST /api/team-hub/roleplay  { name, scenario: "pm"|"owner", history: [{role:"rep"|"prospect", text}], finish? }
   * Returns { reply, ended } or, with finish, { scorecard } and emails the owner the transcript and score.
   */
  app.post("/api/team-hub/roleplay", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "unavailable" });
    const scenarioId = req.body?.scenario === "owner" ? "owner" : "pm";
    const name = String(req.body?.name ?? "A setter").slice(0, 80);
    const hist = (Array.isArray(req.body?.history) ? req.body.history : []).slice(-40)
      .map((m: any) => ({ role: m?.role === "prospect" ? "prospect" : "rep", text: String(m?.text ?? "").slice(0, 1200) }))
      .filter((m: any) => m.text.trim());
    const transcript = hist.map((m: any) => `${m.role === "rep" ? name : "Prospect"}: ${m.text}`).join("\n");
    if (req.body?.finish === true) {
      if (hist.filter((m: any) => m.role === "rep").length < 2) return res.status(400).json({ error: "too short" });
      const r = await callAnthropicModelChain({ apiKey, models: ["claude-sonnet-5", "claude-haiku-4-5"], system: ROLEPLAY_GRADER,
        messages: [{ role: "user", content: `Transcript:\n${transcript}` }], maxTokens: 700 });
      if (!r.ok) return res.status(502).json({ error: "grading failed" });
      let card: any = null;
      try { card = JSON.parse((r.text ?? "").slice((r.text ?? "").indexOf("{"), (r.text ?? "").lastIndexOf("}") + 1)); } catch { /* keep null */ }
      if (!card) return res.status(502).json({ error: "grading failed" });
      const rows = Object.entries(card.scores ?? {}).map(([k, v]) => `<tr><td style="padding:2px 10px 2px 0">${esc(k)}</td><td><b>${esc(String(v))}</b>/10</td></tr>`).join("");
      await sendEmail({
        to: "sales@mechanicalenterprise.com",
        subject: `Role-play: ${name} scored ${card.total}/60${card.booked ? " · booked" : ""}`.slice(0, 150),
        html: `<p style="font-family:Arial,sans-serif"><b>${esc(name)}</b> finished a practice call with the AI prospect (${scenarioId === "pm" ? "property manager" : "building owner"}).</p>`
          + `<table style="font-family:Arial,sans-serif;font-size:14px">${rows}</table>`
          + `<p style="font-family:Arial,sans-serif"><b>Strengths:</b><br>${(card.strengths ?? []).map((x: string) => "• " + esc(x)).join("<br>")}</p>`
          + `<p style="font-family:Arial,sans-serif"><b>To improve:</b><br>${(card.improve ?? []).map((x: string) => "• " + esc(x)).join("<br>")}</p>`
          + `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px;background:#f5f5f5;padding:10px">${esc(transcript)}</pre>`,
      }).catch((e) => console.warn("[teamHub] roleplay email failed", e));
      return res.json({ scorecard: card });
    }
    const messages = hist.length && hist[0].role === "prospect" ? [{ role: "user", content: "(The phone rings and you answer.)" }] : [];
    for (const m of hist) messages.push({ role: m.role === "rep" ? "user" : "assistant", content: m.text });
    if (!messages.length || messages[messages.length - 1].role !== "user") messages.push({ role: "user", content: "(The phone rings and you answer.)" });
    const r = await callAnthropicModelChain({ apiKey, models: ["claude-sonnet-5", "claude-haiku-4-5"],
      system: ROLEPLAY_SCENARIOS[scenarioId] + "\n" + ROLEPLAY_RULES, messages, maxTokens: 200 });
    if (!r.ok) return res.status(502).json({ error: "unavailable" });
    const text = (r.text ?? "").trim();
    const ended = text.includes("[CALL ENDED]");
    return res.json({ reply: text.replace("[CALL ENDED]", "").trim(), ended });
  });

}
