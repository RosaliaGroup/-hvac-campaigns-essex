/**
 * Quick fields — the chips that sit under the card title, matching Trello's Labels row.
 *
 * These are dropdowns rather than checklist items on purpose. Project type, priority and
 * the strategic flags are real columns on the opportunity (projectCategories,
 * priorityScore, isStrategicLead, isStrategicProject), so modelling them as tick-boxes
 * would duplicate live state and let the two disagree — someone ticks "Priority 7" while
 * priorityScore still says 10 and nothing reconciles them. A dropdown writes the column
 * directly, and single-select fields can't be given two answers at once.
 */
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, Star, Tag } from "lucide-react";
import { PROJECT_CATEGORIES, projectCategoryLabel } from "@shared/commercialPipeline";
import type { CommercialDetail } from "@/lib/commercialApiTypes";
import { useCommercialPerms } from "./shared";

/** The commercial scoring ladder retained in priorityScore (see drizzle/README.md). */
const PRIORITY_SCORES = [10, 7, 5, 3, 1] as const;

/** Common channels, so the platform stops being a free-text field people spell three ways. */
const PLATFORMS = ["Email", "Phone", "Text / SMS", "Microsoft Teams", "Zoom", "Client portal", "Other"];

export default function QuickFieldsSection({
  opportunityId, detail,
}: { opportunityId: number; detail: CommercialDetail }) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const { canWrite } = useCommercialPerms();

  const o = detail.opportunity;
  const categories = detail.projectCategories ?? [];

  const refresh = () => utils.opportunities.commercial.get.invalidate({ id: opportunityId });
  const onErr = (err: { message: string }) =>
    toast({ title: "Update failed", description: err.message, variant: "destructive" });

  const update = trpc.opportunities.commercial.update.useMutation({ onSuccess: refresh, onError: onErr });
  const setCategories = trpc.opportunities.commercial.setProjectCategories.useMutation({ onSuccess: refresh, onError: onErr });

  const toggleCategory = (key: string) => {
    const next = categories.includes(key) ? categories.filter(c => c !== key) : [...categories, key];
    setCategories.mutate({ id: opportunityId, categories: next });
  };

  const chip = "h-7 gap-1 text-xs";

  const bidDue = o.bidDueAt ? new Date(o.bidDueAt) : null;
  const bidDueOverdue = bidDue != null && bidDue < new Date();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Bid due date — the submission deadline for this bid. */}
      <span className={`inline-flex items-center gap-1 h-7 rounded-md border px-2 text-xs ${bidDueOverdue ? "border-red-300 bg-red-50 text-red-700" : "text-muted-foreground"}`}>
        Bid due
        <input
          type="date"
          className="bg-transparent text-xs outline-none"
          value={bidDue ? bidDue.toISOString().slice(0, 10) : ""}
          disabled={!canWrite || update.isPending}
          onChange={(e) =>
            update.mutate({
              id: opportunityId,
              bidDueAt: e.target.value ? new Date(e.target.value + "T12:00:00") : null,
            })
          }
        />
      </span>
      {/* Project type — multi-select, since a job can be both e.g. Restaurant and Commercial. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={chip} disabled={!canWrite}>
            <Tag className="h-3.5 w-3.5" /> Project type <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Type of project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PROJECT_CATEGORIES.map(c => (
            <DropdownMenuItem key={c.key} onSelect={e => { e.preventDefault(); toggleCategory(c.key); }}>
              <span className="flex-1">{c.label}</span>
              {categories.includes(c.key) ? <Check className="ml-2 h-4 w-4" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority — single-select ladder. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={chip} disabled={!canWrite}>
            Priority{o.priorityScore ? ` ${o.priorityScore}` : ""} <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Evaluación comercial</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITY_SCORES.map(p => (
            <DropdownMenuItem key={p} onSelect={() => update.mutate({ id: opportunityId, priorityScore: p })}>
              <span className="flex-1">Priority {p}</span>
              {o.priorityScore === p ? <Check className="ml-2 h-4 w-4" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => update.mutate({ id: opportunityId, priorityScore: null })}>
            <span className="flex-1">No priority</span>
            {o.priorityScore == null ? <Check className="ml-2 h-4 w-4" /> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Strategic flags — two independent booleans, so a menu of toggles rather than a select. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={chip} disabled={!canWrite}>
            <Star className="h-3.5 w-3.5" /> Strategic <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={e => { e.preventDefault(); update.mutate({ id: opportunityId, isStrategicLead: !o.isStrategicLead }); }}>
            <span className="flex-1">Strategic lead</span>
            {o.isStrategicLead ? <Check className="ml-2 h-4 w-4" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={e => { e.preventDefault(); update.mutate({ id: opportunityId, isStrategicProject: !o.isStrategicProject }); }}>
            <span className="flex-1">Strategic project</span>
            {o.isStrategicProject ? <Check className="ml-2 h-4 w-4" /> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Communication platform — a picker, not a text box. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={chip} disabled={!canWrite}>
            {o.communicationPlatform || "Platform"} <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Communication platform</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PLATFORMS.map(p => (
            <DropdownMenuItem key={p} onSelect={() => update.mutate({ id: opportunityId, communicationPlatform: p })}>
              <span className="flex-1">{p}</span>
              {o.communicationPlatform === p ? <Check className="ml-2 h-4 w-4" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => update.mutate({ id: opportunityId, communicationPlatform: null })}>Clear</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Current values, so the row reads at a glance without opening anything. */}
      {categories.map(c => (
        <Badge key={c} variant="secondary" className="text-[10px]">{projectCategoryLabel(c)}</Badge>
      ))}
      {o.isStrategicLead ? <Badge variant="outline" className="text-[10px]">Strategic lead</Badge> : null}
      {o.isStrategicProject ? <Badge variant="outline" className="text-[10px]">Strategic project</Badge> : null}
    </div>
  );
}
