import {
  groupEmailThreads,
  splitQuotedEmail,
  type CommunicationMessage,
} from "@/lib/emailThreads";
export default function EmailThreadList({
  messages,
  contactName,
  onOpen,
}: {
  messages: CommunicationMessage[];
  contactName?: string;
  onOpen: (id: number) => void;
}) {
  return (
    <div aria-label="Email conversations">
      {groupEmailThreads(messages).map(thread => {
        const latest = thread.latest;
        const inbound = thread.messages.some(
          message => message.direction === "inbound"
        );
        return (
          <button
            key={thread.key}
            onClick={() => onOpen(latest.id)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[180px_minmax(0,1fr)_90px] items-center gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-3 text-left hover:bg-[#f2f6fc] focus-visible:outline-blue-500"
          >
            <span className="truncate text-sm font-medium">
              {inbound
                ? contactName || latest.fromAddress
                : `To: ${contactName || latest.toAddress || "Contact"}`}
              {thread.messages.length > 1 && (
                <span className="ml-2 text-xs text-slate-500">
                  {thread.messages.length}
                </span>
              )}
            </span>
            <span className="min-w-0 truncate text-sm row-start-2 md:row-start-auto">
              <span className="mr-2 text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                {latest.channel === "sms" ? "SMS" : inbound ? "Inbox" : "Sent"}
              </span>
              <span className="font-medium">
                {thread.messages[0].subject?.replace(
                  /^(?:(?:re|fwd?):\s*)+/i,
                  ""
                ) || (latest.channel === "sms" ? "Text message" : "No subject")}
              </span>
              <span className="text-slate-500">
                {" "}
                —{" "}
                {splitQuotedEmail(latest.body || "").text.replace(
                  /\s+/g,
                  " "
                ) || "No preview available"}
              </span>
            </span>
            <time className="text-xs text-slate-500 text-right col-start-2 row-start-1 md:col-start-3">
              {new Date(latest.occurredAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </time>
          </button>
        );
      })}
    </div>
  );
}
