import Stripe from 'stripe';
import { ENV } from './_core/env';
import { getDb } from './db';
import { enrollments, user_subscriptions } from '../drizzle/courses-schema';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(ENV.stripeSecretKey);

/**
 * Create a checkout session for course enrollment (one-time payment)
 */
export async function createCourseCheckoutSession(
  userId: string,
  courseId: string,
  courseTitle: string,
  price: number, // in cents
  origin: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const userIdNum = parseInt(userId, 10);
  const user = await db.select().from(users).where(eq(users.id, userIdNum)).limit(1);

  if (!user[0]) {
    throw new Error('User not found');
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: user[0].email || undefined,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      course_id: courseId,
      customer_email: user[0].email || '',
      customer_name: user[0].name || 'Student',
      type: 'course_enrollment',
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: courseTitle,
            description: `HVAC Course: ${courseTitle}`,
          },
          unit_amount: price,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/courses?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url: `${origin}/courses?status=cancelled`,
    allow_promotion_codes: true,
  });

  return session;
}

/**
 * Create a checkout session for subscription (recurring payment)
 */
export async function createSubscriptionCheckoutSession(
  userId: string,
  subscriptionName: string,
  priceId: string, // Stripe Price ID
  origin: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const userIdNum = parseInt(userId, 10);
  const user = await db.select().from(users).where(eq(users.id, userIdNum)).limit(1);

  if (!user[0]) {
    throw new Error('User not found');
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: user[0].email || undefined,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      customer_email: user[0].email || '',
      customer_name: user[0].name || 'Student',
      type: 'subscription',
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&status=success`,
    cancel_url: `${origin}/courses?status=cancelled`,
    allow_promotion_codes: true,
  });

  return session;
}

/**
 * Handle checkout.session.completed webhook
 */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) return;

  const userId = session.client_reference_id;
  const metadata = session.metadata;

  if (!userId || !metadata) {
    console.error('[Stripe] Missing user ID or metadata in session');
    return;
  }

  if (metadata.type === 'course_enrollment') {
    const courseId = metadata.course_id;
    const paymentIntentId = session.payment_intent as string;
    const { v4: uuidv4 } = await import('uuid');

    // Create enrollment record
    const enrollmentId = uuidv4();
    const userIdNum = parseInt(userId, 10);
    
    await db.insert(enrollments).values({
      id: enrollmentId,
      user_id: userIdNum,
      course_id: courseId,
      enrollment_type: 'pay_per_course',
      status: 'active',
      payment_id: paymentIntentId,
      price_paid: ((session.amount_total || 0) / 100).toString(),
    });

    console.log(`[Stripe] Course enrollment created: ${enrollmentId} for user ${userId}`);
  } else if (metadata.type === 'subscription') {
    const stripeSubscriptionId = session.subscription as string;

    // Note: The subscription details will be updated via invoice.payment_succeeded webhook
    console.log(`[Stripe] Subscription started: ${stripeSubscriptionId} for user ${userId}`);
  }
}

/**
 * Handle invoice.payment_succeeded webhook (for subscription payments)
 */
export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  if (!customerId) {
    console.error('[Stripe] Missing customer ID in invoice');
    return;
  }

  // Find user by Stripe customer ID (would need to store this in user table)
  // For now, this is a placeholder
  console.log(`[Stripe] Invoice payment succeeded: ${invoice.id} for customer ${customerId}`);
}

/**
 * Handle customer.subscription.updated webhook
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  if (!customerId) {
    console.error('[Stripe] Missing customer ID in subscription');
    return;
  }

  // Update subscription status in database
  console.log(`[Stripe] Subscription updated: ${subscription.id} for customer ${customerId}`);
}

/**
 * Handle customer.subscription.deleted webhook
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  if (!customerId) {
    console.error('[Stripe] Missing customer ID in subscription');
    return;
  }

  // Mark subscription as cancelled in database
  console.log(`[Stripe] Subscription deleted: ${subscription.id} for customer ${customerId}`);
}

/**
 * Retrieve a checkout session
 */
export async function getCheckoutSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Retrieve payment intent details
 */
export async function getPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export { stripe };
