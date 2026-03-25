import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from './_core/trpc';
import { createCourseCheckoutSession, createSubscriptionCheckoutSession } from './stripe-service';
import { STRIPE_PRODUCTS } from './stripe-products';

export const paymentRouter = router({
  // Create checkout session for course enrollment
  createCourseCheckout: protectedProcedure
    .input(
      z.object({
        courseId: z.string(),
        courseTitle: z.string(),
        price: z.number(), // in cents
        origin: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await createCourseCheckoutSession(
        ctx.user.id.toString(),
        input.courseId,
        input.courseTitle,
        input.price,
        input.origin
      );

      return { checkoutUrl: session.url };
    }),

  // Create checkout session for subscription
  createSubscriptionCheckout: protectedProcedure
    .input(
      z.object({
        subscriptionName: z.string(),
        priceId: z.string(), // Stripe Price ID
        origin: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await createSubscriptionCheckoutSession(
        ctx.user.id.toString(),
        input.subscriptionName,
        input.priceId,
        input.origin
      );

      return { checkoutUrl: session.url };
    }),

  // Get Stripe publishable key for frontend
  getStripePublishableKey: publicProcedure.query(() => {
    return {
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
    };
  }),

  // Get product pricing information
  getProductPricing: publicProcedure.query(() => {
    return STRIPE_PRODUCTS;
  }),
});
