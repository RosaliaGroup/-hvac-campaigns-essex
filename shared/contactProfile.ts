export type ProfileFact = { value: string; source: string; evidence: string };
export type ContactProfile = {
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
  checkedAt: string;
  status: "matched" | "not_found" | "unavailable";
  message?: string;
};
