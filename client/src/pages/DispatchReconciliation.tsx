/**
 * Dispatch Reconciliation (M0) — admin-only, READ-ONLY audit view.
 *
 * Renders the report from `dispatchAudit.report`. It only reads and displays;
 * it offers no remediation controls (M0 performs no writes). Server enforcement
 * is authoritative (adminProcedure); this page also gates on `canAccessDispatch`
 * as defense-in-depth.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessDispatch } from "@shared/dispatchPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Severity } from "@shared/dispatchReconciliation";

const SEV_STYLE: Record<Severity, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-sky-100 text-sky-700 border-sky-200",
};
const VERDICT_STYLE: Record<string, string> = {
  clean: "bg-green-100 text-green-700 border-green-200",
  minor: "bg-amber-100 text-amber-700 border-amber-200",
  inaccurate: "bg-red-100 text-red-700 border-red-200",
};

export default function DispatchReconciliation() {
  const { user } = useAuth();
  const allowed = canAccessDispatch(user);
  const q = trpc.dispatchAudit.report.useQuery(undefined, { enabled: allowed, refetchOnWindowFocus: false });

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Dispatch Reconciliation</h1>
        <p className="mt-2 text-muted-foreground">This audit is available to administrators only.</p>
      </div>
    );
  }

  const report = q.data;
  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispatch Reconciliation</h1>
          <p className="text-sm text-muted-foreground">Read-only consistency audit — no data is changed. Complements the job lifecycle reconciliation.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? "Running…" : "Re-run"}
        </Button>
      </div>

      {q.isLoading && <p className="text-muted-foreground">Running reconciliation…</p>}
      {q.error && <p className="text-red-600">Could not run the audit: {q.error.message}</p>}

      {report && (
        <>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">Board accuracy</span>
                <Badge className={VERDICT_STYLE[report.summary.boardAccuracyVerdict]}>{report.summary.boardAccuracyVerdict.toUpperCase()}</Badge>
                <span className="text-sm text-muted-foreground">· {report.summary.totalFindings} findings</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["high", "medium", "low", "info"] as Severity[]).map(s => (
                  <Badge key={s} variant="outline" className={SEV_STYLE[s]}>{s}: {report.summary.findingsBySeverity[s]}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Scope — jobs {report.scope.jobs}, appointments {report.scope.appointments}, completions {report.scope.completions},
                team members {report.scope.teamMembers}, properties {report.scope.properties}. Generated {report.generatedAt}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Checks ({report.checks.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-4">Severity</th><th className="py-1 pr-4">Count</th><th className="py-1 pr-4">Check</th>
                </tr></thead>
                <tbody>
                  {report.checks.map(c => (
                    <tr key={c.id} className="border-t">
                      <td className="py-1.5 pr-4"><Badge variant="outline" className={SEV_STYLE[c.severity]}>{c.severity}</Badge></td>
                      <td className="py-1.5 pr-4 tabular-nums font-medium">{c.count}</td>
                      <td className="py-1.5 pr-4">{c.title} <span className="text-xs text-muted-foreground">({c.id})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Findings ({report.findings.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {report.findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inconsistencies — production data is dispatch-consistent.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-4">Severity</th><th className="py-1 pr-4">Entity</th><th className="py-1 pr-4">Record</th>
                    <th className="py-1 pr-4">Problem</th><th className="py-1 pr-4">Recommended remediation</th>
                  </tr></thead>
                  <tbody>
                    {report.findings.map((f, i) => (
                      <tr key={i} className="border-t align-top">
                        <td className="py-1.5 pr-4"><Badge variant="outline" className={SEV_STYLE[f.severity]}>{f.severity}</Badge></td>
                        <td className="py-1.5 pr-4">{f.entity}</td>
                        <td className="py-1.5 pr-4 tabular-nums">#{f.recordId}{f.relatedId != null ? ` ↔ #${f.relatedId}` : ""}</td>
                        <td className="py-1.5 pr-4">{f.problem}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{f.remediation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
