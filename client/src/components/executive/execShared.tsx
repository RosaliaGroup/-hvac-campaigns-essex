/**
 * Shared building blocks for the Executive Dashboards feature.
 *
 * Everything data-driven here comes from real tRPC reads. Where a KPI has no
 * system of record, the backend returns a `{ status: "coming_soon" }` shape and
 * we render <ComingSoonTile> — we never invent a number or a target.
 */
import { useMemo } from "react";
import {
  startOfMonth, startOfQuarter, startOfYear, subDays, subMonths, endOfDay,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ArrowUpRight, ArrowDownRight, Lock, ExternalLink, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── date presets ────────────────────────────────────────────────────────────
export const DATE_PRESETS = [
  { value: "mtd", label: "Month to date" },
  { value: "qtd", label: "Quarter to date" },
  { value: "ytd", label: "Year to date" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "last_12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number]["value"];

/** Resolve a preset to a concrete [from,to] range (or open-ended for "all"). */
export function resolveRange(preset: DatePreset, now = new Date()): { dateFrom?: Date; dateTo?: Date } {
  const to = endOfDay(now);
  switch (preset) {
    case "mtd": return { dateFrom: startOfMonth(now), dateTo: to };
    case "qtd": return { dateFrom: startOfQuarter(now), dateTo: to };
    case "ytd": return { dateFrom: startOfYear(now), dateTo: to };
    case "last_30d": return { dateFrom: subDays(now, 30), dateTo: to };
    case "last_90d": return { dateFrom: subDays(now, 90), dateTo: to };
    case "last_12m": return { dateFrom: subMonths(now, 12), dateTo: to };
    case "all": return {};
  }
}

// ── the shared filter shape passed to every dashboard + drill-down ────────────
export type ExecFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  technicianId?: number;
  customerId?: number;
};

// ── formatting ────────────────────────────────────────────────────────────────
export function fmtMoney(n: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number.isFinite(n) ? n : 0);
}
export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(Number.isFinite(n) ? n : 0);
}
export function fmtPct(fraction: number): string {
  return `${((Number.isFinite(fraction) ? fraction : 0) * 100).toFixed(1)}%`;
}
export function fmtMult(n: number): string {
  return `${(Number.isFinite(n) ? n : 0).toFixed(1)}×`;
}
/** "2026-07" → "Jul '26" for compact chart axes. */
export function monthShort(key: string): string {
  const [y, m] = key.split("-");
  const mi = Number(m) - 1;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[mi] ?? m} '${(y ?? "").slice(2)}`;
}

// ── coming-soon guard ─────────────────────────────────────────────────────────
export type ComingSoon = { status: "coming_soon"; reason: string };
export function isComingSoon(v: unknown): v is ComingSoon {
  return !!v && typeof v === "object" && (v as { status?: string }).status === "coming_soon";
}

// ── delta from a trend series (a REAL month-over-month comparison) ─────────────
export function deltaFromTrend(series: number[]): { pct: number; dir: "up" | "down" } | null {
  const nonZero = series.map((v, i) => ({ v, i })).filter(p => p.v > 0);
  if (nonZero.length < 2) return null;
  const cur = nonZero[nonZero.length - 1].v;
  const prev = nonZero[nonZero.length - 2].v;
  if (prev <= 0) return null;
  const pct = (cur - prev) / prev;
  return { pct: Math.abs(pct), dir: pct >= 0 ? "up" : "down" };
}

