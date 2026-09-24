/**
 * Netlify Edge Function — injects correct SEO meta tags into the HTML
 * response for every page so crawlers see real content without JS.
 *
 * Runs at the CDN edge, rewrites the <head> of the SPA index.html
 * before it reaches the browser/crawler.
 *
 * ENHANCED: Now handles city pages, direct-install pages, og:image,
 * and adds prerender hints for search engine bots.
 */

import blogPosts from "./blog-meta.json" with { type: "json" };
import routesManifest from "./routes-manifest.json" with { type: "json" };
import { PHONE_DISPLAY as PHONE } from "../../shared/business.ts";
import { isInternalRoute } from "../../client/src/lib/navigation.ts";

// PR-1 item E: paid-only landing pages — indexable by nobody, but crawlable
// (so Google understands the destination when it does see a link/ad-slug).
const NOINDEX_FOLLOW_PATHS = new Set<string>([
  "/lp/fb-commercial",
  "/lp/fb-residential",
  "/lp/referral-partner",
]);

// PR-1 items C/K/L: real, working, registered pages that are simply not
// marketing content — noindex, and no crawl budget wasted following them out.
const NOINDEX_NOFOLLOW_PATHS = new Set<string>([
  "/courses",
  "/estimating",
  "/presentation-2026",
]);

// PR-1 item E: /lp/rebate-guide is a pure duplicate of /rebate-guide.
const CANONICAL_OVERRIDES: Record<string, string> = {
  "/lp/rebate-guide": "https://mechanicalenterprise.com/rebate-guide",
};

const BASE = "https://mechanicalenterprise.com";
// PR-1 item H: was "...#1 MWBE HVAC Contractor..." — "#1" is an unverified
// claim (no certification/ranking documentation in the repo). Kept in sync
// with the client-side title in client/src/pages/Home.tsx (useSEO call).
const DEFAULT_TITLE = "Licensed HVAC Contractor in Newark, NJ | Up to $16K Rebates";
const DEFAULT_DESC =
  `Licensed & MWBE-certified HVAC contractor in Newark, NJ. Heat pump, AC & furnace installation. PSE&G-approved, up to $16K in rebates. Serving 15 NJ counties. Free assessment. Call ${PHONE}.`;
const DEFAULT_OG_IMAGE = `${BASE}/og-default.png`;

// ── Known page metadata ────────────────────────────────────────────────────

interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  "/residential": {
    title: "Residential HVAC Installation NJ | Heat Pump & AC | Up to $16K Rebates",
    description: "Expert residential HVAC installation in NJ. Heat pumps, central AC, ductless mini-splits & furnaces. Up to $16K in NJ rebates. MWBE certified. Free in-home assessment.",
  },
  "/commercial": {
    title: "Commercial HVAC Contractor NJ | Direct Install | Up to 80% Covered",
    description: "Commercial HVAC installation & repair in NJ. PSE&G Direct Install covers up to 80% of costs. VRF/VRV specialists. MWBE certified. Free commercial assessment. Call (862) 423-9396.",
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
    description: "Licensed NJ HVAC contractor serving 15 counties. WMBE/SBE certified. PSE&G approved. Call (862) 423-9396.",
  },
  "/contact": {
    title: "Contact Mechanical Enterprise | NJ HVAC",
    description: "Contact Mechanical Enterprise for HVAC service in New Jersey. Call (862) 423-9396 or request a free assessment online.",
  },
  "/blog": {
    title: "NJ HVAC Blog | Rebate Guides, Heat Pump Tips & Energy Savings",
    description: "Expert HVAC guides for NJ homeowners. Learn about heat pump rebates, PSE&G programs, R22 replacement, oil-to-electric conversion, and how to save thousands on your HVAC upgrade.",
  },
  "/direct-install": {
    title: "NJ Direct Install Program | Free Lighting & 80% HVAC | Mechanical Enterprise",
    description: "NJ Direct Install Program covers 100% of commercial lighting and up to 80% of HVAC. PSE&G Trade Ally. Free assessment for NJ businesses.",
  },
  "/pseg-rebate-contractor-nj": {
    title: "PSE&G Approved HVAC Contractor NJ | Mechanical Enterprise",
    description: "PSE&G-approved HVAC contractor for NJ rebate programs. We handle all paperwork. Up to $16K in rebates. Free assessment.",
  },
  "/pseg-rebate-checklist": {
    title: "PSE&G Rebate Checklist NJ | Mechanical Enterprise",
    description: "Complete PSE&G rebate checklist for NJ homeowners. Every step from assessment to rebate check. Free assessment included.",
  },
  "/rebate-guide": {
    title: "NJ HVAC Rebate Guide 2026 | Mechanical Enterprise",
    description: "Complete guide to every NJ HVAC rebate in 2026. PSE&G and state programs, up to $16K in combined savings.",
  },
  "/maintenance": {
    title: "HVAC Maintenance Plans NJ | Mechanical Enterprise",
    description: "HVAC maintenance plans for NJ homes and businesses. Prevent breakdowns, extend system life, maintain warranty coverage.",
  },
  "/testimonials": {
    title: "Customer Reviews | Mechanical Enterprise NJ",
    description: "Read what NJ homeowners and businesses say about Mechanical Enterprise HVAC installations and rebate assistance.",
  },
  "/careers": {
    title: "HVAC Careers NJ | Mechanical Enterprise",
    description: "Join Mechanical Enterprise. HVAC technician and installer positions in New Jersey. Competitive pay, benefits, growth.",
  },
  "/partnerships": {
    title: "HVAC Referral Partnerships | Mechanical Enterprise NJ",
    description: "Partner with Mechanical Enterprise for HVAC referrals in NJ. Real estate agents, contractors, property managers welcome.",
  },
};

