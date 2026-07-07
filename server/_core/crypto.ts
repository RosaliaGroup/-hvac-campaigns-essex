/**
 * AES-256-GCM symmetric encryption for secrets at rest (Task 7).
 *
 * Used to encrypt QuickBooks OAuth tokens before they touch the database.
 * The key comes from ENCRYPTION_KEY (a 32-byte value, hex-encoded → 64 hex
 * chars). Ciphertext is stored as "iv:authTag:data" (all hex).
 *
 * SECURITY: plaintext tokens must NEVER be logged or returned to the client.
 * This module only (de)serializes; callers are responsible for keeping the
 * decrypted value in-process.
 */
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, recommended for GCM
const KEY_BYTES = 32; // AES-256

/** Resolve and validate the 32-byte key from ENCRYPTION_KEY (hex). */
export function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("ENCRYPTION_KEY is not set (need a 32-byte hex string, e.g. `openssl rand -hex 32`)");
  }
  const key = Buffer.from(hex.trim(), "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(`ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}); use a 64-char hex string`);
  }
  return key;
}

/** Encrypt a UTF-8 string → "iv:authTag:ciphertext" (hex). */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypt a value produced by encrypt(). Throws if tampered or malformed. */
export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext (expected iv:authTag:data)");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

/** True if ENCRYPTION_KEY is present and valid — for status/health checks. */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
