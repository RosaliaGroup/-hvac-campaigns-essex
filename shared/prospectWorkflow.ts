import { isVerifiedProspect } from "../server/services/outreachProspectRules";
export type ResearchedProspect = {
  name: string;
  title: string;
  company: string;
  email: string;
  verificationUrl: string;
  evidence: string;
  reason: string;
  phone?: string;
};
export function prospectHour(now: Date): string | null {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map(p => [p.type, p.value])
  );
  const hour = Number(parts.hour);
  return hour >= 9 && hour < 17
    ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`
    : null;
}
export function verifiedCandidates(
  raw: unknown,
  citations: string[]
): ResearchedProspect[] {
  if (!Array.isArray(raw)) return [];
  const sources = new Set(citations);
  const emails = new Set<string>(),
    companies = new Set<string>();
  return raw
    .filter((p): p is ResearchedProspect => {
      if (
        !p ||
        ![
          "name",
          "title",
          "company",
          "email",
          "verificationUrl",
          "evidence",
          "reason",
        ].every(
          k => typeof p[k] === "string" && p[k].trim() && p[k].length <= 2000
        )
      )
        return false;
      if (
        p.name.length > 255 ||
        p.title.length > 255 ||
        p.company.length > 255 ||
        p.email.length > 320
      )
        return false;
      const email = p.email.trim().toLowerCase(),
        company = p.company.trim().toLowerCase();
      if (
        !isVerifiedProspect(p) ||
        !sources.has(p.verificationUrl) ||
        !p.evidence.toLowerCase().includes(email) ||
        !p.evidence.toLowerCase().includes(p.name.trim().toLowerCase()) ||
        emails.has(email) ||
        companies.has(company)
      )
        return false;
      emails.add(email);
      companies.add(company);
      return true;
    })
    .slice(0, 10);
}
export function introduction(
  p: Pick<ResearchedProspect, "name" | "company" | "title">
) {
  return `Hi ${p.name.split(" ")[0]},\n\nI’m Ana, President of Mechanical Enterprise. I’m reaching out to introduce our HVAC team as a potential service partner for ${p.company}. We support property owners and managers across New York and New Jersey with HVAC service, preventive maintenance, installations, and replacements.\n\nWould you be the right person to discuss your HVAC needs, or could you point me to whoever oversees them?\n\nAna Haynes\nPresident | Mechanical Enterprise LLC\nsales@mechanicalenterprise.com | 862-423-9396\nCertified SBE | SEBD | WMBE\nIf you prefer no further outreach, reply and I’ll remove you from our list.`;
}
