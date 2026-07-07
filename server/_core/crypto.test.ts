import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import { encrypt, decrypt, getEncryptionKey, isEncryptionConfigured } from "./crypto";

describe("crypto — AES-256-GCM", () => {
  beforeAll(() => {
    // Deterministic 32-byte hex key for tests.
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });

  it("round-trips a token value", () => {
    const secret = "eyJhbGciOi.some-quickbooks-access-token.value_123";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret); // ciphertext must not leak plaintext
    expect(decrypt(enc)).toBe(secret);
  });

  it("round-trips unicode and empty strings", () => {
    expect(decrypt(encrypt(""))).toBe("");
    expect(decrypt(encrypt("café ☕ — refresh"))).toBe("café ☕ — refresh");
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const a = encrypt("same-token");
    const b = encrypt("same-token");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const enc = encrypt("tamper-me");
    const [iv, tag, data] = enc.split(":");
    // Flip a byte in the data segment.
    const flipped = data.slice(0, -2) + (data.endsWith("00") ? "11" : "00");
    expect(() => decrypt(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decrypt("not-a-valid-payload")).toThrow();
  });

  it("validates key length", () => {
    const good = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "abcd"; // too short
    expect(() => getEncryptionKey()).toThrow();
    expect(isEncryptionConfigured()).toBe(false);
    process.env.ENCRYPTION_KEY = good;
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("interoperates with a freshly generated key", () => {
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    expect(decrypt(encrypt("live-key-token"))).toBe("live-key-token");
    process.env.ENCRYPTION_KEY = "a".repeat(64);
  });
});
