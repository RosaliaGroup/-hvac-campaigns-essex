import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget (Layer 3). Loads the challenge script once and
 * renders an explicit widget so it behaves correctly across SPA route changes.
 *
 * The sitekey comes from `VITE_TURNSTILE_SITEKEY` (injected at build time from
 * Netlify's build env). If it is unset, the widget silently does not render and
 * the form still submits — the server treats a missing token as "unverified"
 * and falls back to the Layer-1 content guard, so nothing breaks in dev.
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface TurnstileProps {
  /** Fired with the token when the challenge is solved. */
  onVerify: (token: string) => void;
  /** Fired when the token expires or errors — clear any stored token. */
  onExpire?: () => void;
  className?: string;
}

export default function Turnstile({ onVerify, onExpire, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Keep the latest callbacks without forcing a re-render of the widget.
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!SITE_KEY) {
      console.warn("[turnstile] VITE_TURNSTILE_SITEKEY not set — widget not rendered");
      return;
    }
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => onExpireRef.current?.(),
        });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
      }
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
