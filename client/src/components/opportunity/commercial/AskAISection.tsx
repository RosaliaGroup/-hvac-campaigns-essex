import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";

/** Ask-AI panel — internal chat grounded in this bid's own context. */
export default function AskAISection({ opportunityId }: { opportunityId: number }) {
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const ask = trpc.bidAssistant.ask.useMutation({
    onSuccess: (res, vars) => setMsgs(m => [...m, { role: "user", text: vars.question }, { role: "ai", text: res.answer }]),
    onError: (err, vars) => setMsgs(m => [...m, { role: "user", text: vars.question }, { role: "ai", text: "Error: " + err.message }]),
  });
  const send = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    setQ("");
    ask.mutate({ opportunityId, question: trimmed });
  };
  const quick = ["Summarize this bid", "What is outstanding before we can submit?", "Draft a reply email to the customer"];
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Ask AI about this bid</p>
      <div className="flex flex-wrap gap-1.5">
        {quick.map(x => (
          <Button key={x} variant="outline" size="sm" className="h-7 text-xs" disabled={ask.isPending} onClick={() => send(x)}>
            {x}
          </Button>
        ))}
      </div>
      {msgs.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {msgs.map((m, i) => (
            <div key={i} className={"text-sm rounded-md px-3 py-2 whitespace-pre-wrap " + (m.role === "user" ? "bg-muted font-medium" : "bg-blue-50 border border-blue-100")}>
              {m.text}
            </div>
          ))}
        </div>
      )}
      {ask.isPending && <p className="text-xs text-muted-foreground animate-pulse">Thinking…</p>}
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(q); }}
          placeholder="Ask anything about this bid…"
          disabled={ask.isPending}
        />
        <Button size="icon" disabled={ask.isPending || !q.trim()} onClick={() => send(q)}><Send className="h-4 w-4" /></Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Internal only — answers use this bid&apos;s fields and comments; nothing is sent to the customer.</p>
    </div>
  );
}
