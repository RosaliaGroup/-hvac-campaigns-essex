/**
 * Ed25519 webhook signature verification tests (Task 12: signature rejection).
 * Generates a real Ed25519 keypair, signs a payload the way Telnyx does
 * (`${timestamp}|${rawBody}`), and asserts accept/reject behavior.
 */
import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign as cryptoSign } from "crypto";
import {
  verifyTelnyxSignature,
  telnyxPublicKeyObject,
  resolveWebhookAuthMode,
  authorizeTelnyxWebhook,
} from "./telnyxSignature";

// Build a keypair and export the public key as Telnyx does: base64 raw 32 bytes.
function makeKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spkiDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const rawPub = spkiDer.subarray(spkiDer.length - 32); // last 32 bytes = raw key
  const publicKeyBase64 = rawPub.toString("base64");
  return { privateKey, publicKeyBase64 };
}

function signPayload(privateKey: ReturnType<typeof makeKeypair>["privateKey"], timestamp: string, rawBody: string) {
  const signed = Buffer.from(`${timestamp}|${rawBody}`, "utf8");
  return cryptoSign(null, signed, privateKey).toString("base64");
}

describe("telnyxPublicKeyObject", () => {
  it("builds a usable KeyObject from a base64 raw key", () => {
    const { publicKeyBase64 } = makeKeypair();
    const key = telnyxPublicKeyObject(publicKeyBase64);
    expect(key.asymmetricKeyType).toBe("ed25519");
    expect(key.type).toBe("public");
    // exports back to a 44-char base64 SPKI-derived key without throwing
    expect(key.export({ format: "der", type: "spki" }).length).toBe(44);
  });

  it("rejects a key that is not 32 bytes", () => {
    expect(() => telnyxPublicKeyObject(Buffer.from("short").toString("base64"))).toThrow();
  });
});

describe("verifyTelnyxSignature", () => {
  const now = 1_800_000_000;
  const timestamp = String(now);
  const rawBody = JSON.stringify({ data: { event_type: "message.received", id: "evt_1" } });

  it("accepts a valid signature", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const signature = signPayload(privateKey, timestamp, rawBody);
    const res = verifyTelnyxSignature({ rawBody, signature, timestamp, publicKeyBase64, nowSeconds: now });
    expect(res.valid).toBe(true);
  });

  it("accepts a Buffer rawBody identical to the signed bytes", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const signature = signPayload(privateKey, timestamp, rawBody);
    const res = verifyTelnyxSignature({
      rawBody: Buffer.from(rawBody, "utf8"),
      signature,
      timestamp,
      publicKeyBase64,
      nowSeconds: now,
    });
    expect(res.valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const signature = signPayload(privateKey, timestamp, rawBody);
    const res = verifyTelnyxSignature({
      rawBody: rawBody.replace("evt_1", "evt_HACKED"),
      signature,
      timestamp,
      publicKeyBase64,
      nowSeconds: now,
    });
    expect(res).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects a signature from a different key", () => {
    const signer = makeKeypair();
    const other = makeKeypair();
    const signature = signPayload(signer.privateKey, timestamp, rawBody);
    const res = verifyTelnyxSignature({
      rawBody,
      signature,
      timestamp,
      publicKeyBase64: other.publicKeyBase64,
      nowSeconds: now,
    });
    expect(res.valid).toBe(false);
  });

  it("rejects when headers are missing", () => {
    const { publicKeyBase64 } = makeKeypair();
    expect(verifyTelnyxSignature({ rawBody, signature: null, timestamp, publicKeyBase64, nowSeconds: now }))
      .toEqual({ valid: false, reason: "missing_headers" });
    expect(verifyTelnyxSignature({ rawBody, signature: "x", timestamp: null, publicKeyBase64, nowSeconds: now }))
      .toEqual({ valid: false, reason: "missing_headers" });
  });

  it("rejects an expired timestamp (replay outside tolerance)", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const oldTs = String(now - 10_000);
    const signature = signPayload(privateKey, oldTs, rawBody);
    const res = verifyTelnyxSignature({
      rawBody,
      signature,
      timestamp: oldTs,
      publicKeyBase64,
      toleranceSeconds: 300,
      nowSeconds: now,
    });
    expect(res).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a non-numeric timestamp", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const signature = signPayload(privateKey, timestamp, rawBody);
    const res = verifyTelnyxSignature({ rawBody, signature, timestamp: "not-a-number", publicKeyBase64, nowSeconds: now });
    expect(res).toEqual({ valid: false, reason: "bad_timestamp" });
  });
});

