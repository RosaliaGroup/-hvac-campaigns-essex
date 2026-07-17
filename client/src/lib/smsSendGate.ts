/**
 * Pure decision logic for the SMS Campaign Manager "Send" action.
 *
 * Extracted so the send-gate rules are unit-testable without a DOM: the UI must
 * NEVER fire a network request (and therefore never reach Telnyx) for a blocked
 * case, and must explain WHY instead of silently doing nothing.
 *
 * This changes no send routing — the Manager still uses the bulk send path; a
 * single selected contact simply yields a one-recipient list. It also cannot
 * "leak" to non-selected contacts: for target "selected" only explicitly
 * selected ids are ever returned.
 */

export interface GateContact {
  id: number;
  optedOut: boolean;
}

export type SendGateBlockReason =
  | "empty_message"
  | "no_recipients"
  | "all_opted_out";

export type SendGateResult =
  | { ok: true; contactIds: number[] }
  | { ok: false; reason: SendGateBlockReason; message: string };

export const SEND_GATE_MESSAGES: Record<SendGateBlockReason, string> = {
  empty_message: "Enter a message before sending.",
  no_recipients:
    "This number is not in SMS Contacts. Add or import the contact before sending.",
  all_opted_out: "Selected contact(s) have opted out and can't be messaged.",
};

/**
 * Decide whether a Manager send should proceed and to which contact ids.
 *
 * @param target            "selected" (only checked contacts) or "all" (active list)
 * @param message           the message text as typed
 * @param selectedContactIds ids the user explicitly checked (for target "selected")
 * @param contacts          the currently loaded contact list (id + opt-out state)
 */
export function evaluateBulkSend(params: {
  target: "selected" | "all";
  message: string;
  selectedContactIds: number[];
  contacts: GateContact[];
}): SendGateResult {
  const { target, message, selectedContactIds, contacts } = params;

  if (!message || !message.trim()) {
    return { ok: false, reason: "empty_message", message: SEND_GATE_MESSAGES.empty_message };
  }

  const byId = new Map(contacts.map((c) => [c.id, c]));

  // Requested ids: for "selected" ONLY the explicitly selected ids (never the
  // wider filtered/active list) — a single selection can never leak to others.
  const requestedIds =
    target === "all" ? contacts.filter((c) => !c.optedOut).map((c) => c.id) : [...selectedContactIds];

  // Eligible = present in the loaded contacts AND not opted out.
  const eligibleIds = requestedIds.filter((id) => {
    const c = byId.get(id);
    return !!c && !c.optedOut;
  });

  if (eligibleIds.length === 0) {
    // Distinguish "every requested contact is opted out" from "no usable
    // recipient exists (missing / none selected)".
    const anyRequested = requestedIds.length > 0;
    const allOptedOut = anyRequested && requestedIds.every((id) => byId.get(id)?.optedOut === true);
    const reason: SendGateBlockReason = allOptedOut ? "all_opted_out" : "no_recipients";
    return { ok: false, reason, message: SEND_GATE_MESSAGES[reason] };
  }

  return { ok: true, contactIds: eligibleIds };
}
