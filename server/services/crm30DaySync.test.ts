import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  db: { select: vi.fn() },
  read: vi.fn(),
  parse: vi.fn(),
}));
vi.mock("./gmailReadTransport", () => ({
  pacedGmailRead: (url: string, init: unknown, fetcher: typeof fetch) =>
    fetcher(url, init as RequestInit),
}));
vi.mock("./gmailCrm", () => ({
  CRM_MAILBOX: "sales@mechanicalenterprise.com",
  gmailCrmStatus: async () => ({
    connected: true,
    hasReadPermission: true,
    accountEmail: "sales@mechanicalenterprise.com",
  }),
  parseGmailMessage: mocks.parse,
}));
vi.mock("../integrations/google/calendar", () => ({
  googleCalendarProvider: {
    getValidAccessToken: async () => ({ accessToken: "test" }),
  },
}));
vi.mock("./outreachSuppression", () => ({
  GMAIL_SUPPRESSION_LABEL_NAMES: new Set(),
  KNOWN_OUTREACH_SUPPRESSIONS: [],
  seedKnownOutreachSuppressions: async () => {},
  isOutreachSuppressed: async () => false,
}));
vi.mock("./crm30DayTasks", () => ({
  cadenceDatabase: async () => mocks.db,
  insert30DayTask: mocks.insert,
  cancelOpen30DayTasks: async () => 0,
  cancelTasksWithInboundReplies: async () => 0,
  assignAll30DayTasks: async () => ({ assigned: 0 }),
  crm30DayTasks: { status: "status", assignedToUserId: "owner" },
}));
vi.mock("./crmCommunications", () => ({
  upsertExternalContact: async () => ({ id: 1, email: "person@example.com" }),
}));
vi.mock("./sentEmailContact", () => ({
  ensureSentEmailContact: async () => {},
}));
vi.mock("./crm30DayAssignee", () => ({
  resolveCadenceAssignee: async () => ({ user: null, source: "none" }),
}));
vi.mock("./automaticContactEnrichment", () => ({
  queueContactEnrichment: async () => {},
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.parse.mockReturnValue(null);
  mocks.db.select.mockReturnValue({
    from: () => ({ where: async () => [{ open: 0, unassigned: 0 }] }),
  });
});
it("bounds jobs and resumes the next page rather than restarting", async () => {
  const { sync30DayFromGmail } = await import("./crm30DaySync");
  const requested: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const body = url.endsWith("/labels")
      ? { labels: [{ id: "outreach", name: "Outreach/Prospecting Sent" }] }
      : url.includes("messages?")
        ? url.includes("pageToken=next")
          ? { messages: [{ id: "last" }] }
          : {
              messages: Array.from({ length: 20 }, (_, i) => ({
                id: String(i),
              })),
              nextPageToken: "next",
            }
        : {};
    return new Response(JSON.stringify(body));
  });
  expect(await sync30DayFromGmail(10, fetcher)).toMatchObject({
    scanned: 20,
    hasMore: true,
    created: 0,
  });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(await sync30DayFromGmail(10, fetcher)).toMatchObject({
    scanned: 21,
    hasMore: false,
  });
  expect(requested.filter(url => /messages\/0\?/.test(url))).toHaveLength(1);
  expect(requested.some(url => url.includes("pageToken=next"))).toBe(true);
});
it("keeps successful progress when a request fails mid-page", async () => {
  const { sync30DayFromGmail } = await import("./crm30DaySync");
  let fail = true;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("messages/b?") && fail) {
      fail = false;
      throw new Error("quota");
    }
    return new Response(
      JSON.stringify(
        url.endsWith("/labels")
          ? { labels: [{ id: "outreach", name: "Outreach/Prospecting Sent" }] }
          : url.includes("messages?")
            ? { messages: [{ id: "a" }, { id: "b" }] }
            : {}
      )
    );
  });
  await expect(sync30DayFromGmail(10, fetcher)).rejects.toThrow("quota");
  expect(await sync30DayFromGmail(10, fetcher)).toMatchObject({
    scanned: 2,
    hasMore: false,
  });
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).includes("messages/a?"))
  ).toHaveLength(1);
});

it("retains the earliest intro across batches before creating tasks", async () => {
  const { sync30DayFromGmail } = await import("./crm30DaySync");
  const rows = Object.assign([], { limit: async () => [] });
  mocks.db.select.mockReturnValue({ from: () => ({ where: () => rows }) });
  mocks.insert.mockResolvedValue(true);
  mocks.parse.mockImplementation((remote: { id: string }) => ({
    direction: "outbound",
    contacts: ["person@example.com"],
    occurredAt: new Date(
      remote.id === "old" ? "2026-10-01T12:00:00Z" : "2026-10-10T12:00:00Z"
    ),
    providerMessageId: remote.id,
    providerThreadId: "thread",
  }));
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    let body: unknown;
    if (url.pathname.endsWith("/labels"))
      body = {
        labels: [{ id: "outreach", name: "Outreach/Prospecting Sent" }],
      };
    else if (url.pathname.endsWith("/messages"))
      body = url.searchParams.has("pageToken")
        ? { messages: [{ id: "old" }] }
        : {
            messages: Array.from({ length: 20 }, (_, i) => ({ id: String(i) })),
            nextPageToken: "next",
          };
    else
      body = {
        id: url.pathname.split("/").pop(),
        labelIds: ["SENT", "outreach"],
      };
    return new Response(JSON.stringify(body));
  });
  await sync30DayFromGmail(35, fetcher);
  expect(mocks.insert).not.toHaveBeenCalled();
  await sync30DayFromGmail(35, fetcher);
  expect(mocks.insert).toHaveBeenCalled();
  expect(
    mocks.insert.mock.calls.every(([task]) => task.introMessageId === "old")
  ).toBe(true);
});
