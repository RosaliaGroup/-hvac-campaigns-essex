import { eq, and, sql } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { quoteNotificationContact } from "./quoteNotification";
import { startJob } from "./asyncLaneJob";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { getDb } from "../db";
import { logCommunication } from "./crmCommunications";
import { isExplicitOutreachOptOut, recordOutreachSuppression, seedKnownOutreachSuppressions, KNOWN_OUTREACH_SUPPRESSIONS } from "./outreachSuppression";
import { cancelOpen30DayTasks } from "./crm30DayTasks";
import { followupDatabase, followupTasks } from "./crmFollowupTasks";

export const CRM_MAILBOX = "sales@mechanicalenterprise.com";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE_SCOPE =
  "https://www.googleapis.com/auth/gmail.compose";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
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
  const body = plainText(message.payload);
  const quoteContact =
    direction === "inbound"
      ? quoteNotificationContact(from.join(", "), header("Subject"), body)
      : null;
  const contacts = (
    direction === "outbound"
      ? [...to, ...addresses(header("Cc")), ...addresses(header("Bcc"))]
      : quoteContact
        ? [quoteContact.email]
        : from
  ).filter(v => v !== CRM_MAILBOX);
  const occurredAt = new Date(Number(message.internalDate));
  if (!contacts.length || !Number.isFinite(occurredAt.getTime())) return null;
  return {
    contacts: Array.from(new Set(contacts)),
    quoteContact,
    direction,
    fromAddress: from.join(", ").slice(0, 320),
    toAddress: to.join(", ").slice(0, 320),
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    occurredAt,
    subject: header("Subject").slice(0, 500),
    body: body || null,
  };
}

