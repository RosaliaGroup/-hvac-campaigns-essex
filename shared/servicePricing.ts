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

/**
 * Card processing fee: sized so it fully covers Stripe's 2.9% + 30¢ on the
 * whole charge, including the fee itself (owner, Nov 6 — accepted that this is
 * above the 3% card-network surcharge cap on small payments).
 */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED = 0.3;

const cents = (n: number) => Math.round(n * 100) / 100;

/** What Stripe charges on a payment of `total` dollars. */
export function stripeFeeOn(total: number): number {
  return cents(total * STRIPE_PERCENT + STRIPE_FIXED);
}

/** Card fee added to `amount` dollars so that Stripe's fee on the total is fully covered. */
export function cardFee(amount: number): number {
  let fee = Math.ceil(((amount * STRIPE_PERCENT + STRIPE_FIXED) / (1 - STRIPE_PERCENT)) * 100) / 100;
  while (stripeFeeOn(amount + fee) > fee) fee = cents(fee + 0.01); // guard against rounding
  return fee;
}

export function servicePrice(category: ServiceCategory, emergency: boolean): number {
  return SERVICE_PRICES[category][emergency ? "emergency" : "standard"];
}

/** NJ sales tax — charged on every service call (owner, Nov 6). QuickBooks (AST) uses the same 6.625% NJ code. */
export const SALES_TAX_RATE = 0.06625;

export function salesTax(base: number): number {
  return cents(base * SALES_TAX_RATE);
}

/** Full breakdown: price + NJ sales tax, plus the card fee (covers Stripe in full) when paying by card. */
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
