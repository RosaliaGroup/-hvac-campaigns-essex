/**
 * UTM tagging (docs/social-lane-spec.md §3): every post's link carries
 * `utm_campaign=social_{platform}` so the daily report can attribute clicks
 * and leads. `utm_source`/`utm_medium` are fixed; `utm_campaign` is the one
 * the spec calls out explicitly.
 */
export function socialUtmCampaign(platform: string): string {
  return `social_${platform}`;
}

/** Append the Social Lane's UTM params to a URL, preserving any existing query string. */
export function withSocialUtm(url: string, platform: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "social");
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", socialUtmCampaign(platform));
  return u.toString();
}
