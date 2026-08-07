/**
 * Comments tab — add, edit (own/admin), delete (own/admin). Author + timestamps
 * shown; internal IDs are never surfaced. Loading/error states included.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import { fmtDate } from "@/lib/commercialOpportunities";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

type Comment = CommercialDetail["comments"][number];

export default function CommentsSection({ opportunityId, comments }: { opportunityId: number; comments: Comment[] }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite, isAdmin, currentMemberId } = useCommercialPerms();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  const invalidate = () => utils.opportunities.commercial.get.invalidate({ id: opportunityId });
  const onError = (err: { message: string }) => toast({ title: "Comment failed", description: err.message, variant: "destructive" });

  const create = trpc.opportunities.commercial.comments.create.useMutation({ onSuccess: () => { setDraft(""); invalidate(); }, onError });
  const edit = trpc.opportunities.commercial.comments.edit.useMutation({ onSuccess: () => { setEditingId(null); invalidate(); }, onError });
  const remove = trpc.opportunities.commercial.comments.remove.useMutation({ onSuccess: invalidate, onError });

  const canModify = (c: Comment) => isAdmin || (currentMemberId != null && c.authorId === currentMemberId);

  return (
    <div className="space-y-3">
      {canWrite ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a comment…" rows={2} />
          <div className="flex justify-end">
            <Button size="sm" disabled={!draft.trim() || create.isPending} onClick={() => create.mutate({ opportunityId, body: draft.trim() })}>
              {create.isPending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </div>
      ) : null}

      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map(c => (
            <li key={c.id} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{c.authorName ?? "Unknown"}</span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {fmtDate(c.createdAt)}{c.editedAt ? " · edited" : ""}
                  {canModify(c) ? (
                    <>
                      <button aria-label="Edit" onClick={() => { setEditingId(c.id); setEditBody(c.body); }} className="hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                      <button aria-label="Delete" onClick={() => remove.mutate({ commentId: c.id })} className="hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                    </>
                  ) : null}
                </span>
              </div>
              {editingId === c.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" disabled={!editBody.trim() || edit.isPending} onClick={() => edit.mutate({ commentId: c.id, body: editBody.trim() })}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
