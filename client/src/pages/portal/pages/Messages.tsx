import { useEffect, useState, type FormEvent } from "react";
import { MessagesSquare, Plus, ArrowLeft, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { AsyncSection, PortalPageHeader, LoadingState, ErrorState, InlineSpinner } from "../components/common";
import { formatDateTime } from "../lib/format";

export default function PortalMessages() {
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const threads = trpc.portal.messaging.listThreads.useQuery(undefined, { retry: false });

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Messages"
        description="Chat with our team about your service."
        actions={<NewThreadDialog onCreated={(id) => { threads.refetch(); setActiveThreadId(id); }} />}
      />

      {activeThreadId == null ? (
        <AsyncSection
          query={threads}
          isEmpty={(rows) => rows.length === 0}
          emptyTitle="No messages yet"
          emptyDescription="Start a conversation and our team will get back to you."
        >
          {(rows) => (
            <div className="space-y-2">
              {rows.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveThreadId(t.id)}
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b35] rounded-lg"
                >
                  <Card className="transition-colors hover:border-[#ff6b35]/50">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#1e3a5f] dark:bg-slate-800 dark:text-slate-200">
                          <MessagesSquare className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.subject}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Updated {formatDateTime(t.lastMessageAt)}</p>
                        </div>
                      </div>
                      {t.customerUnread > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff6b35] px-1.5 text-xs font-semibold text-white">
                          {t.customerUnread}
                        </span>
                      ) : null}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </AsyncSection>
      ) : (
        <ThreadView threadId={activeThreadId} onBack={() => { setActiveThreadId(null); threads.refetch(); }} />
      )}
    </div>
  );
}

function ThreadView({ threadId, onBack }: { threadId: number; onBack: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");
  const query = trpc.portal.messaging.getThread.useQuery({ threadId }, { retry: false });

  const markRead = trpc.portal.messaging.markRead.useMutation();
  const send = trpc.portal.messaging.sendMessage.useMutation({
    onSuccess: async () => {
      setBody("");
      await utils.portal.messaging.getThread.invalidate({ threadId });
      await utils.portal.messaging.listThreads.invalidate();
    },
    onError: (err) => toast({ variant: "destructive", title: "Couldn't send", description: err.message }),
  });

  // Mark staff messages as read when opening the thread.
  useEffect(() => {
    markRead.mutate({ threadId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) send.mutate({ threadId, body: body.trim() });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 dark:text-slate-300">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> All conversations
      </Button>

      {query.isLoading ? (
        <LoadingState rows={3} />
      ) : query.isError ? (
        <ErrorState message={query.error?.message} onRetry={query.refetch} />
      ) : (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{query.data!.thread.subject}</h2>
            <div className="space-y-3" role="log" aria-label="Conversation messages">
              {query.data!.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.sender === "customer" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                      m.sender === "customer"
                        ? "bg-[#1e3a5f] text-white"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={cn("mt-1 text-[10px]", m.sender === "customer" ? "text-white/70" : "text-slate-400")}>
                      {m.sender === "customer" ? "You" : "Team"} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <label htmlFor="reply" className="sr-only">
                Your message
              </label>
              <Textarea
                id="reply"
                rows={2}
                placeholder="Type your message…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="flex-1 resize-none"
              />
              <Button type="submit" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" disabled={send.isPending || !body.trim()}>
                {send.isPending ? <InlineSpinner /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NewThreadDialog({ onCreated }: { onCreated: (threadId: number) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const start = trpc.portal.messaging.startThread.useMutation({
    onSuccess: (res) => {
      toast({ title: "Message sent", description: "Our team will reply here." });
      setSubject("");
      setBody("");
      setOpen(false);
      onCreated(res.threadId);
    },
    onError: (err) => toast({ variant: "destructive", title: "Couldn't send", description: err.message }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    start.mutate({ subject, body });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
          <Plus className="mr-1.5 h-4 w-4" /> New message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Send a message to our team.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" required maxLength={255} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-body">Message</Label>
            <Textarea id="new-body" required rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={start.isPending || !subject.trim() || !body.trim()}>
              {start.isPending ? <InlineSpinner className="mr-2" /> : null} Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
