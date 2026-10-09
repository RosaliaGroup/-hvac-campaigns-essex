import { eq } from "drizzle-orm";
import { crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { CRM_MAILBOX, gmailCrmStatus } from "./gmailCrm";
import { logCommunication } from "./crmCommunications";
import { assertOutreachNotSuppressed } from "./outreachSuppression";
export function composeMime(to: string, subject: string, body: string) {
  if (
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
    /[\r\n]/.test(subject)
  )
    throw new Error("Invalid email headers");
  return Buffer.from(
    [
      `From: ${CRM_MAILBOX}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
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
export async function composeGmail(
  input: {
    externalContactId: number;
    subject: string;
    body: string;
    action: "draft" | "send";
  },
  fetchImpl: typeof fetch = fetch
) {
  const status = await gmailCrmStatus();
  if (
    !status.connected ||
    !status.hasReadPermission ||
    (input.action === "draft"
      ? !status.hasDraftPermission
      : !status.hasSendPermission)
  )
    throw new Error(
      "Reconnect Google in Integrations and approve Gmail compose/send permission."
    );
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [contact] = await db
    .select()
    .from(crmExternalContacts)
    .where(eq(crmExternalContacts.id, input.externalContactId))
    .limit(1);
  const to = contact?.email?.trim().toLowerCase();
  if (!to) throw new Error("Save a valid contact email address first.");
  await assertOutreachNotSuppressed(db, to);
  const raw = composeMime(to, input.subject, input.body);
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
        `Gmail ${input.action} failed (${res.status}). Check Gmail before retrying.`
      );
    return res.json();
  }
  const profile = await request("profile");
  if (String(profile.emailAddress).toLowerCase() !== CRM_MAILBOX)
    throw new Error(`Connect ${CRM_MAILBOX} before composing email.`);
  if (input.action === "draft") {
    const draft = await request("drafts", {
      method: "POST",
      body: JSON.stringify({ message: { raw } }),
    });
    return { draftSaved: true, draftId: draft.id };
  }
  const sent = await request("messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
  let warning: string | undefined;
  try {
    await logCommunication(db, {
      externalContactId: contact.id,
      customerId: contact.customerId,
      leadId: contact.leadId,
      channel: "email",
      direction: "outbound",
      provider: "gmail",
      providerMessageId: sent.id,
      providerThreadId: sent.threadId,
      fromAddress: CRM_MAILBOX,
      toAddress: to,
      subject: input.subject,
      body: input.body,
      status: "sent",
      occurredAt: new Date(),
    });
  } catch {
    warning = "Email sent. Its CRM history will appear after Gmail sync.";
  }
  return { sent: true, warning };
}
