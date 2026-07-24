/**
 * Auth Hardening — staging env-override validation.
 * Confirms the auth durations honor env overrides (for shortening on staging)
 * and fall back to the production defaults when unset/blank/invalid. Uses
 * vi.resetModules + dynamic import so each case re-reads process.env at load.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { envPositiveInt, envBoundedInt } from "./envInt";

const DUR_VARS = [
  "SESSION_TTL_MS",
  "REMEMBER_ME_TTL_MS",
  "IDLE_TIMEOUT_MS",
  "JWT_CLOCK_SKEW_SECONDS",
];

afterEach(() => {
  for (const v of DUR_VARS) delete process.env[v];
  vi.resetModules();
});

describe("envPositiveInt", () => {
  it("uses the value when a positive integer, else the fallback", () => {
    process.env.__T = "120000";
    expect(envPositiveInt("__T", 999)).toBe(120000);
    process.env.__T = "0";
    expect(envPositiveInt("__T", 999)).toBe(999); // zero → fallback
    process.env.__T = "-5";
    expect(envPositiveInt("__T", 999)).toBe(999); // negative → fallback
    process.env.__T = "not-a-number";
    expect(envPositiveInt("__T", 999)).toBe(999); // NaN → fallback
    process.env.__T = "  ";
    expect(envPositiveInt("__T", 999)).toBe(999); // blank → fallback
    delete process.env.__T;
    expect(envPositiveInt("__T", 999)).toBe(999); // unset → fallback
    process.env.__T = "300000.9";
    expect(envPositiveInt("__T", 999)).toBe(300000); // floored
    delete process.env.__T;
  });
});

describe("envBoundedInt — safe maximums", () => {
  it("clamps values above the max and keeps in-range values", () => {
    process.env.__B = "999";
    expect(envBoundedInt("__B", 10, 100)).toBe(100); // clamp to max
    process.env.__B = "50";
    expect(envBoundedInt("__B", 10, 100)).toBe(50); // in range
    process.env.__B = "100";
    expect(envBoundedInt("__B", 10, 100)).toBe(100); // exactly max
    process.env.__B = "0";
    expect(envBoundedInt("__B", 10, 100)).toBe(10); // non-positive → default
    process.env.__B = "nope";
    expect(envBoundedInt("__B", 10, 100)).toBe(10); // invalid → default
    delete process.env.__B;
    expect(envBoundedInt("__B", 10, 100)).toBe(10); // unset → default
  });
});

describe("auth durations enforce safe maximums (no permanent sessions)", () => {
  it("clamps an absurd SESSION_TTL_MS to 24h and idle to the session lifetime", async () => {
    vi.resetModules();
    process.env.SESSION_TTL_MS = String(365 * 24 * 60 * 60 * 1000); // 1 year
    process.env.IDLE_TIMEOUT_MS = String(999 * 24 * 60 * 60 * 1000); // absurd
    process.env.JWT_CLOCK_SKEW_SECONDS = String(99999); // absurd
    process.env.REMEMBER_ME_TTL_MS = String(999 * 24 * 60 * 60 * 1000); // > 30d

    const mod = await import("./session");
    expect(mod.SESSION_TTL_MS).toBe(mod.MAX_SESSION_TTL_MS); // 24h ceiling
    expect(mod.SESSION_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(mod.IDLE_TIMEOUT_MS).toBe(mod.SESSION_TTL_MS); // idle ≤ absolute lifetime
    expect(mod.CLOCK_TOLERANCE_SEC).toBe(mod.MAX_CLOCK_SKEW_SEC); // 120s ceiling
    expect(mod.REMEMBER_ME_TTL_MS).toBe(mod.MAX_REMEMBER_ME_TTL_MS); // 30d ceiling
  });
});

describe("session durations honor staging env overrides", () => {
  it("applies shortened durations when the env vars are set", async () => {
    vi.resetModules();
    process.env.SESSION_TTL_MS = String(5 * 60 * 1000); // 5 min
    process.env.REMEMBER_ME_TTL_MS = String(10 * 60 * 1000); // 10 min
    process.env.IDLE_TIMEOUT_MS = String(2 * 60 * 1000); // 2 min
    process.env.JWT_CLOCK_SKEW_SECONDS = String(5);

    const mod = await import("./session");
    expect(mod.SESSION_TTL_MS).toBe(5 * 60 * 1000);
    expect(mod.REMEMBER_ME_TTL_MS).toBe(10 * 60 * 1000);
    expect(mod.IDLE_TIMEOUT_MS).toBe(2 * 60 * 1000);
    expect(mod.CLOCK_TOLERANCE_SEC).toBe(5);
    // The remember-device selector reflects the override too.
    expect(mod.sessionTtlMs(false)).toBe(5 * 60 * 1000);
    expect(mod.sessionTtlMs(true)).toBe(10 * 60 * 1000);
  });

  it("falls back to production defaults when unset or invalid", async () => {
    vi.resetModules();
    for (const v of DUR_VARS) delete process.env[v];
    process.env.IDLE_TIMEOUT_MS = "garbage"; // invalid → default

    const mod = await import("./session");
    expect(mod.SESSION_TTL_MS).toBe(8 * 60 * 60 * 1000); // 8h
    expect(mod.REMEMBER_ME_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000); // 30d
    expect(mod.IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000); // 30m
    expect(mod.CLOCK_TOLERANCE_SEC).toBe(30); // 30s
  });

  it("a shortened idle window actually expires a freshly minted token", async () => {
    vi.resetModules();
    process.env.IDLE_TIMEOUT_MS = String(2 * 60 * 1000); // 2 min
    const mod = await import("./session");

    const NOW = 1_700_000_000_000;
    const token = await mod.signSessionToken(
      { openId: "team:1", appId: "team", name: "X", absExp: NOW + mod.SESSION_TTL_MS, rmb: false },
      "staging-secret",
      NOW,
    );
    // Valid within 2m; expired past 2m + the 30s clock-skew tolerance.
    expect((await mod.verifySessionToken(token, "staging-secret", { nowMs: NOW + 60 * 1000 })).ok).toBe(true);
    const expired = await mod.verifySessionToken(token, "staging-secret", { nowMs: NOW + 2 * 60 * 1000 + 60_000 });
    expect(expired).toEqual({ ok: false, reason: "expired" });
  });
});
