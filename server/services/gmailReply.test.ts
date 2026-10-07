import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  status: vi.fn(),
  token: vi.fn(),
  log: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: mocks.db }));
vi.mock("./gmailCrm", () => ({
  CRM_MAILBOX: "sales@mechanicalenterprise.com",
  gmailCrmStatus: mocks.status,
  addresses: (s: string) => s.match(/[\w.+-]+@[\w.-]+\.[a-z]+/gi) ?? [],
}));
vi.mock("../integrations/google/calendar", () => ({
  googleCalendarProvider: { getValidAccessToken: mocks.token },
}));
vi.mock("./crmCommunications", () => ({ logCommunication: mocks.log }));
import { replyMime, sendGmailReply } from "./gmailReply";
beforeEach(() => {
  mocks.status.mockResolvedValue({
    connected: true,
    hasReadPermission: true,
    hasSendPermission: true,
  });
  mocks.token.mockResolvedValue({ accessToken: "token" });
  mocks.log.mockReset().mockResolvedValue({});
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => [
      {
        provider: "gmail",
        channel: "email",
        providerMessageId: "original",
        direction: "inbound",
      },
    ],
  };
  mocks.db.mockResolvedValue(chain);
});
describe("Gmail replies", () => {
  it("refuses a different connected Gmail mailbox before sending", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ emailAddress: "other@example.com" })));
    await expect(sendGmailReply({ externalContactId: 1, messageId: 2, body: "hi" }, fetcher)).rejects.toThrow("Connect sales@");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects injected headers and encodes Unicode bodies", () => {
    expect(() =>
      replyMime(
        "a@example.com\r\nBcc: b@example.com",
        "subject",
        "body",
        "<id@example.com>",
        ""
      )
    ).toThrow();
    const mime = Buffer.from(
      replyMime("a@example.com", "Re: Olá", "Olá", "<id@example.com>", ""),
      "base64url"
    ).toString();
    expect(mime).toContain("In-Reply-To: <id@example.com>");
    expect(mime).toContain(Buffer.from("Olá").toString("base64"));
  });
  it("requires send permission before contacting Gmail", async () => {
    mocks.status.mockResolvedValue({
      connected: true,
      hasReadPermission: true,
      hasSendPermission: false,
    });
    const fetcher = vi.fn();
    await expect(
      sendGmailReply(
        { externalContactId: 1, messageId: 2, body: "hi" },
        fetcher
      )
    ).rejects.toThrow("send permission");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends in the original thread and does not fail an accepted send when CRM logging fails", async () => {
    mocks.log.mockRejectedValue(new Error("db failed"));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ emailAddress: "sales@mechanicalenterprise.com" })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            threadId: "thread",
            payload: {
              headers: [
                { name: "From", value: "a@example.com" },
                { name: "Message-ID", value: "<id@example.com>" },
                { name: "Subject", value: "Quote" },
              ],
            },
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "sent", threadId: "thread" }))
      );
    const result = await sendGmailReply(
      { externalContactId: 1, messageId: 2, body: "hi" },
      fetcher
    );
    expect(result.sent).toBe(true);
    expect(result.warning).toContain("Email sent");
    expect(JSON.parse(fetcher.mock.calls[2][1].body).threadId).toBe("thread");
    expect(mocks.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerMessageId: "sent",
        externalContactId: 1,
      })
    );
  });
});
