/**
 * Test-only env shim. Import this FIRST in any test that loads appRouter:
 * stripe-service constructs a Stripe client at module load and throws
 * without a key. ESM imports evaluate in declaration order, so importing
 * this module before ./routers guarantees the dummy key is present.
 */
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
export {};
