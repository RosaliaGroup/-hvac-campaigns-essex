import { describe, it, expect } from "vitest";
import { outboundSenderBadge } from "./smsSenderBadge";

describe("outboundSenderBadge", () => {
  it("labels AI-VA messages 'AI Assistant'", () => {
    expect(outboundSenderBadge("ai_va", "AI Assistant").label).toBe("AI Assistant");
  });
  it("labels human dashboard replies 'Human'", () => {
    expect(outboundSenderBadge("inbox_reply", "Team").label).toBe("Human");
  });
  it("labels campaign + scheduled sends 'Campaign'", () => {
    expect(outboundSenderBadge("campaign", "Campaign").label).toBe("Campaign");
    expect(outboundSenderBadge("scheduled", "Campaign").label).toBe("Campaign");
  });
  it("labels appointment/rebate as 'Auto'", () => {
    expect(outboundSenderBadge("appointment", "Appointment").label).toBe("Auto");
  });
  it("falls back to sentByName (then 'Team') for unknown/legacy source", () => {
    expect(outboundSenderBadge(null, "Dispatcher Jane").label).toBe("Dispatcher Jane");
    expect(outboundSenderBadge(undefined, null).label).toBe("Team");
  });
});
