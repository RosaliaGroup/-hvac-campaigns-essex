/**
 * Sender badge for an outbound SMS bubble, so staff can tell at a glance whether
 * a message was sent by the AI Assistant, a human dispatcher, or a campaign.
 * Keyed on the row's `source` (set by the outbound logging helper), with
 * `sentByName` as a fallback for legacy/unknown rows.
 */
export interface SenderBadge {
  label: string;
  /** Tailwind classes for the chip. */
  cls: string;
}

export function outboundSenderBadge(
  source?: string | null,
  sentByName?: string | null,
): SenderBadge {
  switch (source) {
    case "ai_va":
      return { label: "AI Assistant", cls: "bg-purple-100 text-purple-700" };
    case "inbox_reply":
      return { label: "Human", cls: "bg-blue-100 text-blue-700" };
    case "campaign":
    case "scheduled":
      return { label: "Campaign", cls: "bg-amber-100 text-amber-700" };
    case "appointment":
    case "rebate":
      return { label: "Auto", cls: "bg-gray-100 text-gray-600" };
    default:
      return { label: sentByName?.trim() || "Team", cls: "bg-gray-100 text-gray-600" };
  }
}
