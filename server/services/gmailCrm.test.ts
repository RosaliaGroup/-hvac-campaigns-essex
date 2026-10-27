import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  token: vi.fn(),
  db: vi.fn(),
  upsert: vi.fn(),
  log: vi.fn(),
  promote: vi.fn(),
  queue: vi.fn(),
  suppressed: vi.fn(),
  stored: [] as any[],
}));
vi.mock("../integrations/google/calendar", () => ({
  googleCalendarProvider: {
    getConnection: mocks.connection,
    getValidAccessToken: mocks.token,
  },
}));
vi.mock("../db", () => ({ getDb: mocks.db }));
vi.mock("./sentEmailContact", () => ({
  ensureSentEmailContact: mocks.promote,
}));
vi.mock("./automaticContactEnrichment", () => ({
 approvedContactSource: (source:string) => ["gmail-selected","gmail-prospecting","verified-hvac-prospect","crm-manual"].includes(source),
 queueContactEnrichment:mocks.queue,
}));
vi.mock("./outreachSuppression", () => ({
  seedKnownOutreachSuppressions: vi.fn().mockResolvedValue(13),
  recordOutreachSuppression: vi.fn().mockResolvedValue({}),
  isExplicitOutreachOptOut: vi.fn().mockReturnValue(false),
  isOutreachSuppressed: mocks.suppressed,
  KNOWN_OUTREACH_SUPPRESSIONS: [],
}));
vi.mock("./crm30DayTasks", () => ({ cancelOpen30DayTasks: vi.fn().mockResolvedValue(0) }));
vi.mock("./crmFollowupTasks", () => ({ followupDatabase: vi.fn().mockResolvedValue({}), followupTasks: {} }));
vi.mock("./crmCommunications", () => ({
  upsertExternalContact: mocks.upsert,
  logCommunication: mocks.log,
}));
import {
  CRM_MAILBOX,
  GMAIL_SCOPE,
  parseGmailMessage,
  syncGmailPage,
  syncGmailBatch,
} from "./gmailCrm";
import { GmailQuotaCooldownError } from "./gmailQuotaCooldown";
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
  mocks.suppressed.mockResolvedValue(false);
  mocks.connection.mockResolvedValue({
    status: "connected",
    googleAccountEmail: CRM_MAILBOX,
    scope: GMAIL_SCOPE,
  });
  mocks.token.mockResolvedValue({ accessToken: "private-token" });
  mocks.stored = [];
  const chain: any = { select: () => chain, from: () => chain, where: () => chain, limit: async () => [], update: () => chain, set: () => chain };
  chain.select = (columns?: unknown) => columns ? { from: () => ({ where: async () => mocks.stored }) } : chain;
  mocks.db.mockResolvedValue(chain);
  mocks.upsert.mockImplementation(async (_db, input) => ({id:7,...input}));
  mocks.log.mockResolvedValue({ id: 8, duplicate: false });
  mocks.promote.mockResolvedValue(10);
});
describe("Gmail CRM", () => {
  it("does not download full bodies for complete saved messages", async () => {
    mocks.stored = [{ providerMessageId: "gmail1", externalContactId: 7, customerId: 10, body: "saved" }];
    const responses = [{ emailAddress: CRM_MAILBOX }, { messages: [{ id: "gmail1" }] }];
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => responses.shift() }));
    expect(await syncGmailPage({}, fetcher)).toMatchObject({ duplicates: 1, imported: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(mocks.log).not.toHaveBeenCalled();
  });
  it("still repairs unlinked or blank messages and reads new replies in known threads", async () => {
    mocks.stored = [{ providerMessageId: "gmail1", externalContactId: 7, customerId: null, body: "saved" }];
    const responses = [{ emailAddress: CRM_MAILBOX }, { messages: [{ id: "gmail1" }, { id: "gmail2" }] }, message(), { ...message("agent@example.com", CRM_MAILBOX), id: "gmail2" }];
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => responses.shift() }));
    await syncGmailPage({}, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(mocks.log).toHaveBeenCalledTimes(2);
    expect(mocks.log.mock.calls[1][1]).toMatchObject({ direction: "inbound", providerMessageId: "gmail2" });
  });
  it("shows HTML-only API messages as readable text without scripts", () => {
    const remote = message();
    remote.payload.parts = [{ mimeType: "text/html", body: { data: Buffer.from('<style>hidden</style><p>Hi Chris,</p><p>Service &amp; maintenance</p><script>bad()</script>').toString("base64url") } }];
    expect(parseGmailMessage(remote)?.body).toBe("Hi Chris,\n\nService & maintenance");
  });
  it("promotes qualifying outreach recipients even on duplicate email imports", async () => {
    mocks.log.mockResolvedValue({ duplicate: true });
    const responses = [
      { emailAddress: CRM_MAILBOX },
      { messages: [{ id: "gmail1" }] },
      message(CRM_MAILBOX, "A <a@example.com>, b@example.com"),
    ];
    const fetcher = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => responses.shift(),
    }));
    expect(await syncGmailPage({}, fetcher)).toMatchObject({ duplicates: 1 });
    expect(mocks.promote).toHaveBeenCalledTimes(2);
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalContactId: 7, customerId:10, channel: "email" })
    );
  });
  it.each([
    ["inbound", false],
    ["unrelated outbound", false],
    ["suppressed outreach", true],
  ])("does not create contacts for %s", async (kind, suppressed) => {
    mocks.suppressed.mockResolvedValue(suppressed);
    const remote = kind === "inbound" ? message("sender@example.com", CRM_MAILBOX) : message();
    if(kind === "unrelated outbound") remote.payload.headers[2].value = "Lunch tomorrow";
    const responses = [{emailAddress:CRM_MAILBOX},{messages:[{id:"gmail1"}]},remote];
    const fetcher = vi.fn(async () => ({ok:true,json:async()=>responses.shift()}));
    await syncGmailPage({},fetcher);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.promote).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });
  it.each([
    ["SERVICE_DISABLED", "Google Cloud project"],
    ["ACCESS_TOKEN_SCOPE_INSUFFICIENT", "approve Gmail read access"],
    ["domainPolicy", "Workspace administrator"],
  ])(
    "explains Google rejection %s without exposing the response",
    async (reason, explanation) => {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "private-token", errors: [{ reason }] },
          }),
          { status: 403 }
        )
      );
      await expect(syncGmailPage({}, fetcher)).rejects.toThrow(explanation);
      await expect(syncGmailPage({}, fetcher)).rejects.not.toThrow(
        "private-token"
      );
    }
  );
  it("handles a non-JSON Google error", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => new Response("unavailable", { status: 503 }));
    await expect(syncGmailPage({}, fetcher)).rejects.toThrow(
      "Gmail read failed (503)"
    );
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
    const fetcher = vi.fn().mockResolvedValue({
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
      expect.objectContaining({ select: expect.any(Function) }),
      expect.objectContaining({
        externalContactId: 7,
        customerId:10,
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

describe("bounded manual Gmail recovery", () => {
  it("yields after two pages with a cursor and a one-minute pause", async () => {
    const page = vi.fn().mockResolvedValueOnce({ imported: 2, duplicates: 3, skipped: 0, nextPageToken: "p2" })
      .mockResolvedValueOnce({ imported: 1, duplicates: 4, skipped: 1, nextPageToken: "p3" });
    expect(await syncGmailBatch({}, page)).toEqual({ imported: 3, duplicates: 7, skipped: 1, nextPageToken: "p3", retryAfterMs: 60_000, paused: true });
    expect(page).toHaveBeenCalledTimes(2);
    expect(page.mock.calls[1][0]).toEqual({ pageToken: "p2", lookbackDays: 30 });
  });
  it("retains the failed page and completed counts through provider cooldown", async () => {
    const page = vi.fn().mockResolvedValueOnce({ imported: 1, duplicates: 0, skipped: 0, nextPageToken: "retry-this" })
      .mockRejectedValueOnce(new GmailQuotaCooldownError(7_200_000));
    expect(await syncGmailBatch({}, page)).toMatchObject({ imported: 1, nextPageToken: "retry-this", retryAfterMs: 7_200_000, paused: true });
    expect(page).toHaveBeenCalledTimes(2);
  });
  it("preserves a first-page quota pause even with no next token", async () => {
    const page = vi.fn().mockRejectedValue(new GmailQuotaCooldownError(900_000));
    expect(await syncGmailBatch({}, page)).toMatchObject({ imported: 0, nextPageToken: undefined, retryAfterMs: 900_000, paused: true });
    expect(page).toHaveBeenCalledTimes(1);
  });
  it("finishes without scheduling another batch and surfaces auth errors", async () => {
    const page = vi.fn().mockResolvedValue({ imported: 1, duplicates: 0, skipped: 0, nextPageToken: undefined });
    expect(await syncGmailBatch({}, page)).toMatchObject({ imported: 1, paused: false, retryAfterMs: 0 });
    await expect(syncGmailBatch({}, vi.fn().mockRejectedValue(new Error("Reconnect Google")))).rejects.toThrow("Reconnect Google");
  });
});

describe("website quote notification messages", () => {
  const quoteMessage = () => {
    const m = message("noreply@mechanicalenterprise.com", CRM_MAILBOX);
    m.payload.headers[2].value = "New Quote Request – Sample Contact";
    m.payload.parts[1].body.data = Buffer.from(
      "CONTACT INFO\nNameSample Contact Emailclient@example.com Phone(201) 555-0100\nREQUEST DETAILS\nMessagePlease quote a heat pump"
    ).toString("base64url");
    return m;
  };
  it("attributes the full inquiry body to the requester, keeping the actual sender", () => {
    expect(parseGmailMessage(quoteMessage())).toMatchObject({
      contacts: ["client@example.com"],
      fromAddress: "noreply@mechanicalenterprise.com",
      body: expect.stringContaining("Please quote a heat pump"),
    });
  });
  it("repairs an already imported message link during re-sync", async () => {
    const updateWhere = vi.fn().mockResolvedValue({});
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const chain: any = {
      select: () => chain,
      from: () => chain,
      where: () => chain,
      limit: async () => [{ id: 42 }],
      update: () => ({ set: updateSet }),
    };
    chain.select = (columns?: unknown) => columns ? { from: () => ({ where: async () => [] }) } : chain;
    mocks.db.mockResolvedValue(chain);

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
      .mockResolvedValueOnce({ ok: true, json: async () => quoteMessage() });
    expect(await syncGmailPage({}, fetcher)).toMatchObject({ duplicates: 1 });
    expect(updateSet).toHaveBeenCalledWith({
      externalContactId: 42,
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

// Last: a quota rejection intentionally leaves the shared transport cooling down.
it("shares a quota stop with other scanners and never retries it immediately", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({error:{errors:[{reason:"rateLimitExceeded"}]}}), {status:403}));
  await expect(syncGmailPage({}, fetcher)).rejects.toThrow("shared cooldown");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(syncGmailPage({}, fetcher)).rejects.toThrow("shared cooldown");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
