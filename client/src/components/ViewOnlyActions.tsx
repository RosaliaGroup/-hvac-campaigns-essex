import { useEffect, type RefObject } from "react";

/**
 * Read-only users (teamRole "viewer") can open pages but every change is
 * refused by the server (server/_core/trpc.ts). This hides the controls that
 * would try to change something, so the screen doesn't offer actions that can
 * only fail. It is presentation only, not the security boundary.
 *
 * Hidden for viewers (audited page by page as a marketing-only viewer):
 * - buttons whose label starts with an action word, icon-only edit/delete/send/
 *   add buttons, row checkboxes;
 * - every text box (message, reply and note fields);
 * - links and "Open …" buttons that leave the CRM for a live account (Meta,
 *   Google, Telnyx, GitHub, Search Console);
 * - action dropdowns (Dismiss…).
 * Tabs, filters, search, Refresh, History, Preview, Copy and links to our own
 * site stay.
 */
const ACTION_WORDS =
  /^(send|delete|remove|edit|configure|recheck|import|opt[ -]?(out|in)|schedule|create|generate|ai generate|approve|reject|run|retry|revert|discard|connect|reconnect|disconnect|save|sync|upload|link|unlink|dismiss|publish|launch|pause|resume|enable|disable|apply|add|new|regenerate|update|submit|assign|mark|archive|restore|test|bulk|start|stop|cancel scheduled|duplicate|activate|optimize|select drafted|select all|api settings|refresh data|open|day \d+)\b/i;
const ACTION_ICONS = /\blucide-(trash|trash-2|pencil|pen|pen-line|square-pen|send|upload|plus|settings|sparkles|wand|rotate-ccw|play|pause|power|link|unlink|archive|external-link)\b/;
const KEEP = /^(refresh|history|show|view|close|back|next|previous|more|less|details|preview|copy)\b/i;
const ALWAYS = /^(refresh data|open)\b/i; // checked before KEEP
const OWN_SITE = /(^|\.)mechanicalenterprise\.com$/i;

function labelOf(el: HTMLElement): string {
  return (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
}

function isExternalLink(el: HTMLElement): boolean {
  if (el.tagName !== "A") return false;
  const href = el.getAttribute("href") || "";
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).hostname;
    return host !== window.location.hostname && !OWN_SITE.test(host);
  } catch {
    return true;
  }
}

export function isActionControl(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "TEXTAREA" || el.getAttribute("contenteditable") === "true") return true;
  if (tag === "SELECT") return Array.from((el as HTMLSelectElement).options).some((o) => /^dismiss/i.test(o.text.trim()));
  if (tag === "A" && !el.getAttribute("role")) return isExternalLink(el);
  if (el.closest('[role="tablist"]') || el.getAttribute("role") === "tab" || el.getAttribute("role") === "combobox") return false;
  if (el instanceof HTMLInputElement && el.type === "checkbox") return true; // row selection for bulk sends
  if (el.getAttribute("role") === "checkbox" || el.getAttribute("role") === "switch") return true;
  const label = labelOf(el);
  if (label && ALWAYS.test(label)) return true;
  if (label && KEEP.test(label)) return false;
  if (label && ACTION_WORDS.test(label)) return true;
  const svg = el.querySelector("svg");
  return !label && !!svg && ACTION_ICONS.test(svg.getAttribute("class") || "");
}

function hideIn(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('button, [role="button"], [role="checkbox"], [role="switch"], input[type="checkbox"], a[href], textarea, select, [contenteditable="true"]').forEach((el) => {
    // Re-checked on every change: a label can turn into "Send" after loading.
    if (isActionControl(el)) el.style.setProperty("display", "none", "important");
  });
}

export function useHideActionsForViewers(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!enabled || !root) return;
    hideIn(root);
    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; hideIn(root); });
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [ref, enabled]);
}
