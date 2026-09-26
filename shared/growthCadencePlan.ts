/**
 * Growth-system lead cadence plan (docs/growth-system-spec.md §1/§2) — the
 * generalized version of shared/followupLoop.ts's opportunity close-loop pattern,
 * applied to a NEW LEAD rather than an open opportunity.
 *
 * Pure, DB-free plan builder: given a lead's need + first name + `now`, returns the
 * ordered list of cadence steps (day offset, channel, due date, message body). All
 * message bodies are built ONLY from shared/verifiedFacts.ts (the fact firewall) —
 * no price, warranty term, or program figure is invented here. See
 * shared/growthCadencePlan.test.ts for the required snapshot coverage.
 *
 * Steps (spec §1.2/§2):
 *   Day 0:  SMS (speed-to-lead) + call attempt #1
 *   Day 1:  SMS — one value line chosen by need (warranty / membership / financing)
 *   Day 3:  call attempt #2 (+ voicemail script)
 *   Day 7:  email with the relevant page
 *   Day 14: SMS — "still want me to hold a spot?"
 *   Day 30: -> nurture (terminal; no message — see growth cadence engine)
 */
import { VERIFIED_FACTS } from "./verifiedFacts";
import { PHONE_DISPLAY } from "./business";

export type CadenceChannel = "sms" | "call" | "email";

/** Coarse need bucket used to pick the day-1 value line. Anything unrecognized falls
 *  back to "general" (a neutral line — never guesses at a specific offer). */
export type LeadNeed =
  | "repair" | "install" | "assessment" | "commercial" | "bid" | "coverage" | "membership" | "general";

export function normalizeLeadNeed(raw: string | null | undefined): LeadNeed {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("commercial") || v.includes("portfolio") || v.includes("multifamily")) return "commercial";
  if (v.includes("bid")) return "bid";
  if (v.includes("member")) return "membership";
  if (v.includes("warrant") || v.includes("coverage")) return "coverage";
  if (v.includes("install") || v.includes("replace")) return "install";
  if (v.includes("assess") || v.includes("estimate") || v.includes("quote")) return "assessment";
  if (v.includes("repair") || v.includes("service") || v.includes("maintenance")) return "repair";
  return "general";
}

/** True for a need that must route to the OWNER for a call-back instead of the
 *  standard residential cadence (spec §1.3/§1.5). */
export function isB2bNeed(need: LeadNeed): boolean {
  return need === "commercial" || need === "bid";
}

export const CADENCE_STEP_DAYS = [0, 1, 3, 7, 14, 30] as const;
export type CadenceStepDay = (typeof CADENCE_STEP_DAYS)[number];

/** Day-1 value line by need (spec §2: "warranty / membership / financing — chosen by need").
 *  Every figure comes from VERIFIED_FACTS; nothing here is invented. */
function valueLine(need: LeadNeed): string {
  const w = VERIFIED_FACTS.warranty;
  const m = VERIFIED_FACTS.membership;
  switch (need) {
    case "install":
    case "coverage":
      return `Quick note — new installs from us come with ${w.headline} (${w.covers}). Happy to walk you through it.`;
    case "membership":
      return `Quick note — our ${m.name} plan includes ${m.includes[0]} plus priority scheduling. Want the details?`;
    case "commercial":
      return `Quick note — we handle portfolio-wide HVAC service with a dedicated point of contact. Want me to send over how it works?`;
    case "bid":
      return `Quick note — happy to walk through our bid process whenever works for you.`;
    case "repair":
    case "assessment":
    default:
      return `Quick note — we can usually get a tech out fast, and if a new system ever makes sense we back it with ${w.headline}.`;
  }
}

/** The relevant page to link in the day-7 email, by need (spec §2). */
function relevantPage(need: LeadNeed): string {
  switch (need) {
    case "commercial":
    case "bid":
      return "/commercial";
    case "membership":
    case "coverage":
    case "install":
      return "/warranty";
    default:
      return "/warranty";
  }
}

export interface CadenceStepPlan {
  day: CadenceStepDay;
  channel: CadenceChannel;
  dueAt: Date;
  body: string | null; // null for day 0's call attempt (voice, no script text stored here)
  /** Day-3's call is attempt #2 and carries a voicemail script (spec §2/§9). */
  voicemail?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build every scheduled touch for one lead's cadence (day 0 through day 14; day 30
 * is the terminal "move to nurture" marker and carries no message — see
 * shared/growthCadencePlan.test.ts and the growth cadence engine for that transition).
 */
export function buildCadenceSteps(args: { firstName: string; need: LeadNeed; now: Date }): CadenceStepPlan[] {
  const { firstName, need, now } = args;
  const first = firstName?.trim() || "there";
  const needLabel = needDisplayLabel(need);

  const day0Sms =
    `Hi ${first}, this is Jessica from Mechanical Enterprise — got your request about ${needLabel}. ` +
    `Is now a good time for a quick call, or should I text you options? Reply STOP to opt out.`;
  const day0Voicemail =
    `Hi ${first}, this is Jessica from Mechanical Enterprise calling about your ${needLabel} request. ` +
    `Give us a call back at ${PHONE_DISPLAY} whenever works, or reply to my text — happy to help either way.`;
  const day1Sms = `${valueLine(need)} Reply STOP to opt out.`;
  const day3Voicemail =
    `Hi ${first}, following up again from Mechanical Enterprise on your ${needLabel} request — ` +
    `still happy to help whenever you're ready. Call us at ${PHONE_DISPLAY}.`;
  const day7EmailBody =
    `Hi ${first},<br><br>Following up on your ${needLabel} request. Here's more detail: ` +
    `<a href="https://mechanicalenterprise.com${relevantPage(need)}">mechanicalenterprise.com${relevantPage(need)}</a>.` +
    `<br><br>Reply any time or call ${PHONE_DISPLAY} — happy to help.`;
  const day14Sms = `Hi ${first}, still want me to hold a spot for your ${needLabel}? Just reply here. Reply STOP to opt out.`;

  return [
    { day: 0, channel: "sms", dueAt: new Date(now.getTime()), body: day0Sms },
    { day: 0, channel: "call", dueAt: new Date(now.getTime() + 2 * 60_000), body: null, voicemail: day0Voicemail },
    { day: 1, channel: "sms", dueAt: new Date(now.getTime() + 1 * DAY_MS), body: day1Sms },
    { day: 3, channel: "call", dueAt: new Date(now.getTime() + 3 * DAY_MS), body: null, voicemail: day3Voicemail },
    { day: 7, channel: "email", dueAt: new Date(now.getTime() + 7 * DAY_MS), body: day7EmailBody },
    { day: 14, channel: "sms", dueAt: new Date(now.getTime() + 14 * DAY_MS), body: day14Sms },
  ];
}

function needDisplayLabel(need: LeadNeed): string {
  switch (need) {
    case "repair": return "your repair";
    case "install": return "a new install";
    case "assessment": return "an assessment";
    case "commercial": return "your commercial property";
    case "bid": return "your bid";
    case "coverage": return "system coverage";
    case "membership": return "a membership plan";
    default: return "your service request";
  }
}

/** Day the cadence moves to the terminal "nurture" state (spec §2). */
export const NURTURE_DAY = 30;
