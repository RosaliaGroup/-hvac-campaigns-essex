/**
 * Follow-up delivery eligibility policy. No Gmail API call or scheduler here.
 * Automatic delivery requires explicit recipient authorization and an enabled,
 * independently approved CRM sending lane; a prior cold email is not consent.
 */
export type FollowupDeliveryInput = {
  enabled: boolean;
  authorizedRecipient: boolean;
  dueAt: Date;
  now: Date;
  kind: "human" | "email_review";
  status: "open" | "done" | "cancelled";
  optedOut: boolean;
  bounced: boolean;
  hasInboundReply: boolean;
  hasHumanInteraction: boolean;
  hasLaterOutbound: boolean;
  hasVerifiedSend: boolean;
  gmailSendPermission: boolean;
  hasValidOwner: boolean;
};

export type FollowupDeliveryDecision =
  | { eligible: true; mode: "send_eligible" }
  | { eligible: false; reason: string };

export function evaluateFollowupDelivery(input: FollowupDeliveryInput): FollowupDeliveryDecision {
  if (!input.enabled) return { eligible: false, reason: "sending_lane_disabled" };
  if (!input.authorizedRecipient) return { eligible: false, reason: "recipient_authorization_missing" };
  if (input.kind !== "email_review") return { eligible: false, reason: "human_followup" };
  if (input.status !== "open") return { eligible: false, reason: "task_not_open" };
  if (!Number.isFinite(input.dueAt.getTime()) || !Number.isFinite(input.now.getTime()) ||
      input.dueAt > input.now) return { eligible: false, reason: "not_due" };
  if (input.optedOut || input.bounced) return { eligible: false, reason: "suppressed" };
  if (input.hasInboundReply || input.hasHumanInteraction) return { eligible: false, reason: "conversation_active" };
  if (input.hasLaterOutbound || input.hasVerifiedSend) return { eligible: false, reason: "already_contacted" };
  if (!input.gmailSendPermission) return { eligible: false, reason: "gmail_send_permission_missing" };
  if (!input.hasValidOwner) return { eligible: false, reason: "valid_owner_missing" };
  return { eligible: true, mode: "send_eligible" };
}
