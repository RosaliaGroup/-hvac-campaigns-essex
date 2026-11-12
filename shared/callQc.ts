/**
 * Per-call quality control (QC) for recorded sales calls.
 *
 * Every recorded call a rep makes (browser dialer, PC softphone or the older
 * ring-my-mobile click-to-call) is transcribed and scored against the rep
 * playbook. This file holds the pure parts — the rubric, the prompt and the
 * parser — so they can be unit-tested; the I/O lives in server/services/callQc.ts.
 *
 * The rubric mirrors the owner's standing rules (claude/standing-rules.md):
 * installs/replacements only, no prices, no residential rebates/tax credits/OBR,
 * no 24/7 or same-day promises, no diagnoses, no competitor names, only the
 * public numbers (862) 419-1763 and (551) 600-7027, honor do-not-call requests.
 */

export const QC_CRITERIA = [
  { key: "opening", label: "Opening", max: 10, guide: "Uses the customer's name, says her name and 'Mechanical Enterprise', states why she is calling." },
  { key: "discovery", label: "Discovery questions", max: 20, guide: "Asks what to replace/install, system age, what's going on, timing, homeowner/decision maker, ZIP/area, email — or for commercial: property type, units, equipment, age, contract, timeline, decision maker." },
  { key: "listening", label: "Listening and tone", max: 10, guide: "Lets the customer talk, doesn't interrupt, friendly and professional, clear English, no pressure." },
  { key: "objections", label: "Objection handling", max: 15, guide: "Handles price/ballpark, other quotes, spouse, rebates, repair-only, out-of-area the playbook way (no number, explains free assessment, offers a time with both decision makers, etc.). Full marks if no objection came up." },
  { key: "nextStep", label: "Next step", max: 20, guide: "Offers two specific in-hours times (Mon–Fri 9–6 ET) for a free in-home assessment/walkthrough and books one, or sets a clear follow-up. Voicemail: short, name + company + reason + 862-419-1763 said twice." },
  { key: "confirmation", label: "Confirmation", max: 10, guide: "Confirms day, time, address and email, says a confirmation will be sent." },
  { key: "compliance", label: "Rules and compliance", max: 15, guide: "No prices or ranges, no residential rebates/incentives/tax credits/$16,000/On-Bill Repayment, no 24/7 or same-day promise, no diagnosis or 'it will last', no competitor names, no personal phone numbers, honors 'don't call me' immediately, no invented facts. Any violation scores 0 here and adds a flag." },
] as const;

export type QcCriterionKey = (typeof QC_CRITERIA)[number]["key"];

export const QC_FLAG_CODES = [
  "price_quoted",
  "rebate_mentioned",
  "after_hours_promise",
  "diagnosis_given",
  "competitor_named",
  "personal_number_shared",
  "dnc_not_honored",
  "repair_booked",
  "out_of_area_booked",
  "rude_or_pushy",
  "invented_fact",
  "no_next_step",
] as const;
export type QcFlagCode = (typeof QC_FLAG_CODES)[number];

/** Flags that make a call fail QC regardless of score. */
export const QC_RED_FLAGS: ReadonlySet<QcFlagCode> = new Set<QcFlagCode>([
  "price_quoted",
  "rebate_mentioned",
  "after_hours_promise",
  "diagnosis_given",
  "competitor_named",
  "personal_number_shared",
  "dnc_not_honored",
  "invented_fact",
]);

export const QC_OUTCOMES = [
  "booked",
  "follow_up_set",
  "not_interested",
  "voicemail",
  "no_conversation",
  "wrong_number",
  "do_not_call",
  "other",
] as const;
export type QcOutcome = (typeof QC_OUTCOMES)[number];

export type QcVerdict = "pass" | "coach" | "fail" | "not_scored";

export interface QcScore {
  key: QcCriterionKey;
  label: string;
  score: number;
  max: number;
  note: string;
}

export interface QcFlag {
  code: QcFlagCode;
  quote: string;
}

export interface CallQcReview {
  /** 0–100, sum of criterion scores (null when the call wasn't a scorable conversation). */
  score: number | null;
  verdict: QcVerdict;
  outcome: QcOutcome;
  appointmentBooked: boolean;
  summary: string;
  scores: QcScore[];
  flags: QcFlag[];
  strengths: string[];
  coaching: string[];
}

/** Pass at 80+, coach at 60–79, fail below 60 or with any red flag. */
export function verdictFor(score: number | null, flags: QcFlag[]): QcVerdict {
  if (score === null) return "not_scored";
  if (flags.some((f) => QC_RED_FLAGS.has(f.code))) return "fail";
  if (score >= 80) return "pass";
  if (score >= 60) return "coach";
  return "fail";
}

