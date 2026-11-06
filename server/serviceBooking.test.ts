import { describe, expect, it } from "vitest";
import { cardFee, formatUsd, priceBreakdown, stripeFeeOn, totalFor } from "../shared/servicePricing";
import { bookingSchema, buildInstructions, buildQuickbooksVenmoSms, paymentConfig, paymentReference } from "./integrations/serviceBookingRoute";
import { buildServiceInvoiceBody } from "./integrations/accounting/quickbooks";

describe("service pricing", () => {
  it("card fee always covers Stripe's 2.9% + 30¢ on the whole charge", () => {
    for (const amt of [1, 49.99, 158.87, 318.81, 453.16, 693.06, 5000, 12345.67]) {
      const fee = cardFee(amt);
      expect(stripeFeeOn(amt + fee)).toBeLessThanOrEqual(fee);
      expect(fee - stripeFeeOn(amt + fee)).toBeLessThanOrEqual(0.02); // no meaningful overcharge
    }
    expect(cardFee(158.87)).toBe(5.06);
  });
  it("adds NJ sales tax to every method and the card fee only for cards", () => {
    expect(priceBreakdown("residential", false, "card")).toEqual({ base: 149, tax: 9.87, subtotal: 158.87, fee: 5.06, total: 163.93 });
    expect(totalFor("residential", false, "zelle")).toBe(158.87);
    expect(totalFor("commercial", true, "venmo")).toBe(693.06);
    expect(totalFor("commercial", true, "card")).toBe(714.07);
    expect(formatUsd(153.47)).toBe("$153.47");
    expect(formatUsd(149)).toBe("$149");
  });
});

describe("service booking route helpers", () => {
  it("defaults Zelle to info@ and hides Venmo until a handle is set", () => {
    expect(paymentConfig({} as NodeJS.ProcessEnv)).toEqual({ card: false, zelle: "info@mechanicalenterprise.com", venmo: null, venmoViaQuickbooks: true });
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
    expect(m.amount).toBe("$693.06");
    expect(m.sms).toContain("($650 + $43.06 NJ sales tax), send $693.06 by Zelle to info@mechanicalenterprise.com with memo ME-ABC123");
    expect(m.html).not.toContain("<b>Test");
  });
});

describe("Venmo via QuickBooks invoice", () => {
  it("builds a one-line emailed invoice with no card option and the base price", () => {
    const body = buildServiceInvoiceBody(
      { customerRef: "42", amount: 149, name: "Service Call", description: "Visit and diagnosis", email: "a@b.co", docNumber: "1050" },
      { value: "7", name: "HVAC Services" },
    ) as any;
    expect(body.CustomerRef).toEqual({ value: "42" });
    expect(body.Line).toHaveLength(1);
    expect(body.Line[0].Amount).toBe(149);
    expect(body.BillEmail).toEqual({ Address: "a@b.co" });
    expect(body.AllowOnlineCreditCardPayment).toBe(false);
    expect(body.DocNumber).toBe("1050");
    expect(body.Line[0].SalesItemLineDetail.TaxCodeRef).toBeUndefined();
    const taxed = buildServiceInvoiceBody(
      { customerRef: "42", amount: 149, name: "Service Call", description: "x", email: "a@b.co", taxable: true, shipToLine1: "12 Main St, Newark, NJ 07105" },
      { value: "14", name: "HVAC Residential Service Call / Repair" },
    ) as any;
    expect(taxed.Line[0].SalesItemLineDetail.TaxCodeRef).toEqual({ value: "TAX" });
    expect(taxed.ShipAddr).toMatchObject({ CountrySubDivisionCode: "NJ", PostalCode: "07105" });
  });
  it("texts the pay link, or points to the email when QuickBooks gives no link", () => {
    expect(buildQuickbooksVenmoSms("Ana Test", "Service Call", "$149", "https://pay.example/x")).toContain("choose Venmo or PayPal: https://pay.example/x");
    expect(buildQuickbooksVenmoSms("Ana Test", "Service Call", "$149", null)).toContain("We emailed your Service Call invoice ($149)");
  });
});