// ── SEO landing pages (repair/service intent) ──────────────────────────────
// Titles/descriptions MUST stay in sync with client/src/data/seoLandingPages.ts
// (that file drives the client-side useSEO; this drives the crawler-facing meta).
interface LandingMeta { title: string; description: string; parent: "Residential" | "Commercial"; name: string }
const SEO_LANDING_META: Record<string, LandingMeta> = {
  "/ac-repair-nj": { parent: "Residential", name: "AC Repair", title: "AC Repair NJ | Same-Day Air Conditioning Repair | Mechanical Enterprise", description: "Same-day AC repair across New Jersey. Licensed techs, all makes, upfront pricing, rebates on upgrades. Call (862) 423-9396." },
  "/heating-repair-nj": { parent: "Residential", name: "Heating Repair", title: "Heating Repair NJ | Same-Day No-Heat Service | Mechanical Enterprise", description: "Fast heating repair across NJ — furnaces, boilers & heat pumps. Same-day & 24/7 no-heat service, upfront pricing. Call (862) 423-9396." },
  "/furnace-repair-nj": { parent: "Residential", name: "Furnace Repair", title: "Furnace Repair NJ | 24/7 No-Heat Service | Mechanical Enterprise", description: "Gas & electric furnace repair across NJ. Same-day & 24/7 no-heat service, safety checks, upfront pricing. Call (862) 423-9396." },
  "/boiler-repair-nj": { parent: "Residential", name: "Boiler Repair", title: "Boiler Repair NJ | Steam & Hot-Water Boilers | Mechanical Enterprise", description: "Boiler repair across NJ — steam & hot-water systems, no heat, leaks, low pressure. Same-day & 24/7 service. Call (862) 423-9396." },
  "/indoor-air-quality-nj": { parent: "Residential", name: "Indoor Air Quality", title: "Indoor Air Quality NJ | Air Purifiers & Filtration | Mechanical Enterprise", description: "Improve your NJ home's air — purifiers, filtration, UV lights, humidity control & duct sealing. Free assessment. Call (862) 423-9396." },
  "/heat-pump-repair-nj": { parent: "Residential", name: "Heat Pump Repair", title: "Heat Pump Repair NJ | Ducted & Ductless | Mechanical Enterprise", description: "Expert heat pump repair across NJ — no heat/cooling, defrost & refrigerant faults, all brands. Upgrade rebates. Call (862) 423-9396." },
  "/ductless-mini-split-repair-nj": { parent: "Residential", name: "Ductless Mini-Split Repair", title: "Ductless Mini-Split Repair NJ | All Brands | Mechanical Enterprise", description: "Mini-split repair across NJ — not cooling, leaks, error codes, comm faults. Mitsubishi, Daikin, Fujitsu & more. Call (862) 423-9396." },
  "/emergency-hvac-repair-nj": { parent: "Residential", name: "Emergency HVAC Repair", title: "Emergency HVAC Repair NJ | 24/7 No Heat / No AC | Mechanical Enterprise", description: "24/7 emergency HVAC repair across New Jersey. No heat, no AC, sudden breakdowns — fast local response. Call (862) 423-9396 now." },
  "/commercial-hvac-service-nj": { parent: "Commercial", name: "Commercial HVAC Service", title: "Commercial HVAC Service & Repair NJ | Mechanical Enterprise", description: "Commercial HVAC service & repair across NJ — RTUs, splits, VRF, controls. Service agreements & 24/7 response. Call (862) 423-9396." },
  "/commercial-rtu-service-nj": { parent: "Commercial", name: "RTU Service", title: "Commercial RTU Service & Repair NJ | Rooftop Units | Mechanical Enterprise", description: "Rooftop unit (RTU) service, repair & replacement across NJ. Economizers, compressors, PM programs. Minimize downtime. Call (862) 423-9396." },
  "/commercial-hvac-maintenance-nj": { parent: "Commercial", name: "Commercial HVAC Maintenance", title: "Commercial HVAC Maintenance NJ | PM Agreements | Mechanical Enterprise", description: "Commercial HVAC preventive maintenance plans across NJ. Fewer breakdowns, longer equipment life, priority service. Call (862) 423-9396." },
  "/restaurant-hvac-nj": { parent: "Commercial", name: "Restaurant HVAC", title: "Restaurant HVAC & Kitchen Ventilation NJ | Mechanical Enterprise", description: "Restaurant HVAC across NJ — kitchen exhaust & makeup air, dining comfort, RTUs. Off-hours service to avoid closures. Call (862) 423-9396." },
  "/warehouse-hvac-nj": { parent: "Commercial", name: "Warehouse HVAC", title: "Warehouse HVAC NJ | Heating, Ventilation & Cooling | Mechanical Enterprise", description: "Warehouse & distribution HVAC across NJ — unit heaters, ventilation, HVLS, rooftop units. Worker comfort & compliance. Call (862) 423-9396." },
  "/office-building-hvac-nj": { parent: "Commercial", name: "Office Building HVAC", title: "Office Building HVAC NJ | Multi-Zone Comfort | Mechanical Enterprise", description: "Office HVAC across NJ — RTUs, VAV/VRF, chillers, controls & IAQ. Tenant comfort, fewer complaints. Call (862) 423-9396." },
  "/industrial-hvac-nj": { parent: "Commercial", name: "Industrial HVAC", title: "Industrial HVAC NJ | Process Cooling & Chillers | Mechanical Enterprise", description: "Industrial HVAC across NJ — process cooling, chillers, ventilation & makeup air. 24/7 uptime & compliance. Call (862) 423-9396." },
};

