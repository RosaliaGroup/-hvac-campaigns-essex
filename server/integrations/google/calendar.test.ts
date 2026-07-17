import { describe, it, expect } from "vitest";
import {
  mapToGoogleEvent,
  parseTokenResponse,
  buildAuthorizeUrl,
  GOOGLE_OAUTH_SCOPES,
  signState,
  verifyState,
  getGoogleConfig,
} from "./calendar";

describe("mapToGoogleEvent", () => {
  it("maps an appointment into a Google event with start/end + attendees", () => {
    const event = mapToGoogleEvent({
      summary: "Service Visit — Jane",
      description: "no heat",
      location: "500 Main St",
      scheduledAt: new Date("2026-07-08T19:53:00.000Z"),
      durationMinutes: 90,
      attendees: [{ email: "jane@example.com", name: "Jane" }, { email: "tech@x.com" }],
      timeZone: "America/New_York",
    }) as any;
    expect(event.summary).toBe("Service Visit — Jane");
    expect(event.location).toBe("500 Main St");
    expect(event.start).toEqual({ dateTime: "2026-07-08T19:53:00.000Z", timeZone: "America/New_York" });
    // 90 minutes later.
    expect(event.end.dateTime).toBe("2026-07-08T21:23:00.000Z");
    expect(event.attendees).toEqual([
      { email: "jane@example.com", displayName: "Jane" },
      { email: "tech@x.com" },
    ]);
    // No reminder requested → no overrides.
    expect(event.reminders).toEqual({ useDefault: false, overrides: [] });
  });

  it("omits optional fields when absent", () => {
    const event = mapToGoogleEvent({
      summary: "X",
      scheduledAt: new Date("2026-07-08T00:00:00.000Z"),
      durationMinutes: 60,
      attendees: [],
    }) as any;
    expect(event.description).toBeUndefined();
    expect(event.location).toBeUndefined();
    expect(event.start.timeZone).toBe("America/New_York");
    expect(event.conferenceData).toBeUndefined();
  });

  it("adds a reminder override when reminderMinutes is set (Google sync)", () => {
    const event = mapToGoogleEvent({
      summary: "X",
      scheduledAt: new Date("2026-07-08T00:00:00.000Z"),
      durationMinutes: 60,
      attendees: [],
      reminderMinutes: 30,
    }) as any;
    expect(event.reminders).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 30 }] });
  });

  it("requests a Google Meet when createMeet is set", () => {
    const event = mapToGoogleEvent({
      summary: "X",
      scheduledAt: new Date("2026-07-08T00:00:00.000Z"),
      durationMinutes: 60,
      attendees: [],
      createMeet: true,
      meetRequestId: "meet-42",
    }) as any;
    expect(event.conferenceData.createRequest.requestId).toBe("meet-42");
    expect(event.conferenceData.createRequest.conferenceSolutionKey).toEqual({ type: "hangoutsMeet" });
  });
});

describe("parseTokenResponse", () => {
  it("parses an authorization_code response", () => {
    const t = parseTokenResponse({ access_token: "at", refresh_token: "rt", expires_in: 3599, scope: "s" });
    expect(t).toMatchObject({ accessToken: "at", refreshToken: "rt", expiresIn: 3599, scope: "s" });
  });
  it("allows a missing refresh_token (refresh responses omit it)", () => {
    const t = parseTokenResponse({ access_token: "at", expires_in: 3600 });
    expect(t.refreshToken).toBeUndefined();
  });
  it("throws without an access_token", () => {
    expect(() => parseTokenResponse({})).toThrow(/access_token/);
  });
});

describe("OAuth state signing", () => {
  it("round-trips a signed nonce and rejects tampering", () => {
    const state = signState("nonce123");
    expect(verifyState(state)).toBe(true);
    expect(verifyState("nonce123.deadbeef")).toBe(false);
    expect(verifyState(undefined)).toBe(false);
    expect(verifyState("no-dot")).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  const url = buildAuthorizeUrl(
    { clientId: "cid", clientSecret: "sec", redirectUri: "https://app/cb" },
    signState("n"),
  );

  it("requests offline access with forced consent (re-prompts for the new scope)", () => {
    expect(url).toContain("client_id=cid");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain(encodeURIComponent("https://app/cb"));
  });

  it("requests Calendar, Search Console AND GA4 Analytics scopes in one consent flow", () => {
    expect(url).toContain(encodeURIComponent("https://www.googleapis.com/auth/calendar.events"));
    expect(url).toContain(encodeURIComponent("https://www.googleapis.com/auth/webmasters.readonly"));
    expect(url).toContain(encodeURIComponent("https://www.googleapis.com/auth/analytics.readonly"));
  });

  it("preserves every required scope in the authorization URL (nothing dropped)", () => {
    // Adding analytics.readonly must not remove any previously-granted scope.
    for (const scope of GOOGLE_OAUTH_SCOPES) {
      expect(url).toContain(encodeURIComponent(scope));
    }
    expect(GOOGLE_OAUTH_SCOPES).toContain("openid");
    expect(GOOGLE_OAUTH_SCOPES).toContain("email");
    expect(GOOGLE_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(GOOGLE_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(GOOGLE_OAUTH_SCOPES).toContain("https://www.googleapis.com/auth/analytics.readonly");
  });

  it("exposes the exact scope set", () => {
    expect(GOOGLE_OAUTH_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/business.manage",
    ]);
  });
});

describe("getGoogleConfig", () => {
  it("returns a shape with clientId/clientSecret/redirectUri", () => {
    const cfg = getGoogleConfig();
    expect(cfg).toHaveProperty("clientId");
    expect(cfg).toHaveProperty("clientSecret");
    expect(cfg).toHaveProperty("redirectUri");
  });
});
