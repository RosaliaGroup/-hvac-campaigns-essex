/**
 * /settings/integrations — Integrations Center (Phase 2, Task 7).
 * QuickBooks Online is live; other providers are "coming soon" placeholders.
 * Admin-only actions (connect/disconnect/push-all) are gated on user.role.
 */
import { useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import InternalNav from "@/components/InternalNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plug, CheckCircle2, XCircle, RefreshCw, Building2, CreditCard, Mail,
  CalendarClock, MessageSquare, Bot, Zap, Loader2,
} from "lucide-react";

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

const COMING_SOON = [
  { name: "Stripe", desc: "Payments & payment links", icon: CreditCard },
  { name: "Gmail", desc: "Send & sync email", icon: Mail },
  { name: "Telnyx", desc: "SMS & voice (connected via env)", icon: MessageSquare },
  { name: "Vapi", desc: "AI voice receptionist", icon: Bot },
  { name: "Zapier", desc: "Automation webhooks", icon: Zap },
];

export default function Integrations() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();

  const statusQ = trpc.quickbooks.getStatus.useQuery();
  const logsQ = trpc.quickbooks.recentLogs.useQuery({ limit: 25 });
  const status = statusQ.data;

  const gcalStatusQ = trpc.googleCalendar.getStatus.useQuery();
  const gcal = gcalStatusQ.data;

  // Surface the OAuth callback result (?qb_* / ?gcal_*).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("qb_connected")) {
      toast({ title: "QuickBooks connected" });
      statusQ.refetch();
      window.history.replaceState({}, "", "/settings/integrations");
    } else if (params.get("qb_error")) {
      toast({ title: "QuickBooks connection failed", description: params.get("qb_error") ?? undefined, variant: "destructive" });
      window.history.replaceState({}, "", "/settings/integrations");
    } else if (params.get("gcal_connected")) {
      toast({ title: "Google Calendar connected" });
      gcalStatusQ.refetch();
      window.history.replaceState({}, "", "/settings/integrations");
    } else if (params.get("gcal_error")) {
      toast({ title: "Google Calendar connection failed", description: params.get("gcal_error") ?? undefined, variant: "destructive" });
      window.history.replaceState({}, "", "/settings/integrations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gcalConnect = trpc.googleCalendar.connectStart.useMutation({
    onSuccess: res => { window.location.href = res.url; },
    onError: e => toast({ title: "Could not start connection", description: e.message, variant: "destructive" }),
  });
  const gcalDisconnect = trpc.googleCalendar.disconnect.useMutation({
    onSuccess: () => { toast({ title: "Google Calendar disconnected" }); gcalStatusQ.refetch(); },
    onError: e => toast({ title: "Disconnect failed", description: e.message, variant: "destructive" }),
  });

  const connect = trpc.quickbooks.connectStart.useMutation({
    onSuccess: res => { window.location.href = res.url; },
    onError: e => toast({ title: "Could not start connection", description: e.message, variant: "destructive" }),
  });
  const disconnect = trpc.quickbooks.disconnect.useMutation({
    onSuccess: () => { toast({ title: "QuickBooks disconnected" }); statusQ.refetch(); logsQ.refetch(); },
    onError: e => toast({ title: "Disconnect failed", description: e.message, variant: "destructive" }),
  });
  const pushAll = trpc.quickbooks.pushAllUnsynced.useMutation({
    onSuccess: s => { toast({ title: "Bulk sync complete", description: `Pushed ${s.pushed}, linked ${s.linked}, conflicts ${s.conflicts}, failed ${s.failed} (of ${s.total})` }); logsQ.refetch(); },
    onError: e => toast({ title: "Bulk sync failed", description: e.message, variant: "destructive" }),
  });

  const connected = status?.connected;

  return (
    <DashboardLayout>
      <InternalNav />
      <div className="space-y-6 p-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6 text-[#1e3a5f]" /> Integrations</h1>
          <p className="text-muted-foreground text-sm">Connect Mechanical Enterprise to accounting and other services.</p>
        </div>

        {/* QuickBooks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <Building2 className="h-5 w-5" /> QuickBooks Online
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{status?.environment ?? "sandbox"}</Badge>
              {connected
                ? <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</Badge>
                : <Badge variant="secondary" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> {status?.status ?? "Not connected"}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!status?.configured && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Not fully configured — set QUICKBOOKS_CLIENT_ID / SECRET / REDIRECT_URI and ENCRYPTION_KEY, then reload.
              </div>
            )}

            {connected && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Meta label="Company" value={status?.companyName ?? "—"} />
                <Meta label="Realm ID" value={status?.realmId ?? "—"} />
                <Meta label="Status" value={status?.status ?? "—"} />
                <Meta label="Token expires" value={fmt(status?.expiresAt)} />
                <Meta label="Refresh expires" value={fmt(status?.refreshExpiresAt)} />
                <Meta label="Last sync" value={fmt(status?.lastSyncAt)} />
              </div>
            )}
            {status?.lastError && <p className="text-sm text-red-600">{status.lastError}</p>}

            <div className="flex flex-wrap gap-2">
              {!connected && (
                <Button onClick={() => connect.mutate()} disabled={!isAdmin || !status?.configured || connect.isPending}>
                  {connect.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plug className="h-4 w-4 mr-1" />}
                  Connect QuickBooks
                </Button>
              )}
              {connected && (
                <>
                  <Button variant="outline" onClick={() => connect.mutate()} disabled={!isAdmin || connect.isPending}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Reconnect
                  </Button>
                  <Button variant="outline" onClick={() => pushAll.mutate()} disabled={!isAdmin || pushAll.isPending}>
                    {pushAll.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Push all unsynced customers
                  </Button>
                  <Button variant="destructive" onClick={() => disconnect.mutate()} disabled={!isAdmin || disconnect.isPending}>
                    Disconnect
                  </Button>
                </>
              )}
              {!isAdmin && <span className="text-xs text-muted-foreground self-center">Admin access required to change connection.</span>}
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-[#1e3a5f]">
              <CalendarClock className="h-5 w-5" /> Google Calendar
            </CardTitle>
            {gcal?.connected
              ? <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</Badge>
              : <Badge variant="secondary" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> {gcal?.status ?? "Not connected"}</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When connected, new appointments create a Google Calendar event and Google emails the invites to
              attendees. When not connected, attendees still receive an .ics email invite.
            </p>
            {!gcal?.configured && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Not fully configured — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALENDAR_REDIRECT_URI and
                ENCRYPTION_KEY, then reload.
              </div>
            )}
            {gcal?.connected && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Meta label="Account" value={gcal?.googleAccountEmail ?? "—"} />
                <Meta label="Calendar" value={gcal?.googleCalendarId ?? "—"} />
                <Meta label="Token expires" value={fmt(gcal?.expiresAt)} />
                <Meta label="Last sync" value={fmt(gcal?.lastSyncAt)} />
              </div>
            )}
            {gcal?.lastError && <p className="text-sm text-red-600">{gcal.lastError}</p>}
            <div className="flex flex-wrap gap-2">
              {!gcal?.connected ? (
                <Button onClick={() => gcalConnect.mutate()} disabled={!isAdmin || !gcal?.configured || gcalConnect.isPending}>
                  {gcalConnect.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plug className="h-4 w-4 mr-1" />}
                  Connect Google Calendar
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => gcalConnect.mutate()} disabled={!isAdmin || gcalConnect.isPending}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Reconnect
                  </Button>
                  <Button variant="destructive" onClick={() => gcalDisconnect.mutate()} disabled={!isAdmin || gcalDisconnect.isPending}>
                    Disconnect
                  </Button>
                </>
              )}
              {!isAdmin && <span className="text-xs text-muted-foreground self-center">Admin access required to change connection.</span>}
            </div>
          </CardContent>
        </Card>

        {/* Coming soon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COMING_SOON.map(p => (
            <Card key={p.name} className="opacity-60">
              <CardContent className="pt-6 flex items-start gap-3">
                <p.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium flex items-center gap-2">{p.name} <Badge variant="secondary" className="text-[10px]">Coming soon</Badge></div>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader><CardTitle className="text-base">Recent sync activity</CardTitle></CardHeader>
          <CardContent>
            {(logsQ.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No sync activity yet.</p>
            ) : (
              <div className="divide-y text-sm">
                {logsQ.data!.map(log => (
                  <div key={log.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="flex items-center gap-2">
                      {log.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="capitalize">{log.direction} {log.entityType}</span>
                      {log.entityId != null && <span className="text-muted-foreground">#{log.entityId}</span>}
                      {log.errorMessage && <span className="text-red-600">— {log.errorMessage}</span>}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">{fmt(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}
