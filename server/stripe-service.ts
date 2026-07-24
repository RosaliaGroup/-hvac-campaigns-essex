import Stripe from 'stripe';
import { ENV } from './_core/env';

// Shared Stripe client + read helpers used by the LIVE customer-portal invoice
// payment flow (server/routers/portal). The dormant course/subscription checkout
// + webhook functions that previously lived here were removed 2026-07-23 (never
// mounted, no callers); see drizzle/README.md history / the removal in this branch.
const stripe = new Stripe(ENV.stripeSecretKey);

/**
 * Retrieve a checkout session (used by portal payment confirmation).
 */
export async function getCheckoutSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Retrieve payment intent details.
 */
export async function getPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export { stripe };
