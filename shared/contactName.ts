/** Names come from verified intake/research, never from splitting an email address. */
export function splitContactPersonName(value?: string | null, company?: string | null) {
  const name = value?.trim().replace(/\s+/g, " ");
  if (!name || name.includes("@") || /\d|[<>:/]/.test(name) ||
      name.toLowerCase() === company?.trim().toLowerCase() ||
      /\b(llc|inc|corp|company|group|realty|properties|management|department|team|office|support|sales|unknown|unnamed)\b/i.test(name)) return null;
  const parts = name.split(" ");
  if (parts.length < 2 || parts.length > 7 || !parts.every(p => new RegExp("^[\\p{L}][\\p{L}.'’\\-]*$", "u").test(p))) return null;
  return {firstName:parts.slice(0,-1).join(" "),lastName:parts.at(-1)!};
}
export function contactDisplayName(c: { firstName?:string|null;lastName?:string|null;companyName?:string|null;email?:string|null;phone?:string|null }) {
  const name=[c.firstName?.trim(),c.lastName?.trim()].filter(Boolean).join(" ");
  return name || c.companyName?.trim() || c.email?.trim() || c.phone?.trim() || "Unnamed Customer";
}
