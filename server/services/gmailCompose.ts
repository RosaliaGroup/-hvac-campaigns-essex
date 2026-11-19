import { eq } from "drizzle-orm";
import { crmExternalContacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { googleCalendarProvider } from "../integrations/google/calendar";
import { CRM_MAILBOX, gmailCrmStatus } from "./gmailCrm";
import { logCommunication } from "./crmCommunications";
import { assertOutreachNotSuppressed } from "./outreachSuppression";
import { fromHeader, resolveSender } from "./gmailSendAs";
export function composeMime(
  to: string,
  subject: string,
  body: string,
  from: string = CRM_MAILBOX
) {
  if (
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ||
    /[\r\n]/.test(subject) ||
    /[\r\n]/.test(from)
  )
    throw new Error("Invalid email headers");
  return Buffer.from(
    [
      `From: ${from}`,
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
/** Owner's personal cell must never reach prospects; signatures use the business line. */
const OWNER_CELL = /\+?1?[\s.-]*\(?201\)?[\s.-]*449[\s.-]*6850/g;
export function cleanSignatureHtml(html: string) {
  return html
    .replace(/tel:\+?1?[\s.-]*\(?201\)?[\s.-]*449[\s.-]*6850/g, "tel:+18624191763")
    .replace(OWNER_CELL, "(862) 419-1763");
}
const escHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
/** multipart/alternative: plain text body + HTML body with the signature. */
export function composeMimeWithSignature(to: string, subject: string, body: string, signatureHtml: string, from: string = CRM_MAILBOX) {
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) || /[\r\n]/.test(subject) || /[\r\n]/.test(from))
    throw new Error("Invalid email headers");
  const b64 = (v: string) => Buffer.from(v).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
  const boundary = "me_" + Math.random().toString(36).slice(2);
  const text = `${body}\n\n${htmlToText(signatureHtml)}`;
  const html = `<div>${escHtml(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`).join("")}</div><br><div class="gmail_signature">${signatureHtml}</div>`;
  return Buffer.from([
    `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(text),
    `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(html),
    `--${boundary}--`, "",
  ].join("\r\n")).toString("base64url");
}
export async function composeGmail(
  input: {
    externalContactId: number;
    subject: string;
    body: string;
    action: "draft" | "send";
    /** Signed-in CRM user; sends as their verified alias when they have one. */
    senderEmail?: string | null;
    /** Append the CRM mailbox's Gmail signature (HTML), with the owner's cell swapped for the business line. */
    withMailboxSignature?: boolean;
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
  const sender = await resolveSender(input.senderEmail, request);
  let raw = composeMime(to, input.subject, input.body, fromHeader(sender));
  if (input.withMailboxSignature) {
    const sa = await request(`settings/sendAs/${encodeURIComponent(sender.email)}`).catch(() => null);
    const sig = typeof sa?.signature === "string" ? sa.signature.trim() : "";
    if (!sig) throw new Error("No Gmail signature found on the CRM mailbox; not sent.");
    raw = composeMimeWithSignature(to, input.subject, input.body, cleanSignatureHtml(sig), fromHeader(sender));
  }
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
  // A successful CRM outreach send must always be represented in Contacts.
  // This is scoped to the CRM send action, not arbitrary Gmail correspondence.
  let contactWarning: string | undefined;
  try {
    const { ensureSentEmailContact } = await import("./sentEmailContact");
    await ensureSentEmailContact(db, {...contact,source:"gmail-prospecting"});
    const { queueContactEnrichment } = await import("./automaticContactEnrichment");
    await db.update(crmExternalContacts)
      .set({source:"gmail-prospecting"})
      .where(eq(crmExternalContacts.id,contact.id));
    await queueContactEnrichment(contact.id);
  } catch(error) {
    contactWarning = "Email sent, but CRM contact promotion needs reconciliation: " +
      (error instanceof Error ? error.message : "unknown error");
    console.error("[CRM Outreach Contact] Post-send promotion failed",contact.id,error);
  }
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
      fromAddress: sender.email,
      toAddress: to,
      subject: input.subject,
      body: input.body,
      status: "sent",
      occurredAt: new Date(),
    });
  } catch {
    warning = "Email sent. Its CRM history will appear after Gmail sync.";
  }
  return { sent: true, warning: [warning,contactWarning].filter(Boolean).join(" ") || undefined };
}
