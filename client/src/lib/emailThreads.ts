export type CommunicationMessage = {
  id: number;
  channel: string;
  provider: string;
  providerThreadId?: string | null;
  subject?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  body?: string | null;
  direction: string;
  occurredAt: Date | string;
};
export function groupEmailThreads<T extends CommunicationMessage>(
  messages: T[]
) {
  const groups = new Map<string, T[]>();
  for (const message of messages) {
    const key =
      message.channel === "email" && message.providerThreadId
        ? `${message.provider}:${message.providerThreadId}`
        : `message:${message.id}`;
    const group = groups.get(key) ?? [];
    group.push(message);
    groups.set(key, group);
  }
  return Array.from(groups, ([key, items]) => {
    const ordered = [...items].sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() ||
        a.id - b.id
    );
    return { key, messages: ordered, latest: ordered[ordered.length - 1] };
  }).sort(
    (a, b) =>
      new Date(b.latest.occurredAt).getTime() -
        new Date(a.latest.occurredAt).getTime() || b.latest.id - a.latest.id
  );
}
export function splitQuotedEmail(body: string) {
  const match =
    /\n(?=\s*(?:On [\s\S]{1,400}?wrote:|From:|-----Original Message|>))/i.exec(
      body
    );
  return match
    ? {
        text: body.slice(0, match.index),
        quoted: body.slice(match.index).trim(),
      }
    : { text: body, quoted: "" };
}
