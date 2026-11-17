import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Proof of work for team members: once a minute, if the person actually used
 * the CRM in the last 2 minutes (mouse, keys, scroll, touch) and the tab is
 * visible, record one "active minute" in the Daily Hub. Clocked-in time with
 * no activity shows up as idle in the owner's clock-out email.
 */
export function useActivityPing(enabled: boolean, page: string) {
  const utils = trpc.useUtils();
  const lastInput = useRef(0);
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    if (!enabled) return;
    const mark = () => { lastInput.current = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }));
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInput.current > 120_000) return;
      utils.client.teamHub.ping.query({ page: pageRef.current.slice(0, 80) }).catch(() => {});
    }, 60_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
      window.clearInterval(t);
    };
  }, [enabled, utils]);
}
