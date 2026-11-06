/**
 * Website chat service-call payments (public, unauthenticated).
 *
 *   GET  /api/service-booking/options  → which payment methods are on
 *   POST /api/service-booking          → card: Stripe Checkout URL for the
 *                                        price + card fee; zelle/venmo: texts and
 *                                        emails the customer payment instructions.
 *
 * Amounts always come from shared/servicePricing — never from the request.
 * The office still gets the booking details from the chat's call recap.
 */

import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  ZELLE_DEFAULT_RECIPIENT,
  cardFee,
  formatUsd,
  servicePrice,
  type ServiceCategory,
  type ServicePaymentMethod,
} from "../../shared/servicePricing";
import { checkRateLimit, phoneKey } from "../_core/rateLimit";
import { sendEmail } from "../services/emailService";
import { sendTelnyxSms, toE164 } from "../services/telnyxSms";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://mechanicalenterprise.com").replace(/\/$/, "");
const OFFICE_PHONE = "(862) 423-9396";

export function paymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const venmo = (env.VENMO_HANDLE ?? "").trim();
  return {
    card: Boolean(env.STRIPE_SECRET_KEY),
    zelle: (env.ZELLE_RECIPIENT ?? "").trim() || ZELLE_DEFAULT_RECIPIENT,
    venmo: venmo ? (venmo.startsWith("@") ? venmo : `@${venmo}`) : null,
  };
}

export const bookingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).refine((p) => toE164(p) !== null, "invalid phone"),
  email: z.string().trim().email().max(200),
  category: z.enum(["residential", "commercial"]),
  emergency: z.boolean(),
  paymentMethod: z.enum(["card", "zelle", "venmo"]),
  /** Honeypot — real visitors never fill it. */
  website: z.string().max(0).optional(),
});
export type BookingInput = z.infer<typeof bookingSchema>;

/** Short code the customer puts in the Zelle/Venmo memo so the office can match it. */
export function paymentReference(rand: () => string = () => randomBytes(3).toString("hex")): string {
  return `ME-${rand().toUpperCase()}`;
}

export function serviceLabel(category: ServiceCategory, emergency: boolean): string {
  return `${category === "commercial" ? "Commercial " : ""}${emergency ? "Emergency Service Call" : "Service Call"}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildInstructions(
  input: Pick<BookingInput, "name" | "category" | "emergency">,
  method: Exclude<ServicePaymentMethod, "card">,
  payTo: string,
  ref: string,
) {
  const first = input.name.split(/\s+/)[0];
  const amount = formatUsd(servicePrice(input.category, input.emergency));
  const label = serviceLabel(input.category, input.emergency);
  const via = method === "zelle" ? `Zelle to ${payTo}` : `Venmo to ${payTo}`;
  const memo = method === "zelle" ? "memo" : "note";
  const sms =
    `Mechanical Enterprise: Thanks, ${first}! To confirm your ${label} (${amount}), send ${amount} by ${via} ` +
    `with ${memo} ${ref}. We'll call to confirm your time once it arrives. Questions? ${OFFICE_PHONE}. Reply STOP to opt out.`;
  const subject = `Payment instructions — ${label} (${amount})`;
  const html = `
    <p>Hi ${esc(first)},</p>
    <p>Thanks for booking a <strong>${esc(label)}</strong> with Mechanical Enterprise.
       The ${esc(amount)} fee covers the visit and diagnosis; we quote any repair before work starts.</p>
    <p><strong>To confirm, send ${esc(amount)} by ${method === "zelle" ? "Zelle" : "Venmo"}:</strong></p>
    <ul>
      <li>${method === "zelle" ? "Zelle to" : "Venmo to"}: <strong>${esc(payTo)}</strong></li>
      <li>Amount: <strong>${esc(amount)}</strong></li>
      <li>${memo === "memo" ? "Memo" : "Note"}: <strong>${esc(ref)}</strong></li>
    </ul>
    <p>Once it arrives we'll call you to confirm your appointment time.</p>
    <p>Questions? Call ${OFFICE_PHONE} or reply to this email.</p>
    <p>— Mechanical Enterprise</p>`;
  return { sms, subject, html, amount };
}

export function registerServiceBookingRoute(app: Express) {
  app.get("/api/service-booking/options", (_req: Request, res: Response) => {
    const cfg = paymentConfig();
    res.json({
      methods: [cfg.card && "card", "zelle", cfg.venmo && "venmo"].filter(Boolean),
    });
  });

  app.post("/api/service-booking", async (req: Request, res: Response) => {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "Please check your name, phone and email." });
    const input = parsed.data;
    if (input.website) return res.json({ ok: true }); // honeypot: pretend success

    const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0].trim() || "unknown";
    if (
      !checkRateLimit("service-booking-ip", ip, 10, 60 * 60_000).allowed ||
      !checkRateLimit("service-booking-phone", phoneKey(input.phone), 3, 60 * 60_000).allowed
    ) {
      return res.status(429).json({ ok: false, error: `Too many requests — please call ${OFFICE_PHONE}.` });
    }

    const cfg = paymentConfig();
    const base = servicePrice(input.category, input.emergency);
    const label = serviceLabel(input.category, input.emergency);

    try {
      if (input.paymentMethod === "card") {
        if (!cfg.card) return res.status(503).json({ ok: false, error: "Card payments are unavailable right now." });
        const { stripe } = await import("../stripe-service");
        const fee = cardFee(base);
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          customer_email: input.email,
          client_reference_id: `service:${phoneKey(input.phone)}`,
          metadata: {
            type: "website_service_call",
            name: input.name,
            phone: input.phone,
            category: input.category,
            emergency: String(input.emergency),
          },
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: label, description: "Visit and diagnosis — any repair is quoted on site." },
                unit_amount: Math.round(base * 100),
              },
              quantity: 1,
            },
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Card processing fee (3%)",
                  description: "Pay by Zelle or Venmo to avoid this fee.",
                },
                unit_amount: Math.round(fee * 100),
              },
              quantity: 1,
            },
          ],
          success_url: `${SITE_URL}/?service_booking=paid`,
          cancel_url: `${SITE_URL}/?service_booking=cancelled`,
        });
        console.log(`[ServiceBooking] card checkout ${session.id} ${label} ${formatUsd(base + fee)}`);
        return res.json({ ok: true, method: "card", checkoutUrl: session.url });
      }

      const payTo = input.paymentMethod === "zelle" ? cfg.zelle : cfg.venmo;
      if (!payTo) return res.status(503).json({ ok: false, error: "Venmo isn't available right now." });
      const ref = paymentReference();
      const msg = buildInstructions(input, input.paymentMethod, payTo, ref);
      const [sms, email] = await Promise.all([
        sendTelnyxSms(input.phone, msg.sms).then((r) => r.success).catch(() => false),
        sendEmail({ to: input.email, subject: msg.subject, html: msg.html }).catch(() => false),
      ]);
      console.log(`[ServiceBooking] ${input.paymentMethod} instructions ${ref} sms=${sms} email=${email}`);
      return res.json({ ok: true, method: input.paymentMethod, reference: ref, payTo, amount: msg.amount, sms, email });
    } catch (err) {
      console.error("[ServiceBooking] failed", err instanceof Error ? err.message : err);
      return res.status(500).json({ ok: false, error: `Something went wrong — please call ${OFFICE_PHONE}.` });
    }
  });
}
