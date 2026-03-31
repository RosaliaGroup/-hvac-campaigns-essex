export type BlogSection =
  | { type: "intro"; content: string }
  | { type: "h2"; content: string }
  | { type: "paragraph"; content: string }
  | { type: "stat_box"; content: string }
  | { type: "checklist"; items: string[] }
  | { type: "numbered_list"; items: string[] }
  | { type: "cta_box"; content: string; buttonText: string; buttonUrl: string };

export type BlogPostData = {
  title: string;
  slug: string;
  date: string;
  readTime: string;
  category: string;
  metaDescription: string;
  excerpt: string;
  sections: BlogSection[];
};

export const blogPosts: BlogPostData[] = [
  {
    title: "NJ Heat Pump Rebates 2026: How to Get Up to $16,000",
    slug: "nj-heat-pump-rebates-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "Complete guide to NJ heat pump rebates in 2026. Learn how to qualify for up to $16,000 in rebates plus a $2,000 federal tax credit. Free assessment available.",
    excerpt: "NJ homeowners can qualify for up to $16,000 in heat pump rebates in 2026. Here's exactly how to get every dollar you're entitled to.",
    sections: [
      {
        type: "intro",
        content: "If you're a New Jersey homeowner thinking about replacing your heating or cooling system, 2026 is the best time to do it. Between NJ state rebates and federal tax credits, you could receive up to $18,000 back on a new heat pump installation — and Mechanical Enterprise handles all the paperwork for free.",
      },
      { type: "h2", content: "What Rebates Are Available for NJ Homeowners in 2026?" },
      {
        type: "paragraph",
        content: "New Jersey homeowners installing qualifying heat pump systems can access two major incentive programs in 2026. The first is NJ state rebates which can provide up to $16,000 depending on your property type, existing system, and the equipment you install. The second is the federal Investment Tax Credit (ITC) under the Inflation Reduction Act, which provides up to $2,000 as a direct tax credit.",
      },
      { type: "stat_box", content: "NJ Rebates: Up to $16,000 | Federal Tax Credit: Up to $2,000 | Total Possible: Up to $18,000" },
      { type: "h2", content: "Who Qualifies for NJ Heat Pump Rebates?" },
      {
        type: "paragraph",
        content: "Most New Jersey homeowners qualify for at least some rebate amount. Eligibility depends on several factors including your current heating system, the type of heat pump you install, your utility provider, and your property type. Residential homeowners generally qualify for higher rebate amounts than commercial properties, though commercial buildings can receive rebates covering up to 80% of total installation costs.",
      },
      {
        type: "checklist",
        items: [
          "Own a home or commercial property in New Jersey",
          "Install a qualifying high-efficiency heat pump system",
          "Work with a licensed NJ HVAC contractor",
          "Submit rebate applications within the required timeframe",
          "Meet minimum efficiency requirements (varies by program)",
        ],
      },
      { type: "h2", content: "What Types of Heat Pumps Qualify?" },
      {
        type: "paragraph",
        content: "Not all heat pumps qualify for maximum rebates. To receive the highest rebate amounts, your system must meet specific efficiency requirements. Central heat pump systems, ductless mini-split heat pumps, and cold climate heat pumps are all eligible. The key requirement is that the system must meet minimum HSPF2 and SEER2 efficiency ratings set by the rebate programs.",
      },
      { type: "h2", content: "How to Apply for NJ Heat Pump Rebates" },
      {
        type: "paragraph",
        content: "The rebate application process can be complex — there are multiple programs, each with their own forms, deadlines, and requirements. This is why most homeowners miss out on thousands of dollars they're entitled to. At Mechanical Enterprise, we handle the entire rebate application process for you at no additional cost. Here's how it works:",
      },
      {
        type: "numbered_list",
        items: [
          "Book a free assessment — we come to your home and evaluate your current system",
          "We identify every rebate program you qualify for",
          "We recommend qualifying equipment that maximizes your rebate amount",
          "We complete the installation and all rebate paperwork",
          "You receive your rebate checks directly",
        ],
      },
      {
        type: "cta_box",
        content: "Want to know exactly how much you qualify for? Book a free assessment and we will calculate your exact rebate amount at no cost.",
        buttonText: "Book Free Assessment \u2192",
        buttonUrl: "https://mechanicalenterprise.com",
      },
      { type: "h2", content: "How Much Can You Save in Each NJ County?" },
      {
        type: "paragraph",
        content: "Rebate amounts can vary slightly depending on your location and utility provider across New Jersey. Homeowners in Essex, Bergen, Hudson, Union, Morris, and Passaic counties are typically served by PSE&G and may qualify for specific utility rebates in addition to state and federal programs. Regardless of your county, Mechanical Enterprise will identify and apply for every available incentive.",
      },
      { type: "h2", content: "Heat Pump vs Gas Furnace: Is It Worth Switching?" },
      {
        type: "paragraph",
        content: "Many NJ homeowners wonder whether switching from a gas furnace to a heat pump makes financial sense. In most cases, when you factor in available rebates and long-term energy savings, the answer is yes. Modern heat pumps are up to 300% more efficient than gas furnaces and provide both heating and cooling in one system. With rebates covering a significant portion of installation costs, the payback period is often 3-5 years — after which you enjoy lower energy bills indefinitely.",
      },
      { type: "h2", content: "2026 Rebate Deadlines: Act Now" },
      {
        type: "paragraph",
        content: "NJ rebate programs operate on annual funding cycles and can be reduced or modified when funding runs low. Homeowners who schedule their installation earlier in the year typically secure the highest available rebate amounts. Waiting until summer or fall — when demand for HVAC services peaks — can mean longer wait times and potentially reduced incentives.",
      },
      { type: "h2", content: "Get Your Free Rebate Assessment Today" },
      {
        type: "paragraph",
        content: "Mechanical Enterprise serves all 15 NJ counties and specializes in maximizing rebate amounts for every customer. Our free assessment includes a full evaluation of your current system, a calculation of every rebate you qualify for, and a no-obligation quote for installation. There is no cost and no pressure — just clear information about what you qualify for and what a new system would cost after rebates.",
      },
    ],
  },
];