// ── Dynamic page metadata generators ──────────────────────────────────────

function getCityMeta(slug: string): PageMeta & { canonical: string } {
  // slug is like "hvac-newark-nj" — extract city name
  const cityPart = slug.replace("hvac-", "").replace("-nj", "");
  const city = cityPart.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    title: `${city} NJ HVAC Contractor | AC & Heat Pump Installation | Up to $16K Rebates`,
    description: `Top-rated HVAC contractor in ${city}, NJ. Heat pump, central AC & furnace installation and repair. Up to $16K in NJ rebates. Free assessment, no obligation. Call ${PHONE}.`,
    canonical: `${BASE}/${slug}`,
  };
}

function getDirectInstallMeta(slug: string): PageMeta & { canonical: string } {
  // slug is like "accounting-offices-nj"
  const industryPart = slug.replace("-nj", "");
  const industry = industryPart.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    title: `Free HVAC & Lighting for ${industry} in NJ | Direct Install Program`,
    description: `NJ ${industry.toLowerCase()} qualify for 100% free commercial lighting and up to 80% off HVAC upgrades through the NJ Direct Install Program. PSE&G Trade Ally. No upfront cost. Free assessment. Call ${PHONE}.`,
    canonical: `${BASE}/direct-install/${slug}`,
  };
}

