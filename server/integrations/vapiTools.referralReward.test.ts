import { describe, it, expect, vi } from "vitest";

vi.mock("../services/referralSms", () => ({
  sendCustomerReferralLink: vi.fn(async () => ({ status: "sent" })),
}));
vi.mock("./callerInfo", () => ({ lookupCallerInfo: vi.fn() }));
vi.mock("../services/rescheduleAppointment", () => ({ rescheduleForVapi: vi.fn() }));
vi.mock("./vapiBookHvac", () => ({ handleBookHVAC: vi.fn() }));

import { handleVapiToolCalls } from "./vapiTools";

describe("sendReferralLink spoken reply", () => {
  it("states the owner-attested $500 reward", async () => {
    const res = await handleVapiToolCalls({
      message: { toolCallList: [{ id: "t1", function: { name: "sendReferralLink", arguments: JSON.stringify({ phone: "+12015550123" }) } }] },
    } as any);
    const out = JSON.parse(res.results[0].result);
    expect(out.success).toBe(true);
    expect(out.message).toContain("you earn $500 when they book");
  });
});
