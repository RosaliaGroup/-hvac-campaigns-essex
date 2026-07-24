/**
 * Auth Hardening — session primitive tests (pure; no ENV/DB/jose-secret coupling).
 * Covers: idle timeout, remember-device duration, activity-resets-timer,
 * absolute cap, expired JWT, invalid JWT, invalid signature, expired remember-me.
 */
import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  IDLE_TIMEOUT_MS,
  REMEMBER_ME_TTL_MS,
  SESSION_TTL_MS,
  idleExpSeconds,
  sessionTtlMs,
  signSessionToken,
  verifySessionToken,
  type StaffSessionClaims,
} from "./session";

const SECRET = "unit-test-session-secret-please-32b";
const OTHER_SECRET = "a-different-secret-value-for-signing";
const NOW = 1_700_000_000_000; // fixed epoch ms for determinism

function claims(overrides: Partial<StaffSessionClaims> = {}): StaffSessionClaims {
  return {
    openId: "team:1",
    appId: "team",
    name: "Test User",
    absExp: NOW + SESSION_TTL_MS,
    rmb: false,
    ...overrides,
  };
}

describe("session — durations", () => {
  it("selects 8h by default and 30d when remembering the device", () => {
    expect(sessionTtlMs(false)).toBe(8 * 60 * 60 * 1000);
    expect(sessionTtlMs(true)).toBe(30 * 24 * 60 * 60 * 1000);
    expect(SESSION_TTL_MS).toBe(8 * 60 * 60 * 1000);
    expect(REMEMBER_ME_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it("idle deadline is now+30m, but never past the absolute cap", () => {
    const farAbs = NOW + SESSION_TTL_MS;
    expect(idleExpSeconds(NOW, farAbs)).toBe(Math.floor((NOW + IDLE_TIMEOUT_MS) / 1000));
    // Absolute cap only 5 minutes away → idle deadline clamps to the cap.
    const nearAbs = NOW + 5 * 60 * 1000;
    expect(idleExpSeconds(NOW, nearAbs)).toBe(Math.floor(nearAbs / 1000));
  });
});

describe("session — sign/verify round trip", () => {
  it("verifies a fresh token and returns its claims", async () => {
    const token = await signSessionToken(claims({ rmb: true }), SECRET, NOW);
    const res = await verifySessionToken(token, SECRET, { nowMs: NOW });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.claims.openId).toBe("team:1");
      expect(res.claims.appId).toBe("team");
      expect(res.claims.name).toBe("Test User");
      expect(res.claims.rmb).toBe(true);
      expect(res.claims.absExp).toBe(NOW + SESSION_TTL_MS);
    }
  });

  it("returns 'missing' for an absent cookie", async () => {
    expect(await verifySessionToken(undefined, SECRET)).toEqual({ ok: false, reason: "missing" });
    expect(await verifySessionToken("", SECRET)).toEqual({ ok: false, reason: "missing" });
  });
});

describe("session — idle timeout", () => {
  it("accepts a token within the 30-minute idle window", async () => {
    const token = await signSessionToken(claims(), SECRET, NOW);
    const res = await verifySessionToken(token, SECRET, { nowMs: NOW + 20 * 60 * 1000 });
    expect(res.ok).toBe(true);
  });

  it("rejects a token after 30 minutes of inactivity (expired)", async () => {
    const token = await signSessionToken(claims(), SECRET, NOW);
    // 30m + 31s to clear the 30s clock-skew tolerance.
    const res = await verifySessionToken(token, SECRET, { nowMs: NOW + IDLE_TIMEOUT_MS + 31_000 });
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("activity resets the timer: re-minting extends the idle window", async () => {
    // First token minted at NOW; user active at NOW+20m → re-mint.
    const t1 = await signSessionToken(claims(), SECRET, NOW);
    expect((await verifySessionToken(t1, SECRET, { nowMs: NOW + 20 * 60 * 1000 })).ok).toBe(true);

    const activeAt = NOW + 20 * 60 * 1000;
    const t2 = await signSessionToken(claims(), SECRET, activeAt);
    // 25 minutes after the re-mint (45m after original) is still valid because
    // the idle window slid forward on activity.
    const res = await verifySessionToken(t2, SECRET, { nowMs: activeAt + 25 * 60 * 1000 });
    expect(res.ok).toBe(true);
    // The original (un-refreshed) token would already be expired at that time.
    expect((await verifySessionToken(t1, SECRET, { nowMs: activeAt + 25 * 60 * 1000 })).ok).toBe(false);
  });
});

describe("session — absolute cap / remember-me expiry", () => {
  it("rejects once the absolute expiry is reached even if the JWT exp looks valid", async () => {
    // Hand-craft a token whose JWT exp is in the future but whose absExp is past.
    const raw = await new SignJWT({
      openId: "team:1",
      appId: "team",
      name: "Test User",
      absExp: NOW - 120_000, // absolute cap elapsed well beyond the 30s skew tolerance
      rmb: true,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor((NOW - 180_000) / 1000))
      .setExpirationTime(Math.floor((NOW + 60_000) / 1000)) // exp in the future
      .sign(new TextEncoder().encode(SECRET));

    const res = await verifySessionToken(raw, SECRET, { nowMs: NOW });
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects an expired remember-me (30d) session", async () => {
    // A remembered session created 30 days + 1h ago: both idle exp and absExp elapsed.
    const created = NOW - (REMEMBER_ME_TTL_MS + 60 * 60 * 1000);
    const token = await signSessionToken(
      claims({ rmb: true, absExp: created + REMEMBER_ME_TTL_MS }),
      SECRET,
      created,
    );
    const res = await verifySessionToken(token, SECRET, { nowMs: NOW });
    expect(res).toEqual({ ok: false, reason: "expired" });
  });
});

describe("session — invalid tokens", () => {
  it("rejects a malformed / garbage token as invalid", async () => {
    expect(await verifySessionToken("not-a-jwt", SECRET, { nowMs: NOW })).toEqual({ ok: false, reason: "invalid" });
    expect(await verifySessionToken("aaa.bbb.ccc", SECRET, { nowMs: NOW })).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a token signed with a different secret as invalid_signature", async () => {
    const token = await signSessionToken(claims(), OTHER_SECRET, NOW);
    const res = await verifySessionToken(token, SECRET, { nowMs: NOW });
    expect(res).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects a token missing required claims as invalid", async () => {
    const raw = await new SignJWT({ openId: "team:1", appId: "team" /* no name */ })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(NOW / 1000))
      .setExpirationTime(Math.floor((NOW + IDLE_TIMEOUT_MS) / 1000))
      .sign(new TextEncoder().encode(SECRET));
    const res = await verifySessionToken(raw, SECRET, { nowMs: NOW });
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a token that uses a non-HS256 algorithm", async () => {
    // 'none' alg must never be accepted (alg-confusion guard).
    const unsigned =
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") +
      "." +
      Buffer.from(JSON.stringify({ openId: "team:1", appId: "team", name: "x", exp: Math.floor((NOW + 1e6) / 1000) })).toString("base64url") +
      ".";
    const res = await verifySessionToken(unsigned, SECRET, { nowMs: NOW });
    expect(res.ok).toBe(false);
  });
});

describe("session — clock skew tolerance", () => {
  it("accepts a token expired by less than the skew tolerance", async () => {
    const token = await signSessionToken(claims(), SECRET, NOW);
    // 10s past the idle deadline — within the 30s tolerance → still valid.
    const justPast = NOW + IDLE_TIMEOUT_MS + 10_000;
    const res = await verifySessionToken(token, SECRET, { nowMs: justPast });
    expect(res.ok).toBe(true);
  });
});
