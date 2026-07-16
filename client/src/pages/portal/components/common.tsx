import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGE_TONE } from "../lib/format";

/** Page title + optional description and actions, used at the top of each section. */
export function PortalPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Semantic status pill (accessible: conveys state via text, colour is supplementary). */
export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: keyof typeof BADGE_TONE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        BADGE_TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Loading skeleton for list/detail sections. */
export function LoadingState({ rows = 4, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Inline centered spinner (for buttons / small regions). */
export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" />;
}

/** Empty state — shown when a query succeeds but returns no rows. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: typeof Inbox;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Error state — shown when a query/mutation fails. Offers a retry. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-6 py-12 text-center dark:border-rose-900/50 dark:bg-rose-950/30"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-rose-900 dark:text-rose-100">{title}</p>
      {message ? <p className="mt-1 max-w-sm text-sm text-rose-700 dark:text-rose-300">{message}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "Coming Soon" — used when a section's backend module is not yet wired up so
 * we never fabricate data. Distinct from an empty state (which means "no records
 * yet"): this signals the capability itself is pending.
 */
export function ComingSoon({
  title = "Coming soon",
  description = "This part of your portal isn't available yet. Check back shortly.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-16 text-center dark:border-slate-700">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
        <Hammer className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

/**
 * Standard async-section renderer: shows loading, then error (with retry), then
 * empty, then the children. Keeps every section's states consistent.
 */
export function AsyncSection<T>({
  query,
  emptyTitle,
  emptyDescription,
  emptyAction,
  isEmpty,
  loadingRows,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error?: { message?: string } | null; data: T | undefined; refetch: () => void };
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  isEmpty: (data: T) => boolean;
  loadingRows?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <LoadingState rows={loadingRows} />;
  if (query.isError) return <ErrorState message={query.error?.message} onRetry={query.refetch} />;
  const data = query.data;
  if (data === undefined) return <ErrorState message="No data was returned." onRetry={query.refetch} />;
  if (isEmpty(data)) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return <>{children(data)}</>;
}
