import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  MessageSquareText,
  Phone,
  Navigation,
  MousePointerClick,
  Search,
  Map as MapIcon,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  CloudOff,
  AlertTriangle,
  Eye,
  Star as StarIcon,
} from "lucide-react";
import DashboardFooter from "@/components/DashboardFooter";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  reviewSnippet,
  type GbpInsightPoint,
  type GbpMetricSummary,
} from "@shared/gbp";

/* ── Formatting helpers ─────────────────────────────────────────────────── */

const fmtInt = (n: number) => n.toLocaleString();
const fmtPct = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;
const fmtRating = (n: number) => (n > 0 ? n.toFixed(1) : "—");

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ── Small presentational pieces ────────────────────────────────────────── */

function DeltaPill({ value }: { value: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">No change</span>;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {fmtPct(Math.abs(value))}
    </span>
  );
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
        />
      ))}
    </span>
  );
}

/** Minimal dependency-free sparkline over a numeric series. */
function Sparkline({ values, color = "#ff6b35" }: { values: number[]; color?: string }) {
  if (values.length < 2) {
    return <div className="h-10 w-full flex items-center text-xs text-muted-foreground">Not enough data yet</div>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / span) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricCard({
  label,
  icon: Icon,
  summary,
  series,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: GbpMetricSummary;
  series: number[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-[#ff6b35]" />
            {label}
          </span>
          <DeltaPill value={summary.delta} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums">{fmtInt(summary.total)}</div>
        <div className="mt-2">
          <Sparkline values={series} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function LocalSeo() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const enabled = isAuthenticated && isAdmin;
  const overview = trpc.gbp.overview.useQuery(undefined, { enabled });
  const reviews = trpc.gbp.reviews.useQuery({ limit: 25 }, { enabled });
  const insights = trpc.gbp.insights.useQuery({ days: 30 }, { enabled });
  const posts = trpc.gbp.posts.useQuery({ limit: 20 }, { enabled });
  const syncStatus = trpc.gbp.getSyncStatus.useQuery(undefined, { enabled });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const sync = trpc.gbp.sync.useMutation({
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Synced ${res.reviewsSynced} reviews · ${res.metricsSynced} metric days`);
      } else if (res.reason === "unconfigured") {
        toast.error("Set GBP_ACCOUNT_ID and GBP_LOCATION_ID to connect a location");
      } else if (res.reason === "unavailable") {
        toast.error("Business Profile unavailable — connect Google in Integrations");
      } else if (res.reason === "no_db") {
        toast.error("Database not configured");
      } else if (res.reason === "already_running") {
        toast.message("A sync is already running");
      } else {
        toast.error(res.error ?? "Sync failed");
      }
      utils.gbp.overview.invalidate();
      utils.gbp.reviews.invalidate();
      utils.gbp.insights.invalidate();
      utils.gbp.posts.invalidate();
      utils.gbp.getSyncStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Admin access required
            </CardTitle>
            <CardDescription>
              The Local SEO dashboard is restricted to administrators. Contact an admin if you need access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const o = overview.data;
  const points: GbpInsightPoint[] = insights.data ?? [];
  const series = (field: keyof GbpInsightPoint) => points.map((p) => Number(p[field]) || 0);
  const status = syncStatus.data;
  const reviewRows = reviews.data ?? [];
  const photoRows = posts.data?.photos ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapIcon className="h-6 w-6 text-[#ff6b35]" />
              Local SEO
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {o?.title ? o.title : "Google Business Profile"}
              {o?.storefrontAddress ? ` · ${o.storefrontAddress}` : ""}
              {o?.rangeLabel ? ` · ${o.rangeLabel}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {status?.lastSuccessAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Updated {fmtDate(status.lastSuccessAt)}
              </span>
            )}
            <Button onClick={() => sync.mutate()} disabled={sync.isPending} variant="outline" size="sm">
              {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Sync from Google</span>
            </Button>
          </div>
        </div>

        {/* Freshness / connection banner */}
        {status && status.stale && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <CloudOff className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Local SEO data hasn't synced yet.</p>
              <p className="text-amber-700">
                {status.lastError
                  ? `Last sync error: ${status.lastError}`
                  : "Connect Google in Integrations and set the Business Profile location, then run a sync."}
              </p>
            </div>
          </div>
        )}

        {/* Rating + reviews summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Star className="h-4 w-4 text-amber-400" /> Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold tabular-nums">{fmtRating(o?.rating ?? 0)}</span>
                <span className="text-sm text-muted-foreground mb-1">/ 5</span>
              </div>
              <div className="mt-1">
                <Stars rating={o?.rating ?? 0} />
              </div>
              {o && (o.ratingTrend.delta !== 0) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {o.ratingTrend.delta > 0 ? "+" : ""}
                  {o.ratingTrend.delta.toFixed(2)} vs start of window
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageSquareText className="h-4 w-4 text-[#ff6b35]" /> Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{fmtInt(o?.totalReviews ?? 0)}</div>
              <p className="mt-2 text-xs text-muted-foreground">Rating trend</p>
              <Sparkline values={series("rating")} color="#f59e0b" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ImageIcon className="h-4 w-4 text-[#ff6b35]" /> Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{fmtInt(o?.totalPhotos ?? 0)}</div>
              <p className="mt-2 text-xs text-muted-foreground">On the profile</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageSquareText className="h-4 w-4 text-[#ff6b35]" /> Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">{fmtInt(o?.totalPosts ?? 0)}</div>
              <p className="mt-2 text-xs text-muted-foreground">Published updates</p>
            </CardContent>
          </Card>
        </div>

        {/* Engagement metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Calls" icon={Phone} summary={o?.calls ?? { total: 0, delta: 0 }} series={series("callClicks")} />
          <MetricCard
            label="Directions"
            icon={Navigation}
            summary={o?.directions ?? { total: 0, delta: 0 }}
            series={series("directionRequests")}
          />
          <MetricCard
            label="Website Clicks"
            icon={MousePointerClick}
            summary={o?.websiteClicks ?? { total: 0, delta: 0 }}
            series={series("websiteClicks")}
          />
          <MetricCard
            label="Search Visibility"
            icon={Search}
            summary={o?.searchViews ?? { total: 0, delta: 0 }}
            series={series("searchViews")}
          />
          <MetricCard
            label="Maps Visibility"
            icon={MapIcon}
            summary={o?.mapsViews ?? { total: 0, delta: 0 }}
            series={series("mapsViews")}
          />
        </div>

        {/* Recent reviews + photo performance */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Recent Reviews</CardTitle>
              <CardDescription>Newest reviews on your Business Profile.</CardDescription>
            </CardHeader>
            <CardContent>
              {reviewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No reviews synced yet.</p>
              ) : (
                <ul className="divide-y">
                  {reviewRows.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm">{r.reviewerName}</span>
                        <span className="flex items-center gap-2">
                          <Stars rating={r.starRating} size={12} />
                          <span className="text-xs text-muted-foreground">{fmtDate(r.createTime)}</span>
                        </span>
                      </div>
                      {r.comment && <p className="mt-1 text-sm text-muted-foreground">{reviewSnippet(r.comment, 220)}</p>}
                      {r.replyComment && (
                        <p className="mt-2 text-xs text-slate-600 border-l-2 border-slate-200 pl-2">
                          <span className="font-medium">Owner reply: </span>
                          {reviewSnippet(r.replyComment, 180)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photo Performance</CardTitle>
              <CardDescription>Most-viewed profile photos.</CardDescription>
            </CardHeader>
            <CardContent>
              {photoRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No photos synced yet.</p>
              ) : (
                <ul className="space-y-2">
                  {photoRows.slice(0, 12).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <Badge variant="secondary" className="capitalize">
                        {p.category.toLowerCase()}
                      </Badge>
                      <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
                        <Eye className="h-3.5 w-3.5" />
                        {fmtInt(p.viewCount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <DashboardFooter />
      </div>
    </div>
  );
}
