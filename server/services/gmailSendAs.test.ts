import { describe, expect, it, vi } from "vitest";
import { candidateSendAs, fromHeader, resolveSender } from "./gmailSendAs";
import { composeMime } from "./gmailCompose";
import { replyMime } from "./gmailReply";
import { parseGmailMessage } from "./gmailCrm";

const decode = (raw: string) => Buffer.from(raw, "base64url").toString("utf8");

describe("candidateSendAs", () => {
  it("only offers team addresses on the company domain", () => {
    expect(candidateSendAs("Heidi@MechanicalEnterprise.com")).toBe("heidi@mechanicalenterprise.com");
    expect(candidateSendAs("sales@mechanicalenterprise.com")).toBeNull();
    expect(candidateSendAs("someone@gmail.com")).toBeNull();
    expect(candidateSendAs("x@mechanicalenterprise.com.evil.io")).toBeNull();
    expect(candidateSendAs(null)).toBeNull();
  });
});

describe("resolveSender", () => {
  it("uses a verified alias with its display name", async () => {
    const request = vi.fn(async () => ({ sendAsEmail: "heidi@mechanicalenterprise.com", displayName: "Heidi", verificationStatus: "accepted" }));
    expect(await resolveSender("heidi@mechanicalenterprise.com", request)).toEqual({ email: "heidi@mechanicalenterprise.com", displayName: "Heidi" });
    expect(request).toHaveBeenCalledWith("settings/sendAs/heidi%40mechanicalenterprise.com");
  });
  it("falls back to sales@ when the alias is pending or missing", async () => {
    const pending = vi.fn(async () => ({ sendAsEmail: "heidi@mechanicalenterprise.com", verificationStatus: "pending" }));
    expect((await resolveSender("heidi@mechanicalenterprise.com", pending)).email).toBe("sales@mechanicalenterprise.com");
    const missing = vi.fn(async () => { throw new Error("404"); });
    expect((await resolveSender("heidi@mechanicalenterprise.com", missing)).email).toBe("sales@mechanicalenterprise.com");
  });
  it("never looks anything up for sales@ or outside addresses", async () => {
    const request = vi.fn();
    expect((await resolveSender("sales@mechanicalenterprise.com", request)).email).toBe("sales@mechanicalenterprise.com");
    expect((await resolveSender("a@gmail.com", request)).email).toBe("sales@mechanicalenterprise.com");
    expect(request).not.toHaveBeenCalled();
  });
});

describe("From header", () => {
  it("is written into composed and reply MIME", () => {
    const from = fromHeader({ email: "heidi@mechanicalenterprise.com", displayName: "Heidi" });
    expect(decode(composeMime("a@example.com", "Hi", "body", from))).toContain(`From: ${from}`);
    expect(decode(replyMime("a@example.com", "Re: Hi", "body", "<id@example.com>", "", from))).toContain(`From: ${from}`);
    expect(decode(composeMime("a@example.com", "Hi", "body"))).toContain("From: sales@mechanicalenterprise.com");
  });
  it("rejects header injection in the From value", () => {
    expect(() => composeMime("a@example.com", "Hi", "body", "x\r\nBcc: b@example.com")).toThrow();
  });
});

describe("Gmail sync with team aliases", () => {
  const msg = (headers: Record<string, string>, labelIds: string[]) => ({
    id: "m1", threadId: "t1", internalDate: "1794500000000", labelIds,
    payload: { mimeType: "text/plain", headers: Object.entries(headers).map(([name, value]) => ({ name, value })), body: { data: Buffer.from("hello").toString("base64url") } },
  });
  it("treats mail sent as heidi@ from the sales@ account as outbound", () => {
    const parsed = parseGmailMessage(msg({ From: "Heidi <heidi@mechanicalenterprise.com>", To: "client@example.com", Subject: "Hi" }, ["SENT"]) as any);
    expect(parsed?.direction).toBe("outbound");
    expect(parsed?.contacts).toEqual(["client@example.com"]);
  });
  it("imports a customer reply to heidi@ delivered to sales@ via the group", () => {
    const parsed = parseGmailMessage(msg({ From: "client@example.com", To: "heidi@mechanicalenterprise.com", "Delivered-To": "sales@mechanicalenterprise.com", Subject: "Re: Hi" }, ["INBOX"]) as any);
    expect(parsed?.direction).toBe("inbound");
    expect(parsed?.contacts).toEqual(["client@example.com"]);
  });
});
