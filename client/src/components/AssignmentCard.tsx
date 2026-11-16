/**
 * Which setter this contact/lead is assigned to, what to do, and the latest
 * result (from the Team Hub). Admins can assign or reassign here.
 */
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck } from "lucide-react";

const RESULT_LABEL: Record<string, string> = {
  todo: "Not started",
  researched: "Researched & cleaned",
  no_answer: "Called · no answer",
  voicemail: "Voicemail left",
  conversation: "Conversation",
  follow_up: "Follow-up set",
  visit_booked: "Visit booked",
  not_interested: "Not interested",
  dnc: "Do not call",
  bad_number: "Wrong / bad number",
};

export function AssignmentCard({ type, id, label, phone }: { type: "customer" | "lead"; id: number; label?: string | null; phone?: string | null }) {
  const { user } = useAuth();
  const isAdmin = (user as { role?: string } | null)?.role === "admin";
  const { toast } = useToast();
  const a = trpc.teamHub.assignment.useQuery({ type, id }, { staleTime: 30_000 });
  const people = trpc.teamHub.people.useQuery(undefined, { enabled: isAdmin, staleTime: 5 * 60_000 });
  const [person, setPerson] = useState<string>("");
  const [what, setWhat] = useState("");
  useEffect(() => {
    setPerson(a.data?.person ?? "");
    setWhat(a.data?.action ?? "");
  }, [a.data]);
  const assign = trpc.teamHub.assign.useMutation({
    onSuccess: () => { toast({ title: "Assignment saved", description: "It shows on their Team Hub right away." }); void a.refetch(); },
    onError: (e) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  if (a.isLoading) return null;
  const d = a.data;
  return (
    <div className="rounded-xl border bg-blue-50/60 dark:bg-blue-950/30 p-3 text-sm space-y-2">
      <div className="flex items-center gap-2 font-semibold text-[#1e3a5f] dark:text-blue-200">
        <ClipboardCheck className="h-4 w-4" />
        {d ? <>Assigned to {d.personName}</> : <>Not assigned to a setter</>}
      </div>
      {d && (
        <div className="space-y-1">
          {d.action && <div><span className="text-muted-foreground">What to do:</span> {d.action}</div>}
          {d.goal && <div><span className="text-muted-foreground">Goal:</span> {d.goal}</div>}
          <div>
            <span className="text-muted-foreground">Result:</span> {RESULT_LABEL[d.result ?? d.status] ?? d.result ?? "Not started"}
            {d.note ? <span className="text-muted-foreground"> · {d.note}</span> : null}
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            aria-label="Assign to"
          >
            <option value="">Unassigned</option>
            {(people.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            placeholder="What to do (optional)"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
          />
          <Button
            size="sm"
            disabled={assign.isPending}
            onClick={() => assign.mutate({ type, id, person: person || null, action: what || undefined, label: label ?? undefined, phone: phone ?? undefined })}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
