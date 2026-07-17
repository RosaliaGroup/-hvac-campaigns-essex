/**
 * AI VA inbound SMS handler tests. Verifies the Telnyx inbound webhook shape is
 * parsed into an smsConversations row and that the acknowledgement reply is
 * returned unchanged. The DB is mocked — no network, no DB.
 *
 * These assert the provider-layer swap (Twilio → Telnyx) preserved behavior:
 * one stored row per inbound message, same canned reply, no auto AI reply.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const createSmsConversationMock = vi.fn();
vi.mock("../db", () => ({
  createSmsConversation: (...args: unknown[]) => createSmsConversationMock(...args),
}));

import { handleIncomingSms } from "./aiVaSms";

const ACK =
  "Thanks for contacting Mechanical Enterprise! We'll respond shortly. For immediate assistance, call (862) 423-9396.";

function telnyxInbound(from: string, text: string, id = "msg_abc") {
  return {
    data: {
      id: "evt_1",
      event_type: "message.received",
      payload: { id, text, from: { phone_number: from } },
    },
  };
}

describe("handleIncomingSms (Telnyx inbound)", () => {
  beforeEach(() => {
    createSmsConversationMock.mockReset();
    createSmsConversationMock.mockResolvedValue(undefined);
  });

  it("stores an inbound Telnyx message and returns the acknowledgement reply", async () => {
    const reply = await handleIncomingSms(telnyxInbound("+19731234567", "Hi there", "msg_1"));
    expect(createSmsConversationMock).toHaveBeenCalledTimes(1);
    expect(createSmsConversationMock).toHaveBeenCalledWith({
      conversationId: "msg_1",
      phoneNumber: "+19731234567",
      direction: "inbound",
      message: "Hi there",
      status: "received",
    });
    expect(reply).toBe(ACK);
  });

  it("does not activate AI reply generation — reply is the fixed acknowledgement", async () => {
    const reply = await handleIncomingSms(telnyxInbound("+19731234567", "What are your hours?"));
    expect(reply).toBe(ACK);
  });

  it("ignores non-message events (e.g. delivery receipts) without storing", async () => {
    const reply = await handleIncomingSms({
      data: { id: "evt_2", event_type: "message.finalized", payload: { id: "m", text: "x", from: { phone_number: "+19731234567" } } },
    });
    expect(createSmsConversationMock).not.toHaveBeenCalled();
    expect(reply).toBe(ACK);
  });

  it("ignores inbound with missing phone or text without storing", async () => {
    await handleIncomingSms({ data: { event_type: "message.received", payload: { text: "no from" } } });
    await handleIncomingSms({ data: { event_type: "message.received", payload: { from: { phone_number: "+19731234567" } } } });
    expect(createSmsConversationMock).not.toHaveBeenCalled();
  });
});
