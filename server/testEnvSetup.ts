/**
 * Test-only env shim. Import this FIRST in any test that loads appRouter:
 * stripe-service constructs a Stripe client at module load and throws
 * without a key. ESM imports evaluate in declaration order, so importing
 * this module before ./routers guarantees the dummy key is present.
 */
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
// Hardened sessions sign/verify HS256 JWTs; provide a dummy secret so session
// tests can mint and verify tokens. Never a real secret.
process.env.JWT_SECRET ||= "unit-test-jwt-secret-value-not-real-000";
export {};
