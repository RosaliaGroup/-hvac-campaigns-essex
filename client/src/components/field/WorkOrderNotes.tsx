/**
 * WorkOrderNotes — technician notes on the work order, split into TWO clearly
 * separated, distinctly-labeled sections so staff can never confuse them:
 *
 *   • Internal Notes — 🔒 Staff Only. NEVER visible to customers. Server-enforced
 *     staff-only: no customer-facing endpoint (portal / SMS / email / invoice /
 *     appointment confirmation / export / AI) reads jobNotes at all — see the
 *     leak-guard test server/internalNotes.leak.test.ts.
 *   • Customer Notes — 👁 Customer Visible. May appear in customer
 *     communications / on the service report.
 *
 * Each section has its own composer and its own timeline (no shared toggle, so a
 * technician can never pick the wrong visibility). A technician edits only their
 * own notes; after completion the server locks editing (canEdit is per note).
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatDisplayName } from "@shared/nameFormat";
import type { NoteType } from "@shared/jobMedia";
import { PhotoThumb } from "@/components/field/PhotoThumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Lock, UserRound, Eye } from "lucide-react";

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

type FieldNote = {
  id: number; body: string; visibility: string;
  authorName: string | null; authorPhoto: string | null;
  edited: boolean; canEdit: boolean;
  createdAt: Date | string; attachmentId: number | null;
};

/** Per-section presentation. Deliberately distinct styling + copy per type. */
const SECTION = {
  internal: {
    title: "Internal Notes",
    Icon: Lock,
    tagText: "Staff Only",
    caption: "Never visible to customers.",
    accent: "text-slate-700",
    tagClass: "border-slate-300 bg-slate-100 text-slate-700",
    cardClass: "border-slate-200",
    addLabel: "Add Internal Note",
    placeholder: "Internal note — staff only. Not shown to the customer…",
    empty: "No internal notes yet.",
  },
  customer: {
    title: "Customer Notes",
    Icon: Eye,
    tagText: "Customer Visible",
    caption: "May appear in customer communications.",
    accent: "text-blue-700",
    tagClass: "border-blue-300 bg-blue-50 text-blue-700",
    cardClass: "border-blue-200",
    addLabel: "Add Customer Note",
    placeholder: "Customer-visible note — may appear on the service report…",
    empty: "No customer notes yet.",
  },
} as const;

function NotesSection({
  jobId, type, notes, isLoading, onChanged,
}: {
  jobId: number; type: NoteType; notes: FieldNote[]; isLoading: boolean; onChanged: () => void;
}) {
  const cfg = SECTION[type];
  const Icon = cfg.Icon;
  const addNote = trpc.jobs.fieldAddNote.useMutation();
  const updateNote = trpc.jobs.fieldUpdateNote.useMutation();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await addNote.mutateAsync({ jobId, body, visibility: type });
      setDraft("");
      onChanged();
      toast.success(`${cfg.title.replace(/s$/, "")} added`);
    } catch (e: any) { toast.error(e?.message || "Could not add note"); }
  };
  const saveEdit = async (id: number) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      await updateNote.mutateAsync({ id, body });
      setEditingId(null);
      onChanged();
      toast.success("Note updated");
    } catch (e: any) { toast.error(e?.message || "Could not update note"); }
  };

  return (
    <Card className={`rounded-2xl shadow-sm ${cfg.cardClass}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={`h-4 w-4 ${cfg.accent}`} />
          <span className={`text-sm font-bold ${cfg.accent}`}>{cfg.title}</span>
          <Badge variant="outline" className={`border text-[11px] ${cfg.tagClass}`}>{cfg.tagText}</Badge>
          <Badge variant="secondary" className="ml-auto">{notes.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{cfg.caption}</p>

        {/* Composer — fixed visibility for this section (no toggle) */}
        <div className="space-y-2 rounded-xl border p-3">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            placeholder={cfg.placeholder}
            className="text-base"
            aria-label={cfg.addLabel}
          />
          <Button className="h-11 w-full" disabled={addNote.isPending || !draft.trim()} onClick={submit}>
            {addNote.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {cfg.addLabel}
          </Button>
        </div>

        {/* Timeline (newest first) */}
        {isLoading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{cfg.empty}</p>
        ) : (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="flex gap-2">
                <Avatar name={n.authorName} photo={n.authorPhoto} />
                <div className="min-w-0 flex-1 rounded-lg bg-muted/50 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-semibold">{n.authorName ? formatDisplayName(n.authorName) : "Office"}</span>
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

export function WorkOrderNotes({ jobId }: { jobId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.jobs.fieldListNotes.useQuery({ jobId }, { enabled: jobId > 0 });
  const notes = (data?.notes ?? []) as FieldNote[];
  const internal = notes.filter(n => n.visibility === "internal");
  const customer = notes.filter(n => n.visibility === "customer");
  const onChanged = () => utils.jobs.fieldListNotes.invalidate({ jobId });

  return (
    <div className="space-y-4">
      <NotesSection jobId={jobId} type="internal" notes={internal} isLoading={isLoading} onChanged={onChanged} />
      <NotesSection jobId={jobId} type="customer" notes={customer} isLoading={isLoading} onChanged={onChanged} />
    </div>
  );
}

export default WorkOrderNotes;
