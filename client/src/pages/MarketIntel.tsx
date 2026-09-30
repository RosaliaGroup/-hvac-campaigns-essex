import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, RotateCcw, Ban, ExternalLink } from "lucide-react";
import DashboardFooter from "@/components/DashboardFooter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { MarketIntelSections } from "@shared/marketIntelTypes";

const DISMISS_REASONS = ["wrong", "not_now", "off_brand", "already_done"] as const;

function StatusBadge({ status }: { status: string }) {
  const variant = status === "accepted" ? "default" : status === "dismissed" ? "secondary" : status === "expired" ? "outline" : "secondary";
  return <Badge variant={variant as never}>{status}</Badge>;
}

export default function MarketIntel() {
  const utils = trpc.useUtils();
  const reportsQuery = trpc.marketIntel.listReports.useQuery();
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const latestQuery = trpc.marketIntel.getLatestReport.useQuery();
  const selectedQuery = trpc.marketIntel.getReport.useQuery({ reportId: selectedReportId! }, { enabled: selectedReportId !== null });

  const active = selectedReportId !== null ? selectedQuery.data : latestQuery.data;

  // Fire-and-forget + poll (server/services/asyncLaneJob.ts): the report can
  // run past the proxy's request timeout (competitor fetches + model calls),
  // so runNow only enqueues it and returns immediately — the actual outcome
  // comes back through polling getJobStatus, not the mutation's response. A
  // click while a report is already running is a no-op, not a duplicate
  // (2026-09-28 incident: a retried click produced two identical reports).
  const jobStatusQ = trpc.marketIntel.getJobStatus.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });
  const jobRunning = jobStatusQ.data?.status === "running";
  const lastFinish = useRef<number | null>(null);
  useEffect(() => {
    const s = jobStatusQ.data;
    if (!s || s.status === "running" || !s.finishedAt || s.finishedAt === lastFinish.current) return;
    lastFinish.current = s.finishedAt;
    if (s.status === "done") {
      const result = s.result as { skipped?: boolean; reason?: string } | null;
      if (result && "skipped" in result && result.skipped) {
        toast.info(`Not run: ${result.reason}`);
      } else {
        toast.success("Market intel report generated.");
      }
      utils.marketIntel.listReports.invalidate();
      utils.marketIntel.getLatestReport.invalidate();
    } else if (s.status === "error") {
      toast.error(s.error ?? "Market intel report failed");
    }
  }, [jobStatusQ.data]);
  const runNow = trpc.marketIntel.runNow.useMutation({
    onSuccess: (res) => {
      if (!res.started) toast.message("A market intel report is already running.");
      jobStatusQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const revertItem = trpc.marketIntel.revertItem.useMutation({
    onSuccess: () => {
      toast.success("Reverted.");
      utils.marketIntel.getReport.invalidate();
      utils.marketIntel.getLatestReport.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const dismissItem = trpc.marketIntel.dismissItem.useMutation({
    onSuccess: () => {
      toast.success("Dismissed.");
      utils.marketIntel.getReport.invalidate();
      utils.marketIntel.getLatestReport.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revertAll = trpc.marketIntel.revertAllFromReport.useMutation({
    onSuccess: (result) => {
      toast.success(`Reverted ${result.reverted} item(s).`);
      utils.marketIntel.getReport.invalidate();
      utils.marketIntel.getLatestReport.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Market Intel</h1>
          <p className="text-sm text-muted-foreground">Daily search demand, competitor, and positioning report (docs/market-intel-spec.md).</p>
        </div>
        <Button onClick={() => runNow.mutate()} disabled={runNow.isPending || jobRunning}>
          {runNow.isPending || jobRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {jobRunning ? "Running… this can take a few minutes" : "Run now"}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {reportsQuery.data?.map((r) => (
          <Button key={r.id} size="sm" variant={selectedReportId === r.id ? "default" : "outline"} onClick={() => setSelectedReportId(r.id)}>
            {r.date} {r.windowKind === "weekly" ? "(weekly)" : ""}
          </Button>
        ))}
      </div>

      {!active ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No report yet — click "Run now", or wait for the 06:00 ET daily run.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{active.report.date} {active.report.windowKind === "weekly" ? "— weekly roll-up" : ""}</CardTitle>
              <CardDescription>
                {active.report.summary ?? "No summary yet."}
                {active.report.circuitPaused && <span className="ml-2 text-amber-600 font-medium">paused: suggestions only</span>}
                {active.report.gscStale && <span className="ml-2 text-amber-600 font-medium">search demand skipped (stale GSC sync)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4 text-sm">
              <span>{active.report.itemCount} suggestions</span>
              <span>{active.report.executedCount} executed</span>
              <span>{active.report.dismissedCount} dismissed</span>
              {active.items.some((i) => i.status === "accepted") && (
                <Button size="sm" variant="destructive" onClick={() => revertAll.mutate({ reportId: active.report.id })} disabled={revertAll.isPending}>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Revert all from this report
                </Button>
              )}
            </CardContent>
          </Card>

          {((active.report.sections as MarketIntelSections | null)?.notes ?? []).map((n) => (
            <Card key={n.id}>
              <CardHeader>
                <CardTitle className="text-base">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{n.markdown}</CardContent>
            </Card>
          ))}

          {(() => {
            const flagged = (active.report.sections as MarketIntelSections | null)?.searchDemand?.possiblyDeindexed ?? [];
            if (flagged.length === 0) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Possibly de-indexed ({flagged.length})</CardTitle>
                  <CardDescription>Pages that lost almost all search visibility (or that Google reports as not indexed). A pointer to check, not a verdict — open URL Inspection to confirm.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {flagged.map((f) => (
                    <div key={f.page} className="flex items-start justify-between gap-4 text-sm">
                      <div>
                        <span className="font-medium">{f.page}</span>
                        <span className="ml-2 text-muted-foreground">{f.previousImpressions.toLocaleString()} → {f.impressions.toLocaleString()} impressions ({(f.pctDown * 100).toFixed(0)}% down){f.indexStatus !== "indexed" ? `, Google: ${f.indexStatus.replace(/_/g, " ")}` : ""}</span>
                        {f.redirectsTo && <Badge variant="outline" className="ml-2">301 → {f.redirectsTo} (expected)</Badge>}
                      </div>
                      <a href={f.inspectUrl} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 text-primary hover:underline">
                        URL Inspection <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          <div className="space-y-3">
            {active.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <StatusBadge status={item.status} />
                      <Badge variant="outline">{item.kind}</Badge>
                      {item.factsBlocked && <Badge variant="destructive">needs your number</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.suggestion}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {item.status === "accepted" && (
                      <Button size="sm" variant="outline" onClick={() => revertItem.mutate({ itemId: item.id, reason: "not_now" })} disabled={revertItem.isPending}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert
                      </Button>
                    )}
                    {item.status === "open" && (
                      <select
                        className="text-sm border rounded px-2 py-1"
                        defaultValue=""
                        onChange={(e) => {
                          const reason = e.target.value as (typeof DISMISS_REASONS)[number];
                          if (reason) dismissItem.mutate({ itemId: item.id, reason });
                        }}
                      >
                        <option value="" disabled>Dismiss…</option>
                        {DISMISS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {active.items.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No material changes today.</CardContent></Card>
            )}
          </div>
        </>
      )}

      <DashboardFooter />
    </div>
  );
}
