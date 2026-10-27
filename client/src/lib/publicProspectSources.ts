/** Public directories for human-verified North Jersey B2B prospect research.
 * Discovery links are not consent, contact verification, or permission to send.
 * No scraping, paid-data providers, email guessing or outbound sending.
 */
export const publicProspectSources = [
  {
    id: "cainj",
    name: "CAI-NJ — Community Management Companies",
    url: "https://cainj.org/online-service-directory/",
    audience: "Condo boards and property managers",
    note: "Find named community management professionals; verify each contact against their current company site.",
  },
  {
    id: "iremnj",
    name: "IREM NJ — Accredited Management Organizations",
    url: "https://iremnj.org/AMO_Directory",
    audience: "Commercial and multifamily property managers",
    note: "Use company listings to identify management firms; verify named decision-makers on official websites.",
  },
  {
    id: "cianj",
    name: "CIANJ — Member Directory",
    url: "https://members.cianj.org/directory",
    audience: "Commercial owners, developers and contractors",
    note: "Find relevant companies, then verify an appropriate contact and published direct business email.",
  },
  {
    id: "bbb",
    name: "BBB — NJ Commercial Property Management",
    url: "https://www.bbb.org/us/nj/category/commercial-property-management",
    audience: "Commercial property management companies",
    note: "Company discovery only; a listing is not evidence of a named person's email.",
  },
] as const;
