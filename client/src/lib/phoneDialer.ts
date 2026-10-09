/** Parse a saved CRM number for a device dialer. Never append extension digits
 * to the telephone number: doing so could dial the wrong recipient.
 */
export type DialablePhone = { tel: string; extension: string | null };
export function parseDialablePhone(value: string | null | undefined): DialablePhone | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const ext = /(?:\s*(?:ext(?:ension)?\.?|x|#)\s*|;ext=)(\d{1,6})\s*$/i.exec(raw);
  const base = ext ? raw.slice(0, ext.index).trim() : raw;
  if (!base || !/^\+?[\d\s().-]+$/.test(base)) return null;
  const digits = base.replace(/\D/g, "");
  const tel = digits.length === 10 ? digits
    : digits.length === 11 && digits.startsWith("1") ? "+" + digits
    : base.startsWith("+") && digits.length >= 8 && digits.length <= 15 ? "+" + digits
    : null;
  return tel ? { tel, extension: ext?.[1] ?? null } : null;
}
