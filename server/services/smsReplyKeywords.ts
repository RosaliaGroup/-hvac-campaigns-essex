/**
 * Inbound SMS keyword classification (10DLC compliance).
 *
 * Pure, side-effect-free helpers shared by the inbound webhook handler and its
 * tests. Keyword sets follow the CTIA / carrier standard reserved words:
 *   STOP family  → opt OUT   (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT)
 *   START family → opt IN     (START, UNSTOP, YES)
 *   HELP family  → help/info  (HELP, INFO)
 *
 * NOTE: Carriers (and Telnyx's messaging profile) auto-respond to STOP/START/
 * HELP at the network level. The application MUST NOT send its own automated
 * message to these, and MUST NOT send application messages to opted-out
 * numbers. This module only classifies; sending policy lives in the handler.
 */

export type InboundIntent = "stop" | "start" | "help" | "message";

const STOP_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "optout",
  "opt-out",
  "opt out",
  "remove",
]);

const START_KEYWORDS = new Set([
  "start",
  "unstop",
  "yes",
  "optin",
  "opt-in",
  "opt in",
  "resume",
]);

const HELP_KEYWORDS = new Set(["help", "info"]);

/**
 * Classify the first token / whole message of an inbound reply.
 * Matches on the trimmed, lower-cased message — carriers treat a keyword as
 * the entire message body (possibly with surrounding whitespace/punctuation).
 */
export function classifyInbound(text: string | null | undefined): InboundIntent {
  if (!text) return "message";
  // Normalize: trim, lowercase, strip trailing punctuation like "STOP." / "STOP!"
  const normalized = text.trim().toLowerCase().replace(/[.!?,]+$/g, "").trim();
  if (STOP_KEYWORDS.has(normalized)) return "stop";
  if (START_KEYWORDS.has(normalized)) return "start";
  if (HELP_KEYWORDS.has(normalized)) return "help";
  return "message";
}

export function isOptOutMessage(text: string): boolean {
  return classifyInbound(text) === "stop";
}
