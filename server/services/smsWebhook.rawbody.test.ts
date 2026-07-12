/**
 * Raw-body preservation integration test (Task 3 of the follow-up).
 *
 * Boots a real Express app with the SHARED body-parser middleware
 * (attachBodyParsers, the same one server/_core/index.ts uses) plus the real
 * /api/sms/reply route, then verifies over the wire that:
 *   • the exact signed raw bytes pass verification (200);
 *   • parsed-then-reserialized JSON with different bytes fails (401);
 *   • any post-signing whitespace/content change fails (401).
 *
 * No DATABASE_URL is set, so getDb() returns null and a verified request is
 * acknowledged with 200 without touching a database — enough to prove the
 * signature (and therefore the raw body) was accepted or rejected.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import { generateKeyPairSync, sign as cryptoSign } from "crypto";
import { attachBodyParsers } from "../_core/bodyParser";
import { registerSmsWebhookRoutes } from "./smsWebhook";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const spkiDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
const PUBLIC_KEY_B64 = spkiDer.subarray(spkiDer.length - 32).toString("base64");

function signFor(timestamp: string, rawBody: string): string {
  return cryptoSign(null, Buffer.from(`${timestamp}|${rawBody}`, "utf8"), privateKey).toString("base64");
}

let server: Server;
let url: string;
const savedEnv: Record<string, string | undefined> = {};

async function post(rawBody: string, headers: Record<string, string>) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: rawBody });
  return res.status;
}

describe("/api/sms/reply raw-body signature integration", () => {
  beforeAll(async () => {
    savedEnv.TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY;
    savedEnv.DATABASE_URL = process.env.DATABASE_URL;
    savedEnv.NODE_ENV = process.env.NODE_ENV;
    process.env.TELNYX_PUBLIC_KEY = PUBLIC_KEY_B64;
    delete process.env.DATABASE_URL; // getDb() → null; verified requests 200 without DB
    process.env.NODE_ENV = "production"; // exercise the strict path

    const app = express();
    attachBodyParsers(app);
    registerSmsWebhookRoutes(app);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    url = `http://127.0.0.1:${port}/api/sms/reply`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  // Deliberately spaced JSON so a reserialization changes the bytes.
  const rawBody = '{"data": {"event_type": "message.received", "id": "evt_int_1", "payload": {"from": {"phone_number": "+18624239396"}, "id": "m1", "text": "hi"}}}';

  it("accepts the exact signed raw bytes (200)", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const status = await post(rawBody, {
      "telnyx-signature-ed25519": signFor(ts, rawBody),
      "telnyx-timestamp": ts,
    });
    expect(status).toBe(200);
  });

  it("rejects parsed-then-reserialized JSON with different bytes (401)", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = signFor(ts, rawBody); // signed over the ORIGINAL spaced bytes
    const reserialized = JSON.stringify(JSON.parse(rawBody)); // compact — different bytes
    expect(reserialized).not.toBe(rawBody);
    const status = await post(reserialized, {
      "telnyx-signature-ed25519": signature,
      "telnyx-timestamp": ts,
    });
    expect(status).toBe(401);
  });

  it("rejects a post-signing content change (401)", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = signFor(ts, rawBody);
    const tampered = rawBody.replace('"text": "hi"', '"text": "HACKED"');
    const status = await post(tampered, {
      "telnyx-signature-ed25519": signature,
      "telnyx-timestamp": ts,
    });
    expect(status).toBe(401);
  });

  it("rejects a post-signing whitespace change (401)", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = signFor(ts, rawBody);
    const spaced = rawBody.replace('{"data"', '{ "data"'); // one extra space
    const status = await post(spaced, {
      "telnyx-signature-ed25519": signature,
      "telnyx-timestamp": ts,
    });
    expect(status).toBe(401);
  });
});
