/**
 * Shared Express body-parser setup.
 *
 * Captures the exact raw request bytes on `req.rawBody` via the json parser's
 * `verify` hook. Webhook signature verification (Telnyx Ed25519, Stripe, etc.)
 * MUST hash the bytes exactly as received — re-serializing the parsed JSON would
 * change whitespace/key-order and break the signature. Exported (not inlined in
 * index.ts) so the same middleware can be exercised in integration tests.
 */
import express, { type Express, type Request } from "express";

export type WithRawBody = Request & { rawBody?: Buffer };

export function attachBodyParsers(app: Express): void {
  app.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        (req as WithRawBody).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
}
