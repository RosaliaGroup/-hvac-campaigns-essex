export type CityEntry = { city: string; slug: string };

export const NJ_COUNTIES: Record<string, CityEntry[]> = {
  "Essex": [
    { city: "Newark", slug: "newark" },
    { city: "East Orange", slug: "east-orange" },
    { city: "Irvington", slug: "irvington" },
    { city: "Bloomfield", slug: "bloomfield" },
    { city: "Montclair", slug: "montclair" },
    { city: "West Orange", slug: "west-orange" },
    { city: "Maplewood", slug: "maplewood" },
    { city: "Livingston", slug: "livingston" },
    { city: "Millburn", slug: "millburn" },
    { city: "South Orange", slug: "south-orange" },
    { city: "Orange", slug: "orange" },
    { city: "West Caldwell", slug: "west-caldwell" },
    { city: "Belleville", slug: "belleville" },
    { city: "Nutley", slug: "nutley" },
    { city: "Hillside", slug: "hillside" },
    { city: "Short Hills", slug: "short-hills" },
  ],
  "Hudson": [
    { city: "Jersey City", slug: "jersey-city" },
    { city: "Hoboken", slug: "hoboken" },
    { city: "Union City", slug: "union-city" },
    { city: "Bayonne", slug: "bayonne" },
    { city: "North Bergen", slug: "north-bergen" },
    { city: "West New York", slug: "west-new-york" },
    { city: "Guttenberg", slug: "guttenberg" },
    { city: "Weehawken", slug: "weehawken" },
    { city: "Secaucus", slug: "secaucus" },
    { city: "Kearny", slug: "kearny" },
    { city: "Harrison", slug: "harrison" },
  ],
  "Bergen": [
    { city: "Hackensack", slug: "hackensack" },
    { city: "Englewood", slug: "englewood" },
    { city: "Fort Lee", slug: "fort-lee" },
    { city: "Teaneck", slug: "teaneck" },
    { city: "Garfield", slug: "garfield" },
    { city: "Cliffside Park", slug: "cliffside-park" },
    { city: "Edgewater", slug: "edgewater" },
    { city: "Palisades Park", slug: "palisades-park" },
    { city: "Ridgefield", slug: "ridgefield" },
    { city: "Fairview", slug: "fairview" },
    { city: "Alpine", slug: "alpine" },
    { city: "Saddle River", slug: "saddle-river" },
    { city: "Franklin Lakes", slug: "franklin-lakes" },
    { city: "Wyckoff", slug: "wyckoff" },
  ],
  "Passaic": [
    { city: "Clifton", slug: "clifton" },
    { city: "Passaic", slug: "passaic" },
    { city: "Wayne", slug: "wayne" },
    { city: "Hawthorne", slug: "hawthorne" },
    { city: "Pompton Lakes", slug: "pompton-lakes" },
    { city: "Wanaque", slug: "wanaque" },
    { city: "Woodland Park", slug: "woodland-park" },
    { city: "Totowa", slug: "totowa" },
    { city: "Little Falls", slug: "little-falls" },
    { city: "West Milford", slug: "west-milford" },
  ],
  "Union": [
    { city: "Elizabeth", slug: "elizabeth" },
    { city: "Westfield", slug: "westfield" },
    { city: "Summit", slug: "summit" },
    { city: "Union", slug: "union" },
    { city: "Linden", slug: "linden" },
    { city: "Rahway", slug: "rahway" },
    { city: "Cranford", slug: "cranford" },
    { city: "Roselle", slug: "roselle" },
    { city: "Roselle Park", slug: "roselle-park" },
    { city: "Springfield", slug: "springfield" },
    { city: "Clark", slug: "clark" },
    { city: "New Providence", slug: "new-providence" },
  ],
  "Middlesex": [
    { city: "Woodbridge", slug: "woodbridge" },
  ],
  "Morris": [
    { city: "Morristown", slug: "morristown" },
    { city: "Madison", slug: "madison" },
    { city: "Chatham", slug: "chatham" },
    { city: "Parsippany", slug: "parsippany" },
    { city: "Randolph", slug: "randolph" },
    { city: "Dover", slug: "dover" },
    { city: "Rockaway", slug: "rockaway" },
    { city: "Denville", slug: "denville" },
    { city: "Roxbury", slug: "roxbury" },
    { city: "Mount Olive", slug: "mount-olive" },
    { city: "Boonton", slug: "boonton" },
    { city: "Butler", slug: "butler" },
    { city: "Mendham", slug: "mendham" },
    { city: "Chester", slug: "chester" },
    { city: "Harding", slug: "harding" },
    { city: "Mountain Lakes", slug: "mountain-lakes" },
  ],
  "Sussex": [
    { city: "Newton", slug: "newton" },
    { city: "Sparta", slug: "sparta" },
    { city: "Hopatcong", slug: "hopatcong" },
    { city: "Sussex", slug: "sussex" },
    { city: "Hardyston", slug: "hardyston" },
  ],
  "Somerset": [
    { city: "Bernardsville", slug: "bernardsville" },
    { city: "Bedminster", slug: "bedminster" },
    { city: "Peapack-Gladstone", slug: "peapack" },
  ],
};

/** All cities flattened */
export const ALL_CITIES: CityEntry[] = Object.values(NJ_COUNTIES).flat();

/** Simple deterministic hash for a string → number */
export function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick N deterministic items from a list, excluding a slug */
export function pickDeterministic<T extends { slug: string }>(
  items: T[],
  slug: string,
  count: number,
): T[] {
  const filtered = items.filter((c) => c.slug !== slug);
  if (filtered.length <= count) return filtered;
  const h = hashSlug(slug);
  const start = h % filtered.length;
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(filtered[(start + i) % filtered.length]);
  }
  return result;
}

/** Get county for a given city slug */
export function getCountyForSlug(slug: string): string | null {
  for (const [county, cities] of Object.entries(NJ_COUNTIES)) {
    if (cities.some((c) => c.slug === slug)) return county;
  }
  return null;
}

/** Get nearby cities (same county, excluding self), deterministic pick of N */
export function getNearbyCities(slug: string, count: number): CityEntry[] {
  const county = getCountyForSlug(slug);
  if (!county) return pickDeterministic(ALL_CITIES, slug, count);
  const sameCo = NJ_COUNTIES[county];
  if (sameCo.length - 1 >= count) {
    return pickDeterministic(sameCo, slug, count);
  }
  // Supplement with cities from other counties
  const result = sameCo.filter((c) => c.slug !== slug);
  const remaining = count - result.length;
  const otherCities = ALL_CITIES.filter(
    (c) => c.slug !== slug && !result.some((r) => r.slug === c.slug),
  );
  const h = hashSlug(slug);
  const start = h % otherCities.length;
  for (let i = 0; i < remaining && i < otherCities.length; i++) {
    result.push(otherCities[(start + i) % otherCities.length]);
  }
  return result;
}