function getLandingPageMeta(slug: string): PageMeta & { canonical: string } {
  const LP_META: Record<string, PageMeta> = {
    "heat-pump-rebates": {
      title: "NJ Heat Pump Rebates 2026 | Up to $16,000 Back | Mechanical Enterprise",
      description: "Get up to $16,000 in NJ heat pump rebates. PSE&G and state programs. Free assessment, we handle all paperwork.",
    },
    "emergency-hvac": {
      title: "Emergency HVAC Repair NJ | Same-Day Service | Mechanical Enterprise",
      description: "Emergency HVAC repair in NJ. Same-day service available. Licensed contractor. Call now for immediate assistance.",
    },
    "commercial-vrv": {
      title: "Commercial VRV/VRF Installation NJ | Mechanical Enterprise",
      description: "Commercial VRV/VRF system installation in NJ. Up to 80% covered by Direct Install. Free commercial assessment.",
    },
    "maintenance-offer": {
      title: "HVAC Maintenance Special NJ | Mechanical Enterprise",
      description: "HVAC maintenance plans for NJ homes. Prevent breakdowns, extend system life. Special offer available.",
    },
    "rebate-guide": {
      title: "NJ HVAC Rebate Guide 2026 | Every Program Explained",
      description: "Complete guide to NJ HVAC rebates in 2026. PSE&G, HEEHRA, Clean Heat. Up to $16,000 in combined residential savings.",
    },
    "referral-partner": {
      title: "HVAC Referral Partner Program NJ | Mechanical Enterprise",
      description: "Earn referral fees for HVAC leads in NJ. Real estate agents, contractors, property managers. Easy signup.",
    },
    "fb-commercial": {
      title: "Commercial HVAC Solutions NJ | Free Assessment | Mechanical Enterprise",
      description: "Commercial HVAC for NJ businesses. Direct Install covers up to 80%. Free assessment, PSE&G Trade Ally.",
    },
    "fb-residential": {
      title: "Home HVAC Installation NJ | Up to $16K Rebates | Mechanical Enterprise",
      description: "Residential HVAC installation in NJ. Heat pumps, central AC. Up to $16K in rebates. Free assessment.",
    },
  };
  const meta = LP_META[slug];
  if (meta) {
    return { ...meta, canonical: `${BASE}/lp/${slug}` };
  }
  return { title: DEFAULT_TITLE, description: DEFAULT_DESC, canonical: `${BASE}/lp/${slug}` };
}

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

  // City page (hvac-*-nj pattern)
  if (clean.match(/^\/hvac-[a-z-]+-nj$/)) {
    return getCityMeta(clean.slice(1));
  }

  // Direct-install page
  if (clean.startsWith("/direct-install/") && clean !== "/direct-install") {
    const slug = clean.replace("/direct-install/", "");
    return getDirectInstallMeta(slug);
  }

  // Landing pages
  if (clean.startsWith("/lp/")) {
    const slug = clean.replace("/lp/", "");
    return getLandingPageMeta(slug);
  }

  // SEO landing page (repair/service intent)
  const landing = SEO_LANDING_META[clean];
  if (landing) {
    return { title: landing.title, description: landing.description, canonical: `${BASE}${clean}` };
  }

  // Known static page
  const known = PAGE_META[clean];
  if (known) {
    return { ...known, canonical: `${BASE}${clean === "/" ? "" : clean}` };
  }

  // Fallback
  return { title: DEFAULT_TITLE, description: DEFAULT_DESC, canonical: `${BASE}${clean}` };
}

