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
}));
vi.mock("../integrations/google/calendar", () => ({
  googleCalendarProvider: { getValidAccessToken: mocks.token },
}));
vi.mock("./crmCommunications", () => ({ logCommunication: mocks.log }));
import { composeMime, composeGmail } from "./gmailCompose";
const input = {
  externalContactId: 1,
  subject: "Olá",
  body: "Hello Amit",
  action: "draft" as const,
};
beforeEach(() => {
  mocks.status.mockResolvedValue({
    connected: true,
    hasReadPermission: true,
    hasSendPermission: true,
    hasDraftPermission: true,
  });
  mocks.token.mockResolvedValue({ accessToken: "token" });
  mocks.log.mockReset().mockResolvedValue({});
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => [{ id: 1, email: "amit@example.com", customerId: 2 }],
  };
  mocks.db.mockResolvedValue(chain);
});
const profile = () =>
  new Response(
    JSON.stringify({ emailAddress: "sales@mechanicalenterprise.com" })
  );
describe("new email and Gmail drafts", () => {
  it("rejects header injection and encodes Unicode without reply headers", () => {
    expect(() =>
      composeMime("a@example.com\r\nBcc:b@example.com", "Hi", "body")
    ).toThrow();
    expect(() =>
      composeMime("a@example.com", "Hi\r\nBcc:b@example.com", "body")
    ).toThrow();
    const raw = Buffer.from(
      composeMime("a@example.com", "Olá", "Olá"),
      "base64url"
    ).toString();
    expect(raw).toContain(Buffer.from("Olá").toString("base64"));
    expect(raw).not.toContain("In-Reply-To");
  });
  it("saves a Gmail draft without sending or logging a sent email", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "draft-1" })));
    expect(await composeGmail(input, fetcher)).toEqual({
      draftSaved: true,
      draftId: "draft-1",
    });
    expect(fetcher.mock.calls[1][0]).toMatch(/\/drafts$/);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).message.raw).toBeTruthy();
    expect(mocks.log).not.toHaveBeenCalled();
  });
  it("requires draft permission before contacting Gmail", async () => {
    mocks.status.mockResolvedValue({
      connected: true,
      hasReadPermission: true,
      hasSendPermission: true,
      hasDraftPermission: false,
    });
    const fetcher = vi.fn();
    await expect(composeGmail(input, fetcher)).rejects.toThrow("Reconnect");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses the wrong connected mailbox", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ emailAddress: "other@example.com" }))
      );
    await expect(composeGmail(input, fetcher)).rejects.toThrow(
      "Connect sales@"
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("sends a new thread and records the CRM contact link", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "sent-1", threadId: "thread-1" }))
      );
    expect(await composeGmail({ ...input, action: "send" }, fetcher)).toEqual({
      sent: true,
      warning: undefined,
    });
    expect(fetcher.mock.calls[1][0]).toMatch(/\/messages\/send$/);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).threadId).toBeUndefined();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: 2,
        externalContactId: 1,
        providerMessageId: "sent-1",
        toAddress: "amit@example.com",
      })
    );
  });
  it("does not retry an accepted send when history logging fails", async () => {
    mocks.log.mockRejectedValue(new Error("database"));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "sent-1" })));
    expect(await composeGmail({ ...input, action: "send" }, fetcher)).toEqual(
      expect.objectContaining({ sent: true, warning: expect.any(String) })
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
