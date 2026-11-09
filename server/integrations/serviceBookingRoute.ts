/**
 * Website chat service-call payments (public, unauthenticated).
 *
 *   GET  /api/service-booking/options  → which payment methods are on
 *   POST /api/service-booking          → card: Stripe Checkout URL for the
 *                                        price + card fee; zelle: texts and emails
 *                                        the customer payment instructions; venmo:
 *                                        a QuickBooks invoice (emailed by QuickBooks,
 *                                        pay link texted) payable with PayPal/Venmo —
 *                                        or, if VENMO_HANDLE is set, instructions.
 *
 * Amounts always come from shared/servicePricing — never from the request.
 * Every method charges NJ sales tax (6.625%); card adds a fee that covers Stripe's 2.9% + 30¢ in full.
 * The office still gets the booking details from the chat's call recap.
 */

import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  SALES_TAX_RATE,
  ZELLE_DEFAULT_RECIPIENT,
  formatUsd,
  priceBreakdown,
  type ServiceCategory,
  type ServicePaymentMethod,
} from "../../shared/servicePricing";
import { checkRateLimit, phoneKey } from "../_core/rateLimit";
import { sendEmail } from "../services/emailService";
import { sendTelnyxSms, toE164 } from "../services/telnyxSms";
import { quickbooksProvider } from "./accounting/quickbooks";

const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://mechanicalenterprise.com").replace(/\/$/, "");
const OFFICE_PHONE = "(862) 419-1763";

export function paymentConfig(env: NodeJS.ProcessEnv = process.env) {
  const venmo = (env.VENMO_HANDLE ?? "").trim();
  return {
    card: Boolean(env.STRIPE_SECRET_KEY),
    zelle: (env.ZELLE_RECIPIENT ?? "").trim() || ZELLE_DEFAULT_RECIPIENT,
    venmo: venmo ? (venmo.startsWith("@") ? venmo : `@${venmo}`) : null,
    venmoViaQuickbooks: env.VENMO_VIA_QUICKBOOKS !== "false",
  };
}

/** QuickBooks items for service calls (Products & Services). Override by env if they change. */
export function serviceCallItem(category: ServiceCategory, env: NodeJS.ProcessEnv = process.env) {
  return category === "commercial"
    ? { value: env.QUICKBOOKS_COMMERCIAL_SERVICE_CALL_ITEM_ID || "17", name: "HVAC Commercial Service Call/ Repair" }
    : { value: env.QUICKBOOKS_RESIDENTIAL_SERVICE_CALL_ITEM_ID || "14", name: "HVAC Residential Service Call / Repair" };
}

/** QuickBooks connection check, cached for 5 minutes (it's a DB read). */
let qbCache: { at: number; ok: boolean } | null = null;
async function quickbooksReady(): Promise<boolean> {
  if (qbCache && Date.now() - qbCache.at < 5 * 60_000) return qbCache.ok;
  const ok = await quickbooksProvider.getStatus().then((s) => s.connected).catch(() => false);
  qbCache = { at: Date.now(), ok };
  return ok;
}

async function venmoAvailable(cfg: ReturnType<typeof paymentConfig>): Promise<boolean> {
  return Boolean(cfg.venmo) || (cfg.venmoViaQuickbooks && (await quickbooksReady()));
}

export function buildQuickbooksVenmoSms(name: string, label: string, amount: string, link: string | null): string {
  const first = name.split(/\s+/)[0];
  return link
    ? `Mechanical Enterprise: Thanks, ${first}! Pay your ${label} (${amount}) here — tap Pay and choose Venmo or PayPal: ${link} We'll call to confirm your time once it's paid. Questions? ${OFFICE_PHONE}. Reply STOP to opt out.`
    : `Mechanical Enterprise: Thanks, ${first}! We emailed your ${label} invoice (${amount}) — open it and choose Venmo or PayPal to pay. We'll call to confirm your time once it's paid. Questions? ${OFFICE_PHONE}. Reply STOP to opt out.`;
}

