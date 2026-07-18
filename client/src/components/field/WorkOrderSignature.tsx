/**
 * WorkOrderSignature (PR #41) — mobile finger/stylus signature capture on a
 * canvas. Clear + re-sign before saving; once the job is completed the signature
 * is read-only (rendered as an image). Stored as a PNG via jobs.fieldSaveSignature.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PenLine, Eraser, Check, Loader2, Lock } from "lucide-react";

export function WorkOrderSignature({ jobId, locked }: { jobId: number; locked: boolean }) {
  const utils = trpc.useUtils();
  const { data } = trpc.jobs.fieldGetSignature.useQuery({ jobId }, { enabled: jobId > 0 });
  const save = trpc.jobs.fieldSaveSignature.useMutation();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Size the canvas backing store to its CSS box for crisp lines.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || locked) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const ctx = c.getContext("2d");
    if (ctx) { ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111827"; }
  }, [locked, data?.hasSignature]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent) => {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    drawing.current = true; setHasInk(true);
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };
  const submit = async () => {
    const c = canvasRef.current; if (!c || !hasInk) return;
    try {
      await save.mutateAsync({ jobId, dataUrl: c.toDataURL("image/png") });
      utils.jobs.fieldGetSignature.invalidate({ jobId });
      toast.success("Signature saved");
    } catch (e: any) { toast.error(e?.message || "Could not save signature"); }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <PenLine className="h-4 w-4" />
          <span className="uppercase tracking-wide">Customer Signature</span>
          {data?.hasSignature ? <Badge variant="outline" className="ml-auto border-green-200 bg-green-50 text-green-700">Signed</Badge> : null}
        </div>

        {locked || data?.hasSignature ? (
          <div className="space-y-1">
            {data?.dataUrl ? (
              <img src={data.dataUrl} alt="Customer signature" className="h-28 w-full rounded-lg border bg-white object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">No signature captured.</p>
            )}
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> {locked ? "Read-only (job completed)." : "Saved."}
              {data?.signedAt ? ` Signed ${new Date(data.signedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="h-32 w-full touch-none rounded-lg border bg-white"
              onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={clear}><Eraser className="mr-1 h-4 w-4" /> Clear</Button>
              <Button className="h-11" disabled={!hasInk || save.isPending} onClick={submit}>
                {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Save Signature
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkOrderSignature;
