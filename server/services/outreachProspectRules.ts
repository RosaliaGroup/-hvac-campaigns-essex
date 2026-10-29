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

/**
 * Public bodies and schools buy HVAC work through public bidding (NJ Local Public Contracts
 * Law / Public School Contracts Law), so cold outreach to them is not pursued. Matches by
 * email domain (.gov, .k12.nj.us, .nj.us, .edu, state/municipal domains) or organization name.
 */
const PUBLIC_DOMAIN = /@(?:[a-z0-9-]+\.)*(?:[a-z0-9-]+\.gov|k12\.[a-z]{2}\.us|[a-z]{2}\.us|edu)$/i;
const PUBLIC_NAME = /\b(board of education|school district|public schools?|regional schools?|school|schools|academy|college|university|community college|county college|township of|borough of|city of|town of|village of|county of|county government|municipal|municipality|department of public works|public works|housing authority|redevelopment agency|improvement authority|utilities authority|sewerage authority|water authority|parking authority|port authority|state of new jersey|nj transit|fire district|library)\b/i;
export function isPublicBidEntity(input: { company?: string | null; email?: string | null; title?: string | null }): boolean {
  const email = (input.email ?? "").trim().toLowerCase();
  if (PUBLIC_DOMAIN.test(email)) return true;
  return PUBLIC_NAME.test(`${input.company ?? ""}`);
}

export function isExcludedProspect(input: { name: string; company: string; email: string }): boolean {
  if (isPublicBidEntity(input)) return true;
  const combined = `${input.name} ${input.company} ${input.email}`.toLowerCase();
  // Permanent exclusions (by person, company or domain). Onyx Equities stays blocked until removed here.
  return /gabriel[\s._-]*(?:lopes|lopez)|\bgiga\b|thomas[\s._-]*visaggio|\bviza\b|@onyxequities\.com\b|\bonyx[\s._-]*equities\b|dennis[\s._-]*mcconnell|\bdmcconnell@|jhana[\s._-]*silva|carriage[\s._-]*club/.test(combined)
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
