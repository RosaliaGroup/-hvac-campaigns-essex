/**
 * Automatic first answer for a team member's question in the Daily Hub.
 * POST /api/team-hub/answer   header x-hub-secret: TEAM_HUB_SECRET
 * body: { question, guide }   guide = the tutorials and tasks that person sees.
 * Answers ONLY from the guide; when the guide doesn't clearly answer it, says
 * so (confident:false) and the question waits for the team.
 */
import type { Express, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { callAnthropicModelChain } from "../_core/anthropic";

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
Reply with JSON only: {"confident": true|false, "answer": "..."} (answer is "" when not confident).`;

export function parseAnswer(text: string | undefined): { confident: boolean; answer: string } {
  const m = (text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return { confident: false, answer: "" };
  try {
    const j = JSON.parse(m[0]);
    const answer = typeof j.answer === "string" ? j.answer.trim().slice(0, 1500) : "";
    return { confident: j.confident === true && answer.length > 0, answer };
  } catch {
    return { confident: false, answer: "" };
  }
}

export function registerTeamHubAnswerRoute(app: Express) {
  app.post("/api/team-hub/answer", async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: "unauthorized" });
    const question = String(req.body?.question ?? "").trim().slice(0, 2000);
    const guide = String(req.body?.guide ?? "").slice(0, 80_000);
    if (!question) return res.status(400).json({ error: "question required" });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.json({ confident: false, answer: "" });
    const r = await callAnthropicModelChain({
      apiKey,
      models: ["claude-sonnet-5", "claude-haiku-4-5"],
      system: `${SYSTEM}\n\n<guide>\n${guide}\n</guide>`,
      messages: [{ role: "user", content: question }],
      maxTokens: 600,
    });
    if (!r.ok) {
      console.warn(JSON.stringify({ evt: "teamHub.answer.failed", code: r.code, status: r.status }));
      return res.json({ confident: false, answer: "" });
    }
    return res.json(parseAnswer(r.text));
  });
}
