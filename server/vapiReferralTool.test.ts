/**
 * Vapi tool wiring for `sendReferralLink`.
 *
 * Confirms the tool name is routed through handleVapiToolCalls and that each
 * outcome maps to the preserved Vapi response contract
 * ({ results: [{ toolCallId, result }] }, result = JSON string with
 * success + message/error) without leaking provider internals.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReferralSendResult } from "./services/referralSms";

// Mock the referral service so the wiring test needs no DB or network.
vi.mock("./services/referralSms", () => ({
  sendCustomerReferralLink: vi.fn(),
}));

import { handleVapiToolCalls } from "./integrations/vapiTools";
import { sendCustomerReferralLink } from "./services/referralSms";

const mockedSend = vi.mocked(sendCustomerReferralLink);

function callTool(name: string, args: Record<string, unknown>, callId = "call_1") {
  return handleVapiToolCalls({
    message: {
      type: "tool-calls",
      toolCallList: [
        { id: "tc_1", type: "function", function: { name, arguments: JSON.stringify(args) } },
      ],
      call: { id: callId },
    },
  });
}

function parseResult(r: { results: Array<{ toolCallId: string; result: string }> }) {
  return { toolCallId: r.results[0].toolCallId, body: JSON.parse(r.results[0].result) };
}

beforeEach(() => {
  mockedSend.mockReset();
});

describe("sendReferralLink Vapi tool", () => {
  it("routes the tool and returns success on a valid send", async () => {
    mockedSend.mockResolvedValue({ status: "sent", phone: "+19735550142" } as ReferralSendResult);
    const { toolCallId, body } = parseResult(await callTool("sendReferralLink", { phone: "9735550142", first_name: "Dana" }));

    expect(mockedSend).toHaveBeenCalledWith({ phone: "9735550142", firstName: "Dana" });
    expect(toolCallId).toBe("tc_1"); // contract: echoes the tool call id
    expect(body.success).toBe(true);
    expect(body.message).toContain("$500");
  });

  it("reports idempotent success on a duplicate/retry", async () => {
    mockedSend.mockResolvedValue({ status: "duplicate", phone: "+19735550142" } as ReferralSendResult);
    const { body } = parseResult(await callTool("sendReferralLink", { phone: "9735550142" }));
    expect(body.success).toBe(true);
  });

  it("reports failure (not success) for an opted-out number", async () => {
    mockedSend.mockResolvedValue({ status: "opted_out", phone: "+19735550142" } as ReferralSendResult);
    const { body } = parseResult(await callTool("sendReferralLink", { phone: "9735550142" }));
    expect(body.success).toBe(false);
    expect(body.error.toLowerCase()).toContain("opted out");
  });

  it("returns a generic, provider-safe error on send failure", async () => {
    mockedSend.mockResolvedValue({ status: "send_failed", phone: "+19735550142" } as ReferralSendResult);
    const { body } = parseResult(await callTool("sendReferralLink", { phone: "9735550142" }));
    expect(body.success).toBe(false);
    // No provider name / credential / status code leaks into the caller-facing error.
    expect(body.error).not.toMatch(/telnyx|api|key|token|500|http/i);
  });

  it("validates missing phone before calling the service", async () => {
    const { body } = parseResult(await callTool("sendReferralLink", {}));
    expect(body.success).toBe(false);
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