export const bookingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).refine((p) => toE164(p) !== null, "invalid phone"),
  email: z.string().trim().email().max(200),
  category: z.enum(["residential", "commercial"]),
  emergency: z.boolean(),
  address: z.string().trim().max(300).optional(),
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
  const p = priceBreakdown(input.category, input.emergency, method);
  const amount = formatUsd(p.total);
  const taxLine = `${formatUsd(p.base)} + ${formatUsd(p.tax)} NJ sales tax`;
  const label = serviceLabel(input.category, input.emergency);
  const via = method === "zelle" ? `Zelle to ${payTo}` : `Venmo to ${payTo}`;
  const memo = method === "zelle" ? "memo" : "note";
  const sms =
    `Mechanical Enterprise: Thanks, ${first}! To confirm your ${label} (${taxLine}), send ${amount} by ${via} ` +
    `with ${memo} ${ref}. We'll call to confirm your time once it arrives. Questions? ${OFFICE_PHONE}. Reply STOP to opt out.`;
  const subject = `Payment instructions — ${label} (${amount})`;
  const html = `
    <p>Hi ${esc(first)},</p>
    <p>Thanks for booking a <strong>${esc(label)}</strong> with Mechanical Enterprise.
       The ${esc(formatUsd(p.base))} fee covers the visit and diagnosis; we quote any repair before work starts.</p>
    <p><strong>To confirm, send ${esc(amount)} by ${method === "zelle" ? "Zelle" : "Venmo"}:</strong></p>
    <ul>
      <li>${method === "zelle" ? "Zelle to" : "Venmo to"}: <strong>${esc(payTo)}</strong></li>
      <li>Amount: <strong>${esc(amount)}</strong> (${esc(taxLine)})</li>
      <li>${memo === "memo" ? "Memo" : "Note"}: <strong>${esc(ref)}</strong></li>
    </ul>
    <p>Once it arrives we'll call you to confirm your appointment time.</p>
    <p>Questions? Call ${OFFICE_PHONE} or reply to this email.</p>
    <p>— Mechanical Enterprise</p>`;
  return { sms, subject, html, amount };
}

export function registerServiceBookingRoute(app: Express) {
  app.get("/api/service-booking/options", async (_req: Request, res: Response) => {
    const cfg = paymentConfig();
    res.json({
      methods: [cfg.card && "card", "zelle", (await venmoAvailable(cfg)) && "venmo"].filter(Boolean),
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
    const price = priceBreakdown(input.category, input.emergency, input.paymentMethod);
    const base = price.base;
    const label = serviceLabel(input.category, input.emergency);

    try {
      if (input.paymentMethod === "card") {
        if (!cfg.card) return res.status(503).json({ ok: false, error: "Card payments are unavailable right now." });
        const { stripe } = await import("../stripe-service");
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
                product_data: { name: `NJ sales tax (${(SALES_TAX_RATE * 100).toFixed(3)}%)` },
                unit_amount: Math.round(price.tax * 100),
              },
              quantity: 1,
            },
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Card processing fee",
                  description: "Pay by Zelle or Venmo to avoid this fee.",
                },
                unit_amount: Math.round(price.fee * 100),
              },
              quantity: 1,
            },
          ],
          success_url: `${SITE_URL}/?service_booking=paid`,
          cancel_url: `${SITE_URL}/?service_booking=cancelled`,
        });
        console.log(`[ServiceBooking] card checkout ${session.id} ${label} ${formatUsd(price.total)}`);
        return res.json({ ok: true, method: "card", checkoutUrl: session.url });
      }

      if (input.paymentMethod === "venmo" && !cfg.venmo) {
        if (!(await venmoAvailable(cfg))) return res.status(503).json({ ok: false, error: "Venmo isn't available right now." });
        const [firstName, ...rest] = input.name.split(/\s+/);
        const customerRef = await quickbooksProvider.findOrCreateWebCustomer({
          localId: 0, type: input.category, displayName: input.name,
          firstName, lastName: rest.join(" ") || null, email: input.email, phone: input.phone,
          address: input.address ? { line1: input.address, state: "NJ" } : undefined,
        });
        const inv = await quickbooksProvider.createAndSendServiceInvoice({
          customerRef, amount: base, name: label, email: input.email,
          description: "Visit and diagnosis — any repair is quoted on site.",
          privateNote: "Website chat booking — customer chose Venmo/PayPal.",
          itemRef: serviceCallItem(input.category),
          taxable: true,
          shipToLine1: input.address,
        });
        // QuickBooks works out the tax from the address; show its total (fall back to ours).
        const amount = formatUsd(inv.totalAmount ?? price.total);
        const sms = await sendTelnyxSms(input.phone, buildQuickbooksVenmoSms(input.name, label, amount, inv.invoiceLink))
          .then((r) => r.success).catch(() => false);
        console.log(`[ServiceBooking] venmo via QuickBooks invoice ${inv.docNumber ?? inv.qbId} emailed=${inv.emailed} link=${Boolean(inv.invoiceLink)} sms=${sms}`);
        return res.json({
          ok: true, method: "venmo", via: "quickbooks", amount, payLink: inv.invoiceLink,
          invoiceNumber: inv.docNumber ?? inv.qbId, sms, email: inv.emailed,
        });
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
