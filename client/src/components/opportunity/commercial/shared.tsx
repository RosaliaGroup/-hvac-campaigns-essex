/**
 * Shared UI atoms for the Commercial Opportunities views: role/permission hook,
 * badge palettes, and small presentational helpers. Kept separate from the pure
 * logic in `@/lib/commercialOpportunities`.
 */
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  opportunityTypeLabel,
  projectCategoryLabel,
  documentCategoryLabel,
} from "@shared/commercialPipeline";

/** Client-side permission signals (server remains authoritative). */
export interface CommercialPerms {
  isAdmin: boolean;
  isViewer: boolean;
  /** May attempt mutations (viewers may not). Ownership is enforced server-side. */
  canWrite: boolean;
  /** Current user's teamMembers.id (for "My Opportunities"), or null. */
  currentMemberId: number | null;
}

export function useCommercialPerms(): CommercialPerms {
  const { user } = useAuth();
  const u = user as { role?: string; teamRole?: string; openId?: string } | null;
  const isAdmin = u?.role === "admin" || u?.teamRole === "admin";
  const isViewer = u?.teamRole === "viewer";
  const currentMemberId =
    typeof u?.openId === "string" && u.openId.startsWith("team:") ? Number(u.openId.slice(5)) : null;
  return { isAdmin, isViewer, canWrite: !isViewer, currentMemberId };
}

export const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-sky-100 text-sky-700 border-sky-200",
  high: "bg-amber-100 text-amber-800 border-amber-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
};

export const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  awarded: "bg-green-100 text-green-700 border-green-200",
  lost: "bg-red-100 text-red-700 border-red-200",
  on_hold: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-slate-200 text-slate-600 border-slate-300",
};

export const CLASSIFICATION_COLUMN: Record<string, string> = {
  open: "border-slate-300",
  won: "border-green-400",
  lost: "border-red-400",
};

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null;
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${PRIORITY_BADGE[priority] ?? ""}`}>
      {priority}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_BADGE[status] ?? ""}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null;
  return <Badge variant="outline" className="text-[10px]">{opportunityTypeLabel(type)}</Badge>;
}

export function CategoryChips({ categories }: { categories: string[] }) {
  if (!categories.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map(c => (
        <Badge key={c} variant="secondary" className="text-[10px]">{projectCategoryLabel(c)}</Badge>
      ))}
    </div>
  );
}

export { opportunityTypeLabel, projectCategoryLabel, documentCategoryLabel };
