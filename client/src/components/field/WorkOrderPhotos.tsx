/**
 * WorkOrderPhotos — mobile job-photo capture + gallery for the work order.
 * Upload uses the device camera (capture) or gallery, compresses each image in
 * the browser (reuses lib/imageResize), rejects non-image files, and supports
 * multiple selections. The gallery groups photos by category (Before / During /
 * After / General), lazy-loads thumbnails through the authorized endpoint, and
 * opens a lightbox on tap. No financial info; view/upload are server-authorized.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { fileToResizedDataUrl } from "@/lib/imageResize";
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_LABEL, type PhotoCategory } from "@shared/jobMedia";
import { PhotoThumb } from "@/components/field/PhotoThumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Images, Loader2, ImageIcon } from "lucide-react";

export function WorkOrderPhotos({ jobId }: { jobId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.jobs.fieldListPhotos.useQuery({ jobId }, { enabled: jobId > 0 });
  const addPhoto = trpc.jobs.fieldAddPhoto.useMutation();

  const [category, setCategory] = useState<PhotoCategory>("general");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    let ok = 0;
    let skipped = 0;
    for (const file of Array.from(files)) {
      try {
        if (!file.type.startsWith("image/")) { skipped++; continue; } // reject non-image
        const dataUrl = await fileToResizedDataUrl(file, 1280, 0.72); // compress in-browser → JPEG
        await addPhoto.mutateAsync({ jobId, category, fileName: file.name.slice(0, 255) || "photo.jpg", dataUrl });
        ok++;
      } catch (e) {
        skipped++;
      }
    }
    setBusy(false);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (ok) { toast.success(`${ok} photo${ok > 1 ? "s" : ""} added`); utils.jobs.fieldListPhotos.invalidate({ jobId }); }
    if (skipped) toast.error(`${skipped} file${skipped > 1 ? "s" : ""} skipped — unsupported type or failed`);
  };

  const photos = data?.photos ?? [];
  const grouped = PHOTO_CATEGORIES.map(c => ({ category: c, items: photos.filter(p => p.category === c) }));

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span className="uppercase tracking-wide">Photos</span>
          <Badge variant="secondary" className="ml-auto">{photos.length}</Badge>
        </div>

        {/* Upload row: category + camera + gallery */}
        <div className="space-y-2">
          <Select value={category} onValueChange={v => setCategory(v as PhotoCategory)}>
            <SelectTrigger className="h-11" aria-label="Photo category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{PHOTO_CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFiles(e.target.files)} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleFiles(e.target.files)} />
            <Button variant="secondary" className="h-12" disabled={busy} onClick={() => cameraRef.current?.click()}>
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />} Camera
            </Button>
            <Button variant="outline" className="h-12" disabled={busy} onClick={() => galleryRef.current?.click()}>
              <Images className="mr-2 h-5 w-5" /> Gallery
            </Button>
          </div>
        </div>

        {/* Gallery grouped by category */}
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos yet. Use Camera or Gallery to add before/during/after shots.</p>
        ) : (
          grouped.filter(g => g.items.length > 0).map(g => (
            <div key={g.category} className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {PHOTO_CATEGORY_LABEL[g.category]} <span className="text-muted-foreground/70">({g.items.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map(p => (
                  <PhotoThumb key={p.id} id={p.id} onOpen={() => setLightbox(p.id)} alt={p.fileName} />
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* Lightbox */}
      <Dialog open={lightbox != null} onOpenChange={o => !o && setLightbox(null)}>
        <DialogContent className="max-w-[95vw] p-2 sm:max-w-2xl">
          {lightbox != null ? <PhotoThumb id={lightbox} className="h-[70vh]" /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default WorkOrderPhotos;
