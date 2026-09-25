/**
 * Live page body text, for the AI drafting prompt's "here's what's actually
 * on the page" context (docs asked for "first ~800 words of body"). No HTML
 * parser dependency — a regex strip is good enough for LLM context, not
 * exact-fidelity extraction. extractBodyText() is pure/testable; fetchBodyExcerpt()
 * does the network call and degrades to "" on any failure (a body excerpt is
 * helpful context, never a hard requirement — drafting must not fail because
 * the site was briefly slow).
 */

const FETCH_TIMEOUT_MS = 8000;

/** Strip boilerplate/tags/scripts and return the first `maxWords` words of visible text. */
export function extractBodyText(html: string, maxWords = 800): string {
  const withoutBoilerplate = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const text = withoutBoilerplate
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text.split(" ").filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

/** Fetch a page's live HTML and return its first ~800 words of body text. Never throws — "" on any failure. */
export async function fetchBodyExcerpt(url: string, maxWords = 800): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return "";
      const html = await res.text();
      return extractBodyText(html, maxWords);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "";
  }
}
