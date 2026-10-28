import type { InlineLeadVariant } from "@/components/InlineLeadCapture";

/**
 * Pick the intent-aware lead-capture variant for a blog post.
 *
 * Commercial/multifamily posts must use the commercial intake (paid service,
 * maintenance and replacement review), never the residential rebate card.
 * The post category is checked first because many commercial slugs
 * (cooling towers, closed-loop pumps, chillers) carry no "commercial" keyword.
 */
const COMMERCIAL_CATEGORY = /(commercial|multifamily|property manag|facilit)/i;
const COMMERCIAL_SLUG =
  /(commercial|multifamily|rooftop|rtu|vrv|vrf|ptac|property-managers|property-management|condo|cooling-tower|chiller|boiler|closed-loop|pump-rotation|circulator|building-owner|facility|facilities|tenant|landlord)/;

export function pickBlogVariant(slug: string, category?: string): InlineLeadVariant {
  const s = slug.toLowerCase();
  if ((category && COMMERCIAL_CATEGORY.test(category)) || COMMERCIAL_SLUG.test(s)) return "commercial";
  if (/(emergency|repair|no-heat)/.test(s)) return "emergency";
  if (/(rebate|financing)/.test(s)) return "rebate";
  return "residential";
}

export function isCommercialVariant(variant: InlineLeadVariant): boolean {
  return variant === "commercial";
}
