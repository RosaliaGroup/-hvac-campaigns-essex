/**
 * WorkOrderNotes — technician notes on the work order. Two types: Internal
 * (staff-only) and Customer (goes on the service report). Notes render newest-
 * first with the author's photo/name, timestamp, a type badge, an "Edited" badge,
 * and any attached photo. A technician may edit only their own notes; after the
 * job is completed the server locks editing (internal → admin-only, customer →
 * read-only). Editability is decided server-side and returned per note (canEdit).
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatDisplayName } from "@shared/nameFormat";
import { NOTE_TYPES, NOTE_TYPE_LABEL, NOTE_TYPE_BADGE, type NoteType } from "@shared/jobMedia";
import { PhotoThumb } from "@/components/field/PhotoThumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Loader2, Pencil, Lock, UserRound } from "lucide-react";

function timeLabel(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function Avatar({ name, photo }: { name: string | null; photo: string | null }) {
  if (photo) return <img src={photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  const initials = (name ?? "").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}

export function WorkOrderNotes({ jobId }: { jobId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.jobs.fieldListNotes.useQuery({ jobId }, { enabled: jobId > 0 });
  const addNote = trpc.jobs.fieldAddNote.useMutation();
  const updateNote = trpc.jobs.fieldUpdateNote.useMutation();

  const [visibility, setVisibility] = useState<NoteType>("internal");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const notes = data?.notes ?? [];

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await addNote.mutateAsync({ jobId, body, visibility });
      setDraft("");
      utils.jobs.fieldListNotes.invalidate({ jobId });
      toast.success("Note added");
    } catch (e: any) { toast.error(e?.message || "Could not add note"); }
  };
  const saveEdit = async (id: number) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      await updateNote.mutateAsync({ id, body });
      setEditingId(null);
      utils.jobs.fieldListNotes.invalidate({ jobId });
      toast.success("Note updated");
    } catch (e: any) { toast.error(e?.message || "Could not update note"); }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <StickyNote className="h-4 w-4" />
          <span className="uppercase tracking-wide">Notes</span>
          <Badge variant="secondary" className="ml-auto">{notes.length}</Badge>
        </div>

        {/* Composer */}
        <div className="space-y-2 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            {NOTE_TYPES.map(t => (
              <Button
                key={t}
                type="button"
                variant={visibility === t ? "default" : "outline"}
                className="h-10"
                onClick={() => setVisibility(t)}
              >
                {NOTE_TYPE_LABEL[t]}
              </Button>
            ))}
          </div>
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            placeholder={visibility === "customer" ? "Work performed (shown on the service report)…" : "Internal note (staff only)…"}
            className="text-base"
          />
          <Button className="h-11 w-full" disabled={addNote.isPending || !draft.trim()} onClick={submit}>
            {addNote.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add {NOTE_TYPE_LABEL[visibility]} Note
          </Button>
        </div>

        {/* Timeline (newest first) */}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="flex gap-2">
                <Avatar name={n.authorName} photo={n.authorPhoto} />
                <div className="min-w-0 flex-1 rounded-lg bg-muted/50 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold">{n.authorName ? formatDisplayName(n.authorName) : "Office"}</span>
                    <Badge variant="outline" className={`border ${NOTE_TYPE_BADGE[n.visibility as NoteType]}`}>
                      {NOTE_TYPE_LABEL[n.visibility as NoteType]}
                    </Badge>
                    {n.edited ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Edited</Badge> : null}
                    <span className="text-muted-foreground">{timeLabel(n.createdAt)}</span>
                    <span className="ml-auto">
                      {n.canEdit ? (
                        <button
                          className="inline-flex items-center gap-1 text-[#ff6b35]"
                          onClick={() => { setEditingId(n.id); setEditDraft(n.body); }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground/70"><Lock className="h-3 w-3" /></span>
                      )}
                    </span>
                  </div>

                  {editingId === n.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} rows={3} className="text-base" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-9" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button size="sm" className="h-9" disabled={updateNote.isPending || !editDraft.trim()} onClick={() => saveEdit(n.id)}>
                          {updateNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
                  )}

                  {n.attachmentId ? (
                    <div className="mt-2 w-28">
                      <PhotoThumb id={n.attachmentId} className="h-20" alt="Note photo" />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkOrderNotes;
