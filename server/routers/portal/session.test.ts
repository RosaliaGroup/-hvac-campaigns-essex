import "./testEnv"; // MUST be first — sets JWT_SECRET before sdk/env load
import { describe, expect, it } from "vitest";
import { sdk } from "../../_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import {
  createPortalSession,
  readPortalToken,
  resolvePortalPrincipal,
  PORTAL_COOKIE,
} from "./session";

const reqWith = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as never;

describe("portal session — token extraction", () => {
  it("reads the portal token from a cookie header", () => {
    const header = `${PORTAL_COOKIE}=abc123; other=zzz`;
    expect(readPortalToken(reqWith(header))).toBe("abc123");
  });

  it("returns null when no cookie header is present", () => {
    expect(readPortalToken(reqWith(undefined))).toBeNull();
  });

  it("returns null when the portal cookie is absent among others", () => {
    expect(readPortalToken(reqWith("app_session_id=team-token; foo=bar"))).toBeNull();
  });
});

describe("portal session — signing", () => {
  it("mints a token whose openId is portal-scoped and appId is 'portal'", async () => {
    const token = await createPortalSession(42, "Jane Customer");
    const payload = await sdk.verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload!.openId).toBe("portal:42");
    expect(payload!.appId).toBe("portal");
    expect(payload!.name).toBe("Jane Customer");
  });
});

describe("portal session — principal resolution fails safe", () => {
  it("returns null when there is no token", async () => {
    expect(await resolvePortalPrincipal(reqWith(undefined))).toBeNull();
  });

  it("returns null for a malformed token", async () => {
    expect(await resolvePortalPrincipal(reqWith(`${PORTAL_COOKIE}=not-a-jwt`))).toBeNull();
  });

  it("rejects a TEAM session cookie (cross-realm isolation)", async () => {
    // A valid team token must NOT authenticate against the portal realm.
    const teamToken = await sdk.signSession(
      { openId: "team:1", appId: "team", name: "Staffer" },
      { expiresInMs: ONE_YEAR_MS },
    );
    expect(await resolvePortalPrincipal(reqWith(`${PORTAL_COOKIE}=${teamToken}`))).toBeNull();
  });

  it("rejects an expired portal token (revocation via expiry)", async () => {
    const expired = await sdk.signSession(
      { openId: "portal:7", appId: "portal", name: "Old" },
      { expiresInMs: -1000 },
    );
    expect(await resolvePortalPrincipal(reqWith(`${PORTAL_COOKIE}=${expired}`))).toBeNull();
  });

  it("rejects a token whose openId is not portal-prefixed", async () => {
    const wrongPrefix = await sdk.signSession(
      { openId: "42", appId: "portal", name: "NoPrefix" },
      { expiresInMs: ONE_YEAR_MS },
    );
    expect(await resolvePortalPrincipal(reqWith(`${PORTAL_COOKIE}=${wrongPrefix}`))).toBeNull();
  });
});
