import { useEffect } from "react";
import seoOverrides from "../../../netlify/edge-functions/seo-meta-overrides.json";

/**
 * seo-bulk-approve override — the SAME file netlify/edge-functions/inject-meta.ts
 * reads server-side. Checked first, below, so that after a human approves a
 * title/meta change via the gated bulk-approve PR flow, client-side hydration
 * can never revert the tab back to the page's hardcoded title/description
 * (the exact failure mode this file's import guards against — see
 * docs/seo-bulk-approve-spec.md, "hydration doesn't override the served
 * title"). Only title/description are ever overridden; og/twitter variants
 * and canonical stay driven by the page's own props.
 */
type SeoOverride = { title: string; description: string };
const SEO_OVERRIDES = seoOverrides as Record<string, SeoOverride>;

type SEOProps = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
};

const DEFAULT_OG_IMAGE = "https://mechanicalenterprise.com/og-default.png";

function setMeta(name: string, content: string, attr = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function useSEO(props: SEOProps) {
  // Guarded: this hook runs during SSR/prerender too, where `window` doesn't exist.
  const override = typeof window !== "undefined" ? SEO_OVERRIDES[window.location.pathname] : undefined;
  const title = override?.title ?? props.title;
  const description = override?.description ?? props.description;
  const { ogTitle, ogDescription, ogUrl, ogImage } = props;

  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("geo.region", "US-NJ");
    setMeta("geo.placename", "Newark, New Jersey");
    setMeta("og:title", ogTitle || title, "property");
    setMeta("og:description", ogDescription || description, "property");
    if (ogUrl) setMeta("og:url", ogUrl, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:image", ogImage || DEFAULT_OG_IMAGE, "property");
    setMeta("og:image:width", "1200", "property");
    setMeta("og:image:height", "630", "property");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", ogTitle || title);
    setMeta("twitter:description", ogDescription || description);
    setMeta("twitter:image", ogImage || DEFAULT_OG_IMAGE);

    // Canonical URL — use ogUrl if provided, otherwise derive from current path
    const canonical = ogUrl || `https://mechanicalenterprise.com${window.location.pathname}`;
    setCanonical(canonical);
  }, [title, description, ogTitle, ogDescription, ogUrl, ogImage]);
}
