import {
  splitQuotedEmail,
  type CommunicationMessage,
} from "@/lib/emailThreads";
export default function EmailConversation({
  messages,
}: {
  messages: CommunicationMessage[];
}) {
  return (
    <div aria-label="Conversation messages">
      {messages.map((message, index) => {
        const body = splitQuotedEmail(
          message.body || "This email has no plain-text body available."
        );
        return (
          <details
            key={message.id}
            open={index === messages.length - 1}
            className="group border-b py-4"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-semibold">
                {(message.fromAddress || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold break-all">
                  {message.fromAddress}
                </p>
                <p className="text-xs text-slate-500 break-all group-open:hidden line-clamp-1">
                  {body.text.replace(/\s+/g, " ")}
                </p>
                <p className="hidden text-xs text-slate-500 break-all group-open:block">
                  to {message.toAddress}
                </p>
              </div>
              <time className="text-xs text-slate-500 shrink-0">
                {new Date(message.occurredAt).toLocaleString()}
              </time>
            </summary>
            <div className="pl-14 pr-2 pt-4 whitespace-pre-wrap break-words text-sm leading-7">
              {body.text}
              {body.quoted && (
                <details className="mt-3">
                  <summary
                    aria-label="Show quoted email"
                    className="cursor-pointer w-fit rounded bg-slate-100 px-3 text-slate-500"
                  >
                    …
                  </summary>
                  <div className="border-l-2 pl-4 mt-3 text-slate-500">
                    {body.quoted}
                  </div>
                </details>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
