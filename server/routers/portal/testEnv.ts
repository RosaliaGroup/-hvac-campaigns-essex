/**
 * Test-only env shim for the Customer Portal. Import this FIRST in portal tests:
 *  - STRIPE_SECRET_KEY: stripe-service builds a client at module load.
 *  - JWT_SECRET: portal/team sessions are signed with HS256 via `sdk`.
 * ESM evaluates imports in order, so importing this before any app module
 * guarantees the vars exist before env.ts / sdk / appRouter are loaded.
 */
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
process.env.JWT_SECRET ||= "portal-test-secret-portal-test-secret";
export {};
