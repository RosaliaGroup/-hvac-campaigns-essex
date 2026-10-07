import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  token: vi.fn(),
  db: vi.fn(),
  upsert: vi.fn(),
  log: vi.fn(),
}));
vi.mock("../integrations/google/calendar", () => ({
  googleCalendarProvider: {
    getConnection: mocks.connection,
    getValidAccessToken: mocks.token,
  },
}));
vi.mock("../db", () => ({ getDb: mocks.db }));
vi.mock("./crmCommunications", () => ({
  upsertExternalContact: mocks.upsert,
  logCommunication: mocks.log,
}));
import {
  CRM_MAILBOX,
  GMAIL_SCOPE,
  parseGmailMessage,
  syncGmailPage,
} from "./gmailCrm";
const message = (from = CRM_MAILBOX, to = "agent@example.com") => ({
  id: "gmail1",
  threadId: "thread1",
  internalDate: "1791327600000",
  payload: {
    headers: [
      { name: "From", value: from },
      { name: "To", value: to },
      { name: "Subject", value: "HVAC quote" },
    ],
    mimeType: "multipart/alternative",
    parts: [
      {
        mimeType: "text/html",
        body: { data: Buffer.from("<b>hello</b>").toString("base64url") },
      },
      {
        mimeType: "text/plain",
        body: { data: Buffer.from("hello").toString("base64url") },
      },
    ],
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.connection.mockResolvedValue({
    status: "connected",
    googleAccountEmail: CRM_MAILBOX,
    scope: GMAIL_SCOPE,
  });
  mocks.token.mockResolvedValue({ accessToken: "private-token" });
  mocks.db.mockResolvedValue({});
  mocks.upsert.mockResolvedValue({ id: 7 });
  mocks.log.mockResolvedValue({ id: 8, duplicate: false });
});
describe("Gmail CRM", () => {
  it.each([
    ["SERVICE_DISABLED", "Google Cloud project"],
    ["ACCESS_TOKEN_SCOPE_INSUFFICIENT", "approve Gmail read access"],
    ["domainPolicy", "Workspace administrator"],
  ])("explains Google rejection %s without exposing the response", async (reason, explanation) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "private-token", errors: [{ reason }] },
    }), { status: 403 }));
    await expect(syncGmailPage({}, fetcher)).rejects.toThrow(explanation);
    await expect(syncGmailPage({}, fetcher)).rejects.not.toThrow("private-token");
  });
  it("handles a non-JSON Google error", async () => {
    const fetcher = vi.fn().mockImplementation(() => new Response("unavailable", { status: 503 }));
    await expect(syncGmailPage({}, fetcher)).rejects.toThrow("Gmail read failed (503)");
  });
  it("keeps Gmail message/thread IDs and decodes plain text without HTML", () => {
    expect(parseGmailMessage(message())).toMatchObject({
      direction: "outbound",
      contacts: ["agent@example.com"],
      providerMessageId: "gmail1",
      providerThreadId: "thread1",
      body: "hello",
    });
  });
  it("recognizes replies and excludes unrelated mail and drafts", () => {
    expect(
      parseGmailMessage(message("Agent <agent@example.com>", CRM_MAILBOX))
    ).toMatchObject({ direction: "inbound", contacts: ["agent@example.com"] });
    expect(
      parseGmailMessage(message("agent@example.com", "other@example.com"))
    ).toBeNull();
    expect(parseGmailMessage({ ...message(), labelIds: ["DRAFT"] })).toBeNull();
  });
  it("rejects invalid dates and preserves recipient order without duplicates", () => {
    expect(
      parseGmailMessage({ ...message(), internalDate: "invalid" })
    ).toBeNull();
    expect(
      parseGmailMessage(
        message(
          CRM_MAILBOX,
          "A <a@example.com>, A <a@example.com>, b@example.com"
        )
      )?.contacts
    ).toEqual(["a@example.com", "b@example.com"]);
  });
  it("does not call Gmail without explicit read permission", async () => {
    mocks.connection.mockResolvedValue({
      status: "connected",
      scope: "openid",
    });
    const fetcher = vi.fn();
    await expect(syncGmailPage({}, fetcher)).rejects.toThrow(
      "grant Gmail read permission"
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects the wrong actual mailbox before any CRM write", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ emailAddress: "other@example.com" }),
      });
    await expect(syncGmailPage({}, fetcher)).rejects.toThrow(
      `Connect ${CRM_MAILBOX}`
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("imports sent/replied messages read-only and passes pagination back", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: CRM_MAILBOX }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ id: "gmail1" }],
          nextPageToken: "page2",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => message() });
    expect(await syncGmailPage({ pageToken: "page1" }, fetcher)).toEqual({
      imported: 1,
      duplicates: 0,
      skipped: 0,
      nextPageToken: "page2",
    });
    expect(fetcher.mock.calls[1][0]).toContain("pageToken=page1");
    expect(mocks.log).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        externalContactId: 7,
        provider: "gmail",
        providerMessageId: "gmail1",
      })
    );
    expect(fetcher.mock.calls.every(([, options]) => !options.method)).toBe(
      true
    );
  });
  it("counts duplicate Gmail IDs without adding another communication", async () => {
    mocks.log.mockResolvedValue({ id: 8, duplicate: true });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ emailAddress: CRM_MAILBOX }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: "gmail1" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => message("agent@example.com", CRM_MAILBOX),
      });
    expect(await syncGmailPage({}, fetcher)).toMatchObject({
      imported: 0,
      duplicates: 1,
    });
  });
});
