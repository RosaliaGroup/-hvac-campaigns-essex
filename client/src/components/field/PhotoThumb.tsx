/**
 * PhotoThumb — a job photo rendered through the authorized endpoint only.
 * The image bytes are fetched via jobs.fieldGetPhoto (access-controlled; there
 * is no guessable public URL), and only once the thumbnail scrolls into view
 * (IntersectionObserver → lazy loading), so a large gallery doesn't fetch every
 * blob up front.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, ImageOff } from "lucide-react";

function useInView<T extends Element>(rootMargin = "250px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const obs = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) { setInView(true); obs.disconnect(); } },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

export function PhotoThumb({
  id,
  onOpen,
  className = "h-24",
  alt = "Job photo",
}: {
  id: number;
  onOpen?: () => void;
  className?: string;
  alt?: string;
}) {
  const { ref, inView } = useInView<HTMLButtonElement>();
  const { data, isLoading, isError } = trpc.jobs.fieldGetPhoto.useQuery(
    { id },
    { enabled: inView, staleTime: 5 * 60 * 1000 },
  );
  const src = data?.dataUrl ?? data?.url ?? null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className={`relative block w-full overflow-hidden rounded-lg border bg-muted ${className}`}
      aria-label="Open photo"
    >
      {src ? (
        <img src={src} loading="lazy" alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          {isError ? <ImageOff className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}
    </button>
  );
}

export default PhotoThumb;
