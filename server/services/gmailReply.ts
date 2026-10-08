import { quoteNotificationContact } from "./quoteNotification";
import { eq, and } from "drizzle-orm";
import { crmCommunications, crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { addresses, CRM_MAILBOX, gmailCrmStatus } from "./gmailCrm";
import { logCommunication } from "./crmCommunications";

export function replyMime(
  to: string,
  subject: string,
  body: string,
  messageId: string,
  references: string
) {
  if ([to, subject, messageId, references].some(value => /[\r\n]/.test(value)))
    throw new Error("Invalid email headers");
  if (!/^<[^<>\s]+>$/.test(messageId))
    throw new Error("Original email has no valid Message-ID");
  return Buffer.from(
    [
      `From: ${CRM_MAILBOX}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      `In-Reply-To: ${messageId}`,
      `References: ${references ? references + " " : ""}${messageId}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body)
        .toString("base64")
        .match(/.{1,76}/g)
        ?.join("\r\n") ?? "",
    ].join("\r\n")
  ).toString("base64url");
}

export async function sendGmailReply(
  input: { externalContactId: number; messageId: number; body: string },
  fetchImpl: typeof fetch = fetch
) {
  const status = await gmailCrmStatus();
  if (
    !status.connected ||
    !status.hasReadPermission ||
    !status.hasSendPermission
  )
    throw new Error(
      "Reconnect Google in Integrations and approve Gmail send permission."
    );
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [original] = await db
    .select()
    .from(crmCommunications)
    .where(
      and(
        eq(crmCommunications.id, input.messageId),
        eq(crmCommunications.externalContactId, input.externalContactId)
      )
    )
    .limit(1);
  if (
    !original ||
    original.provider !== "gmail" ||
    original.channel !== "email" ||
    !original.providerMessageId
  )
    throw new Error("Select a synced Gmail message to reply.");
  const { accessToken } = await googleCalendarProvider.getValidAccessToken();
  async function request(path: string, init: RequestInit = {}) {
    const res = await fetchImpl(
      `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok)
      throw new Error(
        `Gmail reply failed (${res.status}). Check Google send permission before retrying.`
      );
    return res.json();
  }
  const profile = await request("profile");
  if (String(profile.emailAddress).toLowerCase() !== CRM_MAILBOX)
    throw new Error(`Connect ${CRM_MAILBOX} before replying.`);
  const remote = await request(
    `messages/${encodeURIComponent(original.providerMessageId)}?format=metadata`
  );
  const header = (name: string) =>
    remote.payload?.headers?.find(
      (h: { name: string; value: string }) =>
        h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? "";
  const notification = quoteNotificationContact(
    original.fromAddress ?? "",
    original.subject ?? "",
    original.body ?? ""
  );
  const [linkedContact] = notification
    ? await db
        .select()
        .from(crmExternalContacts)
        .where(eq(crmExternalContacts.id, input.externalContactId))
        .limit(1)
    : [];
  const to = notification
    ? linkedContact?.email?.trim().toLowerCase()
    : (original.direction === "inbound"
        ? addresses(header("Reply-To") || header("From"))
        : addresses(header("To"))
      ).find(value => value !== CRM_MAILBOX);
  if (!to) throw new Error("No reply recipient found.");
  const subject = /^re:/i.test(header("Subject"))
    ? header("Subject")
    : `Re: ${header("Subject")}`;
  const sent = await request("messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw: replyMime(
        to,
        subject,
        input.body,
        header("Message-ID"),
        header("References")
      ),
      threadId: remote.threadId,
    }),
  });
  // Gmail has accepted the email. A logging failure must never invite a duplicate send.
  let warning: string | undefined;
  try {
    await logCommunication(db, {
      externalContactId: input.externalContactId,
      customerId: original.customerId,
      leadId: original.leadId,
      channel: "email",
      direction: "outbound",
      provider: "gmail",
      providerMessageId: sent.id,
      providerThreadId: sent.threadId,
      fromAddress: CRM_MAILBOX,
      toAddress: to,
      subject,
      body: input.body,
      status: "sent",
      occurredAt: new Date(),
    });
  } catch {
    warning = "Email sent. Its CRM history will appear after Gmail sync.";
  }
  return { sent: true, warning };
}
