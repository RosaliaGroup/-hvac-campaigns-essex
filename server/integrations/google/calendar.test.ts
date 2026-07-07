import { describe, it, expect } from "vitest";
import {
  mapToGoogleEvent,
  parseTokenResponse,
  buildAuthorizeUrl,
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
    expect(event.reminders).toEqual({ useDefault: true });
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
  it("requests offline access with forced consent and calendar scope", () => {
    const url = buildAuthorizeUrl(
      { clientId: "cid", clientSecret: "sec", redirectUri: "https://app/cb" },
      signState("n"),
    );
    expect(url).toContain("client_id=cid");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain(encodeURIComponent("https://www.googleapis.com/auth/calendar.events"));
    expect(url).toContain(encodeURIComponent("https://app/cb"));
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
