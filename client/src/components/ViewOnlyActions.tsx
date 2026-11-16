import { useEffect, type RefObject } from "react";

/**
 * Read-only users (teamRole "viewer") can open pages but every change is
 * refused by the server (server/_core/trpc.ts). This hides the controls that
 * would try to change something, so the screen doesn't offer actions that can
 * only fail. It is presentation only, not the security boundary.
 *
 * A control is hidden when its label (text, aria-label or title) starts with an
 * action word, or when it is an icon-only edit/delete/send/add button. Tabs,
 * dropdowns, Refresh, History and links stay.
 */
const ACTION_WORDS =
  /^(send|delete|remove|edit|configure|recheck|import|opt[ -]?(out|in)|schedule|create|generate|ai generate|approve|reject|run|retry|revert|discard|connect|reconnect|disconnect|save|sync|upload|link|unlink|dismiss|publish|launch|pause|resume|enable|disable|apply|add|new|regenerate|update|submit|assign|mark|archive|restore|test|bulk|start|stop|cancel scheduled|duplicate)\b/i;
const ACTION_ICONS = /\blucide-(trash|trash-2|pencil|pen|pen-line|square-pen|send|upload|plus|settings|sparkles|wand|rotate-ccw|play|pause|power|link|unlink|archive)\b/;
const KEEP = /^(refresh|history|show|open|view|close|back|next|previous|more|less|details)\b/i;

function labelOf(el: HTMLElement): string {
  return (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
}

export function isActionControl(el: HTMLElement): boolean {
  if (el.closest('[role="tablist"]') || el.getAttribute("role") === "tab" || el.getAttribute("role") === "combobox") return false;
  if (el.tagName === "A" && !el.getAttribute("role")) return false; // plain links (Open Meta Ads, etc.)
  if (el instanceof HTMLInputElement && el.type === "checkbox") return true; // row selection for bulk sends
  if (el.getAttribute("role") === "checkbox") return true;
  const label = labelOf(el);
  if (label && KEEP.test(label)) return false;
  if (label && ACTION_WORDS.test(label)) return true;
  const svg = el.querySelector("svg");
  return !label && !!svg && ACTION_ICONS.test(svg.getAttribute("class") || "");
}

function hideIn(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('button, [role="button"], [role="checkbox"], input[type="checkbox"], a[role="button"]').forEach((el) => {
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
