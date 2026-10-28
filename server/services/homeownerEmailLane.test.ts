import { describe, expect, it } from "vitest";
import {
  firstNameFor, followUpEmail, homeownerAllowance, introEmail, isRealEmail,
} from "../../shared/homeownerEmail";
import { homeownerConfig, runHomeownerEmailHour, unsubscribeUrl, verifyUnsubscribe } from "./homeownerEmailLane";

const SECRET = "test-secret-0123456789abcdef";
const ADDRESS = "123 Example St, Newark, NJ 07105";

describe("homeowner email copy (CAN-SPAM)", () => {
  const url = unsubscribeUrl("Jane@Example.com", SECRET);
  it("intro identifies sender, explains source, has unsubscribe + postal address, correct phone", () => {
    const { subject, body } = introEmail({ firstName: "Jane", unsubscribeUrl: url, postalAddress: ADDRESS });
    expect(subject).toMatch(/Mechanical Enterprise/);
    expect(body).toContain(url);
    expect(body).toContain(ADDRESS);
    expect(body).toMatch(/reply "unsubscribe"/);
    expect(body).toMatch(/mailing list we obtained/);
    expect(body).toContain("(862) 423-9396");
    expect(body).not.toContain("449-6850");
    expect(body).not.toMatch(/you (requested|inquired|contacted us)/i);
  });
  it("follow-up threads the original subject once", () => {
    expect(followUpEmail({ firstName: "Jane", unsubscribeUrl: url, postalAddress: ADDRESS, originalSubject: "Hello" }).subject).toBe("Re: Hello");
    expect(followUpEmail({ firstName: "Jane", unsubscribeUrl: url, postalAddress: ADDRESS, originalSubject: "Re: Hello" }).subject).toBe("Re: Hello");
  });
  it("names are tidy or fall back to 'there'", () => {
    expect(firstNameFor("JOHN", null)).toBe("John");
    expect(firstNameFor(null, "mary smith")).toBe("Mary");
    expect(firstNameFor("J.", null)).toBe("there");
    expect(firstNameFor(null, "")).toBe("there");
  });
  it("rejects placeholder emails", () => {
    expect(isRealEmail("x@placeholder.mwbe")).toBe(false);
    expect(isRealEmail("jane@example.com")).toBe(true);
  });
});

describe("unsubscribe tokens", () => {
  it("round-trips and rejects tampering", () => {
    const url = new URL(unsubscribeUrl("Jane@Example.com", SECRET));
    const e = url.searchParams.get("e"), t = url.searchParams.get("t");
    expect(verifyUnsubscribe(e, t, SECRET)).toBe("jane@example.com");
    expect(verifyUnsubscribe(e, t, "other-secret-0123456789")).toBeNull();
    expect(verifyUnsubscribe(Buffer.from("bob@example.com").toString("base64url"), t, SECRET)).toBeNull();
  });
});

describe("pacing", () => {
  it("respects per-hour, shared hourly ceiling and daily limits; fails closed", () => {
    expect(homeownerAllowance({ perHour: 6, perDay: 40, sentThisHourAllOutreach: 0, homeownerSentToday: 0 })).toBe(6);
    expect(homeownerAllowance({ perHour: 6, perDay: 40, sentThisHourAllOutreach: 17, homeownerSentToday: 0 })).toBe(3);
    expect(homeownerAllowance({ perHour: 6, perDay: 40, sentThisHourAllOutreach: 25, homeownerSentToday: 0 })).toBe(0);
    expect(homeownerAllowance({ perHour: 6, perDay: 40, sentThisHourAllOutreach: 0, homeownerSentToday: 38 })).toBe(2);
    expect(homeownerAllowance({ perHour: 6, perDay: 40, sentThisHourAllOutreach: null, homeownerSentToday: 0 })).toBe(0);
  });
});

describe("gating", () => {
  const env = { HOMEOWNER_EMAIL_ENABLED: "true", HOMEOWNER_EMAIL_POSTAL_ADDRESS: ADDRESS, JWT_SECRET: SECRET } as NodeJS.ProcessEnv;
  const noDb = new Proxy({}, { get: () => { throw new Error("db must not be touched"); } }) as any;
  it("does nothing until enabled with a postal address", async () => {
    const cfg = homeownerConfig({ HOMEOWNER_EMAIL_ENABLED: "true" } as NodeJS.ProcessEnv);
    expect(cfg.enabled).toBe(false);
    expect(cfg.missing.join(" ")).toMatch(/POSTAL_ADDRESS/);
    expect((await runHomeownerEmailHour(noDb, { env: {} as NodeJS.ProcessEnv })).skipped).toBe("not_configured");
  });
  it("never sends on weekends, outside 9–5 ET, or before :30", async () => {
    expect((await runHomeownerEmailHour(noDb, { env, now: new Date("2026-10-31T15:45:00Z") })).skipped).toBe("outside_sending_hours"); // Sat
    expect((await runHomeownerEmailHour(noDb, { env, now: new Date("2026-10-29T23:45:00Z") })).skipped).toBe("outside_sending_hours"); // 7:45pm ET
    expect((await runHomeownerEmailHour(noDb, { env, now: new Date("2026-10-29T15:10:00Z") })).skipped).toBe("waiting_for_commercial_cycle");
  });
});