// ── PR-1: registered-route check (404 vs internal vs marketing) ────────────
// MANIFEST is the exact set of resolvable public marketing/content URLs —
// generated by scripts/generate-sitemap.ts from the App.tsx <Route> registry
// (plus enumerated blog/direct-install slugs) into routes-manifest.json. It
// is NOT the same list as sitemap.xml: some real, working pages (e.g.
// /courses, /portal) are deliberately kept out of the sitemap for SEO
// reasons but must still resolve normally here.
//
// Previously, ANY path matching /^\/hvac-[a-z-]+-nj$/ got a full,
// plausible-looking SEO title/description/canonical/JSON-LD from
// getCityMeta() even if no such city page was actually registered (e.g.
// /hvac-paterson-nj) — the "slug-based title injection for unregistered
// slugs" bug. Gating on MANIFEST first fixes it: an unregistered slug never
// reaches getMetaForPath()'s pattern matching.
const MANIFEST = new Set<string>(routesManifest as string[]);

// /courses/:id (CourseDetail) is the one public, non-CRM route with a
// dynamic param — it can't be enumerated into the manifest the way blog/
// direct-install slugs are. isInternalRoute() covers every other dynamic
// route (/leads/:id, /jobs/:id, /opportunities/:id, /takeoff-ai/:id,
// /portal/:rest*, etc. — all protect()-wrapped or under an internal prefix
// in client/src/lib/navigation.ts).
const PUBLIC_DYNAMIC_PREFIXES = ["/courses/"];

export interface RouteStatus {
  /** False only for a truly unregistered path — gets a real 404. */
  isRegistered: boolean;
  /** True for CRM/internal routes and public-dynamic (non-marketing) routes:
   *  known-good, but must never get fabricated marketing SEO metadata, and
   *  must get noindex (belt-and-braces alongside the X-Robots-Tag header). */
  isInternalOrDynamic: boolean;
}

export function getRouteStatus(pathname: string): RouteStatus {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const isInternalOrDynamic =
    isInternalRoute(clean) || PUBLIC_DYNAMIC_PREFIXES.some((p) => clean.startsWith(p));
  return { isRegistered: MANIFEST.has(clean) || isInternalOrDynamic, isInternalOrDynamic };
}

// ── HTML rewriting ─────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function injectMeta(html: string, urlPath: string): string {
  const meta = getMetaForPath(urlPath);
  const t = escHtml(meta.title);
  const d = escHtml(meta.description);
  const c = escHtml(meta.canonical);
  const ogImage = escHtml(meta.ogImage || DEFAULT_OG_IMAGE);

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

  // Inject og:image if not present
  if (!html.includes('og:image')) {
    html = html.replace(
      /<meta property="og:url"/,
      `<meta property="og:image" content="${ogImage}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:url"`
    );
  }

  // Inject twitter:card and twitter:image if not present
  if (!html.includes('twitter:card')) {
    html = html.replace(
      /<meta name="twitter:title"/,
      `<meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:image" content="${ogImage}" />\n    <meta name="twitter:title"`
    );
  }

  // Inject canonical link
  if (!html.includes('rel="canonical"')) {
    html = html.replace("</head>", `  <link rel="canonical" href="${c}" />\n  </head>`);
  }

  // Inject LocalBusiness JSON-LD schema on all pages
  if (!html.includes('"@type":"HVACBusiness"') && !html.includes('application/ld+json')) {
    const localBusinessSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HVACBusiness",
      "name": "Mechanical Enterprise LLC",
      "url": BASE,
      "telephone": PHONE,
      "email": "info@mechanicalenterprise.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Newark",
        "addressLocality": "Newark",
        "addressRegion": "NJ",
        "postalCode": "07102",
        "addressCountry": "US"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 40.7357,
        "longitude": -74.1724
      },
      "areaServed": {
        "@type": "State",
        "name": "New Jersey"
      },
      "priceRange": "$$",
      "openingHoursSpecification": [
        { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "07:00", "closes": "18:00" },
        { "@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "08:00", "closes": "14:00" }
      ],
      "sameAs": [
        "https://www.google.com/maps/place/Mechanical+Enterprise"
      ],
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "HVAC Services",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Heat Pump Installation" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Central AC Installation" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Ductless Mini-Split Installation" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Commercial VRF/VRV Systems" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "HVAC Repair & Maintenance" } }
        ]
      }
    });
    html = html.replace("</head>", `  <script type="application/ld+json">${localBusinessSchema}</script>\n  </head>`);
  }

  // Inject BreadcrumbList schema for non-homepage
  const clean = urlPath.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean !== "/" && !html.includes('"@type":"BreadcrumbList"')) {
    const breadcrumbs = buildBreadcrumbs(clean);
    if (breadcrumbs.length > 0) {
      const breadcrumbSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs
      });
      html = html.replace("</head>", `  <script type="application/ld+json">${breadcrumbSchema}</script>\n  </head>`);
    }
  }

  return html;
}

