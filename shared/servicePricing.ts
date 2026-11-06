/**
 * Website service-call pricing — one source for the chat widget (prices shown)
 * and the server (amount charged / quoted in payment instructions).
 *
 * The fee covers the visit and diagnosis; any repair is quoted on site.
 * Owner decision Nov 6, 2026.
 */

export type ServiceCategory = "residential" | "commercial";
export type ServiceTierName = "standard" | "emergency";
export type ServicePaymentMethod = "card" | "zelle" | "venmo";

export const SERVICE_PRICES: Record<ServiceCategory, Record<ServiceTierName, number>> = {
  residential: { standard: 149, emergency: 299 },
  commercial: { standard: 425, emergency: 650 },
};

/** Card surcharge: 3% (Visa/Mastercard cap), never more than Stripe's own fee. */
export const CARD_FEE_RATE = 0.03;
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.3;

const cents = (n: number) => Math.round(n * 100) / 100;

/** Card processing fee added to `base` dollars. */
export function cardFee(base: number): number {
  const capped = cents(base * CARD_FEE_RATE);
  // Fee that would exactly cover Stripe's 2.9% + 30¢ on the grossed-up total.
  const stripeCost = Math.ceil(((base * STRIPE_PERCENT + STRIPE_FIXED) / (1 - STRIPE_PERCENT)) * 100) / 100;
  return Math.min(capped, stripeCost);
}

export function servicePrice(category: ServiceCategory, emergency: boolean): number {
  return SERVICE_PRICES[category][emergency ? "emergency" : "standard"];
}

/** NJ sales tax — charged on every service call (owner, Nov 6). QuickBooks (AST) uses the same 6.625% NJ code. */
export const SALES_TAX_RATE = 0.06625;

export function salesTax(base: number): number {
  return cents(base * SALES_TAX_RATE);
}

/** Full breakdown: price + NJ sales tax, plus the 3% card fee on that subtotal when paying by card. */
export function priceBreakdown(category: ServiceCategory, emergency: boolean, method: ServicePaymentMethod) {
  const base = servicePrice(category, emergency);
  const tax = salesTax(base);
  const subtotal = cents(base + tax);
  const fee = method === "card" ? cardFee(subtotal) : 0;
  return { base, tax, subtotal, fee, total: cents(subtotal + fee) };
}

export function totalFor(category: ServiceCategory, emergency: boolean, method: ServicePaymentMethod): number {
  return priceBreakdown(category, emergency, method).total;
}

/** "$149" for whole dollars, "$153.47" otherwise. */
export function formatUsd(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export const ZELLE_DEFAULT_RECIPIENT = "info@mechanicalenterprise.com";
