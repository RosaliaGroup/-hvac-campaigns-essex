import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export interface ExtractedPage {
  pageNum: number;
  text: string;
  charCount: number;
  thumbnail: string; // base64 JPEG data URL
  selected: boolean;
}

// Base render tuning. 150 DPI keeps drawing symbols legible, but a full-size
// sheet at 150 DPI (e.g. 30x42") is ~28 MP and produces a multi-MB JPEG — four
// of those overflow the Netlify /api proxy's ~10 MB request-body cap. Capping
// the longest side and using a moderate JPEG quality keeps a 4-page batch well
// under the safe budget while preserving symbol visibility. Oversized batches
// are further shrunk on demand via recompressImage() (see takeoffBatchPlan).
const BASE_TARGET_DPI = 150;
const BASE_MAX_DIM = 2600; // px, longest side of the base render
const BASE_JPEG_QUALITY = 0.72;

/**
 * Extract text and render thumbnail for every page of a PDF.
 * Calls onProgress(pageNum, totalPages) after each page.
 */
export async function extractPDFPages(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // Extract text
    const textContent = await page.getTextContent();
    const text = (textContent.items as any[]).map((item) => item.str).join(" ");

    // Render at ~150 DPI for symbol visibility (scale relative to 72 DPI default),
    // but cap the longest side so very large sheets don't blow the request budget.
    const baseScale = BASE_TARGET_DPI / 72;
    const baseViewport = page.getViewport({ scale: baseScale });
    const longest = Math.max(baseViewport.width, baseViewport.height);
    const scale = longest > BASE_MAX_DIM ? baseScale * (BASE_MAX_DIM / longest) : baseScale;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const thumbnail = canvas.toDataURL("image/jpeg", BASE_JPEG_QUALITY);

    pages.push({
      pageNum: i,
      text,
      charCount: text.length,
      thumbnail,
      selected: true,
    });

    onProgress?.(i, pdf.numPages);
  }

  return pages;
}

/**
 * Build the combined text from selected pages only.
 */
export function buildSelectedText(pages: ExtractedPage[]): string {
  return pages
    .filter((p) => p.selected)
    .map((p) => `\n=== PAGE ${p.pageNum} ===\n${p.text}`)
    .join("");
}

/** One Claude image content block from a JPEG data URL (strips the data: prefix). */
export function imageBlockFromDataUrl(dataUrl: string): any {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: dataUrl.replace(/^data:image\/jpeg;base64,/, ""),
    },
  };
}

/**
 * Build image content blocks for selected pages (for Claude API).
 * Returns at most maxPages images.
 */
export function buildImageBlocks(pages: ExtractedPage[], maxPages = 20): any[] {
  return pages
    .filter((p) => p.selected)
    .slice(0, maxPages)
    .map((p) => imageBlockFromDataUrl(p.thumbnail));
}

/**
 * Re-encode a JPEG data URL at a smaller max dimension and lower quality — the
 * on-demand fallback for batches whose base-quality images would overflow the
 * API proxy's request-body cap. Browser-only (uses Image + canvas). Returns a
 * new JPEG data URL.
 */
export function recompressImage(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const longest = Math.max(img.width, img.height) || 1;
        const s = longest > maxDim ? maxDim / longest : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * s));
        canvas.height = Math.max(1, Math.round(img.height * s));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D context unavailable"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e as Error);
      }
    };
    img.onerror = () => reject(new Error("Failed to decode image for recompression"));
    img.src = dataUrl;
  });
}
