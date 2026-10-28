import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../integrations/google/calendar", () => ({ googleCalendarProvider: { getValidAccessToken: vi.fn() } }));

// Fresh module graph per test so the shared in-process cooldown starts clear.
async function load() {
  vi.resetModules();
  const gmail = await import("./prospectGmail");
  const cooldown = await import("./gmailQuotaCooldown");
  return { ...gmail, cooldown };
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("prospect Gmail transport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies the sender identity is sales@ only", async () => {
    const { createProspectMailbox, GmailStopError } = await load();
    const fetchImpl = vi.fn(async () => json(200, { emailAddress: "inquiries@rosaliagroup.com" }));
    await expect(createProspectMailbox("t", fetchImpl as any).verifyIdentity()).rejects.toBeInstanceOf(GmailStopError);
    const ok = vi.fn(async () => json(200, { emailAddress: "Sales@MechanicalEnterprise.com" }));
    await expect(createProspectMailbox("t", ok as any).verifyIdentity()).resolves.toBe("sales@mechanicalenterprise.com");
  });

  it("a 403 rate limit stops the run AND starts the shared cooldown for every scanner", async () => {
    const { createProspectMailbox, cooldown } = await load();
    const fetchImpl = vi.fn(async () => json(403, { error: { errors: [{ reason: "rateLimitExceeded" }], status: "RATE_LIMIT_EXCEEDED" } }));
    const mb = createProspectMailbox("t", fetchImpl as any);
    await expect(mb.hasSent("a@b.com")).rejects.toMatchObject({ name: "GmailStopError", kind: "rate_limited" });
    expect(cooldown.gmailQuotaRemainingMs()).toBeGreaterThan(0);
    // Next call never reaches Google.
    await expect(mb.hasSent("c@d.com")).rejects.toMatchObject({ kind: "rate_limited" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("429 is treated as a rate limit", async () => {
    const { createProspectMailbox } = await load();
    const mb = createProspectMailbox("t", vi.fn(async () => json(429, {})) as any);
    await expect(mb.verifyIdentity()).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("a non-quota 403 is a permission stop, without a quota cooldown", async () => {
    const { createProspectMailbox, cooldown } = await load();
    const mb = createProspectMailbox("t", vi.fn(async () => json(403, { error: { status: "PERMISSION_DENIED", message: "Insufficient Permission" } })) as any);
    await expect(mb.hasSent("a@b.com")).rejects.toMatchObject({ kind: "permission_denied" });
    expect(cooldown.gmailQuotaRemainingMs()).toBe(0);
  });

  it("counts this hour's outreach with complete pagination, excluding admin reports", async () => {
    const { createProspectMailbox } = await load();
    const pages = [{ messages: [{ id: "1" }, { id: "2" }], nextPageToken: "p2" }, { messages: [{ id: "3" }] }];
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => { urls.push(url); return json(200, pages[urls.length - 1]); });
    const n = await createProspectMailbox("t", fetchImpl as any).outreachSentSince(1_800_000_000);
    expect(n).toBe(3);
    expect(decodeURIComponent(urls[0])).toContain('in:sent after:1800000000 -subject:"Mechanical Enterprise Hourly Outreach Report"');
    expect(urls[1]).toContain("pageToken=p2");
  });

  it("bounce check is narrow and bounded (no 100-message full-format sweep)", async () => {
    const { createProspectMailbox } = await load();
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => { urls.push(url); return json(200, {}); });
    expect(await createProspectMailbox("t", fetchImpl as any).hasBounce("jane@acme.com", 1_800_000_000)).toBe(false);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("maxResults=5");
    expect(decodeURIComponent(urls[0])).toContain('"jane@acme.com" after:1800000000');
  });

  it("follow-ups are sent in the original thread with reply headers", async () => {
    const { createProspectMailbox } = await load();
    let body: any;
    const fetchImpl = vi.fn(async (_u: string, init: any) => { body = JSON.parse(init.body); return json(200, { id: "m2", threadId: "t1" }); });
    const sent = await createProspectMailbox("t", fetchImpl as any).send({ to: "jane@acme.com", subject: "Re: Hi", body: "x", threadId: "t1", inReplyTo: "<abc@mail>" });
    expect(sent).toEqual({ id: "m2", threadId: "t1" });
    expect(body.threadId).toBe("t1");
    const mime = Buffer.from(body.raw, "base64url").toString();
    expect(mime).toContain("In-Reply-To: <abc@mail>");
    expect(mime).toContain("From: sales@mechanicalenterprise.com");
  });

  it("refuses to thread without a Message-ID and rejects header injection", async () => {
    const { createProspectMailbox } = await load();
    const mb = createProspectMailbox("t", vi.fn() as any);
    await expect(mb.send({ to: "a@b.com", subject: "s", body: "b", threadId: "t1" })).rejects.toThrow(/thread/);
    await expect(mb.send({ to: "a@b.com\r\nBcc: x@y.com", subject: "s", body: "b" })).rejects.toThrow(/Invalid recipient/);
  });

  it("thread state detects replies, bounces and prior outbound steps", async () => {
    const { createProspectMailbox } = await load();
    const msg = (from: string, labels: string[], extra: Record<string, string> = {}) => ({
      labelIds: labels, payload: { headers: [{ name: "From", value: from }, ...Object.entries(extra).map(([name, value]) => ({ name, value }))] },
    });
    const thread = { messages: [
      msg("Ana <sales@mechanicalenterprise.com>", ["SENT"], { Subject: "HVAC", "Message-ID": "<1@x>" }),
      msg("sales@mechanicalenterprise.com", ["SENT"], { "Message-ID": "<2@x>" }),
    ] };
    const mb = createProspectMailbox("t", vi.fn(async () => json(200, thread)) as any);
    expect(await mb.threadState("t1", "jane@acme.com")).toEqual({
      outboundCount: 2, replied: false, bounced: false, lastMessageIdHeader: "<2@x>", originalSubject: "HVAC",
    });
    const replied = createProspectMailbox("t", vi.fn(async () => json(200, { messages: [...thread.messages, msg("Jane <jane@acme.com>", ["INBOX"])] })) as any);
    expect((await replied.threadState("t1", "jane@acme.com")).replied).toBe(true);
  });
});
