import type { BlogPostData } from "../client/src/data/blogPosts";

export function publicationDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }).format(now);
}

export function blogDateIso(value?: string): string | undefined {
  if (!value) return undefined;
  // Interpret date-only labels in UTC so browser timezone cannot shift schema dates.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : `${value} UTC`);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
}

/** Latest meaningful update first, otherwise original publication; never mutate input. */
export function sortPublishedPosts(posts: BlogPostData[]): BlogPostData[] {
  const timestamp = (post: BlogPostData) => Date.parse(blogDateIso(post.updatedDate) ?? blogDateIso(post.date) ?? "1970-01-01");
  return [...posts].sort((a, b) => timestamp(b) - timestamp(a));
}