export const QC_SYSTEM_PROMPT = `You review recorded sales calls for Mechanical Enterprise LLC, a heating and cooling INSTALLATION company in Newark, New Jersey. The rep calls leads who asked to be contacted, learns what they need and books a free in-home (or on-site) assessment. The technicians and the owner give advice, prices and decisions — never the rep.

What the company sells: installation and replacement of heat pumps, central AC, mini-splits/ductless, furnaces, boilers, ductwork, rooftop units/VRV/VRF; maintenance contracts for property managers. Free assessment with load calculation, written quote afterwards, optional 10-year parts and labor coverage. NJ only, about 25–30 miles around Newark. Hours Mon–Fri 9 AM–6 PM Eastern. Public numbers: (862) 419-1763 (calls) and (551) 600-7027 (texts). Commercial businesses may be told a utility program can cover part of the cost (never promised); residential customers must never hear about rebates, incentives or tax credits.

The transcript comes from a two-channel recording. Lines are labelled by channel; work out which channel is the rep (the one who introduces herself as calling from Mechanical Enterprise). Transcription can contain small errors — judge intent, don't punish garbled words.

Score each criterion (integer from 0 to its max):
${QC_CRITERIA.map((c) => `- ${c.key} (max ${c.max}): ${c.guide}`).join("\n")}

Flag codes (only when it clearly happened; quote the rep's words): ${QC_FLAG_CODES.join(", ")}.

Outcome: one of ${QC_OUTCOMES.join(", ")}. If no real conversation happened (nobody answered, a few seconds of silence, an IVR) use "no_conversation" and set "scorable": false. A voicemail the rep left IS scorable: score opening, nextStep (the voicemail itself) and compliance; give the other criteria full marks.

Reply with ONLY a JSON object, no prose, in this shape:
{"scorable": true, "outcome": "booked", "appointmentBooked": true, "summary": "2–3 sentences: who, what they need, what happened", "scores": {"opening": {"score": 8, "note": "short reason"}, ...every criterion...}, "flags": [{"code": "price_quoted", "quote": "exact rep words"}], "strengths": ["up to 3 short points"], "coaching": ["up to 3 specific, kind, actionable tips"]}`;

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function shortText(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function textList(v: unknown, maxItems = 3): string[] {
  return Array.isArray(v) ? v.map((x) => shortText(x, 300)).filter(Boolean).slice(0, maxItems) : [];
}

/**
 * Parse and normalize the model's reply. Never throws: an unparseable reply
 * returns null so the caller records the review as failed.
 */
export function parseQcResponse(raw: string): CallQcReview | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let j: any;
  try {
    j = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;

  const outcome: QcOutcome = (QC_OUTCOMES as readonly string[]).includes(j.outcome) ? j.outcome : "other";
  const flags: QcFlag[] = (Array.isArray(j.flags) ? j.flags : [])
    .filter((f: any) => (QC_FLAG_CODES as readonly string[]).includes(f?.code))
    .map((f: any) => ({ code: f.code as QcFlagCode, quote: shortText(f.quote, 300) }))
    .slice(0, 10);

  const scorable = j.scorable !== false && outcome !== "no_conversation" && outcome !== "wrong_number";
  const scores: QcScore[] = QC_CRITERIA.map((c) => {
    const s = j.scores?.[c.key];
    return {
      key: c.key,
      label: c.label,
      max: c.max,
      score: scorable ? clampInt(s?.score ?? s, 0, c.max) : 0,
      note: shortText(s?.note, 300),
    };
  });
  // Any compliance flag means the compliance criterion can't score.
  if (flags.some((f) => QC_RED_FLAGS.has(f.code))) {
    const comp = scores.find((s) => s.key === "compliance");
    if (comp) comp.score = 0;
  }
  const score = scorable ? scores.reduce((sum, s) => sum + s.score, 0) : null;

  return {
    score,
    verdict: verdictFor(score, flags),
    outcome,
    appointmentBooked: Boolean(j.appointmentBooked),
    summary: shortText(j.summary, 800),
    scores,
    flags,
    strengths: textList(j.strengths),
    coaching: textList(j.coaching),
  };
}

export const QC_VERDICT_LABEL: Record<QcVerdict, string> = {
  pass: "Pass",
  coach: "Needs coaching",
  fail: "Fail",
  not_scored: "Not scored",
};

export const QC_FLAG_LABEL: Record<QcFlagCode, string> = {
  price_quoted: "Gave a price",
  rebate_mentioned: "Mentioned rebates/incentives",
  after_hours_promise: "Promised 24/7 or same-day",
  diagnosis_given: "Diagnosed the equipment",
  competitor_named: "Named a competitor",
  personal_number_shared: "Shared a personal number",
  dnc_not_honored: "Ignored a do-not-call request",
  repair_booked: "Booked repair-only work",
  out_of_area_booked: "Booked outside the service area",
  rude_or_pushy: "Rude or pushy",
  invented_fact: "Made something up",
  no_next_step: "No next step set",
};

/** Minimum call length (seconds) worth sending to transcription. */
export const QC_MIN_SECONDS = 15;
