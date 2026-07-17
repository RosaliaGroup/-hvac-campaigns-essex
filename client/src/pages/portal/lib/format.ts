/** Shared formatting + status helpers for the Customer Portal. */

export function formatMoney(value: string | number | null | undefined, currency = "USD"): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Turn a snake/enum token into Title Case for display. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Tailwind classes for a status pill by semantic tone (works in light + dark). */
export const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
};

export function docStatusTone(status: string): BadgeTone {
  switch (status) {
    case "accepted":
    case "paid":
    case "closed":
      return "success";
    case "pending":
    case "partial":
      return "warning";
    case "rejected":
    case "expired":
    case "void":
    case "unpaid":
      return "danger";
    default:
      return "neutral";
  }
}

export function apptStatusTone(status: string): BadgeTone {
  switch (status) {
    case "confirmed":
    case "completed":
    case "arrived":
      return "success";
    case "pending":
    case "rescheduled":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function jobStatusTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
    case "paid":
    case "closed":
      return "success";
    case "cancelled":
      return "danger";
    case "in_progress":
    case "scheduled":
    case "approved":
      return "info";
    case "waiting_parts":
    case "estimate_sent":
    case "invoice_sent":
      return "warning";
    default:
      return "neutral";
  }
}

export function genericStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
    case "succeeded":
      return "success";
    case "pending":
      return "warning";
    case "expired":
    case "cancelled":
    case "failed":
    case "void":
    case "suspended":
      return "danger";
    default:
      return "neutral";
  }
}
