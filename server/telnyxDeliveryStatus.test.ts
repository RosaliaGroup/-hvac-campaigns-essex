import { describe, expect, it } from "vitest";
import { mapTelnyxDeliveryStatus, parseTelnyxStatusEvent } from "./services/telnyxDeliveryStatus";

// Real-shaped payload from the 2026-07-06 incident (error 40010)
const FINALIZED_40010 = {
  data: {
    event_type: "message.finalized",
    payload: {
      id: "40319f39-17da-4392-98d9-e1d5d79ba7ad",
      direction: "outbound",
      to: [{ phone_number: "+12014239396", status: "delivery_failed" }],
      errors: [{ code: "40010", title: "Not 10DLC registered", detail: "The sending number is not 10DLC-registered but is required to be by the carrier." }],
      completed_at: "2026-07-06T20:21:33.214+00:00",
    },
  },
};

describe("telnyxDeliveryStatus — mapTelnyxDeliveryStatus", () => {
  it("maps delivered / sent / queued", () => {
    expect(mapTelnyxDeliveryStatus("delivered", null)).toBe("delivered");
    expect(mapTelnyxDeliveryStatus("sent", null)).toBe("sent");
    expect(mapTelnyxDeliveryStatus("queued", null)).toBe("accepted");
    expect(mapTelnyxDeliveryStatus("sending", null)).toBe("accepted");
  });
  it("classifies 40010 (Not 10DLC registered) as carrier_filtered", () => {
    expect(mapTelnyxDeliveryStatus("delivery_failed", "40010")).toBe("carrier_filtered");
  });
  it("classifies 403xx family as carrier_filtered", () => {
    expect(mapTelnyxDeliveryStatus("delivery_failed", "40300")).toBe("carrier_filtered");
    expect(mapTelnyxDeliveryStatus("delivery_failed", "40385")).toBe("carrier_filtered");
  });
  it("keeps non-filter failures as delivery_failed", () => {
    expect(mapTelnyxDeliveryStatus("delivery_failed", "40100")).toBe("delivery_failed");
    expect(mapTelnyxDeliveryStatus("delivery_failed", null)).toBe("delivery_failed");
  });
  it("maps sending_failed to rejected and unknown to null", () => {
    expect(mapTelnyxDeliveryStatus("sending_failed", null)).toBe("rejected");
    expect(mapTelnyxDeliveryStatus("weird_new_status", null)).toBeNull();
  });
});

describe("telnyxDeliveryStatus — parseTelnyxStatusEvent", () => {
  it("parses the real 40010 finalized event end-to-end", () => {
    const parsed = parseTelnyxStatusEvent(FINALIZED_40010);
    expect(parsed).not.toBeNull();
    expect(parsed!.telnyxMessageId).toBe("40319f39-17da-4392-98d9-e1d5d79ba7ad");
    expect(parsed!.deliveryStatus).toBe("carrier_filtered");
    expect(parsed!.errorCode).toBe("40010");
    expect(parsed!.errorMessage).toContain("Not 10DLC registered");
    expect(parsed!.completedAt?.toISOString()).toBe("2026-07-06T20:21:33.214Z");
  });
  it("parses a delivered finalized event", () => {
    const parsed = parseTelnyxStatusEvent({
      data: { event_type: "message.finalized", payload: { id: "abc", direction: "outbound", to: [{ status: "delivered" }], completed_at: "2026-07-06T20:00:00Z" } },
    });
    expect(parsed?.deliveryStatus).toBe("delivered");
    expect(parsed?.completedAt).not.toBeNull();
  });
  it("returns null for inbound message.received (falls through to reply handling)", () => {
    expect(parseTelnyxStatusEvent({
      data: { event_type: "message.received", payload: { id: "x", direction: "inbound", from: { phone_number: "+15550001111" }, text: "STOP" } },
    })).toBeNull();
  });
  it("returns null for legacy TextBelt format and garbage", () => {
    expect(parseTelnyxStatusEvent({ fromNumber: "+15550001111", text: "STOP" })).toBeNull();
    expect(parseTelnyxStatusEvent({})).toBeNull();
    expect(parseTelnyxStatusEvent(null)).toBeNull();
    expect(parseTelnyxStatusEvent("nonsense")).toBeNull();
  });
  it("returns null when the event has no message id or unknown status", () => {
    expect(parseTelnyxStatusEvent({ data: { event_type: "message.finalized", payload: { direction: "outbound", to: [{ status: "delivered" }] } } })).toBeNull();
    expect(parseTelnyxStatusEvent({ data: { event_type: "message.finalized", payload: { id: "x", direction: "outbound", to: [{ status: "brand_new_status" }] } } })).toBeNull();
  });
  it("handles numeric error codes", () => {
    const parsed = parseTelnyxStatusEvent({
      data: { event_type: "message.finalized", payload: { id: "y", direction: "outbound", to: [{ status: "delivery_failed" }], errors: [{ code: 40010, title: "Not 10DLC registered" }] } },
    });
    expect(parsed?.errorCode).toBe("40010");
    expect(parsed?.deliveryStatus).toBe("carrier_filtered");
  });
});
