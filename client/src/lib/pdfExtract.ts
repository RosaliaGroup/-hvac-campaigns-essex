import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export interface ExtractedPage {
  pageNum: number;
  text: string;
  charCount: number;
  thumbnail: string; // base64 JPEG
  selected: boolean;
}

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

    // Render thumbnail at 120 DPI (scale relative to 72 DPI default)
    const scale = 120 / 72;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const thumbnail = canvas.toDataURL("image/jpeg", 0.6);

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

/**
 * Build image content blocks for selected pages (for Claude API).
 * Returns at most maxPages images.
 */
export function buildImageBlocks(pages: ExtractedPage[], maxPages = 20): any[] {
  return pages
    .filter((p) => p.selected)
    .slice(0, maxPages)
    .map((p) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: p.thumbnail.replace(/^data:image\/jpeg;base64,/, ""),
      },
    }));
}
