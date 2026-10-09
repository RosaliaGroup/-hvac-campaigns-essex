/** Publicly listed BUSINESS phone numbers for previously emailed Mechanical Enterprise prospects.
 * Only update matching existing CRM contacts with empty phone fields.
 * Do not infer SMS consent from any entry (including publicly listed cell numbers).
 * Provenance and office extension are retained here for audit/research.
 */
export type VerifiedProspectPhone = {
  email: string; phone: string; type: string; sourceUrl: string;
};
export const VERIFIED_PROSPECT_PHONES: readonly VerifiedProspectPhone[] = [
  {
    "email": "rbowlby@ramapo.edu",
    "phone": "2016847331",
    "type": "direct office",
    "sourceUrl": "https://www.ramapo.edu/facilities/facilities-contacts/"
  },
  {
    "email": "dzappala@ripconj.com",
    "phone": "2017772312",
    "type": "listed business",
    "sourceUrl": "https://www.ripcony.com/brokers/daniel-zappala/"
  },
  {
    "email": "anil@fncusa.com",
    "phone": "2014015100",
    "type": "business",
    "sourceUrl": "https://www.fncusa.com/company/team/"
  },
  {
    "email": "rebecca.crespo@njefa.nj.gov",
    "phone": "6099870880",
    "type": "agency office",
    "sourceUrl": "https://www.nj.gov/njefa/contact/"
  },
  {
    "email": "sanjeannetta.worley@njit.edu",
    "phone": "9735963692",
    "type": "listed office",
    "sourceUrl": "https://people.njit.edu/profile/worley"
  },
  {
    "email": "leonard.hughley@rutgers.edu",
    "phone": "9733533716",
    "type": "direct office",
    "sourceUrl": "https://rutgersnewarkathletics.com/staff-directory"
  },
  {
    "email": "ahincapie@elizabethnj.org",
    "phone": "9088204105",
    "type": "direct office",
    "sourceUrl": "https://www.elizabethnj.org/573/Public-Buildings"
  },
  {
    "email": "brandony@montclair.edu",
    "phone": "9736557846",
    "type": "direct office",
    "sourceUrl": "https://www.montclair.edu/profilepages/view_profile.php?username=brandony"
  },
  {
    "email": "adham.ebid@wrdc.net",
    "phone": "2014449050",
    "type": "direct business",
    "sourceUrl": "https://www.fashioncenterparamusnj.com/contact/"
  },
  {
    "email": "phyllis@youngandassoc.com",
    "phone": "2018324875",
    "type": "listed business",
    "sourceUrl": "https://youngrealtorsnj.com/about"
  },
  {
    "email": "drasmusson@crownpointgroup.com",
    "phone": "9736715800",
    "type": "company office",
    "sourceUrl": "https://crownpointgroup.com/meet-our-team/"
  },
  {
    "email": "mlee@tulfra.com",
    "phone": "2015434195",
    "type": "listed business",
    "sourceUrl": "https://www.showcase.com/p/marcus-lee/36605441/"
  },
  {
    "email": "elizabeth.collins@eastorange-nj.gov",
    "phone": "9732665330",
    "type": "department office",
    "sourceUrl": "https://www.eastorange-nj.gov/272/Public-Works"
  },
  {
    "email": "rtheofield@hobokennj.gov",
    "phone": "2014202000",
    "type": "office x1503",
    "sourceUrl": "https://www.hobokennj.gov/departments/parks-rec"
  },
  {
    "email": "jlatore@westorange.org",
    "phone": "9733254067",
    "type": "department office",
    "sourceUrl": "https://westorange.org/67/Public-Works"
  },
  {
    "email": "fjpascucci@essexcountynj.org",
    "phone": "9732268500",
    "type": "office x2340",
    "sourceUrl": "https://www.ecdpw.org/division_of_buildings_and_grounds.php"
  },
  {
    "email": "jfeaster@bergencountynj.gov",
    "phone": "2013366837",
    "type": "department office",
    "sourceUrl": "https://bergencountynj.gov/bergen-county-department-of-public-works/general-services/"
  },
  {
    "email": "vjaynilian@heidenbergproperties.com",
    "phone": "2017681300",
    "type": "office x36",
    "sourceUrl": "https://www.heidenbergproperties.com/contact-2/"
  },
  {
    "email": "sjennings@sanzari.com",
    "phone": "2013422777",
    "type": "company office",
    "sourceUrl": "https://sanzari.com/contact/"
  },
  {
    "email": "lplumstead@oldemillinn.com",
    "phone": "9086962351",
    "type": "listed business",
    "sourceUrl": "https://bernardsvillecentre.com/about-us/"
  },
  {
    "email": "rickm@passaiccountynj.org",
    "phone": "9738814425",
    "type": "direct office",
    "sourceUrl": "https://www.passaiccountynj.org/departments"
  }
];