// ── inline sparkline (light-weight; no per-tile recharts instance) ────────────
export function Sparkline({ data, color = "#1e3a5f" }: { data: number[]; color?: string }) {
  const path = useMemo(() => {
    if (!data.length) return { line: "", area: "", dot: null as null | { x: number; y: number } };
    const w = 120, h = 32, pad = 2;
    const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
    const x = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1 || 1);
    const y = (v: number) => h - pad - ((v - min) / rng) * (h - 2 * pad);
    let line = "";
    data.forEach((v, i) => { line += `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; });
    const area = `${line}L${x(data.length - 1).toFixed(1)} ${h} L${x(0).toFixed(1)} ${h} Z`;
    return { line, area, dot: { x: x(data.length - 1), y: y(data[data.length - 1]) } };
  }, [data]);
  if (!data.length) return null;
  const gid = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox="0 0 120 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gid})`} />
      <path d={path.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {path.dot && <circle cx={path.dot.x} cy={path.dot.y} r="2.4" fill={color} />}
    </svg>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
export function KpiTile({
  label, value, sub, icon: Icon, accent = "#1e3a5f",
  trend, lowerBetter = false, footnote, onOpen,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  trend?: number[];
  lowerBetter?: boolean;
  footnote?: string;
  onOpen?: () => void;
}) {
  const delta = trend ? deltaFromTrend(trend) : null;
  // "good" = up when higher-is-better, or down when lower-is-better.
  const deltaGood = delta ? (delta.dir === "up") !== lowerBetter : false;
  const clickable = !!onOpen;
  return (
    <Card
      className={`border-t-4 transition-shadow ${clickable ? "cursor-pointer hover:shadow-md" : ""}`}
      style={{ borderTopColor: accent }}
      onClick={onOpen}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); } } : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              {label}
              {lowerBetter && (
                <span className="text-[9px] font-mono uppercase tracking-wide text-muted-foreground/70 border border-border rounded px-1 py-px">
                  lower ▽
                </span>
              )}
            </p>
            <p className="text-2xl font-bold truncate" style={{ color: accent }}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className="h-7 w-7 shrink-0 text-muted-foreground/20" />
        </div>

        {delta && (
          <div className="mt-2 flex items-center gap-1 text-xs font-medium">
            {delta.dir === "up"
              ? <ArrowUpRight className={`h-3.5 w-3.5 ${deltaGood ? "text-green-600" : "text-red-600"}`} />
              : <ArrowDownRight className={`h-3.5 w-3.5 ${deltaGood ? "text-green-600" : "text-red-600"}`} />}
            <span className={deltaGood ? "text-green-600" : "text-red-600"}>{fmtPct(delta.pct)}</span>
            <span className="text-muted-foreground">vs prior month</span>
          </div>
        )}

        {trend && trend.some(v => v > 0) && (
          <div className="mt-2"><Sparkline data={trend} color={accent} /></div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
          <span className="text-[10px] text-muted-foreground truncate">{footnote}</span>
          {clickable && (
            <span className="text-[10px] text-[#ff6b35] font-medium flex items-center gap-0.5 shrink-0">
              View data <ExternalLink className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── request-error banner (a FAILED query — distinct from a valid zero result) ──
export function ErrorBanner({
  title = "This dashboard couldn't load", message, onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/50 bg-destructive/5" role="alert">
      <CardContent className="p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {message ?? "The data request failed — this is an error, not a zero result. No figures are shown, to avoid misreporting. Check your connection and retry."}
          </p>
        </div>
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
      </CardContent>
    </Card>
  );
}

// ── loading skeleton (shown while data is in flight — never renders 0 / $0) ────
export function DashboardSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <Card key={i} className="border-t-4 border-t-muted">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Coming-soon tile (no data source — never fabricated) ───────────────────────
export function ComingSoonTile({
  label, reason, icon: Icon,
}: {
  label: string;
  reason: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-t-4 border-t-muted-foreground/30 bg-muted/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40">
                Coming Soon
              </Badge>
            </div>
          </div>
          <Icon className="h-7 w-7 shrink-0 text-muted-foreground/15" />
        </div>
        <p className="text-[11px] text-muted-foreground/80 mt-2 leading-snug">{reason}</p>
      </CardContent>
    </Card>
  );
}

// ── section chart card wrapper ─────────────────────────────────────────────────
export function ChartCard({
  title, subtitle, children, action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#1e3a5f]">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ── drill-down: uniform underlying-data table with CSV export ─────────────────
export type DrillColumn = { key: string; label: string; type: "text" | "number" | "money" | "date" };
export type ServerMetric =
  | "booked_revenue" | "pipeline" | "close_rate"
  | "recognized_revenue" | "estimates"
  | "technician_revenue" | "jobs_completed";
export type DrillTarget =
  | { mode: "server"; metric: ServerMetric; title: string; description?: string }
  | { mode: "static"; title: string; description?: string; columns: DrillColumn[]; rows: Record<string, unknown>[] };

function fmtCell(value: unknown, type: DrillColumn["type"]): string {
  if (value == null || value === "") return "—";
  if (type === "money") return fmtMoney(Number(value));
  if (type === "number") return fmtNum(Number(value));
  if (type === "date") { const d = new Date(value as string); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(); }
  return String(value);
}

function downloadCsv(filename: string, columns: DrillColumn[], rows: Record<string, unknown>[]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = columns.map(c => esc(c.label)).join(",");
  const body = rows.map(r =>
    columns.map(c => {
      const v = r[c.key];
      if (c.type === "date" && v) { const d = new Date(v as string); return esc(isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)); }
      return esc(v == null ? "" : String(v));
    }).join(","),
  ).join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DrilldownSheet({
  target, filters, onClose,
}: {
  target: DrillTarget | null;
  filters: ExecFilters;
  onClose: () => void;
}) {
  const isServer = target?.mode === "server";
  const query = trpc.executiveDashboards.drilldown.useQuery(
    {
      metric: (isServer ? (target as Extract<DrillTarget, { mode: "server" }>).metric : "booked_revenue"),
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      technicianId: filters.technicianId,
      customerId: filters.customerId,
      limit: 500,
      offset: 0,
    },
    { enabled: !!target && isServer },
  );

  const columns: DrillColumn[] = target
    ? target.mode === "static"
      ? target.columns
      : ((query.data?.columns as DrillColumn[]) ?? [])
    : [];
  const rows: Record<string, unknown>[] = target
    ? target.mode === "static"
      ? target.rows
      : ((query.data?.rows as Record<string, unknown>[]) ?? [])
    : [];
  const loading = isServer && query.isLoading;
  const slug = target ? target.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "export";

  return (
    <Sheet open={!!target} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#1e3a5f]">{target?.title}</SheetTitle>
          <SheetDescription>
            {target?.description ?? "Underlying records behind this metric, for the current filters."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} row${rows.length === 1 ? "" : "s"}`}
            {isServer && query.data && query.data.total > rows.length && ` of ${query.data.total} (showing first ${rows.length})`}
          </span>
          <Button
            size="sm" variant="outline"
            disabled={!rows.length}
            onClick={() => downloadCsv(slug, columns, rows)}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>

        <div className="mt-3 rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(c => (
                  <TableHead key={c.key} className={c.type === "money" || c.type === "number" ? "text-right" : ""}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={columns.length || 1} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length || 1} className="text-center text-muted-foreground py-8">No records for these filters.</TableCell></TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={i}>
                    {columns.map(c => (
                      <TableCell key={c.key} className={c.type === "money" || c.type === "number" ? "text-right tabular-nums" : ""}>
                        {fmtCell(r[c.key], c.type)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Standalone CSV export for a table already in memory (used by chart cards). */
export function exportRowsCsv(filename: string, columns: DrillColumn[], rows: Record<string, unknown>[]) {
  downloadCsv(filename, columns, rows);
}

// ── horizontal bar list (funnels, leaderboards) ────────────────────────────────
export function BarList({
  rows, color = "#1e3a5f", valueFormat = (n: number) => fmtNum(n),
}: {
  rows: { label: string; value: number; hint?: string }[];
  color?: string;
  valueFormat?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="space-y-2.5">
      {rows.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No data for these filters.</p>}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3">
          <span className="text-xs text-foreground truncate" title={r.label}>{r.label}</span>
          <div className="h-4 rounded bg-muted overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs font-mono tabular-nums text-foreground text-right min-w-[56px]">
            {valueFormat(r.value)}{r.hint && <span className="text-muted-foreground ml-1">{r.hint}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
