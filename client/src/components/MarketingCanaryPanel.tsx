import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  CANARY_CONTENT,
  CANARY_CONFIRM_LABEL,
  isCanaryAdmin,
  canRunCanary,
} from "@/lib/marketingCanary";

/**
 * Admin-only Marketing Publishing Canary. Exercises the live publish/retry path
 * against ONE connected company-owned destination using fixed test content.
 */
export default function MarketingCanaryPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [platform, setPlatform] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const admin = isCanaryAdmin(user);

  // Admin-gated queries — never fired for non-admins (the server also enforces admin).
  const statusQuery = trpc.aiVa.canary.status.useQuery(undefined, { enabled: admin });
  const auditQuery = trpc.aiVa.canary.audit.useQuery(undefined, { enabled: admin });
  const safetyQuery = trpc.aiVa.canary.safetyChecks.useQuery(undefined, { enabled: admin });

  const platforms = statusQuery.data?.platforms;
  const gate = canRunCanary({ user, platforms, selectedPlatform: platform, confirmed });

  const invalidate = () => {
    utils.aiVa.canary.status.invalidate();
    utils.aiVa.canary.audit.invalidate();
  };

  const runSuccess = trpc.aiVa.canary.runSuccess.useMutation({
    onSuccess: (r: any) => {
      toast({
        title: "Success canary complete",
        description: `row #${r.rowId} · external ${r.externalId ?? "—"} · duplicate prevented: ${r.duplicatePrevented}`,
      });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Canary failed", description: e.message, variant: "destructive" }),
  });

  const runFailureRetry = trpc.aiVa.canary.runFailureRetry.useMutation({
    onSuccess: (r: any) => {
      toast({
        title: "Failure/retry canary complete",
        description: `failed→${r.retryStatus} · same row: ${r.sameRow} · external ${r.externalId ?? "—"}`,
      });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Canary failed", description: e.message, variant: "destructive" }),
  });

  const deleteExternal = trpc.aiVa.canary.deleteExternal.useMutation({
    onSuccess: (r: any) => {
      toast({ title: r.deleted ? "External test post deleted" : "Marked completed", description: r.detail ?? "" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const anyConnected = (platforms ?? []).some((p: any) => p.connected);
  const busy = runSuccess.isPending || runFailureRetry.isPending;

  // Hard client-side gate: render nothing for non-admins (all hooks ran above,
  // so hook order stays stable). The server also enforces admin on every call.
  if (!admin) return null;

  return (
    <div className="space-y-6">
      <Card className="border-amber-400/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" /> Marketing Publishing Canary
            <Badge variant="outline" className="ml-2">admin · temporary</Badge>
          </CardTitle>
          <CardDescription>
            Publishes one fixed test post — <span className="font-mono">{CANARY_CONTENT}</span> — to a single
            company-owned connected destination to verify the live publish path. No real content is used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Destination status */}
          <div className="grid gap-2">
            {statusQuery.isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              (platforms ?? []).map((p: any) => (
                <div key={p.platform} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="font-medium">{p.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{p.destinationRef ?? "—"}</span>
                    <Badge variant={p.connected ? "default" : "outline"}>
                      {p.connected ? "connected" : "not connected"}
                    </Badge>
                    <Badge variant={p.credentialsAvailable ? "secondary" : "outline"}>
                      {p.credentialsAvailable ? "credentials present" : "no credentials"}
                    </Badge>
                  </span>
                </div>
              ))
            )}
          </div>

          {!anyConnected ? (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              No safe connected destination is available. Canary cannot run.
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Destination</label>
                  <Select value={platform ?? undefined} onValueChange={(v) => setPlatform(v)}>
                    <SelectTrigger><SelectValue placeholder="Select a connected destination" /></SelectTrigger>
                    <SelectContent>
                      {(platforms ?? []).filter((p: any) => p.connected).map((p: any) => (
                        <SelectItem key={p.platform} value={p.platform}>{p.label} {p.destinationRef ?? ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {platform && (
                <p className="text-sm text-muted-foreground">
                  This will target <span className="font-semibold">{platform}</span>{" "}
                  {(platforms ?? []).find((p: any) => p.platform === platform)?.destinationRef ?? ""}.
                </p>
              )}

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>{CANARY_CONFIRM_LABEL}</span>
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!gate.allowed || busy}
                  onClick={() => platform && runSuccess.mutate({ platform: platform as any, confirmed: true })}
                >
                  {runSuccess.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Run successful publish canary
                </Button>
                <Button
                  variant="secondary"
                  disabled={!gate.allowed || busy}
                  onClick={() => platform && runFailureRetry.mutate({ platform: platform as any, confirmed: true })}
                >
                  {runFailureRetry.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Run failure/retry canary
                </Button>
              </div>
              {!gate.allowed && <p className="text-xs text-muted-foreground">{gate.message}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {/* Deterministic safety checks (no external publishing) */}
      <Card>
        <CardHeader>
          <CardTitle>Safety checks (no external publishing)</CardTitle>
          <CardDescription>Deterministic in-process verification of approval and AI-safety guardrails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(safetyQuery.data ?? []).map((c: any) => (
            <div key={c.name} className="flex items-center justify-between text-sm">
              <span className="font-mono">{c.name}</span>
              <Badge variant={c.passed ? "default" : "destructive"}>{c.passed ? "pass" : "fail"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Canary audit */}
      <Card>
        <CardHeader>
          <CardTitle>Canary audit</CardTitle>
          <CardDescription>Canary-tagged rows. Delete the external test post after verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(auditQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No canary rows yet.</p>
          ) : (
            (auditQuery.data ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  #{r.id} · {r.platform} · <span className="font-mono">{r.contentType}</span> ·{" "}
                  <Badge variant={r.status === "posted" ? "default" : r.status === "failed" ? "destructive" : "outline"}>
                    {r.status}
                  </Badge>{" "}
                  {r.meta?.state === "canary_completed" && <Badge variant="secondary">completed</Badge>}
                  {r.postId ? <span className="text-muted-foreground"> · ext {r.postId}</span> : null}
                </span>
                {r.status === "posted" && r.meta?.state !== "canary_completed" && (
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={deleteExternal.isPending}
                    onClick={() => deleteExternal.mutate({ id: r.id })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