function buildBreadcrumbs(path: string): Array<{"@type": string; position: number; name: string; item: string}> {
  const items: Array<{"@type": string; position: number; name: string; item: string}> = [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE }
  ];
  if (path.startsWith("/blog/")) {
    items.push({ "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` });
    const slug = path.replace("/blog/", "");
    const title = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    items.push({ "@type": "ListItem", position: 3, name: title.slice(0, 50), item: `${BASE}${path}` });
  } else if (path.startsWith("/direct-install/")) {
    items.push({ "@type": "ListItem", position: 2, name: "Direct Install", item: `${BASE}/direct-install` });
    const slug = path.replace("/direct-install/", "").replace("-nj", "");
    const title = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    items.push({ "@type": "ListItem", position: 3, name: title, item: `${BASE}${path}` });
  } else if (path.match(/^\/hvac-[a-z-]+-nj$/)) {
    items.push({ "@type": "ListItem", position: 2, name: "Service Areas", item: `${BASE}/services` });
    const city = path.replace("/hvac-", "").replace("-nj", "").split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    items.push({ "@type": "ListItem", position: 3, name: `${city}, NJ`, item: `${BASE}${path}` });
  } else if (path.startsWith("/lp/")) {
    items.push({ "@type": "ListItem", position: 2, name: "Offers", item: `${BASE}/lp/heat-pump-rebates` });
  } else if (SEO_LANDING_META[path]) {
    const lp = SEO_LANDING_META[path];
    const parentPath = lp.parent === "Commercial" ? "/commercial" : "/residential";
    items.push({ "@type": "ListItem", position: 2, name: `${lp.parent} HVAC`, item: `${BASE}${parentPath}` });
    items.push({ "@type": "ListItem", position: 3, name: lp.name, item: `${BASE}${path}` });
  } else {
    const pageName = path.slice(1).split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    items.push({ "@type": "ListItem", position: 2, name: pageName, item: `${BASE}${path}` });
  }
  return items;
}

// ── Edge Function handler ──────────────────────────────────────────────────

export default async function handler(request: Request, context: any) {
  const url = new URL(request.url);

  // ── 301 Redirects for old/renamed URLs (must run before SPA fallback) ──
  const REDIRECTS: Record<string, string> = {
    "/blog/how-to-apply-pseg-rebate-nj": "/blog/pseg-rebate-application-process",
    "/blog/r22-replacement-cost-nj": "/blog/how-much-does-r22-replacement-cost-nj",
    "/blog/warehouse-lighting-hvac-direct-install-nj": "/blog/warehouse-hvac-nj",
    "/blog/old-ac-replacement-nj-rebates": "/blog/central-ac-replacement-nj-cost",
    "/blog/nj-direct-install-program-commercial-guide": "/direct-install",
    // Duplicated a city/service page's own ranking — see netlify.toml.
    "/blog/hvac-contractor-newark-nj": "/hvac-newark-nj",
    "/blog/hvac-contractor-jersey-city-nj": "/hvac-jersey-city-nj",
    "/blog/hvac-contractor-elizabeth-nj": "/hvac-elizabeth-nj",
    "/blog/hvac-contractor-clifton-nj": "/hvac-clifton-nj",
    "/blog/hvac-contractor-woodbridge-nj": "/hvac-woodbridge-nj",
    "/blog/commercial-hvac-newark-nj": "/commercial",
    "/blog/commercial-hvac-jersey-city-nj": "/commercial",
    "/blog/commercial-hvac-paterson-nj": "/commercial",
    "/blog/emergency-hvac-repair-newark-nj": "/lp/emergency-hvac",
    "/blog/heating-not-working-newark-nj": "/lp/emergency-hvac",
    // PR-1: pure content duplicate — /rebate-calc and /rebate-calculator both
    // render the exact same RebateCalculator component. Consolidate to one URL.
    // (/referral is intentionally NOT redirected here — see PR-1 notes: it is
    // the live URL Vapi's sendReferralLink SMS tool sends to real customers,
    // server/services/referralSms.ts CUSTOMER_REFERRAL_LINK. Flagged for the
    // owner rather than changed.)
    "/rebate-calc": "/rebate-calculator",
  };
  const redirectTarget = REDIRECTS[url.pathname];
  if (redirectTarget) {
    return new Response(null, {
      status: 301,
      headers: { "Location": `${url.origin}${redirectTarget}` },
    });
  }

  // Static files — skip entirely so Netlify serves them as-is
  if (url.pathname.endsWith(".xml") || url.pathname.endsWith(".txt") || url.pathname.endsWith(".csv") || url.pathname === "/247-partners.html") {
    return;
  }

  // Terms pages are versioned, standalone static HTML that must render
  // identically forever — never rewrite their <head>. (/terms itself is a
  // 302 redirect handled by netlify.toml; skipping it here is harmless.)
  if (url.pathname === "/terms" || url.pathname.startsWith("/terms/")) {
    return;
  }

  // Skip non-HTML requests (assets, API, etc.)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.match(/\.\w{2,5}$/) // has file extension like .js, .css, .png
  ) {
    return;
  }

  // Get the original response (index.html via SPA fallback)
  const response = await context.next();

  // Only rewrite HTML responses
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const { isRegistered, isInternalOrDynamic } = getRouteStatus(url.pathname);

  if (!isRegistered) {
    // Real 404: same empty SPA shell (client-side NotFound already renders
    // correctly here — wouter's <Route component={NotFound}/> catch-all),
    // but with an honest status code and no fabricated SEO metadata.
    let notFoundHtml = html.replace(/<title>[^<]*<\/title>/, "<title>Page Not Found | Mechanical Enterprise</title>");
    if (!notFoundHtml.includes('name="robots"')) {
      notFoundHtml = notFoundHtml.replace("</head>", `  <meta name="robots" content="noindex" />\n  </head>`);
    }
    return new Response(notFoundHtml, {
      status: 404,
      headers: response.headers,
    });
  }

  if (isInternalOrDynamic) {
    // CRM/internal or public-dynamic (non-marketing) route: known-good, but
    // never gets the marketing injectMeta() treatment (no fabricated title/
    // canonical/JSON-LD for a dashboard page). Belt-and-braces noindex meta
    // tag alongside the X-Robots-Tag header (netlify.toml) — see PR-1 item B.
    let internalHtml = html;
    if (!internalHtml.includes('name="robots"')) {
      internalHtml = internalHtml.replace("</head>", `  <meta name="robots" content="noindex, nofollow" />\n  </head>`);
    }
    return new Response(internalHtml, {
      status: response.status,
      headers: response.headers,
    });
  }

  let rewritten = injectMeta(html, url.pathname);
  const clean = url.pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // PR-1 items C/E/K/L: real marketing-adjacent pages that must still resolve
  // normally and keep sensible title/description (so injectMeta() above ran
  // as usual), but must not be indexed. Belt-and-braces meta tag alongside
  // the matching X-Robots-Tag header in netlify.toml.
  const robotsValue = NOINDEX_FOLLOW_PATHS.has(clean)
    ? "noindex, follow"
    : NOINDEX_NOFOLLOW_PATHS.has(clean)
      ? "noindex, nofollow"
      : null;
  if (robotsValue && !rewritten.includes('name="robots"')) {
    rewritten = rewritten.replace("</head>", `  <meta name="robots" content="${robotsValue}" />\n  </head>`);
  }

  // PR-1 item E: /lp/rebate-guide canonicalizes to /rebate-guide instead of
  // the self-canonical injectMeta() already wrote above.
  const canonicalOverride = CANONICAL_OVERRIDES[clean];
  if (canonicalOverride) {
    rewritten = rewritten.replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonicalOverride}" />`
    );
  }

  return new Response(rewritten, {
    status: response.status,
    headers: response.headers,
  });
}

export const config = {
  path: "/*",
};
