import { useEffect } from "react";

type SEOProps = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
};

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

export function useSEO({ title, description, ogTitle, ogDescription, ogUrl }: SEOProps) {
  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("geo.region", "US-NJ");
    setMeta("geo.placename", "Newark, New Jersey");
    setMeta("og:title", ogTitle || title, "property");
    setMeta("og:description", ogDescription || description, "property");
    if (ogUrl) setMeta("og:url", ogUrl, "property");
    setMeta("og:type", "website", "property");
    setMeta("twitter:title", ogTitle || title);
    setMeta("twitter:description", ogDescription || description);

    // Canonical URL — use ogUrl if provided, otherwise derive from current path
    const canonical = ogUrl || `https://mechanicalenterprise.com${window.location.pathname}`;
    setCanonical(canonical);
  }, [title, description, ogTitle, ogDescription, ogUrl]);
}
