import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Link } from "wouter";

type Review = { id: string; author: string; rating: number; text: string; date: string | null };
type Photo = { id: string; url: string; category: string | null };
type PublicGbp = { connected: boolean; rating?: string | null; totalReviews?: number | null; reviews: Review[]; photos: Photo[] };

export default function GoogleBusinessShowcase({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<PublicGbp | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/google-business", { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then((value: PublicGbp | null) => { if (value) setData(value); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!data?.connected || (!data.reviews.length && !data.photos.length)) return null;
  const reviews = data.reviews.slice(0, compact ? 3 : 12);
  const photos = data.photos.slice(0, compact ? 4 : 18);
  return (
    <section className="py-14 bg-slate-50" aria-label="Google reviews and photos">
      <div className="container mx-auto px-4 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-600">From our Google Business Profile</p>
            <h2 className="text-3xl font-bold text-slate-900">Customer Reviews & Photos</h2>
            {data.rating && <p className="mt-2 text-slate-700">{Number(data.rating).toFixed(1)} / 5 on Google{data.totalReviews ? ` · ${data.totalReviews} reviews` : ""}</p>}
          </div>
          {compact && <Link href="/testimonials" className="text-orange-700 font-semibold underline">View all reviews and photos</Link>}
        </div>
        {reviews.length > 0 && <div className="grid gap-4 md:grid-cols-3">
          {reviews.map(review => <article key={review.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex gap-1 mb-3" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: Math.min(5, review.rating) }, (_, i) => <Star key={i} className="h-4 w-4 fill-orange-500 text-orange-500" />)}
            </div>
            <p className="text-slate-800 whitespace-pre-line line-clamp-6">{review.text}</p>
            <p className="mt-3 text-sm font-semibold text-slate-700">{review.author}</p>
            {review.date && <p className="text-xs text-slate-500">{new Date(review.date).toLocaleDateString()}</p>}
          </article>)}
        </div>}
        {photos.length > 0 && <div>
          <h3 className="text-xl font-bold mb-4">Photos on Google</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {photos.map(photo => <img key={photo.id} src={photo.url} alt="Mechanical Enterprise Google Business Profile photo" loading="lazy" referrerPolicy="no-referrer" className="aspect-[4/3] w-full rounded-lg object-cover bg-slate-200" />)}
          </div>
        </div>}
        <p className="text-xs text-slate-500">Reviews and photos sourced from the Mechanical Enterprise Google Business Profile. Content is refreshed from Google's available data.</p>
      </div>
    </section>
  );
}
