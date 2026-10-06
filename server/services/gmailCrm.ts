import { startJob } from "./asyncLaneJob";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { getDb } from "../db";
import { logCommunication, upsertExternalContact } from "./crmCommunications";

export const CRM_MAILBOX = "sales@mechanicalenterprise.com";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
export type GmailMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: Part & { headers?: { name?: string; value?: string }[] };
};

export function addresses(value: string) {
  return Array.from(
    new Set(
      (
        value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ??
        []
      ).map(v => v.toLowerCase())
    )
  );
}
function plainText(part?: Part): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  return (part.parts ?? []).map(plainText).filter(Boolean).join("\n");
}
export function parseGmailMessage(message: GmailMessage) {
  if (
    !message.id ||
    !message.threadId ||
    !message.internalDate ||
    !/^\d+$/.test(message.internalDate)
  )
    return null;
  if (message.labelIds?.some(v => ["DRAFT", "SPAM", "TRASH"].includes(v)))
    return null;
  const header = (name: string) =>
    message.payload?.headers?.find(
      h => h.name?.toLowerCase() === name.toLowerCase()
    )?.value ?? "";
  const from = addresses(header("From"));
  const to = addresses(header("To"));
  const direction = from.includes(CRM_MAILBOX)
    ? ("outbound" as const)
    : ("inbound" as const);
  if (
    direction === "inbound" &&
    ![
      ...to,
      ...addresses(header("Cc")),
      ...addresses(header("Delivered-To")),
    ].includes(CRM_MAILBOX)
  )
    return null;
  const contacts = (
    direction === "outbound"
      ? [...to, ...addresses(header("Cc")), ...addresses(header("Bcc"))]
      : from
  ).filter(v => v !== CRM_MAILBOX);
  const occurredAt = new Date(Number(message.internalDate));
  if (!contacts.length || !Number.isFinite(occurredAt.getTime())) return null;
  return {
    contacts: Array.from(new Set(contacts)),
    direction,
    fromAddress: from.join(", ").slice(0, 320),
    toAddress: to.join(", ").slice(0, 320),
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    occurredAt,
    subject: header("Subject").slice(0, 500),
    body: plainText(message.payload) || null,
  };
}

export async function gmailCrmStatus() {
  const conn = await googleCalendarProvider.getConnection();
  return {
    mailbox: CRM_MAILBOX,
    connected: conn?.status === "connected",
    accountEmail: conn?.googleAccountEmail ?? null,
    hasReadPermission: Boolean(conn?.scope?.split(" ").includes(GMAIL_SCOPE)),
  };
}

/** @slow
 * One bounded page, resumable with Google's page token. No mailbox writes. */
export async function syncGmailPage(
  input: { pageToken?: string; lookbackDays?: 2 | 30 },
  fetchImpl: typeof fetch = fetch
) {
  const status = await gmailCrmStatus();
  if (!status.connected || !status.hasReadPermission)
    throw new Error(
      "Reconnect Google in Integrations to grant Gmail read permission."
    );
  const { accessToken } = await googleCalendarProvider.getValidAccessToken();
  async function read(path: string) {
    const response = await fetchImpl(
      `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!response.ok)
      throw new Error(
        `Gmail read failed (${response.status}). Check the Google connection and Gmail API access.`
      );
    return response.json();
  }
  const profile = await read("profile");
  if (String(profile.emailAddress).toLowerCase() !== CRM_MAILBOX)
    throw new Error(
      `Connect ${CRM_MAILBOX} in Integrations before syncing email.`
    );
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const params = new URLSearchParams({
    maxResults: "25",
    q: `in:anywhere -in:spam -in:trash -in:drafts newer_than:${input.lookbackDays ?? 30}d {from:${CRM_MAILBOX} to:${CRM_MAILBOX} cc:${CRM_MAILBOX}}`,
  });
  if (input.pageToken) params.set("pageToken", input.pageToken);
  const page = await read(`messages?${params}`);
  let imported = 0,
    duplicates = 0,
    skipped = 0;
  for (const item of page.messages ?? []) {
    const parsed = parseGmailMessage(
      await read(`messages/${encodeURIComponent(item.id)}?format=full`)
    );
    if (!parsed) {
      skipped++;
      continue;
    }
    // A message is stored once under its Gmail ID, linked to the primary correspondent.
    const contact = await upsertExternalContact(db, {
      name: parsed.contacts[0],
      email: parsed.contacts[0],
      source: "gmail",
    });
    const { contacts, ...communication } = parsed;
    const result = await logCommunication(db, {
      ...communication,
      externalContactId: contact.id,
      channel: "email",
      provider: "gmail",
      status: parsed.direction === "outbound" ? "sent" : "received",
    });
    if (result.duplicate) duplicates++;
    else imported++;
  }
  return {
    imported,
    duplicates,
    skipped,
    nextPageToken: page.nextPageToken as string | undefined,
  };
}

/** Automatically refresh recent sent mail/replies once the correct account consents. */
export function startGmailCrmScheduler() {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.GMAIL_CRM_SYNC_ENABLED === "false"
  )
    return;
  let pageToken: string | undefined;
  const run = () =>
    startJob({
      kind: "crm-gmail",
      key: "crm-gmail",
      fn: async () => {
        const status = await gmailCrmStatus();
        if (
          !status.connected ||
          !status.hasReadPermission ||
          status.accountEmail?.toLowerCase() !== CRM_MAILBOX
        )
          return null;
        try {
          const result = await syncGmailPage({ pageToken, lookbackDays: 2 });
          pageToken = result.nextPageToken;
          return result;
        } catch (error) {
          pageToken = undefined;
          console.error(
            "[CRM Gmail] Sync failed:",
            error instanceof Error ? error.message : "Unknown error"
          );
          throw error;
        }
      },
    });
  const timer = setInterval(run, 5 * 60 * 1000);
  timer.unref();
}
