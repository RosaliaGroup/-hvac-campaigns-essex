import aiFaqs from "@/data/aiFaqs.json";
import { buildFaqPageJsonLd, buildSpeakableJsonLd, type AiFaqFile, type FaqItem } from "@shared/aiFaq";

const BASE = "https://mechanicalenterprise.com";

/** The generated (linted, facts-only) Q&As for a page path, [] if none. */
export function getAiFaqs(path: string, file: AiFaqFile = aiFaqs as AiFaqFile): FaqItem[] {
  return file.pages[path]?.items ?? [];
}

/**
 * Visible conversational Q&A + the page's ONE FAQPage JSON-LD (the page's own visible FAQs first, then the
 * generated ones) + speakable markup pointing at the generated block (.ai-faq-q / .ai-faq-a). Pages that
 * used to emit their own FAQPage script pass their faqs as `existing` and drop that script, so there is
 * exactly one FAQPage per page and it matches visible content.
 */
export default function AiFaqSection({ path, name, existing = [], file }: { path: string; name: string; existing?: FaqItem[]; file?: AiFaqFile }) {
  const items = getAiFaqs(path, file);
  if (items.length === 0 && existing.length === 0) return null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqPageJsonLd([...existing, ...items])) }} />
      {items.length > 0 && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSpeakableJsonLd(`${BASE}${path}`, name)) }} />
          <section className="py-14 bg-gray-50" aria-label="Common questions">
            <div className="container max-w-3xl">
              <h2 className="text-2xl font-bold text-[#0a1628] mb-6">Common questions</h2>
              <div className="space-y-5">
                {items.map((i) => (
                  <div key={i.q}>
                    <h3 className="ai-faq-q font-semibold text-[#0a1628]">{i.q}</h3>
                    <p className="ai-faq-a mt-1 text-gray-700 leading-relaxed">{i.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
