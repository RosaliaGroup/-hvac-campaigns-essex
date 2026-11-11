/** Social profile links for the Contacts list column (person first, then company). */
export type SocialLink = { platform: string; url: string; company: boolean };

type ProfileLike = {
  social?: Array<{ platform?: string; url?: string }> | null;
  companySocial?: Array<{ platform?: string; url?: string }> | null;
} | null | undefined;

export function socialLinksFromProfiles(profiles: ProfileLike[]): SocialLink[] {
  const seen = new Set<string>();
  const out: SocialLink[] = [];
  const add = (items: Array<{ platform?: string; url?: string }> | null | undefined, company: boolean) => {
    for (const s of items ?? []) {
      const url = (s?.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) continue;
      const key = url.replace(/\/+$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ platform: (s?.platform ?? "").trim() || "Profile", url, company });
    }
  };
  for (const p of profiles) add(p?.social, false);
  for (const p of profiles) add(p?.companySocial, true);
  return out;
}

/** Short label for a link chip: "LinkedIn", "Facebook (company)". */
export function socialLinkLabel(l: SocialLink): string {
  return l.company ? `${l.platform} (company)` : l.platform;
}
