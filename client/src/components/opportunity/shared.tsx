/**
 * Shared building blocks for the Opportunity Center views (Overview / Pipeline /
 * All). Badge palettes, formatting, and the client-side row/detail types that
 * mirror the opportunities router output.
 */
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import { workCategoryLabel, type WorkCategory } from "@shared/opportunityCategory";
import { followUpUrgency } from "@shared/opportunityDashboard";
import type { OpportunityStage, SalesDocStatus, AgingBucket } from "@shared/opportunityDashboard";

export const STAGE_META: { value: OpportunityStage; label: string; badge: string; column: string }[] = [
  { value: "new", label: "New", badge: "bg-slate-100 text-slate-700 border-slate-200", column: "border-slate-300" },
  { value: "proposal_sent", label: "Proposal Sent", badge: "bg-blue-100 text-blue-700 border-blue-200", column: "border-blue-300" },
  { value: "pending", label: "Pending", badge: "bg-amber-100 text-amber-700 border-amber-200", column: "border-amber-300" },
  { value: "won", label: "Won", badge: "bg-green-100 text-green-700 border-green-200", column: "border-green-300" },
  { value: "lost", label: "Lost", badge: "bg-red-100 text-red-700 border-red-200", column: "border-red-300" },
];

export const WORK_CATEGORY_BADGE: Record<WorkCategory, string> = {
  residential: "bg-sky-100 text-sky-800 border-sky-200",
  commercial: "bg-violet-100 text-violet-800 border-violet-200",
  change_order: "bg-orange-100 text-orange-800 border-orange-200",
};

export const DOC_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  closed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-slate-200 text-slate-600",
};

export const AGING_BADGE: Record<AgingBucket, string> = {
  "0-3": "bg-green-100 text-green-700",
  "4-7": "bg-yellow-100 text-yellow-700",
  "8-14": "bg-orange-100 text-orange-700",
  "15+": "bg-red-100 text-red-700",
};

export const RELATIONSHIP_BADGE: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700",
  prospect: "bg-blue-100 text-blue-700",
  customer: "bg-green-100 text-green-700",
};

export function fmtMoney(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function stageMeta(stage: string) {
  return STAGE_META.find(m => m.value === stage);
}

export function StageBadge({ stage }: { stage: string }) {
  const m = stageMeta(stage);
  return <Badge variant="outline" className={m?.badge ?? ""}>{m?.label ?? stage}</Badge>;
}

export function WorkCategoryBadge({ category }: { category: WorkCategory | null | undefined }) {
  if (!category) return null;
  return (
    <Badge variant="outline" className={`text-xs font-semibold ${WORK_CATEGORY_BADGE[category]}`}>
      {workCategoryLabel(category)}
    </Badge>
  );
}

/**
 * Follow-up urgency chip for a pipeline/list row. Renders a red "Overdue" or
 * amber "Due today" badge (and nothing otherwise), derived client-side by the
 * unit-tested followUpUrgency helper from the opportunity's next-action date.
 */
export function FollowUpIndicator({ row }: { row: Pick<OppRow, "stage" | "nextActionDueAt"> }) {
  const urgency = followUpUrgency(row);
  if (!urgency) return null;
  if (urgency === "overdue") {
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[11px] font-medium text-red-700">
        <AlertTriangle className="h-3 w-3" /> Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-700">
      <Clock className="h-3 w-3" /> Due today
    </span>
  );
}

/** One row of the opportunities.list output (mirrors server toListItem). */
export interface OppRow {
  id: number;
  stage: OpportunityStage;
  amount: number;
  probability: number | null;
  effectiveProbability: number;
  weightedValue: number;
  amountOverridden: boolean;
  stageOverridden: boolean;
  quickbooksAmount: number | null;
  valueDiffersFromQuickbooks: boolean;
  workCategory: WorkCategory | null;
  docTypeLabel: string | null;
  title: string | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  assignedToId: number | null;
  customerId: number;
  customerName: string;
  customerType: string | null;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  docId: number | null;
  docType: string | null;
  docNumber: string | null;
  docStatus: SalesDocStatus | null;
  txnDate: Date | null;
  sentAt: Date | null;
  documentLink: string | null;
  daysPending: number | null;
  agingBucket: AgingBucket | null;
  createdAt: Date;
  updatedAt: Date | null;
}
