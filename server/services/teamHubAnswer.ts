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

const SYSTEM = `You answer questions from a new team member (call setter or outreach rep) using ONLY the guide below: their tutorials and their task list.

Rules:
- If the guide clearly answers the question, give a short, plain-English answer (2-4 sentences), say what to do, and name the tutorial or task it comes from.
- If the guide does not clearly answer it, or the question is about pay, hours, contracts, personal matters, prices or policies not in the guide, or needs a judgment call by the owner, do NOT guess: set confident to false.
- If two parts of the guide disagree, set confident to false.
- Never invent prices, promises, phone numbers, people or steps.
- If the question is too vague to act on (e.g. "some pages don't work", "I can't log in", "it's not working" without saying which page, account or task, or what error they see), set confident to false and put in "clarify" one short, friendly reply asking for exactly what's missing: which page/account/task (name or link) and what happens when they try (the exact error or what they see). Otherwise "clarify" is "".
Reply with JSON only: {"confident": true|false, "answer": "...", "clarify": "..."} (answer is "" when not confident).`;

export function parseAnswer(text: string | undefined): { confident: boolean; answer: string; clarify: string } {
  const m = (text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return { confident: false, answer: "", clarify: "" };
  try {
    const j = JSON.parse(m[0]);
    const answer = typeof j.answer === "string" ? j.answer.trim().slice(0, 1500) : "";
    const clarify = typeof j.clarify === "string" ? j.clarify.trim().slice(0, 800) : "";
    const confident = j.confident === true && answer.length > 0;
    return { confident, answer: confident ? answer : "", clarify: confident ? "" : clarify };
  } catch {
    return { confident: false, answer: "", clarify: "" };
  }
}

export function registerTeamHubAnswerRoute(app: Express) {
  app.post("/api/team-hub/answer", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const question = String(req.body?.question ?? "").trim().slice(0, 2000);
    const guide = String(req.body?.guide ?? "").slice(0, 80_000);
    if (!question) return res.status(400).json({ error: "question required" });
    // Optional: who asked, so an unanswered question is emailed to the owner.
    const asker = req.body?.escalate && typeof req.body.escalate === "object"
      ? { name: String(req.body.escalate.name ?? "").slice(0, 80), source: String(req.body.escalate.source ?? "hub").slice(0, 20) }
      : null;
    const giveUp = async (clarify = "") => {
      if (asker) await escalateToOwner(asker.name, asker.source, question);
      return res.json({ confident: false, answer: "", clarify, escalated: !!asker });
    };
    if (req.body?.escalate_only === true) return giveUp();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return giveUp();
    const r = await callAnthropicModelChain({
      apiKey,
      models: ["claude-sonnet-5", "claude-haiku-4-5"],
      system: `${SYSTEM}\n\n<guide>\n${guide}\n</guide>`,
      messages: [{ role: "user", content: question }],
      maxTokens: 600,
    });
    if (!r.ok) {
      console.warn(JSON.stringify({ evt: "teamHub.answer.failed", code: r.code, status: r.status }));
      return giveUp();
    }
    const out = parseAnswer(r.text);
    if (!out.confident) return giveUp(out.clarify);
    return res.json(out);
  });
}
