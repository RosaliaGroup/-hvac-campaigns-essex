import { describe, expect, it } from "vitest";
import { evaluateFollowupDelivery, type FollowupDeliveryInput } from "./crmFollowupDeliveryPolicy";
const baseline: FollowupDeliveryInput = {
  enabled: true, authorizedRecipient: true, dueAt: new Date("2026-10-10T12:00:00Z"),
  now: new Date("2026-10-12T12:00:00Z"), kind: "email_review", status: "open",
  optedOut: false, bounced: false, hasInboundReply: false, hasHumanInteraction: false,
  hasLaterOutbound: false, hasVerifiedSend: false, gmailSendPermission: true, hasValidOwner: true,
};
describe("automatic CRM follow-up eligibility", () => {
  it("permits only a due, authorized, untouched email task", () => {
    expect(evaluateFollowupDelivery(baseline)).toEqual({ eligible: true, mode: "send_eligible" });
  });
  it.each([
    ["enabled", false], ["authorizedRecipient", false], ["optedOut", true],
    ["bounced", true], ["hasInboundReply", true], ["hasHumanInteraction", true],
    ["hasLaterOutbound", true], ["hasVerifiedSend", true], ["gmailSendPermission", false],
    ["hasValidOwner", false],
  ] as const)("blocks unsafe %s state", (key, value) => {
    expect(evaluateFollowupDelivery({ ...baseline, [key]: value }).eligible).toBe(false);
  });
  it("never auto-sends human tasks or future tasks", () => {
    expect(evaluateFollowupDelivery({ ...baseline, kind: "human" }).eligible).toBe(false);
    expect(evaluateFollowupDelivery({ ...baseline, dueAt: new Date("2026-10-20") }).eligible).toBe(false);
  });
});
