import { useEffect } from "react";
import { useLocation } from "wouter";
import { isInternalRoute } from "@/lib/navigation";

/**
 * PR-1 item G/B: the "ME CRM" apple-mobile-web-app-* meta tags are a CRM-only
 * concern (they only affect the "Add to Home Screen" install experience for the
 * CRM PWA — see the install comment that used to sit next to them in
 * client/index.html). They previously shipped statically on every public
 * marketing page too, which is pointless (visitors never install the CRM). This
 * hook adds them only while `isInternalRoute(location)` is true and removes them
 * the moment navigation leaves the CRM. `manifest.webmanifest`, `theme-color`,
 * and `apple-touch-icon` stay in client/index.html unchanged — they're not what
 * item G asked to move, and manifest/icon churn on every route change risks iOS
 * "Add to Home Screen" caching oddities for no requested benefit.
 *
 * The X-Robots-Tag HTTP header (netlify.toml) is the primary noindex signal for
 * internal routes; this is the client-side belt-and-braces meta tag alongside it.
 */

const PWA_META: Array<{ name: string; content: string }> = [
  { name: "apple-mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
  { name: "apple-mobile-web-app-title", content: "ME CRM" },
];
const ROBOTS_NOINDEX = "noindex,nofollow";

function upsertMeta(name: string, content: string): HTMLMetaElement {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

function removeMeta(name: string) {
  document.querySelector(`meta[name="${name}"]`)?.remove();
}

export function useCrmMeta() {
  const [location] = useLocation();

  useEffect(() => {
    const internal = isInternalRoute(location);

    if (internal) {
      for (const m of PWA_META) upsertMeta(m.name, m.content);
      upsertMeta("robots", ROBOTS_NOINDEX);
    } else {
      for (const m of PWA_META) removeMeta(m.name);
      removeMeta("robots");
    }
  }, [location]);
}
