/**
 * Netlify Edge Function — injects correct SEO meta tags into the HTML
 * response for every page so crawlers see real content without JS.
 *
 * Runs at the CDN edge, rewrites the <head> of the SPA index.html
 * before it reaches the browser/crawler.
 */

import blogPosts from "./blog-meta.json" with { type: "json" };

const BASE = "https://mechanicalenterprise.com";
const DEFAULT_TITLE = "Mechanical Enterprise | Expert HVAC Solutions in New Jersey";
const DEFAULT_DESC =
  "Licensed HVAC contractor in Newark NJ. PSE&G-approved for heat pump rebates up to $16K. Serving 15 NJ counties. Call (862) 419-1763.";

// ── Known page metadata ────────────────────────────────────────────────────

interface PageMeta {
  title: string;
  description: string;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  "/residential": {
    title: "Residential HVAC Services NJ | Mechanical Enterprise",
    description: "Residential HVAC installation, repair, and replacement in New Jersey. Heat pumps, central AC, ductless mini-splits. Up to $16K in rebates.",
  },
  "/commercial": {
    title: "Commercial HVAC Services NJ | Mechanical Enterprise",
    description: "Commercial HVAC solutions for NJ businesses. PSE&G Direct Install covers up to 80%. VRF/VRV specialists. Free assessment.",
  },
  "/rebate-calculator": {
    title: "NJ HVAC Rebate Calculator | Mechanical Enterprise",
    description: "Calculate your NJ heat pump rebate in 2 minutes. PSE&G rebates up to $16K. Free assessment, no obligation.",
  },
  "/services": {
    title: "HVAC Services | Mechanical Enterprise NJ",
    description: "Full-service HVAC contractor in New Jersey. Installation, repair, maintenance. Heat pumps, AC, furnaces. WMBE certified.",
  },
  "/about": {
    title: "About Mechanical Enterprise | NJ HVAC Contractor",
    description: "Licensed NJ HVAC contractor serving 15 counties. WMBE/SBE certified. PSE&G approved. Call (862) 419-1763.",
  },
  "/contact": {
    title: "Contact Mechanical Enterprise | NJ HVAC",
    description: "Contact Mechanical Enterprise for HVAC service in New Jersey. Call (862) 419-1763 or request a free assessment online.",
  },
  "/blog": {
    title: "HVAC Blog | Mechanical Enterprise NJ",
    description: "HVAC tips, NJ rebate guides, heat pump advice, and energy savings articles from Mechanical Enterprise.",
  },
};

function getMetaForPath(urlPath: string): PageMeta & { canonical: string } {
  const clean = urlPath.split("?")[0].replace(/\/+$/, "") || "/";

  // Blog post
  if (clean.startsWith("/blog/")) {
    const slug = clean.replace("/blog/", "");
    const post = (blogPosts as Array<{ slug: string; title: string; metaDescription: string }>).find(
      (p) => p.slug === slug
    );
    if (post) {
      return {
        title: `${post.title} | Mechanical Enterprise`,
        description: post.metaDescription,
        canonical: `${BASE}/blog/${post.slug}`,
      };
    }
  }

  // Known static page
  const known = PAGE_META[clean];
  if (known) {
    return { ...known, canonical: `${BASE}${clean === "/" ? "" : clean}` };
  }

  // Fallback
  return { title: DEFAULT_TITLE, description: DEFAULT_DESC, canonical: `${BASE}${clean}` };
}

// ── HTML rewriting ─────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function injectMeta(html: string, urlPath: string): string {
  const meta = getMetaForPath(urlPath);
  const t = escHtml(meta.title);
  const d = escHtml(meta.description);
  const c = escHtml(meta.canonical);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${d}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${t}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${d}" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${c}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${t}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${d}" />`
  );

  // Inject canonical link
  if (!html.includes('rel="canonical"')) {
    html = html.replace("</head>", `  <link rel="canonical" href="${c}" />\n  </head>`);
  }

  return html;
}

// ── Edge Function handler ──────────────────────────────────────────────────

export default async function handler(request: Request, context: any) {
  const url = new URL(request.url);

  // Skip non-HTML requests (assets, API, etc.)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.\w{2,5}$/) // has file extension like .js, .css, .png
  ) {
    return context.next();
  }

  // Get the original response (index.html via SPA fallback)
  const response = await context.next();

  // Only rewrite HTML responses
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const rewritten = injectMeta(html, url.pathname);

  return new Response(rewritten, {
    status: response.status,
    headers: response.headers,
  });
}

export const config = {
  path: "/*",
};
