/**
 * Browser dialer — the rep calls from the CRM with a headset (Telnyx WebRTC).
 * Opened by <CallButton> when calls.status.browserDialer is true. The call is
 * logged against the lead/contact, recorded, and scored by Call QC afterwards.
 */
import { useEffect, useRef, useState } from "react";
import { TelnyxRTC } from "@telnyx/webrtc";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Mic, MicOff, PhoneOff, PhoneOutgoing } from "lucide-react";

type Phase = "connecting" | "ready" | "dialing" | "ringing" | "active" | "ended" | "error";

const PHASE_LABEL: Record<Phase, string> = {
  connecting: "Connecting your headset…",
  ready: "Ready to call",
  dialing: "Dialing…",
  ringing: "Ringing…",
  active: "Connected — this call is recorded",
  ended: "Call ended",
  error: "Calling isn't working",
};

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function BrowserDialer({
  open,
  onOpenChange,
  phone,
  name,
  customerId,
  leadCaptureId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  name?: string | null;
  customerId?: number | null;
  leadCaptureId?: number | null;
}) {
  const utils = trpc.useUtils();
  const tokenM = trpc.calls.webrtcToken.useMutation();
  const startM = trpc.calls.webrtcStart.useMutation();
  const finishM = trpc.calls.webrtcFinish.useMutation();

  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [callerId, setCallerId] = useState<string | null>(null);

  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const logIdRef = useRef<number | null>(null);
  const answeredAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Connect when the dialog opens; tear down when it closes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("connecting");
    setError(null);
    setSeconds(0);
    finishedRef.current = false;
    (async () => {
      try {
        const { token } = await tokenM.mutateAsync();
        if (cancelled) return;
        const client = new TelnyxRTC({ login_token: token } as any);
        clientRef.current = client;
        if (audioRef.current) (client as any).remoteElement = audioRef.current;
        client.on("telnyx.ready", () => !cancelled && setPhase((p) => (p === "connecting" ? "ready" : p)));
        client.on("telnyx.error", () => {
          if (cancelled) return;
          setError("The phone connection failed. Check your internet and try again.");
          setPhase("error");
        });
        client.on("telnyx.notification", (n: any) => {
          if (n?.type !== "callUpdate" || !n.call) return;
          const c = n.call;
          callRef.current = c;
          switch (c.state) {
            case "trying":
            case "requesting":
              setPhase("dialing");
              break;
            case "ringing":
            case "early":
              setPhase("ringing");
              break;
            case "active":
              if (!answeredAtRef.current) answeredAtRef.current = Date.now();
              setPhase("active");
              break;
            case "hangup":
            case "destroy":
              void finish(c);
              break;
          }
        });
        client.connect();
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Couldn't connect the phone.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      try {
        callRef.current?.hangup?.();
      } catch {
        /* already ended */
      }
      try {
        clientRef.current?.disconnect?.();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
      callRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Call timer.
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => {
      if (answeredAtRef.current) setSeconds(Math.round((Date.now() - answeredAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  async function finish(c: any) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("ended");
    const logId = logIdRef.current;
    if (!logId) return;
    const answered = Boolean(answeredAtRef.current);
    const durationSec = answered ? Math.round((Date.now() - answeredAtRef.current!) / 1000) : 0;
    try {
      await finishM.mutateAsync({
        callLogId: logId,
        sessionId: c?.telnyxIDs?.telnyxSessionId ?? null,
        answered,
        durationSec,
        hangupCause: c?.cause ? String(c.cause).toLowerCase().slice(0, 40) : null,
      });
    } finally {
      utils.calls.listForContact.invalidate();
    }
  }

  async function dial() {
    if (!clientRef.current) return;
    try {
      setPhase("dialing");
      answeredAtRef.current = null;
      finishedRef.current = false;
      const r = await startM.mutateAsync({
        phone,
        customerId: customerId ?? undefined,
        leadCaptureId: leadCaptureId ?? undefined,
      });
      logIdRef.current = r.callLogId;
      setCallerId(r.callerId);
      callRef.current = clientRef.current.newCall({
        destinationNumber: r.to,
        callerNumber: r.callerId,
        callerName: "Mechanical Enterprise",
        audio: true,
        video: false,
        remoteElement: audioRef.current ?? undefined,
      });
    } catch (e: any) {
      setError(e?.message ?? "The call couldn't be started.");
      setPhase("error");
    }
  }

  function hangup() {
    try {
      callRef.current?.hangup?.();
    } catch {
      void finish(callRef.current);
    }
  }

  function toggleMute() {
    const c = callRef.current;
    if (!c) return;
    if (muted) c.unmuteAudio?.();
    else c.muteAudio?.();
    setMuted(!muted);
  }

  const inCall = phase === "dialing" || phase === "ringing" || phase === "active";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && inCall) return; // hang up first
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{name || phone}</DialogTitle>
          <DialogDescription>
            {phone}
            {callerId ? ` · they'll see ${callerId}` : ""}
          </DialogDescription>
        </DialogHeader>

        <audio ref={audioRef} autoPlay />

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="text-sm font-medium flex items-center gap-2" aria-live="polite">
            {(phase === "connecting" || phase === "dialing") && <Loader2 className="h-4 w-4 animate-spin" />}
            {PHASE_LABEL[phase]}
          </div>
          {phase === "active" && <div className="text-3xl font-semibold tabular-nums">{mmss(seconds)}</div>}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <div className="flex gap-2 pt-1">
            {(phase === "ready" || phase === "ended") && (
              <Button onClick={dial} disabled={startM.isPending}>
                <PhoneOutgoing className="h-4 w-4 mr-1" /> {phase === "ended" ? "Call again" : "Call"}
              </Button>
            )}
            {inCall && (
              <>
                <Button variant="outline" onClick={toggleMute} disabled={phase !== "active"}>
                  {muted ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                  {muted ? "Unmute" : "Mute"}
                </Button>
                <Button variant="destructive" onClick={hangup}>
                  <PhoneOff className="h-4 w-4 mr-1" /> Hang up
                </Button>
              </>
            )}
            {(phase === "ended" || phase === "error") && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Use your headset. The browser will ask for microphone access the first time. After the call, add your notes on the lead.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
