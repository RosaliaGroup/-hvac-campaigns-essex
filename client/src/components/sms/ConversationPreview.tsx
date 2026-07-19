/**
 * ConversationPreview — read-only SMS history on a Lead / Customer card.
 *
 * Shows the most recent messages for a phone number IF the number already has
 * SMS history, and links into the internal Communications thread. It never
 * renders an OS `sms:` link and it does NOT own conversation state — the live
 * thread + composer live in the SMS Inbox (`/sms-campaigns`); this is a preview
 * that reuses the same `listInboxMessages` source, so there is one source of
 * truth for the conversation.
 */
import { useLocation } from "wouter";
import { MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { internalSmsConversationPath, isDialablePhone } from "@/lib/internalSms";

type PreviewMessage = { id: number; message: string; direction: string; createdAt: string | Date };

export default function ConversationPreview({
  phone,
  limit = 5,
}: {
  phone?: string | null;
  limit?: number;
}) {
  const [, navigate] = useLocation();
  const enabled = isDialablePhone(phone);

  const { data: messages = [] } = trpc.smsCampaigns.listInboxMessages.useQuery(
    { phone: phone ?? undefined, limit },
    { enabled },
  );

  // Only surface the section when the Lead/Customer actually has SMS history.
  if (!enabled || messages.length === 0) return null;

  const open = () => navigate(internalSmsConversationPath(phone));
  const recent = [...(messages as PreviewMessage[])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-2" data-testid="lead-customer-sms-conversation">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> SMS Conversation
        </h3>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={open}>
          Open
        </Button>
      </div>
      <div className="space-y-1 rounded-md border p-2">
        {recent.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={open}
            className="block w-full rounded px-1.5 py-1 text-left text-xs hover:bg-muted"
          >
            <span
              className={
                m.direction === "outbound"
                  ? "mr-1 font-medium text-[#1e3a5f]"
                  : "mr-1 font-medium text-emerald-700"
              }
            >
              {m.direction === "outbound" ? "You:" : "Them:"}
            </span>
            <span className="text-muted-foreground">
              {m.message.length > 80 ? `${m.message.slice(0, 80)}…` : m.message}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
