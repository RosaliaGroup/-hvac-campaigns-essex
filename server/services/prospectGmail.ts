import { googleCalendarProvider } from "../integrations/google/calendar";
import { CRM_MAILBOX, gmailCrmStatus, addresses } from "./gmailCrm";
export async function prospectMailbox() {
  const status = await gmailCrmStatus();
  if (
    !status.connected ||
    !status.hasReadPermission ||
    !status.hasSendPermission
  )
    throw new Error("Reconnect CRM Gmail with read and send permissions.");
  const { accessToken } = await googleCalendarProvider.getValidAccessToken();
  const request = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(
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
    if (!r.ok) throw new Error(`CRM Gmail request failed (${r.status}).`);
    return r.json();
  };
  const profile = await request("profile");
  if (String(profile.emailAddress).toLowerCase() !== CRM_MAILBOX)
    throw new Error(`Connect ${CRM_MAILBOX} in CRM Integrations.`);
  return {
    async hasSent(email: string) {
      const r = await request(
        `messages?maxResults=1&q=${encodeURIComponent(`in:sent to:${email}`)}`
      );
      return Boolean(r.messages?.length);
    },
    async recipientStopped(email: string, threadId: string | null) {
      const query = `in:anywhere -in:trash -in:spam {from:${email} from:mailer-daemon from:postmaster} newer_than:90d`;
      const r = await request(
        `messages?maxResults=100&q=${encodeURIComponent(query)}`
      );
      // Every prospect reply hands control to a human; delivery failure notices suppress exact recipients.
      for (const m of r.messages ?? []) {
        const msg = await request(`messages/${m.id}?format=full`);
        const from =
          msg.payload?.headers?.find(
            (h: any) => h.name.toLowerCase() === "from"
          )?.value ?? "";
        if (addresses(from).includes(email.toLowerCase())) return "replied";
        if (/mailer-daemon|postmaster/i.test(from)) {
          const walk = (p: any): string =>
            (p?.body?.data
              ? Buffer.from(p.body.data, "base64url").toString("utf8")
              : "") + (p?.parts ?? []).map(walk).join("\n");
          if (walk(msg.payload).toLowerCase().includes(email.toLowerCase()))
            return "delivery_failed";
        }
      }
      // Incomplete pagination cannot establish absence of failures/replies.
      if (r.nextPageToken)
        throw new Error(
          "Gmail reply/bounce check exceeded page limit; review mailbox before continuing."
        );
      return null;
    },
    async send(email: string, body: string, threadId: string | null) {
      const subject = "HVAC service partnership — Mechanical Enterprise";
      if (/[\r\n]/.test(email)) throw new Error("Invalid recipient");
      let replyHeaders: string[] = [];
      if (threadId) {
        const thread = await request(
          `threads/${encodeURIComponent(threadId)}?format=metadata`
        );
        const original = thread.messages?.at(-1);
        const id = original?.payload?.headers?.find(
          (h: any) => h.name.toLowerCase() === "message-id"
        )?.value;
        if (typeof id !== "string" || !/^<[^<>\s]+>$/.test(id))
          throw new Error("Cannot safely thread the follow-up email.");
        replyHeaders = [`In-Reply-To: ${id}`, `References: ${id}`];
      }
      const raw = Buffer.from(
        [
          `From: ${CRM_MAILBOX}`,
          `To: ${email}`,
          `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
          ...replyHeaders,
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
      return request("messages/send", {
        method: "POST",
        body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
      });
    },
  };
}
