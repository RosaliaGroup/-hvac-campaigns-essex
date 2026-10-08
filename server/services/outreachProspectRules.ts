/**
 * Normalization and eligibility rules for Mechanical Enterprise outbound CRM contacts.
 * Pure functions: safe to use in imports, campaign queues and historical backfills.
 * No message is sent by this module.
 */
export const OUTREACH_CATEGORIES = [
  "Property Manager", "HOA/Community Manager", "Facilities/Engineering",
  "Multifamily Owner/Operator", "Commercial Owner/Operator",
  "Broker/Agent", "Developer", "Other Property Decision-Maker",
] as const;
export type OutreachCategory = typeof OUTREACH_CATEGORIES[number];

const AUTOMATED_LOCAL_PART = /^(no-?reply|do-?not-?reply|notifications?|alerts?|newsletter|news|marketing|postmaster|mailer-daemon)([+._-]|$)/i;
const GENERIC_LOCAL_PART = /^(info|contact|hello|leasing|service|support|admin|office|sales|general|inquiries)([+._-]|$)/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeProspectEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function isDirectBusinessEmail(value: string): boolean {
  const email = normalizeProspectEmail(value);
  if (!email) return false;
  const [local] = email.split("@");
  return !AUTOMATED_LOCAL_PART.test(local) && !GENERIC_LOCAL_PART.test(local);
}

export function isExcludedProspect(input: { name: string; company: string; email: string }): boolean {
  const combined = `${input.name} ${input.company}`.toLowerCase();
  return /gabriel\s+lopez|giga\s+holdings/.test(combined)
    || !isDirectBusinessEmail(input.email);
}

export function categorizeProspect(title: string, company = ""): OutreachCategory {
  const role = `${title} ${company}`.toLowerCase();
  if (/hoa|community|condominium|condo|association manager/.test(role)) return "HOA/Community Manager";
  if (/facilit|engineer|maintenance|building manager|superintendent/.test(role)) return "Facilities/Engineering";
  if (/property manag|portfolio manag|asset manag/.test(role)) return "Property Manager";
  if (/develop|construction principal/.test(role)) return "Developer";
  if (/broker|realtor|real estate agent|leasing agent/.test(role)) return "Broker/Agent";
  if (/multifamily|apartment owner|residential portfolio/.test(role)) return "Multifamily Owner/Operator";
  if (/commercial|owner|operator|principal|president|ceo/.test(role)) return "Commercial Owner/Operator";
  return "Other Property Decision-Maker";
}

/** Every outbound lead requires a traceable public verification source. */
export function isVerifiedProspect(input: {
  name: string; title: string; company: string; email: string; verificationUrl: string;
}): boolean {
  if (!input.name.trim() || !input.title.trim() || !input.company.trim()) return false;
  if (isExcludedProspect(input)) return false;
  try {
    const url = new URL(input.verificationUrl);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}
