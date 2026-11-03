/**
 * Recorded click-to-call. "Call" rings the signed-in rep's own mobile first;
 * when she answers, the app dials the client and records the call. The call,
 * its length and the recording show up in <CallHistoryCard>.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, PhoneCall, Play } from "lucide-react";

type CallTarget = { phone: string | null | undefined; customerId?: number | null; leadCaptureId?: number | null };

export function CallButton({
  phone,
  customerId,
  leadCaptureId,
  size = "sm",
  variant = "outline",
  label = "Call",
}: CallTarget & { size?: "sm" | "default"; variant?: "outline" | "default"; label?: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const status = trpc.calls.status.useQuery(undefined, { staleTime: 60_000 });
  const start = trpc.calls.start.useMutation({
    onSuccess: (r) => {
      toast({
        title: "Your phone is ringing",
        description: `Answer ${r.repPhone} and we'll connect you to the client. The call is recorded.`,
      });
      setTimeout(() => utils.calls.listForContact.invalidate(), 4000);
    },
    onError: (e) => toast({ title: "Couldn't start the call", description: e.message, variant: "destructive" }),
  });

  // Not set up yet → fall back to the phone's dialer (not recorded).
  if (status.data && !status.data.configured) {
    return (
      <Button asChild size={size} variant={variant} disabled={!phone}>
        <a href={phone ? `tel:${phone}` : undefined} title="In-app recorded calling isn't set up yet">
          <Phone className="h-3.5 w-3.5 mr-1" /> {label}
        </a>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      disabled={!phone || start.isPending}
      onClick={() => phone && start.mutate({ phone, customerId: customerId ?? undefined, leadCaptureId: leadCaptureId ?? undefined })}
      title="Rings your phone, then connects the client. Recorded."
    >
      {start.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5 mr-1" />}
      {label}
    </Button>
  );
}

const STATUS_LABEL: Record<string, string> = {
  ringing_rep: "Ringing you…",
  ringing_client: "Ringing client…",
  in_progress: "In progress",
  completed: "Completed",
  rep_no_answer: "You didn't answer",
  canceled: "Canceled",
  failed: "Failed",
};

function statusLabel(s: string | null): string {
  if (!s) return "";
  if (s.startsWith("no_answer")) return "Client didn't answer";
  return STATUS_LABEL[s] ?? s;
}

function duration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function RecordingPlayer({ callLogId }: { callLogId: number }) {
  const [open, setOpen] = useState(false);
  const q = trpc.calls.recordingUrl.useQuery({ callLogId }, { enabled: open, staleTime: 5 * 60_000 });
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Play className="h-3.5 w-3.5 mr-1" /> Play
      </Button>
    );
  }
  if (q.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!q.data?.url) return <span className="text-xs text-muted-foreground">Recording not ready yet</span>;
  return <audio controls autoPlay src={q.data.url} className="h-8 max-w-[260px]" />;
}

export function CallHistoryCard({ phone, customerId, leadCaptureId }: CallTarget) {
  const q = trpc.calls.listForContact.useQuery(
    { phone: phone ?? null, customerId: customerId ?? undefined, leadCaptureId: leadCaptureId ?? undefined },
    { enabled: Boolean(phone || customerId || leadCaptureId), refetchInterval: (query) => {
      const rows = query.state.data as Array<{ status: string | null }> | undefined;
      return rows?.some((r) => r.status === "ringing_rep" || r.status === "ringing_client" || r.status === "in_progress") ? 5000 : false;
    } },
  );
  const rows = q.data ?? [];
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-[#1e3a5f]" /> Calls ({rows.length})
        </CardTitle>
        <CallButton phone={phone} customerId={customerId} leadCaptureId={leadCaptureId} />
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No calls yet.</p>}
        {rows.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3 text-sm">
            <div>
              <div className="font-medium capitalize">
                {c.direction} · {c.phoneNumber}
              </div>
              <div className="text-muted-foreground">
                {new Date(c.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                {c.duration ? ` · ${duration(c.duration)}` : ""}
                {c.status ? ` · ${statusLabel(c.status)}` : ""}
              </div>
            </div>
            {c.hasRecording && <RecordingPlayer callLogId={c.id} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
