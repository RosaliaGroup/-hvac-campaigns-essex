/**
 * Lead-source channel grouping for the Lead Inbox source filter.
 *
 * The Lead Inbox used to show four large, non-interactive "channel" stat cards
 * (Google Ads / Facebook·IG / Website / Email·SMS). They are now compact,
 * clickable source filters. Each channel maps a set of raw `captureType` values
 * to one user-facing filter. Pure/serialisable so it can be unit-tested and
 * shared without pulling in React.
 */

export type LeadChannel = "all" | "google_ads" | "facebook" | "website" | "email_sms";

export type LeadChannelDef = {
  id: LeadChannel;
  label: string;
  /** Raw captureType values that belong to this channel ("all" matches every lead). */
  captureTypes: string[];
};

/** Ordered channel definitions (drives the filter chips left→right). */
export const LEAD_CHANNELS: LeadChannelDef[] = [
  { id: "all", label: "All Sources", captureTypes: [] },
  {
    id: "google_ads",
    label: "Google Ads",
    captureTypes: ["lp_heat_pump", "lp_commercial_vrv", "lp_emergency"],
  },
  {
    id: "facebook",
    label: "Facebook/IG",
    captureTypes: ["lp_fb_residential", "lp_fb_commercial", "meta_lead_ad"],
  },
  {
    id: "website",
    label: "Website",
    captureTypes: [
      "exit_popup",
      "inline_form",
      "quick_quote",
      "exit_popup_residential",
      "exit_popup_commercial",
      "scroll_popup_residential",
      "scroll_popup_commercial",
    ],
  },
  {
    id: "email_sms",
    label: "Email/SMS",
    captureTypes: ["lp_rebate_guide", "lp_maintenance", "newsletter", "download_gate"],
  },
];

const BY_ID: Record<LeadChannel, LeadChannelDef> = Object.fromEntries(
  LEAD_CHANNELS.map((c) => [c.id, c])
) as Record<LeadChannel, LeadChannelDef>;

/** Does a lead's captureType belong to the given channel? "all" matches everything. */
export function matchesChannel(captureType: string | null | undefined, channel: LeadChannel): boolean {
  if (channel === "all") return true;
  const def = BY_ID[channel];
  if (!def) return false;
  return def.captureTypes.includes(captureType ?? "");
}

/** Filter a list of leads (anything with a `captureType`) by channel. */
export function filterLeadsByChannel<T extends { captureType?: string | null }>(
  leads: T[],
  channel: LeadChannel
): T[] {
  if (channel === "all") return leads;
  return leads.filter((l) => matchesChannel(l.captureType, channel));
}