describe("resolveWebhookAuthMode — fail-closed policy", () => {
  it("verifies when a public key is present (any env)", () => {
    expect(resolveWebhookAuthMode({ nodeEnv: "production", publicKey: "k" })).toBe("verify");
    expect(resolveWebhookAuthMode({ nodeEnv: "development", publicKey: "k" })).toBe("verify");
  });

  it("is misconfigured in production without a key (never bypass)", () => {
    expect(resolveWebhookAuthMode({ nodeEnv: "production", publicKey: undefined })).toBe("misconfigured");
    // bypass flag is IGNORED in production
    expect(resolveWebhookAuthMode({ nodeEnv: "production", publicKey: undefined, bypass: "true" })).toBe(
      "misconfigured",
    );
    expect(resolveWebhookAuthMode({ nodeEnv: "production", publicKey: undefined, bypass: true })).toBe(
      "misconfigured",
    );
  });

  it("does not infer bypass from a missing key in dev (must be explicit)", () => {
    expect(resolveWebhookAuthMode({ nodeEnv: "development", publicKey: undefined })).toBe("misconfigured");
    expect(resolveWebhookAuthMode({ nodeEnv: "development", publicKey: undefined, bypass: "false" })).toBe(
      "misconfigured",
    );
  });

  it("bypasses only when explicitly enabled outside production", () => {
    expect(resolveWebhookAuthMode({ nodeEnv: "development", publicKey: undefined, bypass: "true" })).toBe("bypass");
    expect(resolveWebhookAuthMode({ nodeEnv: "test", publicKey: undefined, bypass: true })).toBe("bypass");
  });
});

describe("authorizeTelnyxWebhook — end-to-end decision", () => {
  const now = 1_800_000_000;
  const timestamp = String(now);
  const rawBody = JSON.stringify({ data: { event_type: "message.received", id: "evt_1" } });

  it("production without a key returns 503 (fail closed)", () => {
    const res = authorizeTelnyxWebhook({ nodeEnv: "production", publicKey: undefined, rawBody, signature: "x", timestamp });
    expect(res).toEqual({ ok: false, code: 503, reason: "signature_verification_unconfigured" });
  });

  it("production ignores the bypass flag and still returns 503 without a key", () => {
    const res = authorizeTelnyxWebhook({
      nodeEnv: "production",
      publicKey: undefined,
      bypass: "true",
      rawBody,
      signature: "x",
      timestamp,
    });
    expect(res).toEqual({ ok: false, code: 503, reason: "signature_verification_unconfigured" });
  });

  it("dev bypass authorizes without a signature only when explicitly enabled", () => {
    expect(authorizeTelnyxWebhook({ nodeEnv: "development", publicKey: undefined, bypass: "true", rawBody })).toEqual({
      ok: true,
      mode: "bypass",
    });
    // not enabled → misconfigured 503
    expect(
      authorizeTelnyxWebhook({ nodeEnv: "development", publicKey: undefined, rawBody }),
    ).toMatchObject({ ok: false, code: 503 });
  });

  it("valid signature is authorized (verify mode)", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const signature = signPayload(privateKey, timestamp, rawBody);
    const res = authorizeTelnyxWebhook({
      nodeEnv: "production",
      publicKey: publicKeyBase64,
      rawBody,
      signature,
      timestamp,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: true, mode: "verify" });
  });

  it("invalid signature returns 401", () => {
    const { privateKey, publicKeyBase64 } = makeKeypair();
    const signature = signPayload(privateKey, timestamp, rawBody);
    const res = authorizeTelnyxWebhook({
      nodeEnv: "production",
      publicKey: publicKeyBase64,
      rawBody: rawBody.replace("evt_1", "evt_HACKED"),
      signature,
      timestamp,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, code: 401, reason: "bad_signature" });
  });

  it("missing signature header returns 401 when a key is configured", () => {
    const { publicKeyBase64 } = makeKeypair();
    const res = authorizeTelnyxWebhook({
      nodeEnv: "production",
      publicKey: publicKeyBase64,
      rawBody,
      signature: null,
      timestamp,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, code: 401, reason: "missing_headers" });
  });
});
