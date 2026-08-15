/**
 * Description — Trello's card description block: a placeholder box that becomes a
 * textarea on click, with Save / Cancel. Writes opportunities.description through the
 * commercial update mutation.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlignLeft } from "lucide-react";
import { useCommercialPerms } from "./shared";

export default function DescriptionSection({
  opportunityId, description,
}: { opportunityId: number; description: string | null }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? "");

  const update = trpc.opportunities.commercial.update.useMutation({
    onSuccess: () => { utils.opportunities.commercial.get.invalidate({ id: opportunityId }); setEditing(false); },
    onError: err => toast({ title: "Could not save description", description: err.message, variant: "destructive" }),
  });

  const open = () => { setDraft(description ?? ""); setEditing(true); };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlignLeft className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">Description</h3>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add a more detailed description…"
            className="min-h-[120px] text-sm"
            onKeyDown={e => { if (e.key === "Escape") setEditing(false); }}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8" disabled={update.isPending} onClick={() => update.mutate({ id: opportunityId, description: draft.trim() || null })}>Save</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : description ? (
        <button
          className="w-full rounded-md p-2 text-left text-sm whitespace-pre-wrap hover:bg-muted"
          onClick={() => canWrite && open()}
        >
          {description}
        </button>
      ) : (
        <button
          className="w-full rounded-md border bg-muted/40 p-3 text-left text-sm text-muted-foreground hover:bg-muted"
          onClick={() => canWrite && open()}
        >
          Add a more detailed description…
        </button>
      )}
    </div>
  );
}
