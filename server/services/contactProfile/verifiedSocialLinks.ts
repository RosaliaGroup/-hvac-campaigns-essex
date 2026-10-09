/** Public LinkedIn profiles independently verified against the existing Mechanical Enterprise Gmail recipient email and organization. 
 * These are NOT evidence of a LinkedIn follow, connection, consent, or outreach authorization.
 * Never infer a person's profile from their company's page.
 */
export type VerifiedSocialLink = {
  email: string; platform: "LinkedIn"; url: string; source: string; evidence: string; kind: "person"|"company";
};
export const VERIFIED_SOCIAL_LINKS: readonly VerifiedSocialLink[] = [
  {
    "email": "dzappala@ripconj.com",
    "platform": "LinkedIn",
    "url": "https://www.linkedin.com/in/daniel-zappala",
    "source": "https://www.linkedin.com/in/daniel-zappala",
    "evidence": "Daniel Zappala — RIPCO commercial property management",
    "kind": "person"
  },
  {
    "email": "rbowlby@ramapo.edu",
    "platform": "LinkedIn",
    "url": "https://www.linkedin.com/in/ryan-bowlby-72807757",
    "source": "https://www.linkedin.com/in/ryan-bowlby-72807757",
    "evidence": "Ryan Bowlby — Ramapo College of New Jersey",
    "kind": "person"
  },
  {
    "email": "sanjeannetta.worley@njit.edu",
    "platform": "LinkedIn",
    "url": "https://www.linkedin.com/in/sanjeannetta-worley",
    "source": "https://www.linkedin.com/in/sanjeannetta-worley",
    "evidence": "Sanjeannetta Worley — New Jersey Institute of Technology",
    "kind": "person"
  },
  {
    "email": "rebecca.crespo@njefa.nj.gov",
    "platform": "LinkedIn",
    "url": "https://www.linkedin.com/in/rebecca-clark-crespo-35612835",
    "source": "https://www.linkedin.com/in/rebecca-clark-crespo-35612835",
    "evidence": "Rebecca (Clark) Crespo — New Jersey Educational Facilities Authority",
    "kind": "person"
  },
  {
    "email": "mlee@tulfra.com",
    "platform": "LinkedIn",
    "url": "https://www.linkedin.com/in/marcus-lee-ccim-15345992",
    "source": "https://www.linkedin.com/in/marcus-lee-ccim-15345992",
    "evidence": "Marcus Lee, CCIM — Tulfra Real Estate",
    "kind": "person"
  },
  {
    "email": "anil@fncusa.com",
    "platform": "LinkedIn",
    "url": "https://www.linkedin.com/company/first-national-realty-management",
    "source": "https://www.linkedin.com/company/first-national-realty-management",
    "evidence": "First National Realty Management — company LinkedIn page",
    "kind": "company"
  }
];
