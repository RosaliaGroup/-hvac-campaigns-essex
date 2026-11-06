import { describe, expect, it } from "vitest";
import { cardFee, formatUsd, totalFor } from "../shared/servicePricing";
import { bookingSchema, buildInstructions, paymentConfig, paymentReference } from "./integrations/serviceBookingRoute";

describe("service pricing", () => {
  it("adds a 3% card fee, never above Stripe's 2.9% + 30¢", () => {
    expect(cardFee(149)).toBe(4.47);
    expect(cardFee(299)).toBe(8.97);
    expect(cardFee(425)).toBe(12.75);
    expect(cardFee(650)).toBe(19.5);
    // Large amounts: Stripe's real cost is below 3%, so the fee is capped at that cost.
    expect(cardFee(5000)).toBeLessThan(150);
  });
  it("charges the card fee only for cards", () => {
    expect(totalFor("residential", false, "card")).toBe(153.47);
    expect(totalFor("residential", false, "zelle")).toBe(149);
    expect(totalFor("commercial", true, "venmo")).toBe(650);
    expect(formatUsd(153.47)).toBe("$153.47");
    expect(formatUsd(149)).toBe("$149");
  });
});

describe("service booking route helpers", () => {
  it("defaults Zelle to info@ and hides Venmo until a handle is set", () => {
    expect(paymentConfig({} as NodeJS.ProcessEnv)).toEqual({ card: false, zelle: "info@mechanicalenterprise.com", venmo: null });
    expect(paymentConfig({ VENMO_HANDLE: "Mech-Ent", STRIPE_SECRET_KEY: "sk" } as NodeJS.ProcessEnv).venmo).toBe("@Mech-Ent");
  });
  it("validates input and rejects the honeypot", () => {
    const ok = { name: "Ana Test", phone: "(862) 555-0100", email: "a@b.co", category: "residential", emergency: false, paymentMethod: "zelle" };
    expect(bookingSchema.safeParse(ok).success).toBe(true);
    expect(bookingSchema.safeParse({ ...ok, phone: "123" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, website: "spam" }).success).toBe(false);
  });
  it("builds Zelle instructions with the base price (no card fee) and the reference", () => {
    const ref = paymentReference(() => "abc123");
    expect(ref).toBe("ME-ABC123");
    const m = buildInstructions({ name: "Ana <b>Test</b>", category: "commercial", emergency: true }, "zelle", "info@mechanicalenterprise.com", ref);
    expect(m.amount).toBe("$650");
    expect(m.sms).toContain("send $650 by Zelle to info@mechanicalenterprise.com with memo ME-ABC123");
    expect(m.html).not.toContain("<b>Test");
  });
});
