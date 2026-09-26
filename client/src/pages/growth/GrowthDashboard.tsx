/**
 * Growth system (docs/growth-system-spec.md) — §10 scoreboard + §7 CSV contact
 * import, in one CRM page. Speed-to-lead (§1), the cadence engine (§2), and the
 * review engine (§5) run as background services (server/services/growth/*); this
 * page is the visibility + admin surface for what they're doing.
 *
 * Not yet linked from the sidebar (client/src/lib/navigation.ts) — see the build
 * report. Reachable directly at /growth.
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Phone, MessageSquare, Star, Upload, AlertTriangle } from "lucide-react";

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-[#1e3a5f]">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreboardSection() {
  const { data, isLoading } = trpc.growth.scoreboard.useQuery();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading scoreboard…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Scoreboard unavailable (database not configured).</p>;

  return (
    <div className="space-y-4">
      {!data.callsConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Calls not configured</p>
            <p>
              VAPI_API_KEY / VAPI_OUTBOUND_ASSISTANT_ID / VAPI_PHONE_NUMBER_ID are not all set — every cadence call step
              (speed-to-lead, day-3, review escalation) is skipped and falls back to SMS/email only until these are configured.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Leads MTD" value={`${data.leadsMtd} / ${data.target}`} sub={`Run-rate ${data.runRatePerDay}/day`} />
        <StatTile label="Projected month-end" value={data.projectedMonthEnd} />
        <StatTile label="Qualified rate" value={data.qualifiedRate != null ? `${Math.round(data.qualifiedRate * 100)}%` : "—"} />
        <StatTile label="Booked rate" value={data.bookedRate != null ? `${Math.round(data.bookedRate * 100)}%` : "—"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Speed-to-lead median"
          value={data.speedToLeadMedianSeconds != null ? `${Math.round(data.speedToLeadMedianSeconds)}s` : "—"}
        />
        <StatTile
          label="Cadence response rate"
          value={data.cadenceResponseRate != null ? `${Math.round(data.cadenceResponseRate * 100)}%` : "—"}
        />
        <StatTile
          label="Reviews this week"
          value={`${data.reviewsThisWeek.responded}/${data.reviewsThisWeek.asked}`}
          sub={data.reviewsThisWeek.average != null ? `avg ${data.reviewsThisWeek.average.toFixed(1)}/5` : undefined}
        />
        <StatTile label="Quotes open/won/lost" value="—" sub={data.quotesDeferredReason ? "Deferred — see below" : undefined} />
      </div>

      {data.gapPlan && (
        <Card className="border-l-4 border-l-[#ff6b35]">
          <CardContent className="p-4">
            <p className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Gap plan</p>
            <p className="text-sm text-muted-foreground mt-1">{data.gapPlan}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Leads by source</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {data.bySource.length === 0 && <p className="text-sm text-muted-foreground">No leads this month yet.</p>}
            {data.bySource.map((s) => (
              <div key={s.source} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.source}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.quotesDeferredReason && (
        <p className="text-xs text-muted-foreground italic">{data.quotesDeferredReason}</p>
      )}
    </div>
  );
}

function ImportSection() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("");
  const { data: batches = [] } = trpc.growth.contactImport.listBatches.useQuery();
  const upload = trpc.growth.contactImport.upload.useMutation({
    onSuccess: (r) => {
      toast({ title: "Import received", description: `${r.rowCount} row(s) uploaded, ${r.mergedCount} matched an existing customer. Review window ends ${new Date(r.releaseAt).toLocaleString()}.` });
      setCsvText("");
      setFilename("");
      utils.growth.contactImport.listBatches.invalidate();
    },
    onError: (e) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });
  const rollback = trpc.growth.contactImport.rollback.useMutation({
    onSuccess: () => { toast({ title: "Batch rolled back" }); utils.growth.contactImport.listBatches.invalidate(); },
  });
  const releaseNow = trpc.growth.contactImport.releaseNow.useMutation({
    onSuccess: (r) => { toast({ title: "Batch released", description: `${r.enrolled} contact(s) enrolled in cadence.` }); utils.growth.contactImport.listBatches.invalidate(); },
  });

  const onFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Import contacts (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Columns: name, phone, email, company, address, type (residential|commercial|pm|gc), last_job_date, notes,
            consent (customer|opt_in|unknown). <code>unknown</code> consent gets email only. Imported contacts sit in a
            24-hour review window before entering their cadence — you can remove rows or roll back the whole batch first.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm"
          />
          <Button
            disabled={!csvText || upload.isPending}
            onClick={() => upload.mutate({ filename: filename || "import.csv", csv: csvText })}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Import batches</CardTitle></CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <div className="space-y-2">
              {batches.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-border pb-2 text-sm">
                  <div>
                    <p className="font-medium">{b.filename} <span className="text-xs text-muted-foreground">({b.rowCount} rows)</span></p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString()} — review until {new Date(b.releaseAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === "pending_review" ? "secondary" : b.status === "rolled_back" ? "destructive" : "default"}>
                      {b.status.replace("_", " ")}
                    </Badge>
                    {b.status === "pending_review" && (
                      <Button size="sm" variant="outline" onClick={() => releaseNow.mutate({ batchId: b.id })}>Release now</Button>
                    )}
                    {b.status !== "rolled_back" && (
                      <Button size="sm" variant="destructive" onClick={() => rollback.mutate({ batchId: b.id })}>Roll back</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GrowthDashboard() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> Growth System
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Speed-to-lead, follow-up cadence, review engine, and contact import — target 80 qualified leads/month.
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> SMS/call cadence runs automatically</span>
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> 9am-7pm ET, Mon-Sat only</span>
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Reviews asked 2h after job completion</span>
          </div>
        </div>

        <ScoreboardSection />
        <ImportSection />
      </div>
    </DashboardLayout>
  );
}
