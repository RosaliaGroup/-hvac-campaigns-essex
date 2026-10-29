export type ProfileFact = { value: string; source: string; evidence: string };
export type ContactProfile = {
  person?: { firstName: ProfileFact; lastName: ProfileFact };
  /** Published business phone, formatted (NNN) NNN-NNNN, with its cited source. Never implies SMS consent. */
  phone?: ProfileFact;
  company: {
    name?: ProfileFact;
    website?: ProfileFact;
    industry?: ProfileFact;
    location?: ProfileFact;
    description?: ProfileFact;
  };
  social: Array<{
    platform: string;
    url: string;
    source: string;
    evidence: string;
  }>;
  companySocial?: Array<{ platform: string; url: string; source: string; evidence: string }>;
  checkedAt: string;
  status: "matched" | "not_found" | "unavailable";
  message?: string;
};
