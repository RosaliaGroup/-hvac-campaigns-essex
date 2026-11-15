/**
 * Recorded calling from the CRM. When the browser dialer is set up, "Call"
 * opens <BrowserDialer> and the rep talks through her headset. Otherwise it
 * rings the rep's own mobile first, then dials the client. Either way the call,
 * its length, the recording and its QC score show up in <CallHistoryCard>.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Loader2, Phone, PhoneCall, Play } from "lucide-react";
import { BrowserDialer } from "./BrowserDialer";
import { QC_FLAG_LABEL, QC_VERDICT_LABEL, type QcVerdict } from "@shared/callQc";

type CallTarget = { phone: string | null | undefined; customerId?: number | null; leadCaptureId?: number | null; name?: string | null };

export function CallButton({
  phone,
  customerId,
  leadCaptureId,
  name,
  size = "sm",
  variant = "outline",
  label = "Call",
}: CallTarget & { size?: "sm" | "default"; variant?: "outline" | "default"; label?: string }) {
  const { toast } = useToast();
  const [dialerOpen, setDialerOpen] = useState(false);
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

  // Browser dialer (headset) when set up.
  if (status.data?.browserDialer && phone) {
    return (
      <>
        <Button size={size} variant={variant} onClick={() => setDialerOpen(true)} title="Call from your browser with your headset. Recorded.">
          <PhoneCall className="h-3.5 w-3.5 mr-1" />
          {label}
        </Button>
        <BrowserDialer
          open={dialerOpen}
          onOpenChange={setDialerOpen}
          phone={phone}
          name={name}
          customerId={customerId}
          leadCaptureId={leadCaptureId}
        />
      </>
    );
  }

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
  dialing: "Dialing…",
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

const VERDICT_CLASS: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  coach: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  fail: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  not_scored: "bg-muted text-muted-foreground",
};

export function QcReportDialog({ callLogId, open, onOpenChange }: { callLogId: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const q = trpc.calls.qcForCall.useQuery({ callLogId }, { enabled: open });
  const [showTranscript, setShowTranscript] = useState(false);
  const r = q.data?.review;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Call quality review</DialogTitle>
          <DialogDescription>
            {q.data?.score != null ? `${q.data.score}/100 · ` : ""}
            {q.data?.verdict ? QC_VERDICT_LABEL[q.data.verdict as QcVerdict] : q.data?.status === "pending" ? "Being reviewed" : ""}
          </DialogDescription>
        </DialogHeader>
        {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {q.data && !r && <p className="text-sm text-muted-foreground">{q.data.error ?? "Review not ready yet. It usually takes a few minutes after the call."}</p>}
        {r && (
          <div className="space-y-3 text-sm">
            <p>{r.summary}</p>
            {r.flags.length > 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/40 p-3 space-y-1">
                <div className="font-medium text-red-800 dark:text-red-300">Flags</div>
                {r.flags.map((f, i) => (
                  <div key={i}>
                    {QC_FLAG_LABEL[f.code]}
                    {f.quote ? <span className="text-muted-foreground">: "{f.quote}"</span> : null}
                  </div>
                ))}
              </div>
            )}
            <div className="divide-y border rounded-md">
              {r.scores.map((s) => (
                <div key={s.key} className="flex gap-3 p-2">
                  <div className="w-36 shrink-0 font-medium">{s.label}</div>
                  <div className="w-14 shrink-0 tabular-nums">
                    {s.score}/{s.max}
                  </div>
                  <div className="text-muted-foreground min-w-0">{s.note}</div>
                </div>
              ))}
            </div>
            {r.strengths.length > 0 && (
              <div>
                <div className="font-medium">Did well</div>
                <ul className="list-disc pl-5">{r.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {r.coaching.length > 0 && (
              <div>
                <div className="font-medium">Coaching</div>
                <ul className="list-disc pl-5">{r.coaching.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            )}
            {q.data?.transcript && (
              <div>
                <Button size="sm" variant="ghost" onClick={() => setShowTranscript(!showTranscript)}>
                  {showTranscript ? "Hide transcript" : "Show transcript"}
                </Button>
                {showTranscript && <pre className="whitespace-pre-wrap text-xs bg-muted rounded-md p-3 mt-2">{q.data.transcript}</pre>}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QcBadge({ callLogId, qc }: { callLogId: number; qc: { status: string; score: number | null; verdict: string | null } | null }) {
  const [open, setOpen] = useState(false);
  if (!qc) return null;
  const label =
    qc.status === "done"
      ? `QC ${qc.score ?? "–"}${qc.verdict ? ` · ${QC_VERDICT_LABEL[qc.verdict as QcVerdict]}` : ""}`
      : qc.status === "pending"
        ? "QC pending"
        : qc.status === "skipped"
          ? "QC skipped"
          : "QC failed";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${VERDICT_CLASS[qc.verdict ?? "not_scored"] ?? VERDICT_CLASS.not_scored}`}
      >
        <ClipboardCheck className="h-3 w-3" /> {label}
      </button>
      {open && <QcReportDialog callLogId={callLogId} open={open} onOpenChange={setOpen} />}
    </>
  );
}

export function CallHistoryCard({ phone, customerId, leadCaptureId, name }: CallTarget) {
  const q = trpc.calls.listForContact.useQuery(
    { phone: phone ?? null, customerId: customerId ?? undefined, leadCaptureId: leadCaptureId ?? undefined },
    { enabled: Boolean(phone || customerId || leadCaptureId), refetchInterval: (query) => {
      const rows = query.state.data as Array<{ status: string | null }> | undefined;
      return rows?.some((r) => r.status === "dialing" || r.status === "ringing_rep" || r.status === "ringing_client" || r.status === "in_progress") ? 5000 : false;
    } },
  );
  const rows = q.data ?? [];
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-[#1e3a5f]" /> Calls ({rows.length})
        </CardTitle>
        <CallButton phone={phone} customerId={customerId} leadCaptureId={leadCaptureId} name={name} />
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
            <div className="flex items-center gap-2">
              <QcBadge callLogId={c.id} qc={c.qc} />
              {c.hasRecording && <RecordingPlayer callLogId={c.id} />}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
