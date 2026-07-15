/**
 * AI SEO Optimization provider — interface + deterministic mock (PR #23).
 *
 * The optimization service (server/services/seo/optimizations.ts) talks ONLY to
 * this interface, so a real LLM/agent provider can replace the mock later with
 * zero changes upstream. The mock is deterministic (no network, no randomness)
 * so tests are stable and the workspace works offline. NOTHING here publishes —
 * it returns draft content the service stores for human review.
 *
 * Swap point: getAiOptimizationProvider() reads SEO_AI_PROVIDER; only "mock" is
 * implemented today. A future "openai"/"anthropic" provider implements the same
 * AiOptimizationProvider interface and is selected here.
 */
import type { AiFaqItem, AiInternalLink, SeoCategory, SeoProblem } from "@shared/seo";

/** Everything the AI needs about a page to draft optimizations. */
export interface PageContext {
  page: string;
  url: string;
  title: string;
  metaDescription: string;
  h1: string;
  category: SeoCategory;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  problems: SeoProblem[];
}

export interface AiOptimizationProvider {
  /** Provider identity stored on the draft (e.g. "mock-v1"). */
  readonly model: string;
  generateTitle(ctx: PageContext): Promise<string>;
  generateMetaDescription(ctx: PageContext): Promise<string>;
  generateH1(ctx: PageContext): Promise<string>;
  generateFaq(ctx: PageContext): Promise<AiFaqItem[]>;
  generateInternalLinks(ctx: PageContext): Promise<AiInternalLink[]>;
  generateSchema(ctx: PageContext): Promise<Record<string, unknown>>;
  expandContent(ctx: PageContext): Promise<string>;
}

/* ── Helpers (pure) ──────────────────────────────────────────────────────── */

const BRAND = "Mechanical Enterprise";
const PHONE = "(862) 419-1763";

/** Turn a path like "/hvac-newark-nj" into a readable phrase "HVAC Newark NJ". */
export function keywordFromPath(path: string): string {
  const cleaned = path.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
  if (!cleaned) return "HVAC Services";
  return cleaned
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => {
      const lw = w.toLowerCase();
      if (lw === "hvac") return "HVAC";
      if (lw === "nj") return "NJ";
      if (lw === "vrf" || lw === "vrv") return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function clip(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

function categoryNoun(category: SeoCategory): string {
  switch (category) {
    case "commercial": return "commercial HVAC";
    case "residential": return "residential HVAC";
    case "city_page": return "local HVAC";
    case "blog": return "HVAC";
    default: return "HVAC";
  }
}

/* ── Deterministic mock provider ─────────────────────────────────────────── */

export class MockAiOptimizationProvider implements AiOptimizationProvider {
  readonly model = "mock-v1";

  async generateTitle(ctx: PageContext): Promise<string> {
    const kw = keywordFromPath(ctx.page);
    return clip(`${kw} | Expert ${categoryNoun(ctx.category)} in New Jersey — ${BRAND}`, 60);
  }

  async generateMetaDescription(ctx: PageContext): Promise<string> {
    const kw = keywordFromPath(ctx.page);
    return clip(
      `Looking for ${kw.toLowerCase()}? ${BRAND} delivers licensed, ${categoryNoun(ctx.category)} installation, repair & maintenance across New Jersey. PSE&G-approved rebates. Call ${PHONE} for a free quote.`,
      158,
    );
  }

  async generateH1(ctx: PageContext): Promise<string> {
    const kw = keywordFromPath(ctx.page);
    return clip(`${kw} You Can Rely On`, 70);
  }

  async generateFaq(ctx: PageContext): Promise<AiFaqItem[]> {
    const kw = keywordFromPath(ctx.page);
    const noun = categoryNoun(ctx.category);
    return [
      {
        question: `How much does ${kw.toLowerCase()} cost in New Jersey?`,
        answer: `${noun.charAt(0).toUpperCase() + noun.slice(1)} pricing depends on system size and scope. ${BRAND} provides free, itemized quotes and can apply PSE&G rebates of up to $16,000 on qualifying heat-pump installs.`,
      },
      {
        question: `Is ${BRAND} licensed and insured for ${kw.toLowerCase()}?`,
        answer: `Yes. ${BRAND} is a fully licensed and insured New Jersey HVAC contractor serving 15 counties, with EPA-certified technicians on every job.`,
      },
      {
        question: `How quickly can you schedule service?`,
        answer: `Most ${noun} service calls are scheduled within 24–48 hours. Call ${PHONE} or request a callback and we'll confirm the earliest available window.`,
      },
    ];
  }

  async generateInternalLinks(ctx: PageContext): Promise<AiInternalLink[]> {
    const kw = keywordFromPath(ctx.page).toLowerCase();
    return [
      { anchor: "commercial HVAC systems", targetPath: "/commercial", rationale: `Strengthens topical authority for "${kw}" by linking to the commercial hub.` },
      { anchor: "heat pump rebates in NJ", targetPath: "/rebates", rationale: "Links to a high-intent rebate page to capture conversion-ready traffic." },
      { anchor: "book a free estimate", targetPath: "/contact", rationale: "Adds a conversion-focused internal link to the contact page." },
    ];
  }

  async generateSchema(ctx: PageContext): Promise<Record<string, unknown>> {
    const kw = keywordFromPath(ctx.page);
    return {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: kw,
      provider: {
        "@type": "HVACBusiness",
        name: BRAND,
        telephone: PHONE,
        areaServed: "New Jersey",
      },
      url: ctx.url,
      description: `${categoryNoun(ctx.category)} services: ${kw} across New Jersey.`,
    };
  }

  async expandContent(ctx: PageContext): Promise<string> {
    const kw = keywordFromPath(ctx.page);
    const noun = categoryNoun(ctx.category);
    return [
      `## ${kw}: What New Jersey property owners should know`,
      ``,
      `${BRAND} has helped New Jersey homeowners and businesses with ${noun} for years. Our EPA-certified team handles everything from high-efficiency heat pumps and VRF/VRV systems to routine maintenance that keeps your equipment running at peak efficiency.`,
      ``,
      `### Why it matters`,
      `A right-sized, well-maintained system lowers energy bills, improves comfort, and qualifies for PSE&G rebates of up to $16,000. We start every project with a load calculation so you never over- or under-size your equipment.`,
      ``,
      `### Next steps`,
      `Call ${PHONE} or request a free estimate. We serve 15 New Jersey counties and can usually schedule within 24–48 hours.`,
    ].join("\n");
  }
}

let _provider: AiOptimizationProvider | null = null;

/** The active AI optimization provider (mock today; swap via SEO_AI_PROVIDER). */
export function getAiOptimizationProvider(): AiOptimizationProvider {
  if (!_provider) {
    // Only "mock" is implemented. Future providers slot in here behind the same interface.
    _provider = new MockAiOptimizationProvider();
  }
  return _provider;
}

/** Test seam — override the provider (e.g. a spy/fake) or reset with null. */
export function setAiOptimizationProvider(p: AiOptimizationProvider | null): void {
  _provider = p;
}
