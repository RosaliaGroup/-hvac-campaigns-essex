/**
 * Internal SMS navigation helpers.
 *
 * Mechanical Enterprise NEVER hands SMS off to the operating system's
 * messaging app. There is no `sms:` / `tel:` protocol handler, no
 * `navigator.share`, no `window.open("sms:…")`. Every text is authored and
 * sent inside the internal Communications module (the SMS Inbox at
 * `/sms-campaigns`) and delivered over the existing Telnyx backend.
 *
 * These helpers produce the INTERNAL route to a conversation so the Lead /
 * Customer cards can open the in-app thread instead of the OS messenger.
 */

/** Digits-only last-10 of a phone (client mirror of the server normalization). */
export function phoneLast10(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

/** True when a phone has enough digits to identify a conversation (last-10). */
export function isDialablePhone(phone: string | null | undefined): boolean {
  return phoneLast10(phone).length === 10;
}

/**
 * Internal in-app route to the Mechanical Enterprise SMS conversation for a
 * phone number. Opening this path lands the user in the Communications Inbox
 * with the matching thread selected (or a fresh internal thread + composer
 * when the number has no history yet). It is NEVER an `sms:` link.
 */
export function internalSmsConversationPath(phone: string | null | undefined): string {
  const p = (phone ?? "").trim();
  return p ? `/sms-campaigns?phone=${encodeURIComponent(p)}` : "/sms-campaigns";
}

/**
 * Decide what a deep-link into the inbox should open for `phone`:
 *  - `existing` → reuse the already-loaded conversation thread (by last-10),
 *  - `new`      → no history yet, synthesize a draft thread + composer,
 *  - `null`     → the phone isn't dialable, do nothing.
 * Pure so the reuse-vs-create rule is unit-testable without React/tRPC.
 */
export function resolveConversationTarget<T extends { key: string; phone: string }>(
  conversations: T[],
  phone: string | null | undefined,
): { kind: "existing"; key: string } | { kind: "new"; phoneLast10: string } | null {
  if (!isDialablePhone(phone)) return null;
  const target = phoneLast10(phone);
  const match = conversations.find((c) => phoneLast10(c.phone) === target);
  return match ? { kind: "existing", key: match.key } : { kind: "new", phoneLast10: target };
}