export async function gmailCrmStatus() {
  const conn = await googleCalendarProvider.getConnection();
  return {
    mailbox: CRM_MAILBOX,
    connected: conn?.status === "connected",
    accountEmail: conn?.googleAccountEmail ?? null,
    hasReadPermission: Boolean(conn?.scope?.split(" ").includes(GMAIL_SCOPE)),
    hasDraftPermission: Boolean(
      conn?.scope?.split(" ").includes(GMAIL_COMPOSE_SCOPE)
    ),
    hasSendPermission: Boolean(
      conn?.scope
        ?.split(" ")
        .some(
          scope => scope === GMAIL_SEND_SCOPE || scope === GMAIL_COMPOSE_SCOPE
        )
    ),
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
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetchImpl(
          `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
          }
        );
        // Retry transient server errors, never auth or permission errors.
        if (response.status !== 429 && response.status < 500) break;
        if (attempt === 2) break;
      } catch (error) {
        if (attempt === 2) {
          const cause = error instanceof Error ? error.message : String(error);
          throw new Error(`Gmail transport failed after 3 attempts (path=${path}): ${cause}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
    if (!response) throw new Error(`Gmail transport returned no response (path=${path})`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const reasons = [
        ...(payload?.error?.errors ?? []).map(
          (item: { reason?: string }) => item.reason
        ),
        ...(payload?.error?.details ?? []).map(
          (item: { reason?: string }) => item.reason
        ),
      ];
      const explanations: Record<string, string> = {
        accessNotConfigured:
          "Enable Gmail API in the Google Cloud project that owns the CRM OAuth client.",
        SERVICE_DISABLED:
          "Enable Gmail API in the Google Cloud project that owns the CRM OAuth client.",
        insufficientPermissions:
          "Reconnect Google and approve Gmail read access.",
        ACCESS_TOKEN_SCOPE_INSUFFICIENT:
          "Reconnect Google and approve Gmail read access.",
        domainPolicy:
          "Your Google Workspace administrator must allow this app to access Gmail.",
        rateLimitExceeded: "Google rate limit reached. Retry later.",
        userRateLimitExceeded:
          "Google mailbox rate limit reached. Retry later.",
        dailyLimitExceeded:
          "Google daily quota reached. Check the Gmail API quota.",
      };
      const reason = reasons.find(
        (value: unknown) =>
          typeof value === "string" && Object.hasOwn(explanations, value)
      );
      throw new Error(
        reason
          ? `Gmail read failed (${response.status}, ${reason}). ${explanations[reason]}`
          : `Gmail read failed (${response.status}). Check the Google connection and Gmail API access.`
      );
    }
    return response.json();
  }
  const profile = await read("profile");
  if (String(profile.emailAddress).toLowerCase() !== CRM_MAILBOX)
    throw new Error(
      `Connect ${CRM_MAILBOX} in Integrations before syncing email.`
    );
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await seedKnownOutreachSuppressions(db);
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
    const remote = await read(
      `messages/${encodeURIComponent(item.id)}?format=full`
    );
    const parsed = parseGmailMessage(remote);
    if (!parsed) {
      skipped++;
      continue;
    }
    // Explicit opt-outs and hard delivery failures are durable before timeline import.
    // Never turn a quoted email into an opt-out or assume that any auto-reply is one.
    const sender = addresses((remote.payload?.headers ?? [])
      .find((h: { name?: string }) => h.name?.toLowerCase() === "from")?.value ?? "")[0];
    const failure = /delivery status notification \(failure\)|undeliverable|mail delivery failed/i.test(parsed.subject)
      && /mailer-daemon|postmaster/i.test(sender ?? "");
    const bounced = failure
      ? parsed.body?.match(/(?:your message to|wasn't delivered to|was not delivered to|message to)\s+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1]
      : undefined;
    const suppressions = parsed.direction === "inbound" && isExplicitOutreachOptOut(parsed.body, parsed.subject)
      ? parsed.contacts.map(email => ({ email, reason: "opt_out" as const }))
      : bounced ? [{ email: bounced, reason: "hard_bounce" as const }] : [];
    for (const entry of suppressions) {
      await recordOutreachSuppression(db, entry.email, entry.reason, parsed.providerMessageId);
      await cancelOpen30DayTasks(entry.email, "CRM Gmail recorded a delivery failure or explicit do-not-contact request.");
      await followupDatabase();
      await db.update(followupTasks).set({
        status: "cancelled",
        note: "CRM Gmail recorded a delivery failure or explicit do-not-contact request.",
      }).where(and(eq(followupTasks.recipientEmail, entry.email), eq(followupTasks.status, "open")));
    }
    // Gmail sync is COMMUNICATION HISTORY ONLY. Never automatically create a
    // prospect, customer or contact from a correspondent. An operator must
    // explicitly select a Gmail person to import with a valid email + phone.
    // Already-approved CRM contacts retain their thread associations.
    const matched = [];
    for (const email of parsed.contacts) {
      const [contact] = await db.select().from(crmExternalContacts)
        .where(sql`lower(trim(${crmExternalContacts.email})) = ${email}`).limit(1);
      if (contact) matched.push(contact);
    }
    const contact = matched[0] ?? null;
    const { contacts, quoteContact, ...communication } = parsed;
    // Repair links only when an existing CRM contact is already known.
    if (quoteContact && contact) {
      await db.update(crmCommunications).set({
        externalContactId: contact.id,
        ...(contact.customerId ? {customerId:contact.customerId} : {}),
      }).where(and(
        eq(crmCommunications.provider,"gmail"),
        eq(crmCommunications.providerMessageId,parsed.providerMessageId),
      ));
    }
    const result = await logCommunication(db, {
      ...communication,
      externalContactId: contact?.id ?? null,
      customerId: contact?.customerId ?? null,
      channel:"email",provider:"gmail",
      status:parsed.direction==="outbound"?"sent":"received",
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
  // Suppression must be seeded and read back even if Gmail OAuth is disconnected.
  const bootstrap = setTimeout(async () => {
    try {
      const db = await getDb();
      if (!db) throw new Error("CRM database unavailable");
      const verified = await seedKnownOutreachSuppressions(db);
      let cancelled = 0;
      await followupDatabase();
      for (const entry of KNOWN_OUTREACH_SUPPRESSIONS) {
        cancelled += await cancelOpen30DayTasks(entry.email, "Do not contact / delivery failure.");
        const result = await db.update(followupTasks)
          .set({ status: "cancelled", note: "Do not contact / delivery failure." })
          .where(and(eq(followupTasks.recipientEmail, entry.email), eq(followupTasks.status, "open")));
        cancelled += Number((result as any)?.[0]?.affectedRows ?? 0);
      }
      console.info("[CRM Suppression] Verified:", JSON.stringify({ verified, cancelled }));
    } catch (error) {
      console.error("[CRM Suppression] Bootstrap failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }, 20_000);
  bootstrap.unref();
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
