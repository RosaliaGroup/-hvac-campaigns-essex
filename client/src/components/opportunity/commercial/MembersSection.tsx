/**
 * Additional opportunity members (the owner / estimator / project manager stay
 * separate, edited in the Overview). Add/remove with duplicate prevention
 * handled server-side.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X, UserPlus } from "lucide-react";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

type Member = CommercialDetail["members"][number];

export default function MembersSection({ opportunityId, members }: { opportunityId: number; members: Member[] }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();
  const salespeople = trpc.opportunities.salespeople.useQuery();
  const [pick, setPick] = useState<string>("");

  const invalidate = () => utils.opportunities.commercial.get.invalidate({ id: opportunityId });
  const onError = (err: { message: string }) => toast({ title: "Member error", description: err.message, variant: "destructive" });
  const add = trpc.opportunities.commercial.members.add.useMutation({ onSuccess: () => { setPick(""); invalidate(); }, onError });
  const remove = trpc.opportunities.commercial.members.remove.useMutation({ onSuccess: invalidate, onError });

  const existingIds = new Set(members.map(m => m.teamMemberId));
  const options = (salespeople.data ?? []).filter(p => !existingIds.has(p.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {members.length === 0 ? <span className="text-sm text-muted-foreground">No additional members.</span> : null}
        {members.map(m => (
          <Badge key={m.id} variant="secondary" className="gap-1">
            {m.name ?? `#${m.teamMemberId}`}
            {canWrite ? (
              <button aria-label="Remove member" onClick={() => remove.mutate({ opportunityId, teamMemberId: m.teamMemberId, role: m.role })} className="hover:text-red-600"><X className="h-3 w-3" /></button>
            ) : null}
          </Badge>
        ))}
      </div>
      {canWrite ? (
        <div className="flex items-center gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Add member…" /></SelectTrigger>
            <SelectContent>{options.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!pick || add.isPending} onClick={() => add.mutate({ opportunityId, teamMemberId: Number(pick) })}>
            <UserPlus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}
