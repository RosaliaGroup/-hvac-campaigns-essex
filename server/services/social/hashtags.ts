/**
 * Hashtag allow-list + selection (docs/social-lane-spec.md §3): at most 5
 * hashtags per post, drawn only from this owner-editable allow-list — never
 * model-invented tags.
 */
export const HASHTAG_ALLOWLIST = [
  "#HVAC", "#HeatPump", "#NJHVAC", "#HomeComfort", "#EnergyEfficiency",
  "#CentralAir", "#Furnace", "#IndoorAirQuality", "#NewJersey", "#HomeMaintenance",
  "#Heating", "#Cooling", "#Ductless", "#CommercialHVAC", "#PropertyManagement",
] as const;

export const MAX_HASHTAGS = 5;

const TOPIC_TAGS: Record<string, readonly string[]> = {
  heat_pump: ["#HeatPump", "#EnergyEfficiency", "#NJHVAC"],
  membership: ["#HomeMaintenance", "#HVAC", "#HomeComfort"],
  seasonal: ["#Heating", "#Cooling", "#HomeMaintenance"],
  commercial: ["#CommercialHVAC", "#PropertyManagement", "#HVAC"],
  review: ["#HomeComfort", "#HVAC"],
  general: ["#HVAC", "#NJHVAC", "#HomeComfort"],
};

/** Pick up to MAX_HASHTAGS from the allow-list for a topic; always allow-list-only. */
export function pickHashtags(topic: keyof typeof TOPIC_TAGS | string, extra: string[] = []): string[] {
  const base = TOPIC_TAGS[topic] ?? TOPIC_TAGS.general;
  const allowSet = new Set<string>(HASHTAG_ALLOWLIST);
  const picked = [...base, ...extra].filter((t) => allowSet.has(t));
  return Array.from(new Set(picked)).slice(0, MAX_HASHTAGS);
}
