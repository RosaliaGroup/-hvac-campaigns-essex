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
    title: "NJ Heat Pump Rebates 2026: How to Get Up to $20,000",
    slug: "nj-heat-pump-rebates-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "Complete guide to NJ heat pump rebates in 2026. Learn how to qualify for up to $20,000 in combined rebates plus a $2,000 federal tax credit. Free assessment available.",
    excerpt: "NJ homeowners can qualify for up to $20,000 in combined rebates in 2026. Here's exactly how to get every dollar you're entitled to.",
    sections: [
      {
        type: "intro",
        content: "If you're a New Jersey homeowner thinking about replacing your heating or cooling system, 2026 is the best time to do it. Between NJ state rebates and federal tax credits, you could receive up to $20,000 back — PSE&G covers up to $18,000 and Mechanical Enterprise adds up to $2,000 for qualifying clients — and Mechanical Enterprise handles all the paperwork for free.",
      },
      { type: "h2", content: "What Rebates Are Available for NJ Homeowners in 2026?" },
      {
        type: "paragraph",
        content: "New Jersey homeowners installing qualifying heat pump systems can access multiple incentive programs in 2026. Combined, these programs offer up to $20,000 in combined rebates — up to $18,000 from PSE&G's NJ Clean Heat program, plus up to $2,000 from Mechanical Enterprise's qualifying credit. On top of that, the federal Investment Tax Credit (ITC) under the Inflation Reduction Act provides up to $2,000 as a direct tax credit.",
      },
      { type: "stat_box", content: "PSE&G Rebate: Up to $18,000 | ME Credit: Up to $2,000 | Combined Total: Up to $20,000" },
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
        buttonText: "Book Free Assessment →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
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

  // Post 1: Complete Guide to NJ HVAC Rebates in 2026
  {
    title: "The Complete Guide to NJ HVAC Rebates in 2026 (No Fluff, Just Numbers)",
    slug: "nj-hvac-rebates-2026-complete-guide",
    date: "March 31, 2026",
    readTime: "10 min read",
    category: "Rebates & Incentives",
    metaDescription: "Every rebate available to NJ homeowners in 2026 — PSE&G, NJ Clean Heat, federal tax credit, and the Mechanical Enterprise qualifying credit. Real numbers, no catch.",
    excerpt: "If $20,000 sounds too good to be true, here's exactly where every dollar comes from. The complete breakdown of every NJ HVAC rebate in 2026.",
    sections: [
      {
        type: "intro",
        content: "If $20,000 sounds too good to be true, here's exactly where every dollar comes from. New Jersey has some of the most generous HVAC incentive programs in the country right now, and 2026 is a peak year for stacking them together. This guide breaks down every rebate, credit, and incentive available to NJ homeowners — no vague promises, just the actual numbers and where they come from.",
      },
      { type: "h2", content: "Where the $20,000 Actually Comes From" },
      {
        type: "paragraph",
        content: "Let's start with the number everyone sees in the headlines and break it down dollar by dollar. The $20,000 figure comes from combining three separate programs, each administered by a different entity. No single program hands you a $20,000 check — but when you stack them correctly, qualifying homeowners can reach that total. Here's how it works.",
      },
      {
        type: "stat_box",
        content: "PSE&G / NJ Clean Heat: Up to $18,000 | Mechanical Enterprise Qualifying Credit: Up to $2,000 | Federal 25C Tax Credit: Up to $2,000/year (additional) | Maximum Combined Value: $20,000+ with tax credit",
      },
      { type: "h2", content: "Program #1: PSE&G and NJ Clean Heat (Up to $18,000)" },
      {
        type: "paragraph",
        content: "The NJ Clean Heat program is the backbone of HVAC rebates in New Jersey. Administered through your utility provider — PSE&G for most of Essex, Bergen, Hudson, Union, Morris, and Passaic counties — this program offers the single largest rebate available to residential homeowners. Rebate amounts vary based on several factors: the type of heat pump you install, your home's existing heating system, whether you're income-qualified, and the efficiency rating of the new equipment. For a standard residential installation replacing a gas furnace with a cold-climate heat pump, rebates typically range from $8,000 to $18,000. Income-qualified households — generally those earning below 80% of area median income — receive the highest tier of rebates. Even moderate-income households can qualify for substantial amounts. The program covers central ducted heat pumps, ductless mini-splits, and hybrid systems. The key requirement is that equipment must meet minimum efficiency ratings: typically SEER2 15.2+ and HSPF2 7.8+ for the highest rebate tiers.",
      },
      { type: "h2", content: "Program #2: Mechanical Enterprise Qualifying Credit (Up to $2,000)" },
      {
        type: "paragraph",
        content: "Mechanical Enterprise offers an additional credit of up to $2,000 for qualifying clients. This credit applies on top of the PSE&G/NJ Clean Heat rebate and is designed to bridge the gap between rebate coverage and your actual out-of-pocket cost. Not every installation qualifies — the credit is based on the scope of work, the equipment selected, and the total rebate package. During your free assessment, we calculate the exact credit amount you're eligible for and show you the final numbers before you commit to anything.",
      },
      { type: "h2", content: "Program #3: Federal 25C Tax Credit (Up to $2,000/Year)" },
      {
        type: "paragraph",
        content: "The Inflation Reduction Act's Section 25C tax credit provides 30% of the cost of qualifying HVAC equipment and installation, up to $2,000 per year. This is a tax credit, not a rebate — it reduces your federal tax liability dollar-for-dollar when you file your return. The 25C credit stacks on top of NJ state rebates with no conflict. You can claim it for the year you install the equipment. Qualifying equipment includes heat pumps that meet CEE (Consortium for Energy Efficiency) highest efficiency tier requirements. This credit is available through at least 2032 under current legislation.",
      },
      { type: "h2", content: "Who Qualifies for Maximum Rebates?" },
      {
        type: "checklist",
        items: [
          "You own a residential property in New Jersey",
          "Your home is in a PSE&G service area (covers most of northern and central NJ)",
          "You're replacing an existing heating system (not new construction)",
          "You install a qualifying cold-climate heat pump with minimum SEER2 15.2+ and HSPF2 7.8+",
          "You work with a participating contractor (Mechanical Enterprise is a registered installer)",
          "Income-qualified households (below 80% AMI) receive the highest rebate tier",
        ],
      },
      { type: "h2", content: "Real Example: 3-Bedroom Newark Home" },
      {
        type: "paragraph",
        content: "Here's a real scenario from a recent assessment. A 3-bedroom, 1,400 sq ft home in Newark's Ironbound neighborhood. The homeowner was replacing a 22-year-old gas furnace and a 15-year-old central AC unit. The home qualified as income-eligible under the NJ Clean Heat program. We recommended a Mitsubishi cold-climate ducted heat pump system rated at SEER2 17.1 and HSPF2 9.2. The total installation cost was $24,800. Here's how the rebates stacked up: PSE&G/NJ Clean Heat rebate came to $17,400. The Mechanical Enterprise qualifying credit added $2,000. The federal 25C tax credit provided an additional $2,000 at tax time. The homeowner's net cost after all incentives was $3,400 — for a complete HVAC system replacement that eliminated both the old furnace and the aging AC unit. Monthly energy bills dropped by approximately $85 compared to the previous system. At that rate, the $3,400 out-of-pocket cost pays for itself in about 40 months.",
      },
      { type: "h2", content: "On-Bill Repayment: The $0 Upfront Option" },
      {
        type: "paragraph",
        content: "Even after rebates, some homeowners prefer not to pay the remaining balance upfront. NJ's on-bill repayment (OBR) program allows you to finance the remaining cost directly through your utility bill. There's no separate loan application, no credit check in most cases, and the monthly payment is often less than the energy savings from the new system — meaning your total monthly housing costs could actually decrease from day one. Mechanical Enterprise helps you apply for OBR as part of our standard process.",
      },
      { type: "h2", content: "How to Get Started" },
      {
        type: "numbered_list",
        items: [
          "Book a free 20-minute home assessment with Mechanical Enterprise",
          "We evaluate your current system and calculate every rebate you qualify for",
          "You receive a written breakdown showing total cost, all rebates, and your net price",
          "If you proceed, we handle all installation, permits, and rebate paperwork",
          "Rebates are applied directly — you never pay the full price out of pocket",
        ],
      },
      {
        type: "cta_box",
        content: "Ready to see your exact rebate amount? Our free assessment takes 20 minutes and gives you real numbers — no obligation, no pressure.",
        buttonText: "Calculate My Rebates →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 2: PSE&G Heat Pump Rebates Explained
  {
    title: "PSE&G Heat Pump Rebates Explained: What They Cover, What They Don't",
    slug: "pseg-heat-pump-rebates-explained",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "PSE&G offers up to $18,000 in heat pump rebates for NJ homeowners. Here's exactly what's covered, who qualifies, and how to stack it with other programs.",
    excerpt: "PSE&G's NJ Clean Heat program offers the largest single rebate for NJ homeowners. Here's what it covers, what it doesn't, and how to stack it.",
    sections: [
      {
        type: "intro",
        content: "PSE&G administers the largest single HVAC rebate program available to New Jersey homeowners in 2026. Through the NJ Clean Heat initiative, PSE&G customers can receive up to $18,000 toward a new heat pump installation. But not every system qualifies, and the rebate amounts vary significantly based on your situation. Here's what you actually need to know — no marketing spin.",
      },
      { type: "h2", content: "How Much Does PSE&G Actually Offer?" },
      {
        type: "paragraph",
        content: "PSE&G's rebate amounts depend on three main factors: the type of heat pump you install, your home's existing heating fuel source, and whether you qualify as an income-eligible household. For standard-income households replacing a gas furnace with a qualifying cold-climate heat pump, rebates typically range from $4,000 to $12,000. Income-eligible households — those earning below 80% of the area median income — can receive enhanced rebates of up to $18,000. The highest rebates go to income-eligible homeowners who are switching from oil or propane heating to an electric heat pump, as these conversions deliver the greatest emissions reduction.",
      },
      {
        type: "stat_box",
        content: "Standard Income: $4,000 – $12,000 | Income-Eligible (below 80% AMI): $8,000 – $18,000 | Fuel Switching Bonus: Additional incentive for oil/propane conversion",
      },
      { type: "h2", content: "Rebate Amounts by Equipment Type" },
      {
        type: "paragraph",
        content: "Central ducted heat pumps receive the highest rebates because they typically replace the entire heating and cooling system in one installation. Ductless mini-split systems qualify for per-head rebates, which can add up quickly in multi-zone installations. Heat pump water heaters also qualify under a separate but stackable rebate category. Here's the general breakdown for 2026: central ducted cold-climate heat pumps qualify for the maximum tier. Ductless mini-splits qualify per indoor head, typically $1,000 to $3,000 per head depending on capacity and efficiency. Heat pump water heaters qualify for $500 to $1,500 depending on capacity and efficiency ratings.",
      },
      { type: "h2", content: "What PSE&G Rebates Don't Cover" },
      {
        type: "paragraph",
        content: "It's important to understand what falls outside the rebate program. PSE&G rebates do not cover standard air conditioners — only heat pumps that provide both heating and cooling. They don't cover gas furnace replacements with another gas furnace. Portable or window heat pump units don't qualify. Repairs or maintenance on existing systems are excluded. New construction projects are generally not eligible for the residential program. And systems that don't meet minimum efficiency requirements — typically SEER2 15.2+ and HSPF2 7.8+ — won't qualify for the highest rebate tiers.",
      },
      {
        type: "checklist",
        items: [
          "Standard AC units — only heat pumps qualify",
          "Gas-to-gas furnace replacements",
          "Portable or window heat pump units",
          "Repairs or maintenance on existing systems",
          "New construction (separate programs may apply)",
          "Equipment below minimum SEER2/HSPF2 thresholds",
        ],
      },
      { type: "h2", content: "How to Stack PSE&G Rebates With Other Programs" },
      {
        type: "paragraph",
        content: "The best part about the PSE&G rebate is that it stacks with other incentive programs. You can combine it with the Mechanical Enterprise qualifying credit of up to $2,000 and the federal 25C tax credit of up to $2,000 per year. These programs are administered by different entities, so there's no double-dipping concern — each one is designed to work alongside the others. A homeowner who qualifies for the full PSE&G rebate, the ME credit, and the federal tax credit could see a combined $22,000 in incentive value. The key is making sure you apply for all programs simultaneously, which is exactly what Mechanical Enterprise handles for every client.",
      },
      { type: "h2", content: "Real Example: Newark Homeowner" },
      {
        type: "paragraph",
        content: "A recent client in Newark's North Ward had a 1,600 sq ft home heated by a 19-year-old gas furnace with a separate 12-year-old AC condenser. As a PSE&G customer with household income qualifying under the enhanced tier, they were eligible for $16,800 from PSE&G's NJ Clean Heat program. We added the $2,000 ME qualifying credit, bringing the pre-installation incentive total to $18,800. The total system cost was $23,200 for a Carrier cold-climate ducted heat pump. After all rebates, their out-of-pocket was $4,400 — and they'll claim an additional $2,000 on their federal taxes. Net cost: $2,400 for a brand-new, high-efficiency system.",
      },
      { type: "h2", content: "How to Apply Through PSE&G" },
      {
        type: "numbered_list",
        items: [
          "Confirm you're a PSE&G electric customer (check your utility bill)",
          "Schedule a free assessment with a participating contractor like Mechanical Enterprise",
          "Your contractor submits the rebate application on your behalf before installation",
          "PSE&G reviews and approves the application (typically 2-4 weeks)",
          "Installation proceeds and rebate is applied to your project cost",
          "For income-eligible applicants, additional documentation may be required",
        ],
      },
      {
        type: "paragraph",
        content: "The application process can be confusing if you try to navigate it alone. Forms change, requirements update, and missing a single document can delay your approval by weeks. Mechanical Enterprise submits PSE&G rebate applications daily and knows exactly what's needed to get approval on the first submission. We handle everything so you don't have to learn the system.",
      },
      {
        type: "cta_box",
        content: "Find out exactly what PSE&G will cover for your home. Our free assessment calculates your specific rebate amount based on your address, equipment, and income tier.",
        buttonText: "Get My PSE&G Rebate Estimate →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 3: Heat Pump vs Gas Furnace
  {
    title: "Heat Pump vs Gas Furnace in New Jersey: An Honest Comparison (2026)",
    slug: "heat-pump-vs-gas-furnace-nj-2026",
    date: "March 31, 2026",
    readTime: "11 min read",
    category: "HVAC Education",
    metaDescription: "Gas furnaces are cheaper upfront. Heat pumps come with up to $20,000 in NJ rebates. Here's the unbiased math for NJ homeowners in 2026.",
    excerpt: "Gas furnaces are cheaper upfront. But with up to $20,000 in NJ rebates, the math changes fast. Here's the honest comparison for 2026.",
    sections: [
      {
        type: "intro",
        content: "This is the comparison every NJ homeowner considering a new HVAC system needs to see. Gas furnaces have been the default in New Jersey for decades, and for good reason — they're proven, relatively affordable, and they work. But 2026 has changed the math significantly. With up to $20,000 in available rebates for heat pump installations, the upfront cost advantage of gas furnaces has largely disappeared. Here's the honest, side-by-side breakdown.",
      },
      { type: "h2", content: "Upfront Cost: Before Rebates" },
      {
        type: "paragraph",
        content: "Let's start with the raw numbers — no rebates, no incentives, just equipment and installation. A mid-range gas furnace with a new AC condenser, fully installed in a typical NJ home, costs between $8,000 and $14,000 depending on the brand, efficiency rating, and complexity of the install. A comparable cold-climate heat pump system — which handles both heating and cooling in one unit — runs between $15,000 and $28,000 installed. On raw cost alone, gas wins. There's no way around that. A heat pump system costs roughly 60-100% more than a furnace/AC combo before any incentives are applied.",
      },
      {
        type: "stat_box",
        content: "Gas Furnace + AC: $8,000 – $14,000 installed | Heat Pump System: $15,000 – $28,000 installed | Difference Before Rebates: $7,000 – $14,000 more for heat pump",
      },
      { type: "h2", content: "Upfront Cost: After NJ Rebates" },
      {
        type: "paragraph",
        content: "Now here's where 2026 changes everything. Gas furnaces receive zero rebates in New Jersey. No state program, no utility incentive, no federal credit subsidizes a gas-to-gas replacement. Heat pumps, on the other hand, qualify for up to $20,000 in combined rebates — up to $18,000 from PSE&G's NJ Clean Heat program and up to $2,000 from Mechanical Enterprise's qualifying credit. Add the federal 25C tax credit of up to $2,000, and a $24,000 heat pump installation can drop to $4,000 or less out of pocket. That's often cheaper than the gas furnace that gets zero help.",
      },
      {
        type: "stat_box",
        content: "Gas Furnace + AC After Rebates: $8,000 – $14,000 (no rebates available) | Heat Pump After Rebates: $2,000 – $8,000 (after up to $22,000 in incentives) | Winner: Heat Pump",
      },
      { type: "h2", content: "Monthly Operating Costs at NJ Energy Prices" },
      {
        type: "paragraph",
        content: "Operating cost is where heat pumps pull further ahead. A modern cold-climate heat pump operates at 250-350% efficiency (COP of 2.5-3.5), meaning for every dollar of electricity it consumes, it moves $2.50-$3.50 worth of heating energy into your home. A high-efficiency gas furnace operates at 95-97% efficiency — for every dollar of gas burned, you get $0.95-$0.97 of heat. At current NJ energy prices (approximately $0.18/kWh for electricity and $1.45/therm for natural gas), a heat pump costs roughly 30-45% less to operate per heating season compared to a gas furnace in the same home. For a typical 1,500 sq ft NJ home, that translates to annual heating savings of $400-$800. And because a heat pump also replaces your AC, you're saving on cooling costs too — modern heat pumps are significantly more efficient than the 10-15 year old AC condenser most homes are running.",
      },
      { type: "h2", content: "When Gas Still Makes Sense (Being Honest)" },
      {
        type: "paragraph",
        content: "We're an HVAC company that installs heat pumps, so you might expect us to push them on everyone. But here's the truth: gas furnaces still make sense in some situations. If your existing furnace is less than 10 years old and working fine, the economics of early replacement don't always pencil out even with rebates. If your home has no existing ductwork and you don't want a ductless system, the installation complexity and cost increase significantly. If you're planning to sell the home within 2-3 years, you may not recoup enough of the investment even with rebates. And if your home has extremely high heating loads — say, a poorly insulated older home that you're not ready to weatherize — a gas furnace may still deliver more raw heating capacity per dollar in the coldest weeks of winter. We tell clients this during every assessment. Not every home is a slam-dunk for a heat pump, and we'd rather give you honest advice than push a sale.",
      },
      { type: "h2", content: "The Cold Weather Performance Myth" },
      {
        type: "paragraph",
        content: "The biggest objection we hear is: 'Heat pumps don't work when it's really cold.' This was true 15 years ago. It is not true in 2026. Modern cold-climate heat pumps are specifically engineered for northern climates. Models from Mitsubishi, Carrier, Daikin, and others maintain full heating capacity down to 5°F and continue operating at reduced capacity down to -13°F or lower. New Jersey's average winter low is around 25°F, with occasional dips into the single digits. That's well within the comfortable operating range of any cold-climate heat pump on the market. In the handful of nights per year when temperatures drop below 5°F, the system uses a backup electric resistance heater — which is less efficient but only runs for a few hours per season. The impact on your annual energy bill is negligible. We have hundreds of heat pump installations across northern NJ that have performed through multiple winters without supplemental heating issues.",
      },
      { type: "h2", content: "10-Year Cost of Ownership Comparison" },
      {
        type: "paragraph",
        content: "Here's where the full picture comes together. Over a 10-year period for a typical 1,500 sq ft NJ home, the total cost of ownership tells the real story. A gas furnace plus AC system: $12,000 upfront, plus approximately $2,200/year in gas and electric for heating and cooling, plus $300/year average maintenance — total 10-year cost of roughly $37,000. A heat pump system after rebates: $5,000 upfront (after $20,000 in rebates on a $25,000 system), plus approximately $1,400/year for electric heating and cooling, plus $250/year average maintenance — total 10-year cost of roughly $21,500. That's a $15,500 savings over 10 years with the heat pump. Even if you only qualify for $12,000 in rebates instead of the full $20,000, the heat pump still wins by about $7,500 over the decade thanks to lower operating costs.",
      },
      {
        type: "stat_box",
        content: "10-Year Gas Furnace + AC: ~$37,000 | 10-Year Heat Pump (after rebates): ~$21,500 | 10-Year Savings with Heat Pump: ~$15,500",
      },
      { type: "h2", content: "The Rebate Math Changes Everything" },
      {
        type: "paragraph",
        content: "Five years ago, recommending a heat pump over a gas furnace in NJ required the homeowner to have a long time horizon and a willingness to pay more upfront for long-term savings. In 2026, the rebate landscape has completely flipped that calculus. With up to $20,000 in combined rebates from PSE&G and Mechanical Enterprise, plus up to $2,000 in federal tax credits, heat pumps now cost less upfront than gas furnaces in many scenarios — and they cost less to operate every month after that. It's not a close call anymore for most NJ homeowners.",
      },
      {
        type: "cta_box",
        content: "Want to see the exact numbers for your home? Our free assessment compares your current system costs against a heat pump with all available rebates applied. No obligation — just the math.",
        buttonText: "Compare My Options →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 4: NJ Clean Heat Program 2026
  {
    title: "NJ Clean Heat Program 2026: Everything You Need to Know Before You Apply",
    slug: "nj-clean-heat-program-2026",
    date: "March 31, 2026",
    readTime: "9 min read",
    category: "Rebates & Incentives",
    metaDescription: "The NJ Clean Heat Program is the largest source of HVAC rebates in the state. Here's what it covers, who qualifies, and how to apply without getting rejected.",
    excerpt: "NJ Clean Heat is the single biggest source of HVAC rebates in the state. Here's what you need to know before you apply.",
    sections: [
      {
        type: "intro",
        content: "The NJ Clean Heat Program is the single largest source of HVAC rebates available to New Jersey homeowners in 2026. Administered through the state's electric and gas utilities — including PSE&G, which serves most of northern and central NJ — this program provides rebates of up to $18,000 for qualifying heat pump installations. But the application process has specific requirements, and getting them wrong can delay or disqualify your rebate entirely. Here's everything you need to know before you apply.",
      },
      { type: "h2", content: "What Is the NJ Clean Heat Program?" },
      {
        type: "paragraph",
        content: "NJ Clean Heat is a state-mandated building decarbonization program that provides financial incentives for homeowners and businesses to switch from fossil fuel heating systems to high-efficiency electric heat pumps. The program is funded through utility ratepayer charges and administered by each utility in its service territory. It's not a loan — it's a direct rebate that reduces the cost of your installation. The goal is to reduce greenhouse gas emissions from the building sector, which is why the highest rebates go to homeowners switching from the most carbon-intensive heating fuels (oil and propane) to the most efficient electric heat pumps.",
      },
      { type: "h2", content: "2026 Rebate Amounts by Equipment Type" },
      {
        type: "paragraph",
        content: "Rebate amounts under NJ Clean Heat vary based on the equipment you install and your income tier. For standard-income households, central ducted cold-climate heat pumps qualify for $4,000 to $10,000 depending on system capacity and efficiency rating. Ductless mini-split heat pumps qualify for $1,000 to $3,000 per indoor unit. Heat pump water heaters qualify for $500 to $1,500. For income-eligible households (below 80% of area median income), all of these amounts increase significantly — central ducted systems can qualify for $12,000 to $18,000, and ductless systems see proportional increases. The program also offers enhanced rebates for fuel-switching — converting from oil or propane heating to electric heat pump — at both income tiers.",
      },
      {
        type: "stat_box",
        content: "Standard Income Ducted HP: $4,000 – $10,000 | Income-Eligible Ducted HP: $12,000 – $18,000 | Mini-Split (per head): $1,000 – $3,000 | HP Water Heater: $500 – $1,500",
      },
      { type: "h2", content: "Income-Qualified Tiers Explained" },
      {
        type: "paragraph",
        content: "NJ Clean Heat uses two main income tiers to determine rebate levels. The standard tier is available to all homeowners regardless of income. The income-eligible tier provides enhanced rebates for households earning below 80% of the area median income (AMI). For Essex County in 2026, 80% AMI for a family of four is approximately $82,000. Single-person households have a lower threshold, and larger families have a higher one. Income verification is done through self-certification in most cases, though the utility may request documentation such as tax returns or pay stubs. If you're close to the threshold, it's worth checking — the difference between standard and income-eligible rebates can be $6,000 to $8,000 or more.",
      },
      { type: "h2", content: "Step-by-Step Application Process" },
      {
        type: "numbered_list",
        items: [
          "Choose a participating contractor — they must be registered with your utility's NJ Clean Heat program (Mechanical Enterprise is registered with PSE&G)",
          "Schedule a home energy assessment to determine qualifying equipment and rebate amounts",
          "Your contractor submits the rebate reservation application to the utility before work begins",
          "The utility reviews the application and issues a reservation confirmation (2-4 weeks typical)",
          "Once approved, your contractor installs the equipment and submits completion documentation",
          "The rebate is applied to your project — you only pay the net amount after rebate",
          "For income-eligible applicants, additional income documentation may be required at step 3",
        ],
      },
      { type: "h2", content: "Common Rejection Mistakes to Avoid" },
      {
        type: "paragraph",
        content: "We've seen dozens of rebate applications get delayed or rejected over the years, and it's almost always due to a few common mistakes. First, the equipment doesn't meet minimum efficiency requirements — each program year updates the required SEER2 and HSPF2 ratings, and using last year's specifications is a frequent error. Second, the application is submitted after installation begins — the reservation must be approved before work starts. Third, missing or incorrect customer information, especially for income-eligible applications where documentation doesn't match. Fourth, using a contractor who isn't registered with the program, which automatically disqualifies the entire application. And fifth, not including all required equipment documentation such as AHRI certificates and manufacturer specification sheets.",
      },
      {
        type: "checklist",
        items: [
          "Verify equipment meets current 2026 efficiency minimums before ordering",
          "Submit the rebate reservation before any installation work begins",
          "Ensure all customer names, addresses, and account numbers match utility records exactly",
          "For income-eligible applications, gather income documentation in advance",
          "Confirm your contractor is a registered participant in the NJ Clean Heat program",
          "Include AHRI certificates and manufacturer spec sheets with the completion paperwork",
        ],
      },
      { type: "h2", content: "Timeline: How Long Does It Take?" },
      {
        type: "paragraph",
        content: "From first contact to completed installation with rebate applied, the typical timeline is 4-8 weeks. The rebate reservation review takes 2-4 weeks. Equipment ordering and scheduling takes 1-2 weeks. Installation itself is usually 1-2 days for most residential systems. Mechanical Enterprise submits applications within 48 hours of your assessment and follows up with the utility weekly until approval is confirmed. We've processed hundreds of NJ Clean Heat applications and know how to avoid the delays that slow down less experienced contractors.",
      },
      { type: "h2", content: "We Handle the Paperwork — You Get the Rebate" },
      {
        type: "paragraph",
        content: "The NJ Clean Heat application process isn't difficult, but it is detailed. Missing a single form or specification can set you back weeks. As a registered NJ Clean Heat contractor, Mechanical Enterprise handles every step of the application process — from the initial reservation to the final completion documentation. We submit applications daily and maintain a near-100% first-submission approval rate because we know exactly what the utilities require. You don't need to learn the system, call the utility, or chase down paperwork. We do all of that.",
      },
      {
        type: "cta_box",
        content: "Ready to find out what you qualify for under NJ Clean Heat? Book a free assessment and we'll calculate your exact rebate amount and handle the entire application.",
        buttonText: "Check My NJ Clean Heat Eligibility →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 5: HVAC Rebates in Essex County
  {
    title: "HVAC Rebates in Essex County NJ: What Local Homeowners Are Actually Getting in 2026",
    slug: "hvac-rebates-essex-county-nj",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Local Guides",
    metaDescription: "Real rebate numbers from assessments across Newark, Montclair, Bloomfield, West Orange, and Maplewood. What Essex County homeowners are qualifying for in 2026.",
    excerpt: "Real rebate numbers from assessments across Newark, Montclair, Bloomfield, West Orange, and Maplewood. What Essex County homeowners are actually getting.",
    sections: [
      {
        type: "intro",
        content: "We've completed hundreds of HVAC assessments across Essex County in 2026, and the rebate numbers are real. Homeowners in Newark, Montclair, Bloomfield, West Orange, Maplewood, and surrounding towns are qualifying for $14,000 to $20,000 in combined rebates on heat pump installations. Here's what we're actually seeing on the ground — town by town, with real numbers from real assessments.",
      },
      { type: "h2", content: "Why Essex County Homes Qualify So Well" },
      {
        type: "paragraph",
        content: "Essex County has a unique combination of factors that make its homeowners particularly well-positioned for maximum HVAC rebates. First, the entire county is in the PSE&G service area, which administers the most generous utility rebate program in the state through NJ Clean Heat. Second, Essex County has one of the oldest housing stocks in New Jersey — many homes were built between 1920 and 1970, meaning they're running aging, inefficient HVAC systems that are prime candidates for replacement. Third, the county's income demographics mean a significant percentage of households qualify for the enhanced income-eligible rebate tier, which can double or even triple the standard rebate amount. And fourth, many Essex County homes still use oil heat, which qualifies for the highest fuel-switching rebates under NJ Clean Heat.",
      },
      { type: "h2", content: "What We're Seeing by Town" },
      {
        type: "paragraph",
        content: "In Newark — our highest-volume service area — the average qualifying rebate amount in 2026 is $17,200. Many Newark homeowners qualify as income-eligible, which pushes rebate amounts into the highest tier. Combined with the Mechanical Enterprise credit and the federal tax credit, we've had Newark clients receive over $19,000 in total incentives. In Montclair, the average is slightly lower at $13,500 because fewer households qualify for income-eligible tiers, but the older Victorian and Colonial homes with outdated heating systems still qualify for substantial standard-tier rebates. Bloomfield homeowners are seeing $14,000 to $18,000 depending on income tier, with many of the post-war Cape Cods and ranches being ideal candidates for ductless mini-split conversions. West Orange and Maplewood averages sit around $12,000 to $16,000, with the larger homes in these towns sometimes qualifying for higher total amounts due to the larger systems they require.",
      },
      {
        type: "stat_box",
        content: "Newark Average: $17,200 | Bloomfield Average: $14,000 – $18,000 | Montclair Average: $13,500 | West Orange/Maplewood: $12,000 – $16,000",
      },
      { type: "h2", content: "Real Assessment Examples from Essex County" },
      {
        type: "paragraph",
        content: "Here are three real assessments from the past month. A 3-bedroom rowhouse in Newark's Ironbound neighborhood: replacing a 25-year-old oil boiler with a Mitsubishi cold-climate heat pump. Income-eligible household. Total rebates: $18,000 from PSE&G plus $2,000 ME credit — $20,000 total before the federal tax credit. Net cost on a $24,500 installation: $4,500, or $2,500 after the 25C tax credit. A 4-bedroom Colonial in Montclair: replacing a 16-year-old gas furnace and AC. Standard income tier. Total rebates: $9,800 from PSE&G plus $1,500 ME credit — $11,300 total. Net cost on a $22,000 installation: $10,700, or $8,700 after the tax credit. A 2-bedroom Cape Cod in Bloomfield: replacing electric baseboard heating with a ductless mini-split system. Income-eligible household. Total rebates: $14,200 from PSE&G plus $2,000 ME credit — $16,200 total. Net cost on a $18,500 installation: $2,300.",
      },
      { type: "h2", content: "The Essex County Advantage" },
      {
        type: "paragraph",
        content: "If you live in Essex County and you haven't looked into HVAC rebates yet, you're leaving money on the table. The combination of PSE&G service coverage, older housing stock, and diverse income levels means most Essex County homeowners qualify for substantial rebates. Whether you're in a Newark apartment building, a Montclair Victorian, a Bloomfield Cape Cod, or a West Orange split-level, there's likely a rebate package that makes upgrading to a heat pump financially compelling. The key is getting an accurate assessment that identifies exactly which programs apply to your specific situation.",
      },
      { type: "h2", content: "How Essex County Homeowners Get Started" },
      {
        type: "numbered_list",
        items: [
          "Book a free 20-minute home assessment — we serve all of Essex County",
          "We evaluate your current system, home size, and fuel type",
          "We calculate your exact rebate amount across all programs",
          "You receive a written quote showing total cost minus all rebates",
          "If you proceed, we handle installation and all rebate paperwork",
        ],
      },
      {
        type: "cta_box",
        content: "Essex County homeowners are qualifying for $14,000 to $20,000 in HVAC rebates right now. Find out your exact number with a free assessment — no obligation.",
        buttonText: "Get My Essex County Rebate Estimate →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 6: What Happens at a Free HVAC Assessment
  {
    title: "What Happens at a Free HVAC Assessment? (We Walk Through Every Step)",
    slug: "what-happens-free-hvac-assessment",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Getting Started",
    metaDescription: "Worried a free assessment means a sales ambush? Here's exactly what a Mechanical Enterprise tech does during your 20-minute home visit — nothing more.",
    excerpt: "Worried a free assessment means a sales pitch? Here's exactly what happens during your 20-minute home visit — step by step, nothing more.",
    sections: [
      {
        type: "intro",
        content: "We get it — 'free assessment' often feels like code for 'high-pressure sales visit.' That's not how we operate, and we know the only way to prove that is to show you exactly what happens. Here's a step-by-step walkthrough of what a Mechanical Enterprise HVAC assessment looks like, start to finish. It takes about 20 minutes, and you walk away with a number — not a contract.",
      },
      { type: "h2", content: "Step 1: Scheduling (2 Minutes)" },
      {
        type: "paragraph",
        content: "You book online or call us. We ask for your address, the approximate age of your current heating system, and what fuel it runs on (gas, oil, electric, or you're not sure — all fine). We schedule a window that works for you, typically within 3-5 business days. We'll text you the day before to confirm and give you a 2-hour arrival window. Our tech arrives in a marked Mechanical Enterprise vehicle and introduces themselves by name.",
      },
      { type: "h2", content: "Step 2: Your Current System (5 Minutes)" },
      {
        type: "paragraph",
        content: "The tech locates your existing heating and cooling equipment — usually in the basement, utility closet, or attic. They note the make, model, age, fuel type, and current condition. They're not looking for problems to upsell — they're documenting what you have so we can calculate what rebate programs apply. They'll also look at your thermostat setup and note the type and condition of your ductwork if you have any. If you have a boiler system, they'll note whether it's hot water or steam, as this affects the heat pump configuration options.",
      },
      { type: "h2", content: "Step 3: Your Home Layout (5 Minutes)" },
      {
        type: "paragraph",
        content: "The tech does a quick walkthrough to assess your home's heating and cooling zones. They're looking at square footage per floor, window count and condition, insulation visible in accessible areas, and the general layout that affects system sizing. They are not inspecting your home for defects or judging your housekeeping. They're gathering the data points needed to recommend the right size system and calculate accurate rebate amounts. If areas of the home are off-limits, just say so — they'll estimate based on what they can see.",
      },
      { type: "h2", content: "Step 4: The Questions We Ask" },
      {
        type: "checklist",
        items: [
          "How old is your current heating system? (Approximate is fine)",
          "What are your current monthly energy bills? (Helps us estimate savings)",
          "Are there any rooms that are too hot or too cold? (Helps with system design)",
          "Are you the homeowner? (Required for rebate eligibility)",
          "Approximate household income range (only if you want to check for income-eligible enhanced rebates — completely optional)",
          "Any upcoming plans for the home? (Renovation, addition, selling — affects our recommendation)",
        ],
      },
      { type: "h2", content: "Step 5: The Numbers (5 Minutes)" },
      {
        type: "paragraph",
        content: "Based on what the tech sees, they'll calculate your estimated rebate amount on the spot using our internal tool. You'll get a preliminary number that includes the PSE&G/NJ Clean Heat rebate estimate, the Mechanical Enterprise qualifying credit, and the federal tax credit you'd be eligible for. They'll also give you a ballpark total system cost so you can see what the net price would look like after rebates. This is an estimate — the final numbers come in a written proposal within 48 hours. But the estimate is usually within 10% of the final figure.",
      },
      { type: "h2", content: "Step 6: What We Leave You With" },
      {
        type: "paragraph",
        content: "When the tech leaves — after about 20 minutes total — you'll have three things. First, a clear understanding of what rebates you likely qualify for and the approximate amounts. Second, a timeline for receiving a detailed written proposal (usually within 48 hours). Third, our contact information if you have follow-up questions. You will not have signed anything. You will not have committed to anything. Nobody will call you repeatedly to follow up. If you want to proceed, you call us. If you don't, that's fine — the assessment cost us time, not you money.",
      },
      { type: "h2", content: "What We Don't Do" },
      {
        type: "paragraph",
        content: "We don't use scare tactics about your existing system. We don't claim your furnace is 'dangerous' to pressure you into a decision. We don't offer a 'today only' price. We don't send a closer after the tech leaves. We don't add you to a call list. Our business model is simple: NJ has generous rebates right now, a lot of homeowners don't know about them, and when we explain the numbers honestly, a good percentage of people decide to move forward on their own timeline. Pressure tactics aren't necessary when the math speaks for itself.",
      },
      {
        type: "cta_box",
        content: "Book your free 20-minute assessment. We'll show you the numbers and leave you alone to decide. No pressure, no obligation, no follow-up calls.",
        buttonText: "Book My Free Assessment →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 7: NJ On-Bill Repayment
  {
    title: "NJ On-Bill Repayment: How to Replace Your HVAC System With $0 Upfront",
    slug: "nj-on-bill-repayment-zero-upfront-hvac",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Financing",
    metaDescription: "On-bill repayment means your new heat pump gets paid through your utility bill — often less than your current energy savings. Here's how it works in NJ.",
    excerpt: "On-bill repayment puts your new heat pump payment right on your utility bill — often less than your current energy savings. Here's how it works.",
    sections: [
      {
        type: "intro",
        content: "Even after $20,000 in rebates, some homeowners still have a remaining balance they'd rather not pay upfront. That's where NJ's on-bill repayment program comes in. Instead of paying cash or taking out a separate loan, you repay the remaining cost of your heat pump installation directly through your monthly utility bill — and in many cases, the payment is less than the energy savings your new system generates. Here's how it works, who qualifies, and what the fine print actually says.",
      },
      { type: "h2", content: "What Is On-Bill Repayment (OBR)?" },
      {
        type: "paragraph",
        content: "On-bill repayment is a financing mechanism offered through NJ utilities — including PSE&G — that allows homeowners to pay for energy efficiency upgrades through their monthly utility bill. It's not a traditional loan. There's no separate lender, no separate payment, and in most cases, no traditional credit check. The repayment amount is added as a line item on your existing utility bill. The program is designed so that the monthly repayment amount does not exceed the estimated energy savings from the upgrade — meaning your total utility bill should stay the same or decrease even while you're paying off the system. If you sell the home, the repayment obligation can transfer to the new owner (since they benefit from the energy savings), or you can pay it off at closing.",
      },
      { type: "h2", content: "Who Qualifies for On-Bill Repayment?" },
      {
        type: "checklist",
        items: [
          "You must be a current PSE&G (or other participating NJ utility) customer",
          "Your utility account must be in good standing (no past-due balances)",
          "The installation must be performed by a participating contractor",
          "The equipment must meet program efficiency requirements",
          "Your estimated energy savings must meet or exceed the monthly repayment amount",
          "The property must be your primary residence or a qualifying rental property",
        ],
      },
      { type: "h2", content: "Monthly Payment Examples" },
      {
        type: "paragraph",
        content: "Let's look at real numbers. Say your total heat pump installation costs $24,000. After a $17,000 PSE&G rebate and a $2,000 Mechanical Enterprise credit, your remaining balance is $5,000. Financed through on-bill repayment over 10 years at the program's low interest rate, your monthly payment would be approximately $48. Now consider that your new heat pump reduces your monthly energy costs by an estimated $75 compared to your old gas furnace and AC. After adding the $48 OBR payment and subtracting the $75 energy savings, your net monthly cost actually decreases by $27. You've replaced your entire HVAC system, you paid nothing upfront, and your monthly bills went down.",
      },
      {
        type: "stat_box",
        content: "Example: $5,000 remaining after rebates | OBR Monthly Payment: ~$48 | Monthly Energy Savings: ~$75 | Net Monthly Change: -$27 (you save money from day one)",
      },
      { type: "h2", content: "How OBR Combines With Rebates" },
      {
        type: "paragraph",
        content: "On-bill repayment is designed to work alongside NJ Clean Heat rebates, not replace them. The rebates are applied first, reducing the total project cost. OBR then finances whatever remains. This means the amount you're repaying through OBR is already the post-rebate balance — so the monthly payments are as low as possible. For many income-eligible homeowners who qualify for the maximum $18,000 PSE&G rebate plus the $2,000 ME credit, the remaining OBR balance can be as little as $2,000-$5,000 on a $22,000-$25,000 installation. At those levels, the monthly OBR payment is typically $20-$48 per month.",
      },
      { type: "h2", content: "The $0 Upfront Scenario Explained" },
      {
        type: "paragraph",
        content: "Here's how a true $0 upfront installation works. You book a free assessment. We determine your rebate eligibility and calculate the total project cost. Rebates are applied upfront — you never pay the rebated portion. The remaining balance is enrolled in on-bill repayment. Installation happens. From the next billing cycle forward, your utility bill includes the OBR charge, but your total bill stays the same or decreases because of the energy savings. You have paid $0 out of pocket, your home has a brand-new high-efficiency heat pump, and your monthly costs haven't increased. This scenario is most common for income-eligible homeowners in PSE&G territory who qualify for the highest rebate tier.",
      },
      { type: "h2", content: "The Fine Print You Should Know" },
      {
        type: "paragraph",
        content: "We believe in transparency, so here's what the marketing materials don't always emphasize. OBR is a financial obligation — if you stop paying your utility bill, it can affect your service just like any other unpaid utility charge. The interest rate, while low, is not zero — it's typically 0-3% depending on the program year and your utility. The repayment term is usually 5-15 years, and the monthly payment is fixed for the duration. Energy savings estimates are based on modeling, not guarantees — actual savings depend on weather, usage habits, and energy prices. If you sell the home, the OBR obligation can transfer to the buyer, but this needs to be disclosed and agreed upon during the sale. Despite these caveats, OBR remains one of the most homeowner-friendly financing options available for HVAC upgrades in New Jersey.",
      },
      { type: "h2", content: "How to Get Started With On-Bill Repayment" },
      {
        type: "numbered_list",
        items: [
          "Book a free assessment with Mechanical Enterprise",
          "We calculate your rebate amounts and the remaining balance eligible for OBR",
          "We show you the projected monthly OBR payment alongside your estimated energy savings",
          "If you proceed, we handle the OBR enrollment as part of our standard process",
          "Installation happens with $0 due from you",
          "OBR charges appear on your next utility bill cycle",
        ],
      },
      {
        type: "cta_box",
        content: "Curious what your monthly payment would look like with on-bill repayment? Our free assessment includes a full OBR breakdown alongside your rebate calculation. $0 upfront may be closer than you think.",
        buttonText: "See My $0 Upfront Options →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 8: Commercial HVAC Rebates NJ 2026
  {
    title: "Commercial HVAC Rebates in NJ: Up to 80% Covered — 2026 Guide for Property Owners",
    slug: "commercial-hvac-rebates-nj-2026",
    date: "March 31, 2026",
    readTime: "9 min read",
    category: "Commercial",
    metaDescription: "NJ commercial decarbonization programs can cover up to 80% of HVAC replacement costs. Here's what property owners need to know in 2026.",
    excerpt: "NJ commercial programs can cover up to 80% of your HVAC replacement costs. Here's everything property owners need to know for 2026.",
    sections: [
      {
        type: "intro",
        content: "If you own a commercial property in New Jersey — whether it's a small retail building, a multi-family apartment complex, an office, or a warehouse — the state's commercial decarbonization incentives in 2026 are substantial. NJ's commercial HVAC programs can cover up to 80% of the total replacement cost, making it possible to upgrade aging rooftop units, boilers, and split systems at a fraction of the sticker price. Here's what's available, who qualifies, and how to make the numbers work for your property.",
      },
      { type: "h2", content: "Commercial Program Overview" },
      {
        type: "paragraph",
        content: "New Jersey's commercial HVAC incentive landscape includes several overlapping programs. The NJ Clean Energy Commercial & Industrial program provides direct rebates for high-efficiency equipment installations. The NJ Clean Heat commercial tier offers additional incentives specifically for electrification — switching from gas or oil to heat pump systems. Federal programs including the Section 179D commercial building energy efficiency deduction and the Investment Tax Credit provide additional tax savings. When these programs are stacked correctly, commercial property owners can see 60-80% of total project costs covered by incentives. The key is understanding which programs apply to your specific property type and how to maximize the stack.",
      },
      {
        type: "stat_box",
        content: "NJ Clean Energy C&I Rebate: Up to 50% of project cost | NJ Clean Heat Commercial: Additional 10-20% for electrification | Federal 179D Deduction: Up to $5.00/sq ft | Combined Coverage: Up to 80% of total cost",
      },
      { type: "h2", content: "Qualifying Building Types" },
      {
        type: "paragraph",
        content: "The commercial programs cover a wide range of property types, and the qualifications differ from residential programs. Multi-family residential buildings with 5+ units are classified as commercial and qualify for commercial-tier incentives, which are often more generous than residential rebates on a per-unit basis. Office buildings, retail spaces, restaurants, and mixed-use properties all qualify. Houses of worship, schools, and nonprofits are eligible and often receive enhanced incentives. Warehouses and light industrial facilities qualify for equipment-specific rebates. Even new construction commercial projects can qualify for certain programs, unlike residential new construction. The main requirements are that the building must be in a participating NJ utility's service territory and the new equipment must meet commercial-grade efficiency standards.",
      },
      {
        type: "checklist",
        items: [
          "Multi-family residential (5+ units)",
          "Office buildings and professional spaces",
          "Retail stores and shopping centers",
          "Restaurants and food service establishments",
          "Houses of worship and nonprofits",
          "Schools and educational facilities",
          "Warehouses and light industrial buildings",
          "Mixed-use commercial/residential properties",
        ],
      },
      { type: "h2", content: "How 80% Coverage Works" },
      {
        type: "paragraph",
        content: "Reaching the 80% coverage threshold requires stacking multiple programs, and the exact percentage depends on your property type, equipment choices, and project scope. Here's a realistic example. A 20-unit apartment complex in Newark needs to replace its 25-year-old gas boiler system. Total project cost for a commercial VRF heat pump system: $180,000. The NJ Clean Energy C&I rebate covers $72,000 (40% of project cost based on equipment efficiency). The NJ Clean Heat commercial electrification bonus adds $27,000 (15% for fuel-switching from gas to electric). The Mechanical Enterprise commercial credit contributes $5,000. Federal Section 179D deduction provides an additional $40,000 in tax savings at the property owner's tax rate. Total incentive value: $144,000, or 80% of the $180,000 project. The property owner's net cost is $36,000 for a complete HVAC replacement of a 20-unit building — that's $1,800 per unit.",
      },
      { type: "h2", content: "Stacking Commercial Rebates: The Right Order" },
      {
        type: "numbered_list",
        items: [
          "Start with the NJ Clean Energy C&I program — this provides the largest base rebate and must be applied for before installation begins",
          "Add the NJ Clean Heat commercial tier if you're converting from fossil fuel heating to electric heat pumps",
          "Apply the Mechanical Enterprise commercial credit on top of utility rebates",
          "Claim the federal Section 179D deduction on your tax return for the year of installation",
          "If applicable, explore additional local incentives such as municipality-level clean energy programs",
          "Consider on-bill repayment or C-PACE financing for the remaining balance",
        ],
      },
      { type: "h2", content: "How to Apply for Commercial Rebates" },
      {
        type: "paragraph",
        content: "Commercial rebate applications are more complex than residential ones — the documentation requirements are extensive, including detailed engineering calculations, equipment specifications, and pre- and post-installation energy modeling. This is where working with an experienced commercial HVAC contractor pays for itself. Mechanical Enterprise has a dedicated commercial team that handles the entire incentive application process. We start with a free commercial property assessment, then prepare a comprehensive incentive analysis showing every program your property qualifies for. We manage the application timeline to ensure all reservations are in place before work begins, and we handle all completion documentation after installation.",
      },
      { type: "h2", content: "Real Example: Essex County Multi-Family Property" },
      {
        type: "paragraph",
        content: "A 12-unit apartment building in East Orange needed a complete HVAC overhaul — the existing system was a 30-year-old oil boiler with window AC units in each apartment. The property owner had been quoted $85,000 for a traditional boiler replacement. We proposed a commercial VRF heat pump system that would provide both heating and cooling to every unit through a single, efficient system. Total project cost: $145,000. After stacking NJ Clean Energy ($58,000), NJ Clean Heat electrification bonus ($21,750), ME commercial credit ($4,000), and the 179D deduction ($25,000 in tax savings), the owner's net investment was $36,250. That's less than half the cost of the basic boiler replacement — and the new system provides air conditioning that the building never had before. Tenant satisfaction increased, utility costs per unit decreased by approximately 40%, and the building's market value increased by more than the net investment.",
      },
      {
        type: "cta_box",
        content: "Own a commercial property in NJ? Get a free commercial assessment to find out exactly what incentives your building qualifies for. We'll show you the full stack — every rebate, credit, and deduction available.",
        buttonText: "Book Free Commercial Assessment →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 9: Federal 25C Tax Credit
  {
    title: "The Federal 25C Tax Credit for HVAC in 2026: How to Claim Your 30%",
    slug: "federal-25c-tax-credit-hvac-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "The Inflation Reduction Act gives you 30% back on HVAC equipment and installation — up to $2,000/year. Here's what qualifies and how to file it with NJ rebates.",
    excerpt: "The federal 25C tax credit gives you 30% back on qualifying HVAC equipment — up to $2,000 per year. Here's how to claim it alongside NJ rebates.",
    sections: [
      {
        type: "intro",
        content: "The federal Section 25C Energy Efficient Home Improvement Credit is one of the most overlooked HVAC incentives available to NJ homeowners. While PSE&G rebates and NJ Clean Heat get the headlines, the 25C tax credit quietly adds up to $2,000 per year to your savings — and it stacks on top of every state and utility rebate. Here's what it covers, how to calculate it, and exactly how to claim it when you file your taxes.",
      },
      { type: "h2", content: "What the 25C Tax Credit Covers" },
      {
        type: "paragraph",
        content: "Section 25C of the Internal Revenue Code, as updated by the Inflation Reduction Act (IRA), provides a tax credit equal to 30% of the cost of qualifying energy-efficient home improvements. For HVAC specifically, this includes heat pumps (both ducted and ductless), heat pump water heaters, central air conditioning systems that meet efficiency standards, furnaces and boilers that meet efficiency standards, and related installation costs. The credit also covers non-HVAC improvements like insulation, windows, doors, and electrical panel upgrades — but for this guide, we're focusing on the HVAC components. The key distinction is that this is a tax credit, not a deduction. A $2,000 tax credit reduces your tax bill by $2,000 — dollar for dollar. It's much more valuable than a deduction of the same amount.",
      },
      { type: "h2", content: "How the 30% Calculation Works" },
      {
        type: "paragraph",
        content: "The math is straightforward. Take the total cost of qualifying equipment and installation, multiply by 30%, and that's your credit — up to the annual cap. For example: if your heat pump system costs $18,000 for equipment and installation, 30% would be $5,400. But the annual cap for heat pumps is $2,000, so your credit is $2,000. If your system costs $6,000, 30% is $1,800 — that's below the cap, so your credit is $1,800. The $2,000 annual cap applies specifically to heat pumps and heat pump water heaters. There's a separate $1,200 annual cap for other improvements like furnaces, boilers, insulation, and windows. These caps are per year, not per lifetime — meaning you can claim up to $2,000 for heat pump improvements every year you make qualifying purchases.",
      },
      {
        type: "stat_box",
        content: "Credit Rate: 30% of qualifying costs | Heat Pump Annual Cap: $2,000 | Other Improvements Cap: $1,200/year | Combined Annual Maximum: $3,200 | Available Through: At least 2032",
      },
      { type: "h2", content: "How to Stack 25C With PSE&G and NJ Clean Heat" },
      {
        type: "paragraph",
        content: "One of the most common questions we get is: 'Does taking a state rebate disqualify me from the federal tax credit?' The answer is no — with a nuance. The federal tax credit is calculated on your out-of-pocket cost after any rebates that are considered purchase price reductions. If a rebate reduces the price you pay at the point of sale, the 25C credit is calculated on the reduced amount. However, if the rebate comes as a check after you've already paid (which is how most NJ rebates are structured), the IRS has generally treated the full purchase price as the basis for the credit. This is an area where you should consult your tax advisor for your specific situation. In practice, most NJ homeowners can claim the full $2,000 25C credit on top of their PSE&G and NJ Clean Heat rebates, because the total system cost typically exceeds $6,667 (the amount where 30% equals the $2,000 cap) even after rebates are considered.",
      },
      { type: "h2", content: "Which Equipment Qualifies" },
      {
        type: "paragraph",
        content: "Not every heat pump qualifies for the 25C credit. The equipment must meet the highest efficiency tier established by the Consortium for Energy Efficiency (CEE). For 2026, this generally means air-source heat pumps with SEER2 16+ and HSPF2 9.0+ for split systems, or SEER2 15.2+ and HSPF2 8.1+ for packaged systems. Heat pump water heaters must have a Uniform Energy Factor (UEF) of 2.2 or greater for standard tanks. The good news is that any equipment that qualifies for NJ Clean Heat's highest rebate tier will almost certainly qualify for the 25C credit as well. When Mechanical Enterprise recommends equipment, we always verify it meets both state rebate and federal tax credit requirements so you're maximizing every available incentive.",
      },
      {
        type: "checklist",
        items: [
          "Air-source heat pumps meeting CEE highest efficiency tier (SEER2 16+ / HSPF2 9.0+ typical for split systems)",
          "Ductless mini-split heat pumps meeting CEE highest tier",
          "Heat pump water heaters with UEF 2.2+",
          "Installation labor costs for qualifying equipment",
          "Equipment must be installed in your primary residence (not rental properties for 25C — different rules apply)",
          "Must be an existing home, not new construction",
        ],
      },
      { type: "h2", content: "How to File the 25C Credit" },
      {
        type: "numbered_list",
        items: [
          "Keep all invoices and receipts from your HVAC installation showing equipment model numbers and costs",
          "Request the manufacturer's certification statement — this document confirms the equipment meets efficiency requirements (Mechanical Enterprise provides this automatically)",
          "When filing your federal tax return, complete IRS Form 5695 (Residential Energy Credits)",
          "Enter the total qualifying costs in Part II of Form 5695",
          "The calculated credit flows to Form 1040, line 5",
          "Keep all documentation for at least 3 years in case of audit",
        ],
      },
      { type: "h2", content: "Tax Season Timing: When to Claim" },
      {
        type: "paragraph",
        content: "You claim the 25C credit for the tax year in which the installation is completed. If your heat pump is installed in 2026, you claim the credit on your 2026 tax return (filed in early 2027). If the installation starts in December 2026 but isn't completed until January 2027, the credit goes on your 2027 return. This is important for planning purposes — if you're expecting a large tax liability this year, completing the installation before December 31 ensures you can use the credit sooner. The 25C credit is non-refundable, meaning it can reduce your tax liability to zero but won't generate a refund beyond what you owe. If your tax liability is less than $2,000, you'll use whatever portion applies and lose the rest for that year. However, if you have additional qualifying improvements in future years, you can claim up to $2,000 per year through at least 2032.",
      },
      {
        type: "cta_box",
        content: "Want to maximize both your NJ rebates and your federal tax credit? Our free assessment identifies every incentive you qualify for — state, utility, and federal — so nothing gets left on the table.",
        buttonText: "Calculate All My Incentives →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // Post 10: Is the NJ HVAC Rebate Worth It?
  {
    title: "Is the NJ HVAC Rebate Actually Worth It? An Honest Answer.",
    slug: "is-nj-hvac-rebate-worth-it-honest-answer",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Getting Started",
    metaDescription: "We're an HVAC company and we'll tell you straight: it's not worth it for everyone. Here's how to know in 5 minutes without wasting a day researching it.",
    excerpt: "We're an HVAC company and we'll tell you straight — it's not worth it for everyone. Here's how to know in 5 minutes.",
    sections: [
      {
        type: "intro",
        content: "We install HVAC systems for a living, so you'd expect us to tell every homeowner in New Jersey to jump on the rebate bandwagon. But here's the truth: it's not the right move for everyone. Some people will save $20,000. Some will save $10,000. And some should wait. Instead of making you spend a full day researching programs and reading fine print, here's how to figure out where you stand in about 5 minutes.",
      },
      { type: "h2", content: "Scenario 1: It's Absolutely Worth It" },
      {
        type: "paragraph",
        content: "You're in the best position to benefit from NJ HVAC rebates if most of the following apply to you. Your current heating system is 15+ years old or showing signs of failure — strange noises, uneven heating, rising repair bills. You own your home in a PSE&G service area (most of northern and central NJ). You're heating with gas, oil, or propane. Your household income is below 80% of area median income, which qualifies you for enhanced rebates. And you're planning to stay in the home for at least 3-5 more years. If this sounds like you, the math is overwhelmingly in your favor. You're likely looking at $16,000 to $20,000 in combined rebates, which can reduce the cost of a complete HVAC replacement to under $5,000 out of pocket. You'd be replacing a system that's going to fail soon anyway, with a high-efficiency system that costs less to operate every month. This is the no-brainer scenario.",
      },
      { type: "h2", content: "Scenario 2: It's Partially Worth It" },
      {
        type: "paragraph",
        content: "The rebates make financial sense but aren't a slam dunk if your situation looks more like this. Your heating system is 10-15 years old — working fine but past its prime. You're a standard-income household (above the income-eligible threshold) so you qualify for standard-tier rebates of $4,000 to $10,000 rather than the maximum. Or you're in a utility territory with smaller rebates than PSE&G. In this scenario, your out-of-pocket after rebates might be $8,000 to $15,000 instead of under $5,000. It's still a good deal — you're getting a significant discount on a system you'll need to replace eventually, and the energy savings will continue for 15-20 years. But it's not the life-changing financial windfall of Scenario 1. It's more of a smart financial decision that pays back over 4-7 years through energy savings. Worth doing, especially if your current system is showing any signs of aging, but less urgent.",
      },
      { type: "h2", content: "Scenario 3: It's Not the Right Time" },
      {
        type: "paragraph",
        content: "Here's when we'd honestly tell you to wait. Your heating system is less than 10 years old and running efficiently — you'd be replacing a perfectly good system, and even with rebates, the math doesn't favor early replacement. You're planning to sell the home within 1-2 years — you likely won't recoup the investment in the sale price, even with rebates. Your home has significant insulation or envelope issues that should be addressed first — installing a new HVAC system in a poorly insulated home is like putting premium gas in a car with a leaking tank. Or you're not in a utility service area that offers substantial rebates, which significantly reduces the financial benefit. In these cases, the honest answer is: the rebate is real, but the timing isn't right for you. Bookmark this page, keep it in mind, and revisit when your situation changes.",
      },
      { type: "h2", content: "Quick Self-Qualification Checklist" },
      {
        type: "checklist",
        items: [
          "Is your heating system 15+ years old? (Strong yes = Scenario 1)",
          "Is your heating system 10-15 years old? (Moderate yes = Scenario 2)",
          "Are you in a PSE&G service area? (Check your utility bill)",
          "Do you own your home (not rent)?",
          "Are you planning to stay for 3+ years?",
          "Is your household income below $82,000 for a family of four? (Income-eligible = highest rebates)",
          "Are you currently heating with gas, oil, or propane? (All qualify, oil/propane get the highest rebates)",
        ],
      },
      {
        type: "paragraph",
        content: "If you checked 5 or more boxes, you're likely in Scenario 1 — the full rebate package is almost certainly worth it, and you should get an assessment. If you checked 3-4 boxes, you're in Scenario 2 — it's still worth exploring, and a free assessment will give you exact numbers. If you checked fewer than 3, you may be in Scenario 3 — but it's still worth a conversation, because individual circumstances can shift the math.",
      },
      { type: "h2", content: "Why We're Telling You This" },
      {
        type: "paragraph",
        content: "You might wonder why an HVAC company would talk a potential customer out of a sale. Simple: we'd rather do 100 installations for happy customers who got real value than 150 installations where some people felt oversold. Our business runs on referrals and reputation in communities like Newark, Montclair, Bloomfield, and across Essex County. When someone gets $18,000 in rebates and their energy bills drop by $80 a month, they tell their neighbors. That's worth more than any marketing campaign. So we'd rather you know upfront whether this makes sense for your situation — and if it does, we'll make sure you get every dollar available.",
      },
      {
        type: "cta_box",
        content: "If you're in Scenario 1 or 2, the assessment is free and takes 20 minutes. We'll give you exact rebate numbers for your home — no obligation, no pressure, no follow-up calls if you're not interested.",
        buttonText: "Find Out Where I Stand →",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // R22 BLOG POSTS (20 posts)
  // ═══════════════════════════════════════════════════════════

  {
    title: "R22 Refrigerant Is Banned in NJ — Here's Exactly What to Do Next",
    slug: "r22-refrigerant-banned-nj-what-to-do",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "R22 refrigerant was banned in 2020. NJ homeowners with R22 AC systems cannot recharge them. Here's what to do and how to get up to $20K in rebates.",
    excerpt: "If your AC uses R22 refrigerant, you cannot recharge it. Here's what NJ homeowners need to know and how to get up to $20K back.",
    sections: [
      {
        type: "intro",
        content: "R22 refrigerant — also called Freon — was permanently banned in the United States on January 1, 2020. If your air conditioning system was installed before 2010, there is a good chance it uses R22. Here is what that means for you and what NJ homeowners can do about it.",
      },
      { type: "h2", content: "What Is R22 and Why Was It Banned?" },
      {
        type: "paragraph",
        content: "R22 is a hydrochlorofluorocarbon refrigerant that was widely used in residential AC systems from the 1970s through the 2000s. It was phased out under the Montreal Protocol because of its damaging effect on the ozone layer. The EPA banned production and import of R22 on January 1, 2020. Any remaining R22 is reclaimed from old systems and is extremely expensive — often $100 to $200 per pound.",
      },
      { type: "h2", content: "What This Means for Your AC System" },
      {
        type: "paragraph",
        content: "If your AC uses R22 and it develops a refrigerant leak, you have two options — pay extremely high prices for reclaimed R22 to recharge it, or replace the entire system. Most HVAC technicians will tell you that recharging an R22 system is throwing money away. A single recharge can cost $500 to $2,000, and it does not fix the underlying leak. You will need to recharge again.",
      },
      { type: "h2", content: "The Better Option — Replace and Get Up to $20K in NJ Rebates" },
      {
        type: "paragraph",
        content: "NJ homeowners who replace their R22 system with a qualifying heat pump qualify for PSE&G rebates of up to $18,000, plus up to $2,000 from Mechanical Enterprise, for a combined total of up to $20,000. The new system will be dramatically more efficient — heat pumps use 50-60% less energy than old AC systems and also provide heating, so you can eliminate your oil or gas furnace too.",
      },
      { type: "stat_box", content: "R22 Recharge Cost: $500-$2,000 per visit | New Heat Pump with Rebates: Often $0 out of pocket | Monthly Savings: $150-$300 on energy bills" },
      {
        type: "checklist",
        items: [
          "Your system was installed before 2010",
          "You have had refrigerant added in the past 3 years",
          "Your energy bills have been increasing",
          "Your system takes a long time to cool your home",
          "Your technician mentioned R22 or Freon",
        ],
      },
      { type: "h2", content: "How Mechanical Enterprise Handles It" },
      {
        type: "paragraph",
        content: "We assess your home for free and identify every rebate you qualify for. We handle every PSE&G application and all paperwork at no cost to you. Most of our R22 replacement customers in NJ receive between $12,000 and $20,000 in combined rebates. Call (862) 423-9396 or book online.",
      },
      {
        type: "cta_box",
        content: "Find out if your system uses R22 and what you qualify for. Free 20-minute assessment.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "R22 vs R410A: What NJ Homeowners Need to Know Before Replacing Their AC",
    slug: "r22-vs-r410a-difference-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "R22 and R410A are different refrigerants. R22 is banned and cannot be used in new systems. Here's what NJ homeowners need to know before replacing.",
    excerpt: "R22 is banned. R410A replaced it but is also being phased down. Here is what NJ homeowners should know before choosing a new system.",
    sections: [
      {
        type: "intro",
        content: "If you are replacing an R22 system, you need to understand the differences between refrigerants. R22 is banned, R410A has been the standard replacement for two decades, and now R454B is arriving as the next generation. Here is what matters for NJ homeowners making this decision in 2026.",
      },
      { type: "h2", content: "R22 vs R410A — What Changed and Why" },
      {
        type: "paragraph",
        content: "R22 was the dominant residential refrigerant from the 1970s until the mid-2000s. It works well as a coolant but destroys the ozone layer, which is why the EPA phased it out entirely by January 2020. R410A replaced R22 starting around 2006 and became the standard in all new residential systems. R410A does not deplete the ozone layer, operates at higher pressures which means better efficiency, and has been the default choice for nearly 20 years. The two refrigerants are not interchangeable — you cannot put R410A into an R22 system. If your system uses R22, you need a completely new system regardless of which modern refrigerant you choose.",
      },
      { type: "stat_box", content: "R22: Banned since 2020, $100-200/lb | R410A: Current standard, widely available | R454B: Next generation, arriving 2025-2026" },
      { type: "h2", content: "The Shift to R454B — Should You Wait?" },
      {
        type: "paragraph",
        content: "Starting in 2025, the EPA is phasing down R410A in favor of R454B, which has a much lower global warming potential. Some manufacturers are already producing R454B systems. However, this does not mean you should wait. R410A systems will be supported, serviced, and recharged for decades to come. Waiting means paying more for R22 recharges, risking a complete system failure in summer, and potentially missing current rebate levels. The best time to replace an R22 system is now, regardless of whether you choose R410A or R454B equipment.",
      },
      { type: "h2", content: "What This Means for Your NJ Rebates" },
      {
        type: "paragraph",
        content: "Both R410A and R454B heat pump systems qualify for PSE&G rebates up to $18,000 and Mechanical Enterprise credits up to $2,000, for a combined total of up to $20,000. The refrigerant type does not affect your rebate eligibility — what matters is the system efficiency rating. We help you choose the right system for your home and maximize every available rebate. See our complete guide to NJ heat pump rebates for full details on eligibility.",
      },
      { type: "h2", content: "Which Refrigerant Should You Choose?" },
      {
        type: "paragraph",
        content: "For most NJ homeowners replacing an R22 system in 2026, either R410A or R454B equipment will serve you well for 15-20 years. The most important factor is choosing a high-efficiency heat pump system that qualifies for maximum rebates. Mechanical Enterprise evaluates your home and recommends the best equipment for your specific situation. Call (862) 423-9396 for a free assessment.",
      },
      {
        type: "cta_box",
        content: "Not sure which system is right for your home? We evaluate your current R22 setup and recommend the best replacement option — free, no obligation.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "How Much Does R22 System Replacement Cost in NJ? (And How to Get It Free)",
    slug: "how-much-does-r22-replacement-cost-nj",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "R22 AC system replacement costs $8,000-$15,000 in NJ. But PSE&G rebates cover up to $18,000. Many NJ homeowners pay nothing. Here's how.",
    excerpt: "R22 system replacement in NJ costs $8K-$15K before rebates. But with PSE&G rebates up to $18K, many homeowners pay nothing out of pocket.",
    sections: [
      {
        type: "intro",
        content: "The most common question we hear from NJ homeowners with R22 systems is how much replacement will cost. The answer surprises most people — after rebates, many pay nothing out of pocket. Here is a complete cost breakdown.",
      },
      { type: "h2", content: "What R22 Replacement Costs Before Rebates" },
      {
        type: "paragraph",
        content: "A full R22 system replacement in NJ typically costs between $8,000 and $15,000 before rebates. The exact cost depends on your home size, the type of system you choose, ductwork condition, and installation complexity. A standard central heat pump for a 1,500-2,000 square foot home runs $8,000 to $11,000. Larger homes or those needing ductwork modifications can reach $12,000 to $15,000. Ductless mini-split systems for smaller spaces start around $5,000 to $8,000.",
      },
      {
        type: "numbered_list",
        items: [
          "Home size — larger homes need larger capacity systems",
          "System type — central heat pump vs ductless mini-split",
          "Ductwork condition — existing ducts may need sealing or replacement",
          "Electrical panel — some homes need a panel upgrade for heat pumps",
          "Number of zones — multi-zone systems cost more but provide better comfort",
        ],
      },
      { type: "stat_box", content: "Average R22 Replacement: $8,000-$15,000 | PSE&G Rebate: Up to $18,000 | ME Credit: Up to $2,000 | Net Cost for Many NJ Homeowners: $0" },
      { type: "h2", content: "How PSE&G Rebates Eliminate the Cost" },
      {
        type: "paragraph",
        content: "PSE&G offers rebates up to $18,000 for qualifying heat pump installations through their NJ Clean Heat program. When you add Mechanical Enterprise's credit of up to $2,000, the combined rebates can exceed the total installation cost. We have had dozens of NJ homeowners walk away owing nothing after their R22 system was replaced with a brand new high-efficiency heat pump. Even homeowners who do not qualify for the maximum rebate typically receive $12,000 to $16,000 back, reducing their out-of-pocket cost to a fraction of the total.",
      },
      { type: "h2", content: "Real Examples from NJ Homeowners" },
      {
        type: "paragraph",
        content: "A homeowner in Montclair with a 2,200 sq ft home replaced their R22 system with a central heat pump for $12,500. They received $14,200 in combined rebates and paid nothing out of pocket. A Newark homeowner replaced a failing R22 unit with a ductless system for $7,800 and received $9,100 in rebates. These are not unusual cases — they are typical for NJ homeowners who work with a contractor that knows how to maximize every available incentive. Call (862) 423-9396 to find out what your specific home qualifies for.",
      },
      {
        type: "cta_box",
        content: "Want to know your exact cost after rebates? Our free assessment calculates your specific rebate amount based on your home and current system.",
        buttonText: "Get Your Free Quote",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "Your R22 AC Stopped Working in NJ — Should You Repair or Replace?",
    slug: "r22-ac-not-working-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "R22 AC not working? Repair costs are skyrocketing because R22 is banned. NJ homeowners can replace and get up to $20K back. Here's the math.",
    excerpt: "If your R22 AC stopped working, here is why replacing it makes more financial sense than repairing — and how to get up to $20K in NJ rebates.",
    sections: [
      {
        type: "intro",
        content: "Your R22 AC just stopped working and you need a solution fast. Before you call for a repair, read this. The math almost always favors full replacement — especially with NJ rebates covering most or all of the cost.",
      },
      { type: "h2", content: "Why R22 Repairs Are a Money Pit" },
      {
        type: "paragraph",
        content: "R22 refrigerant has been banned since January 2020. The only R22 available is reclaimed from other old systems, and the supply shrinks every year. A single R22 recharge now costs $500 to $2,000 depending on how much refrigerant your system needs. If the problem is a compressor failure, you are looking at $1,500 to $3,000 for the repair plus the cost of the R22 recharge. And here is the critical problem — these repairs do not fix the underlying age of the system. An R22 system that needs a major repair today will need another one within 12 to 24 months. You are spending thousands to keep a dying system running for a little while longer.",
      },
      { type: "stat_box", content: "R22 Recharge: $500-$2,000 | Compressor Repair: $1,500-$3,000 | New Heat Pump After Rebates: Often $0 | Annual Savings: $1,800-$3,600" },
      { type: "h2", content: "The Repair vs Replace Math" },
      {
        type: "paragraph",
        content: "Consider two scenarios for a typical NJ homeowner. Scenario A — you repair your R22 system for $2,000 now, then spend another $1,500 next year on another repair, plus your monthly energy bills stay high at $300 to $400 during summer. Total cost over 3 years: $5,500 in repairs plus $10,800 in energy bills. Scenario B — you replace the system now. After PSE&G rebates of up to $18,000 and ME credits of up to $2,000, your out-of-pocket cost could be $0. Your monthly energy bills drop to $100 to $150 during summer. Total cost over 3 years: $0 in repairs plus $4,500 in energy bills. Replacement saves you over $11,000 in just three years.",
      },
      { type: "h2", content: "Emergency Replacement Is Faster Than You Think" },
      {
        type: "paragraph",
        content: "If your AC failed and you are worried about timing, know that Mechanical Enterprise offers same-day assessments for emergency situations. We can typically complete a full system replacement within 1 to 3 days of your assessment. You do not have to suffer through weeks without cooling. We also handle all PSE&G rebate paperwork so you do not have to worry about the application process while dealing with an AC emergency. Call (862) 423-9396 for a same-day assessment.",
      },
      {
        type: "cta_box",
        content: "R22 system down? Get a same-day assessment and find out how much you qualify for in NJ rebates. Most homeowners pay nothing for a brand new system.",
        buttonText: "Get Same-Day Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "When Is the Right Time to Replace Your R22 System in NJ?",
    slug: "when-to-replace-r22-system-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "Don't wait for your R22 system to fail completely. NJ homeowners who replace proactively get up to $20K in rebates. Here's when to act.",
    excerpt: "The best time to replace your R22 system is before it fails completely. NJ homeowners can get up to $20K in rebates by acting now.",
    sections: [
      {
        type: "intro",
        content: "Many NJ homeowners with R22 systems wait until their AC fails completely before replacing it. This is a costly mistake. Here is why timing matters and when you should act.",
      },
      { type: "h2", content: "Why Waiting Costs You More" },
      {
        type: "paragraph",
        content: "When your R22 system fails in the middle of July, you are in emergency mode. Emergency replacements cost 10-20% more because you cannot shop around or wait for scheduling availability. HVAC contractors are fully booked in summer, so you may wait days or even weeks without cooling. You also lose the ability to plan around rebate timelines — some rebate programs have funding cycles that can run low later in the year. Homeowners who replace proactively in spring get the best scheduling, the best pricing, and the full range of rebate options.",
      },
      {
        type: "checklist",
        items: [
          "Your system is making unusual noises — grinding, squealing, or banging",
          "Your energy bills have increased more than 20% year over year",
          "Some rooms are noticeably warmer or cooler than others",
          "Your system runs constantly but never reaches the set temperature",
          "You have had a refrigerant recharge in the past 2 years",
          "Your system is 15 or more years old",
          "Repair costs have exceeded $1,000 in the past 12 months",
        ],
      },
      { type: "h2", content: "The Best Time to Replace Is Spring" },
      {
        type: "paragraph",
        content: "Spring is the ideal time for R22 replacement in NJ. Contractors have more availability, rebate funding is at its highest for the year, and you get your new system installed and tested before the first heat wave. PSE&G rebate programs operate on annual funding cycles — homeowners who apply earlier in the year historically receive the highest rebate amounts. Waiting until summer or fall risks reduced incentives if funding runs low.",
      },
      { type: "h2", content: "Rebate Funding Is Not Guaranteed Forever" },
      {
        type: "paragraph",
        content: "The PSE&G rebate programs offering up to $18,000 for heat pump installation are based on current NJ clean energy policy. These programs can be modified, reduced, or ended. The federal 25C tax credit of up to $2,000 is also subject to congressional renewal. Homeowners who replace now lock in the current incentive levels. Combined with Mechanical Enterprise credits of up to $2,000, the total available today is up to $20,000. There is no guarantee these numbers will be the same next year. Call (862) 423-9396 to get your free assessment scheduled.",
      },
      {
        type: "cta_box",
        content: "Do not wait for your R22 system to fail in the middle of summer. Book your free spring assessment now and lock in maximum rebates.",
        buttonText: "Book Spring Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "Upgrade From R22 to a Heat Pump in NJ — Get Up to $20K in Rebates",
    slug: "r22-heat-pump-upgrade-nj-rebates",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "Upgrade your R22 system to a heat pump in NJ and get up to $20K in combined PSE&G and federal rebates. Free assessment and paperwork handling.",
    excerpt: "Upgrading from R22 to a heat pump is the smartest move for NJ homeowners. Up to $20K in rebates available.",
    sections: [
      {
        type: "intro",
        content: "A heat pump is the ideal replacement for an R22 system. It provides both heating and cooling in one unit, runs on electricity instead of fossil fuels, and qualifies for the highest available NJ rebates. Here is everything you need to know about the upgrade.",
      },
      { type: "h2", content: "Why a Heat Pump Is the Best R22 Replacement" },
      {
        type: "paragraph",
        content: "Your R22 system only provides cooling. A heat pump provides both heating and cooling using a single outdoor unit. Modern heat pumps are 300% efficient — for every dollar of electricity they use, they produce three dollars worth of heating or cooling. This means you can eliminate your gas furnace or oil boiler entirely and run your entire home comfort system on one efficient electric unit. NJ homeowners who switch from R22 AC plus gas or oil heat to a heat pump typically see their total energy costs drop by 40-60%.",
      },
      { type: "stat_box", content: "Heat Pump Efficiency: 300% (3x output per dollar) | Energy Cost Reduction: 40-60% | Systems Replaced: AC + Furnace = 1 Heat Pump" },
      { type: "h2", content: "How to Stack Every Available Rebate" },
      {
        type: "numbered_list",
        items: [
          "PSE&G Clean Heat rebate — up to $18,000 for qualifying heat pump installation",
          "Mechanical Enterprise credit — up to $2,000 for qualifying customers",
          "Federal 25C tax credit — up to $2,000 on your annual tax return",
          "Combined total — up to $22,000 in incentives (rebates + tax credit)",
        ],
      },
      {
        type: "paragraph",
        content: "The PSE&G rebate is the largest single incentive. The amount depends on your current heating system, the heat pump model you install, and your home characteristics. Homes switching from oil heat or electric resistance heat typically qualify for the highest rebate tier. We identify every program you qualify for and handle all applications at no cost. See our guide to PSE&G rebates for step-by-step details.",
      },
      { type: "h2", content: "The R22 to Heat Pump Upgrade Process" },
      {
        type: "numbered_list",
        items: [
          "Free assessment — we evaluate your R22 system, home size, insulation, and ductwork",
          "System recommendation — we specify the right heat pump model for your home",
          "Rebate calculation — we identify every incentive you qualify for and show your net cost",
          "Installation — typically completed in 1-2 days with minimal disruption",
          "Rebate filing — we submit all PSE&G and other applications on your behalf",
          "Follow-up — we confirm your system is performing as expected and rebates are processing",
        ],
      },
      {
        type: "paragraph",
        content: "The entire process from assessment to installation typically takes 2-4 weeks. Rebate checks arrive 6-12 weeks after installation. Call (862) 423-9396 to start with a free assessment.",
      },
      {
        type: "cta_box",
        content: "Ready to upgrade from R22 to a heat pump? Find out exactly how much you qualify for with a free home assessment.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "Commercial R22 System Replacement in NJ — 80% Covered by PSE&G",
    slug: "r22-commercial-replacement-nj",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Commercial",
    metaDescription: "NJ commercial buildings with R22 systems can get up to 80% of replacement costs covered by PSE&G Direct Install Program. Free assessment.",
    excerpt: "NJ commercial property owners with R22 systems can get up to 80% of replacement costs covered through PSE&G Direct Install.",
    sections: [
      {
        type: "intro",
        content: "Commercial buildings in NJ face the same R22 ban as residential properties, but the solution is different — and in many ways better. The PSE&G Direct Install Program covers up to 80% of HVAC replacement costs for qualifying commercial properties, and lighting upgrades are 100% free.",
      },
      { type: "h2", content: "The PSE&G Direct Install Program for Commercial R22" },
      {
        type: "paragraph",
        content: "PSE&G Direct Install is designed specifically for small to medium commercial properties in NJ. If your commercial building uses R22 HVAC equipment, you qualify for up to 80% coverage on the replacement cost. This is not a rebate you apply for after the fact — PSE&G pays the contractor directly, so your out-of-pocket cost is only 20% of the total project. For a $30,000 commercial HVAC replacement, you would pay approximately $6,000. The program also includes 100% free lighting upgrades — LED retrofits for your entire building at no cost to you.",
      },
      { type: "stat_box", content: "HVAC Coverage: Up to 80% by PSE&G | Lighting Upgrades: 100% Free | Your Cost: As low as 20% of total project" },
      { type: "h2", content: "Which Commercial Properties Qualify?" },
      {
        type: "checklist",
        items: [
          "Office buildings and professional spaces",
          "Restaurants and food service establishments",
          "Retail stores and shopping centers",
          "Churches and houses of worship",
          "Nonprofit organizations",
          "Warehouses and light industrial facilities",
          "Medical and dental offices",
          "Multi-unit residential buildings (5+ units)",
        ],
      },
      {
        type: "paragraph",
        content: "Most commercial properties served by PSE&G qualify for the Direct Install Program. The property must be in PSE&G service territory and have existing HVAC equipment that is being replaced with higher-efficiency systems. There is no minimum or maximum building size requirement, though the program is designed primarily for small to medium commercial properties.",
      },
      { type: "h2", content: "How to Get Started with Commercial R22 Replacement" },
      {
        type: "paragraph",
        content: "Mechanical Enterprise is a certified PSE&G Direct Install contractor. We handle the entire process — assessment, PSE&G application, equipment selection, installation, and all paperwork. Our commercial assessment is free and typically takes 30-60 minutes depending on building size. We evaluate your existing R22 equipment, calculate your coverage amount, and provide a detailed proposal showing your cost after PSE&G covers their portion. Call (862) 423-9396 to schedule your free commercial assessment.",
      },
      {
        type: "cta_box",
        content: "Own a commercial property with R22 HVAC? Get a free assessment and find out how much PSE&G will cover.",
        buttonText: "Schedule Commercial Assessment",
        buttonUrl: "https://mechanicalenterprise.com/commercial",
      },
    ],
  },

  {
    title: "How to Use PSE&G Rebates to Replace Your R22 System in NJ",
    slug: "pseg-rebate-r22-replacement-nj",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "PSE&G offers up to $18,000 in rebates for replacing R22 systems with heat pumps in NJ. Here's exactly how to claim it.",
    excerpt: "PSE&G offers up to $18K for R22 system replacement in NJ. Here is exactly how the rebate process works step by step.",
    sections: [
      {
        type: "intro",
        content: "PSE&G's NJ Clean Heat program is the largest single source of rebate money for R22 system replacement. Up to $18,000 is available for qualifying heat pump installations. Here is exactly how to claim every dollar you are entitled to.",
      },
      { type: "h2", content: "PSE&G Clean Heat Program — How It Works" },
      {
        type: "paragraph",
        content: "The PSE&G NJ Clean Heat program incentivizes homeowners to switch from fossil fuel and outdated cooling systems to high-efficiency heat pumps. The rebate amount depends on your current heating system type, the heat pump you install, and your home characteristics. Homes replacing R22 AC systems are strong candidates because the old system is inherently inefficient and uses a banned refrigerant. PSE&G wants these systems off the grid, which is why rebate amounts are so generous for R22 replacements.",
      },
      { type: "stat_box", content: "PSE&G Clean Heat: Up to $18,000 | Processing Time: 6-12 weeks | Required: Licensed NJ contractor + qualifying equipment" },
      { type: "h2", content: "Step-by-Step Rebate Process" },
      {
        type: "numbered_list",
        items: [
          "Schedule a free assessment with a PSE&G certified contractor like Mechanical Enterprise",
          "Contractor evaluates your R22 system and recommends qualifying replacement equipment",
          "Contractor provides a quote showing the total cost and estimated rebate amount",
          "You approve the project and installation is scheduled",
          "Contractor installs the new heat pump system (typically 1-2 days)",
          "Contractor submits the PSE&G rebate application with all required documentation",
          "PSE&G reviews and approves the application (typically 4-8 weeks)",
          "You receive your rebate check directly from PSE&G",
        ],
      },
      { type: "h2", content: "Common Mistakes That Reduce Your Rebate" },
      {
        type: "paragraph",
        content: "The biggest mistake homeowners make is choosing a contractor who is not experienced with PSE&G rebate applications. Incomplete paperwork, wrong equipment specifications, or missed deadlines can reduce or eliminate your rebate. Some contractors also recommend equipment that does not qualify for the highest rebate tier, leaving thousands on the table. Mechanical Enterprise specializes in maximizing PSE&G rebates — we know exactly which equipment qualifies for the highest tier and we file every application correctly the first time.",
      },
      { type: "h2", content: "Why Work with a Certified Contractor" },
      {
        type: "paragraph",
        content: "PSE&G requires that installations be performed by a licensed NJ HVAC contractor. But beyond the basic requirement, working with a contractor who has deep experience with PSE&G rebates makes a significant difference in your rebate amount. Mechanical Enterprise has processed hundreds of PSE&G rebate applications and knows how to document installations to maximize approval amounts. We handle all paperwork at no additional cost. Call (862) 423-9396 to get started.",
      },
      {
        type: "cta_box",
        content: "Want to use PSE&G rebates to replace your R22 system? We handle the entire process. Free assessment and rebate calculation.",
        buttonText: "Start Your PSE&G Rebate",
        buttonUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj",
      },
    ],
  },

  {
    title: "Replace Both Your R22 AC and Oil Furnace at Once — Maximize NJ Rebates",
    slug: "r22-oil-heat-replacement-nj",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "Replace your R22 AC and oil furnace together with one heat pump and maximize NJ rebates. Up to $20K available for combined replacement.",
    excerpt: "If you have an R22 AC and oil furnace, replacing both with one heat pump maximizes your NJ rebates up to $20K.",
    sections: [
      {
        type: "intro",
        content: "Many NJ homes built before 2000 have two systems that are both expensive to maintain — an R22 air conditioner and an oil-fired furnace or boiler. A heat pump replaces both with a single system, and NJ rebates for this switch are at their highest because you are eliminating both a banned refrigerant and fossil fuel heating.",
      },
      { type: "h2", content: "Why R22 Homes Often Have Oil Heat Too" },
      {
        type: "paragraph",
        content: "Homes built in the 1960s through 1990s across NJ were commonly equipped with oil-fired heating and R22 central air conditioning as separate systems. If your home has an oil tank in the basement and an outdoor AC unit from that era, you almost certainly have this combination. Both systems are now expensive liabilities — R22 is banned and oil prices fluctuate wildly, averaging $4 to $5 per gallon in NJ. Together these two systems can cost $5,000 to $8,000 per year in combined energy and maintenance costs.",
      },
      { type: "stat_box", content: "Oil Heat Cost: $3,000-$5,000/year | R22 AC Cost: $1,500-$3,000/year | Heat Pump Cost: $1,200-$2,000/year | Annual Savings: $3,000-$6,000" },
      { type: "h2", content: "One Heat Pump Replaces Both Systems" },
      {
        type: "paragraph",
        content: "A modern heat pump provides both heating and cooling from a single outdoor unit. In cooling mode it works like a high-efficiency air conditioner. In heating mode it reverses the cycle and extracts heat from outdoor air — even in cold NJ winters. Modern cold-climate heat pumps operate efficiently down to -15 degrees Fahrenheit, well below the coldest NJ temperatures. By installing one heat pump you eliminate your R22 AC, your oil furnace, your oil tank, and your annual oil delivery costs.",
      },
      { type: "h2", content: "Maximum Rebates for Oil-to-Heat-Pump Conversions" },
      {
        type: "paragraph",
        content: "PSE&G and NJ Clean Energy programs offer their highest rebate tiers for homes converting from oil heat to heat pumps. This is because oil-to-electric conversions have the biggest impact on carbon reduction, which is the primary goal of these incentive programs. Combined with the R22 system replacement, you are hitting two priority targets at once — removing a banned refrigerant and eliminating fossil fuel heating. This positions you for maximum rebates of up to $18,000 from PSE&G plus up to $2,000 from Mechanical Enterprise. Call (862) 423-9396 to find out your exact rebate amount.",
      },
      {
        type: "cta_box",
        content: "Have both R22 AC and oil heat? You are in the highest rebate tier. Find out exactly how much you qualify for.",
        buttonText: "Calculate My Rebates",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "How Old Is Your HVAC System? NJ Systems Over 10 Years Old May Use R22",
    slug: "r22-system-age-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "HVAC systems installed before 2010 in NJ likely use R22 refrigerant. Here's how to check and what to do about it.",
    excerpt: "If your HVAC was installed before 2010, it probably uses R22. Here is how to check and what NJ homeowners should do about it.",
    sections: [
      {
        type: "intro",
        content: "Not every homeowner knows what refrigerant their AC uses. But if your system was installed before 2010, there is a high probability it runs on R22 — a refrigerant that has been banned since 2020. Here is how to find out and why it matters for your wallet.",
      },
      { type: "h2", content: "The R22 Timeline — When Systems Were Made" },
      {
        type: "paragraph",
        content: "R22 was the standard residential refrigerant from the 1970s through the mid-2000s. Manufacturers began transitioning to R410A around 2006, and by January 2010 all new AC systems were required to use R410A or another approved refrigerant. This means any AC system manufactured before 2010 almost certainly uses R22. Systems manufactured between 2006 and 2010 could use either refrigerant. If your system was installed in 2010 or later, it likely uses R410A and you do not have the R22 problem.",
      },
      { type: "h2", content: "3 Ways to Check If Your System Uses R22" },
      {
        type: "numbered_list",
        items: [
          "Check the label on your outdoor unit — look for a sticker or nameplate that lists the refrigerant type. It will say R22, HCFC-22, or R410A. The label is usually on the side or back of the outdoor condenser unit.",
          "Check the installation date — look at your home purchase records, warranty documents, or the unit nameplate for a manufacture date. Any system made before 2010 is very likely R22.",
          "Look up the model number — find the model number on your outdoor unit nameplate and search it online. The manufacturer specification sheet will list the refrigerant type.",
        ],
      },
      { type: "stat_box", content: "Systems before 2006: 99% use R22 | Systems 2006-2010: Mixed R22/R410A | Systems after 2010: R410A or newer | Efficiency loss by age 15+: 30-50%" },
      { type: "h2", content: "Why System Age Matters for Rebates" },
      {
        type: "paragraph",
        content: "Older R22 systems are dramatically less efficient than modern heat pumps. A 15-year-old R22 system operates at roughly 10 SEER, while a modern heat pump operates at 18-22 SEER — nearly double the efficiency. This means your current system uses almost twice as much electricity as a new one to produce the same amount of cooling. NJ rebate programs specifically target older, less efficient systems because replacing them has the biggest impact on energy savings and carbon reduction. If your R22 system is 15 or more years old, you are likely to qualify for the highest rebate tier. Call (862) 423-9396 to confirm your system age and rebate eligibility.",
      },
      {
        type: "cta_box",
        content: "Not sure about your system? Our free assessment includes R22 identification, age verification, and a complete rebate calculation.",
        buttonText: "Book Free System Check",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "R22 System Replacement in Essex County NJ — Local Rebates Available",
    slug: "r22-essex-county-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "Essex County NJ homeowners with R22 systems qualify for up to $20K in local PSE&G rebates. Free assessment from a certified local contractor.",
    excerpt: "Essex County NJ homeowners with R22 systems can get up to $20K in PSE&G rebates. Local certified contractor serving Newark, Montclair, and more.",
    sections: [
      {
        type: "intro",
        content: "Essex County has some of the oldest housing stock in NJ, which means a high concentration of homes still running on R22 systems. If you live in Essex County, here is how local homeowners are replacing their R22 systems and getting up to $20,000 in rebates.",
      },
      { type: "h2", content: "Why Essex County Has So Many R22 Systems" },
      {
        type: "paragraph",
        content: "Much of Essex County was built between the 1940s and 1990s — decades when R22 was the only residential refrigerant available. Towns like Newark, East Orange, Irvington, and Bloomfield have large numbers of homes with original HVAC systems or systems replaced during the R22 era. Even homes in Montclair, West Orange, South Orange, and Maplewood that were renovated in the 1990s and 2000s likely had R22 systems installed. These systems are now 15 to 30 years old, running inefficiently, and using a banned refrigerant.",
      },
      { type: "h2", content: "Essex County Towns We Serve" },
      {
        type: "checklist",
        items: [
          "Newark",
          "Montclair",
          "West Orange",
          "East Orange",
          "Orange",
          "South Orange",
          "Maplewood",
          "Irvington",
          "Bloomfield",
          "Nutley",
          "Belleville",
          "Livingston",
        ],
      },
      {
        type: "paragraph",
        content: "Mechanical Enterprise is based in the Essex County area and serves every town in the county. As a local contractor, we understand the specific housing types, building codes, and utility infrastructure across Essex County. Our technicians drive less distance to your home, which means faster response times and lower overhead costs. We are also deeply familiar with PSE&G service territory boundaries in Essex County.",
      },
      { type: "h2", content: "PSE&G Rebates for Essex County Homeowners" },
      {
        type: "paragraph",
        content: "All of Essex County is within PSE&G service territory, which means every homeowner qualifies for PSE&G Clean Heat rebates of up to $18,000 for heat pump installation. Combined with Mechanical Enterprise credits of up to $2,000, Essex County homeowners can receive up to $20,000 toward their R22 system replacement. We handle all PSE&G paperwork and rebate applications at no cost. Call (862) 423-9396 to schedule your free assessment.",
      },
      {
        type: "cta_box",
        content: "Essex County homeowner with an R22 system? Get your free local assessment and rebate calculation.",
        buttonText: "Book Essex County Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "R22 System Replacement in Hudson County NJ — Up to $20K Available",
    slug: "r22-hudson-county-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "Hudson County NJ homeowners with R22 AC systems can get up to $20K in PSE&G rebates. Jersey City, Hoboken, Bayonne area contractor.",
    excerpt: "Hudson County homeowners with R22 systems qualify for up to $20K in rebates. Serving Jersey City, Hoboken, Bayonne, and surrounding areas.",
    sections: [
      {
        type: "intro",
        content: "Hudson County is one of the most densely populated counties in the entire United States, with a mix of older rowhouses, mid-rise apartments, and modern condos. Many of these buildings still rely on R22 air conditioning. Here is what Hudson County homeowners need to know about replacement and rebates.",
      },
      { type: "h2", content: "R22 Challenges in Hudson County" },
      {
        type: "paragraph",
        content: "Hudson County homes present unique HVAC challenges. Many are rowhouses or attached units where outdoor condenser placement is limited. Older buildings in Jersey City, Bayonne, and Union City often have R22 window units or through-wall systems that are loud, inefficient, and impossible to recharge at a reasonable cost. Even single-family homes in North Bergen, Secaucus, and Kearny that have central R22 systems face the same ban — the refrigerant is unavailable at affordable prices and the systems cannot be maintained long-term.",
      },
      { type: "h2", content: "Hudson County Towns We Serve" },
      {
        type: "checklist",
        items: [
          "Jersey City",
          "Hoboken",
          "Bayonne",
          "North Bergen",
          "West New York",
          "Union City",
          "Secaucus",
          "Weehawken",
          "Guttenberg",
          "Harrison",
          "Kearny",
        ],
      },
      { type: "h2", content: "Ductless Solutions for Hudson County Homes" },
      {
        type: "paragraph",
        content: "Many Hudson County homes lack ductwork, which makes ductless mini-split heat pumps the ideal R22 replacement. Ductless systems require only a small hole in the wall for refrigerant lines — no major construction or ductwork installation needed. They are whisper-quiet compared to old R22 window units and provide both heating and cooling. PSE&G rebates apply to ductless systems just as they do to central heat pumps, with combined rebates available up to $20,000. Mechanical Enterprise has extensive experience installing ductless systems in Hudson County's tight spaces and historic homes. Call (862) 423-9396 for a free assessment.",
      },
      {
        type: "cta_box",
        content: "Hudson County homeowner with R22? Find out how much you qualify for — free assessment, no obligation.",
        buttonText: "Book Hudson County Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "R22 AC Replacement in Bergen County NJ — PSE&G Rebates Up to $20K",
    slug: "r22-bergen-county-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "Bergen County NJ homeowners with R22 systems qualify for PSE&G rebates up to $20K. Serving Hackensack, Paramus, Teaneck, and surrounding areas.",
    excerpt: "Bergen County homeowners with R22 AC systems can replace and get up to $20K in PSE&G rebates. Free assessment available.",
    sections: [
      {
        type: "intro",
        content: "Bergen County is one of the most affluent counties in NJ, with larger homes that often have higher-capacity R22 systems. The good news is that larger systems mean larger rebates. Here is how Bergen County homeowners are taking advantage.",
      },
      { type: "h2", content: "Larger Homes Mean Bigger Rebates" },
      {
        type: "paragraph",
        content: "Bergen County homes in towns like Alpine, Saddle River, Franklin Lakes, and Wyckoff tend to be larger than the NJ average. Larger homes require higher-capacity HVAC systems, which cost more to install but also qualify for higher rebate amounts. A 3,000 to 5,000 square foot Bergen County home replacing an R22 system with a multi-zone heat pump can receive rebates at the top of the PSE&G scale. Many Bergen County homeowners we serve receive $15,000 to $18,000 in PSE&G rebates alone, plus up to $2,000 from Mechanical Enterprise.",
      },
      { type: "h2", content: "Bergen County Towns We Serve" },
      {
        type: "checklist",
        items: [
          "Hackensack",
          "Paramus",
          "Teaneck",
          "Englewood",
          "Fort Lee",
          "Edgewater",
          "Palisades Park",
          "Ridgefield",
          "Fairview",
          "Cliffside Park",
          "Alpine",
          "Saddle River",
          "Franklin Lakes",
          "Wyckoff",
        ],
      },
      { type: "h2", content: "Bergen County R22 Replacement Process" },
      {
        type: "paragraph",
        content: "The process is straightforward. We schedule a free assessment at your Bergen County home, evaluate your R22 system and home characteristics, and provide a detailed proposal showing your total cost, rebate amount, and net out-of-pocket expense. Most Bergen County homeowners are surprised by how little they pay after rebates — many pay nothing. We handle all PSE&G paperwork and rebate applications. Installation typically takes 1-2 days for standard systems and 2-3 days for larger multi-zone installations. Call (862) 423-9396 to schedule your free Bergen County assessment.",
      },
      {
        type: "cta_box",
        content: "Bergen County homeowner with an R22 system? Your larger home may qualify for even bigger rebates. Free assessment.",
        buttonText: "Book Bergen County Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "Replace Your R22 System in Passaic County NJ — Get Up to $20K Back",
    slug: "r22-passaic-county-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "Passaic County NJ homeowners can replace R22 AC systems and get up to $20K in PSE&G rebates. Serving Paterson, Clifton, Wayne.",
    excerpt: "Passaic County homeowners with R22 systems qualify for up to $20K in NJ rebates. Serving Paterson, Clifton, Wayne, and more.",
    sections: [
      {
        type: "intro",
        content: "Passaic County has a diverse mix of housing — from urban multi-family homes in Paterson to suburban single-family houses in Wayne and Clifton. Regardless of your housing type, if you have an R22 system, PSE&G rebates of up to $20,000 are available.",
      },
      { type: "h2", content: "Passaic County Housing and R22" },
      {
        type: "paragraph",
        content: "Paterson and Passaic city have many older multi-family buildings with R22 systems serving individual units. These buildings were built in the 1950s through 1980s and often have window units or through-wall R22 systems. Suburban towns like Clifton, Wayne, Hawthorne, and Woodland Park have primarily single-family homes with central R22 air conditioning. West Milford and Pompton Lakes have a mix of older and newer housing. All of these housing types qualify for PSE&G rebates when replacing R22 systems with qualifying heat pumps.",
      },
      { type: "h2", content: "Passaic County Towns We Serve" },
      {
        type: "checklist",
        items: [
          "Paterson",
          "Clifton",
          "Wayne",
          "Passaic",
          "Hawthorne",
          "Woodland Park",
          "Totowa",
          "Little Falls",
          "West Milford",
          "Pompton Lakes",
          "Wanaque",
        ],
      },
      { type: "h2", content: "Getting Started in Passaic County" },
      {
        type: "paragraph",
        content: "Mechanical Enterprise serves all of Passaic County with free R22 assessments. We evaluate your current system, determine your exact rebate eligibility, and provide a clear proposal with no surprises. Whether you have a single-family home in Wayne or a multi-unit building in Paterson, we have experience with your housing type. PSE&G rebates of up to $18,000 combined with ME credits of up to $2,000 mean most Passaic County homeowners pay a fraction of the total cost — or nothing at all. Call (862) 423-9396 to book your free assessment.",
      },
      {
        type: "cta_box",
        content: "Passaic County homeowner with R22? Find out what you qualify for — free assessment, no obligation.",
        buttonText: "Book Passaic County Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "7 Signs Your R22 System Is Failing and It Is Time to Replace It in NJ",
    slug: "signs-r22-system-failing-nj",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "Watch for these 7 warning signs that your R22 AC system is failing in NJ. Replace before it breaks and get up to $20K in rebates.",
    excerpt: "These 7 warning signs mean your R22 system is failing. NJ homeowners who replace proactively save thousands and get up to $20K in rebates.",
    sections: [
      {
        type: "intro",
        content: "R22 systems do not fail all at once — they deteriorate gradually. Knowing the warning signs lets you plan a replacement on your schedule instead of scrambling in an emergency. Here are 7 signs your R22 system is on its way out.",
      },
      { type: "h2", content: "The 7 Warning Signs" },
      {
        type: "numbered_list",
        items: [
          "Rising energy bills — if your electric bill has increased 20% or more year over year without changes in usage, your R22 system is losing efficiency as it ages and components wear down",
          "Frequent repairs — if you have called for service more than twice in the past 12 months, your system is entering the failure cascade where one failing component stresses others",
          "Uneven cooling — hot spots or rooms that never reach the set temperature indicate your system can no longer distribute cooled air effectively, often due to a failing compressor or low refrigerant",
          "Strange noises — grinding, squealing, banging, or rattling sounds from the outdoor unit signal worn bearings, loose components, or a compressor that is about to seize",
          "Short cycling — the system turns on and off frequently in rapid cycles instead of running steadily, which indicates a refrigerant leak, electrical issue, or failing compressor",
          "Warm air from vents — if your system is running but blowing lukewarm air, it has likely lost a significant amount of R22 refrigerant through leaks and cannot cool effectively",
          "Excessive moisture or ice — unusual condensation around the indoor unit or ice forming on the outdoor unit are signs of refrigerant problems that are expensive to fix on R22 systems",
        ],
      },
      { type: "stat_box", content: "Emergency Replacement Cost Premium: 10-20% more | Planned Replacement: Full rebate access, best scheduling | Average Warning Period: 6-12 months before complete failure" },
      { type: "h2", content: "Why Proactive Replacement Saves Money" },
      {
        type: "paragraph",
        content: "Homeowners who replace their R22 system before complete failure save money in multiple ways. They avoid emergency pricing premiums of 10-20%. They choose from the full range of equipment options instead of whatever is in stock. They schedule installation during spring when contractors have availability and pricing is competitive. They also access the full range of rebate programs with proper documentation. An emergency replacement in July leaves no time for optimal rebate applications. Read our guide on when to replace your R22 system for more timing advice.",
      },
      { type: "h2", content: "What to Do If You See These Signs" },
      {
        type: "paragraph",
        content: "If you recognize two or more of these signs in your R22 system, schedule a free assessment now — before the system fails completely. Mechanical Enterprise will evaluate your system, confirm whether it uses R22, and calculate your exact rebate eligibility. There is no cost and no obligation. Most NJ homeowners qualify for PSE&G rebates up to $18,000 plus ME credits up to $2,000. Call (862) 423-9396 today.",
      },
      {
        type: "cta_box",
        content: "Seeing warning signs from your R22 system? Get ahead of the problem. Free assessment and rebate calculation.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "How Much Does R22 Freon Cost in 2026? Why NJ Homeowners Are Replacing Instead",
    slug: "r22-freon-cost-2026-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "R22 freon costs $100-200 per pound in 2026 because it is banned. NJ homeowners are replacing their systems and getting up to $20K in rebates instead.",
    excerpt: "R22 freon costs $100-200 per pound in 2026 and rising. Here is why NJ homeowners are replacing their systems instead of recharging.",
    sections: [
      {
        type: "intro",
        content: "If your HVAC technician quoted you $800 to $2,000 for an R22 recharge and you thought that sounded high, you are right. R22 prices have skyrocketed since the 2020 ban and will only continue to rise. Here is what is happening and why replacement makes more sense.",
      },
      { type: "h2", content: "R22 Price History — A Disappearing Supply" },
      {
        type: "paragraph",
        content: "Before the phase-out began, R22 cost contractors about $10 to $15 per pound wholesale. As the phase-out progressed through the 2010s, prices climbed steadily. After the complete ban on production and import in January 2020, the only R22 available is reclaimed from old systems being decommissioned. This finite and shrinking supply has driven wholesale prices to $50 to $100 per pound, which translates to $100 to $200 per pound retail when you factor in contractor markup, handling, and labor. A typical residential recharge uses 3 to 10 pounds of refrigerant.",
      },
      { type: "stat_box", content: "R22 Price 2015: $15/lb | R22 Price 2020: $50/lb | R22 Price 2026: $100-200/lb | Typical Recharge: 3-10 lbs = $500-$2,000" },
      { type: "h2", content: "Why Recharging Is Throwing Money Away" },
      {
        type: "paragraph",
        content: "An R22 recharge does not fix anything — it just adds refrigerant to compensate for a leak. The leak is still there and the system will lose refrigerant again within months. You are paying $500 to $2,000 every time, potentially multiple times per year, to keep a dying system running. Over 2 to 3 years, many homeowners spend $3,000 to $6,000 on recharges alone — and still end up needing a full replacement. That $3,000 to $6,000 wasted on recharges would have been better spent toward a new system that comes with up to $20,000 in NJ rebates.",
      },
      { type: "h2", content: "The Smarter Financial Move" },
      {
        type: "paragraph",
        content: "Instead of paying $100 to $200 per pound for banned refrigerant, NJ homeowners are replacing their R22 systems with heat pumps and receiving PSE&G rebates of up to $18,000 plus Mechanical Enterprise credits of up to $2,000. Many pay nothing out of pocket for a brand new system that is twice as efficient as their old R22 unit. The monthly energy savings of $150 to $300 start immediately. Every dollar you spend on R22 recharges is a dollar you will never see again — but a new heat pump pays for itself and then some. Call (862) 423-9396 for a free assessment to see your numbers.",
      },
      {
        type: "cta_box",
        content: "Stop paying $100-200 per pound for banned refrigerant. Replace your R22 system and get up to $20K in NJ rebates.",
        buttonText: "Get Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "How Much Will You Save by Replacing Your R22 System with a Heat Pump in NJ?",
    slug: "r22-heat-pump-savings-nj",
    date: "April 8, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "NJ homeowners who replace R22 systems with heat pumps save $150-300 per month on energy bills plus get up to $20K in rebates.",
    excerpt: "Replacing your R22 system with a heat pump saves $150-300 per month on energy bills in NJ, plus you get up to $20K in rebates.",
    sections: [
      {
        type: "intro",
        content: "The upfront rebates get the headlines, but the ongoing savings are what really make R22-to-heat-pump replacement a financial no-brainer for NJ homeowners. Here is a detailed breakdown of what you can expect to save every month and over the life of your new system.",
      },
      { type: "h2", content: "Monthly Energy Savings Breakdown" },
      {
        type: "paragraph",
        content: "An R22 system typically operates at 8 to 10 SEER efficiency. A modern heat pump operates at 18 to 22 SEER — roughly twice as efficient for cooling. For heating, the comparison is even more dramatic. If you currently heat with oil at $4.50 per gallon or natural gas, a heat pump provides the same heating at roughly 40-60% lower cost because it moves heat rather than generating it through combustion. NJ homeowners who replace R22 AC plus oil or gas heating with a heat pump typically see their combined energy bills drop from $400 to $600 per month to $150 to $250 per month during peak heating and cooling seasons.",
      },
      { type: "stat_box", content: "Cooling Savings: 50% lower electric bills | Heating Savings: 40-60% vs oil/gas | Monthly Reduction: $150-$300 | 15-Year Savings: $27,000-$54,000" },
      { type: "h2", content: "Where the Savings Come From" },
      {
        type: "numbered_list",
        items: [
          "Cooling efficiency — your new system uses half the electricity for the same cooling output",
          "Heating efficiency — heat pumps are 300% efficient vs 80-95% for furnaces and boilers",
          "No oil delivery — eliminating oil heat saves $2,000 to $4,000 per year in NJ",
          "No R22 recharges — stop paying $500 to $2,000 per year for banned refrigerant",
          "Lower maintenance — new systems need less frequent and less expensive maintenance",
          "Smart controls — modern heat pumps include smart thermostats that optimize scheduling",
        ],
      },
      { type: "h2", content: "Total Savings Over 15 Years" },
      {
        type: "paragraph",
        content: "A typical NJ homeowner who replaces their R22 system with a heat pump saves $150 to $300 per month on energy costs. Over the 15 to 20 year lifespan of a heat pump, that adds up to $27,000 to $72,000 in cumulative savings. Add the upfront rebates of up to $20,000 from PSE&G and Mechanical Enterprise, and the total financial benefit of replacing your R22 system reaches $47,000 to $92,000. There is no scenario where keeping an R22 system makes financial sense. Call (862) 423-9396 to get your personalized savings estimate.",
      },
      {
        type: "cta_box",
        content: "Want to know your exact monthly savings? Our free assessment includes a personalized energy savings calculation.",
        buttonText: "Calculate My Savings",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "How to Tell If Your NJ Home Has an R22 System — 3 Easy Ways to Check",
    slug: "r22-system-check-nj",
    date: "April 8, 2026",
    readTime: "3 min read",
    category: "Residential",
    metaDescription: "Not sure if your AC uses R22? Here are 3 easy ways NJ homeowners can check before calling a contractor.",
    excerpt: "Not sure if your AC uses R22 refrigerant? Here are 3 easy ways to check without calling a technician.",
    sections: [
      {
        type: "intro",
        content: "You have heard that R22 is banned and NJ homeowners can get up to $20,000 in rebates for replacing R22 systems. But you are not sure if your AC actually uses R22. Here are three simple ways to find out in the next 10 minutes.",
      },
      { type: "h2", content: "Method 1 — Check the Outdoor Unit Label" },
      {
        type: "paragraph",
        content: "Walk outside to your air conditioning condenser — the box-shaped unit with a fan on top, usually located on the side or back of your house. Look for a metal nameplate or sticker on the unit. It will list the manufacturer, model number, serial number, and refrigerant type. If you see R-22, HCFC-22, or R22 listed under refrigerant, your system uses the banned refrigerant. If you see R-410A, your system uses the newer refrigerant and does not have the R22 issue.",
      },
      { type: "h2", content: "Method 2 — Check the Installation Date" },
      {
        type: "paragraph",
        content: "If the label is faded or hard to read, check the installation date. Look at the serial number on the nameplate — many manufacturers encode the manufacture date in the first few characters. You can also check your home purchase inspection report, warranty documents, or prior HVAC service records. If the system was installed before 2010, it almost certainly uses R22. Systems installed between 2006 and 2010 could use either R22 or R410A. Systems installed after 2010 use R410A or newer refrigerants.",
      },
      { type: "h2", content: "Method 3 — Look Up the Model Number Online" },
      {
        type: "paragraph",
        content: "Find the model number on the nameplate of your outdoor unit and search for it online. Enter the brand name and model number into any search engine. The manufacturer specification sheet will clearly list the refrigerant type. This is the most definitive method if the label on the unit is damaged or illegible. You can also call the manufacturer customer service line with your model number and they will tell you the refrigerant type.",
      },
      {
        type: "numbered_list",
        items: [
          "Go outside and find your AC condenser unit",
          "Look for the nameplate or sticker on the side or back",
          "Find the refrigerant type — R-22 means you have the banned refrigerant",
          "If unreadable, check the install date — before 2010 means likely R22",
          "If still unsure, search the model number online for specifications",
        ],
      },
      { type: "h2", content: "What to Do If You Confirm R22" },
      {
        type: "paragraph",
        content: "If your system uses R22, do not panic but do not wait either. Your system still works — but when it needs refrigerant or a major repair, the costs will be extreme because R22 is banned. The best move is to get a free assessment now while rebates are at their highest. NJ homeowners qualify for up to $20,000 in combined PSE&G and Mechanical Enterprise rebates. Call (862) 423-9396 or book online. See our complete guide to R22 replacement for full details.",
      },
      {
        type: "cta_box",
        content: "Confirmed R22? Or still not sure? Either way, our free assessment identifies your refrigerant type and calculates your rebate amount.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "How Long Does R22 System Replacement Take in NJ? What to Expect",
    slug: "r22-replacement-timeline-nj",
    date: "April 8, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "R22 system replacement in NJ typically takes 1-2 days. Here is what to expect from assessment to installation to rebate check.",
    excerpt: "R22 system replacement takes 1-2 days in NJ. Here is the full timeline from free assessment to rebate check in your mailbox.",
    sections: [
      {
        type: "intro",
        content: "One of the most common concerns we hear from NJ homeowners is how long the process takes. The answer is shorter than most people expect. Here is a complete timeline so you know exactly what to plan for.",
      },
      { type: "h2", content: "The Full Timeline — Assessment to Rebate Check" },
      {
        type: "numbered_list",
        items: [
          "Day 1 — Free Assessment (20-30 minutes): We visit your home, evaluate your R22 system, measure your home, check ductwork and electrical, and calculate your exact rebate amount. You leave with a written proposal showing total cost, rebate amount, and net out-of-pocket cost.",
          "Days 2-7 — Decision and Scheduling: You review the proposal and decide to proceed. We order your equipment and schedule your installation date. Most equipment ships within 3-5 business days.",
          "Installation Day 1 (6-8 hours): Our crew removes your old R22 system, installs the new heat pump outdoor and indoor units, connects refrigerant lines, and runs electrical. For standard central systems this is a single-day job.",
          "Installation Day 2 if needed (4-6 hours): Larger homes, multi-zone systems, or installations requiring ductwork modifications may need a second day. We complete all connections, test the system thoroughly, and walk you through the controls.",
          "Week 1-2 After Installation: We submit your PSE&G rebate application with all required documentation including installation photos, equipment specifications, and efficiency ratings.",
          "Weeks 6-12 After Submission: PSE&G processes your rebate application and mails your rebate check directly to you. Processing time varies but typically takes 6-12 weeks.",
        ],
      },
      { type: "stat_box", content: "Assessment: 20-30 minutes | Installation: 1-2 days | Rebate Check: 6-12 weeks after submission | Total Process: 2-4 weeks assessment to installation" },
      { type: "h2", content: "How to Prepare Your Home" },
      {
        type: "paragraph",
        content: "Before installation day, clear a 3-foot area around your outdoor AC unit and your indoor furnace or air handler. Make sure our crew has clear access to the electrical panel. If you have pets, plan to keep them in a separate room during installation. The crew will need to turn off your HVAC system for the duration of installation. In warm weather, consider having fans available. In cold weather, have a space heater handy. Most installations are completed within a single day so any discomfort is minimal.",
      },
      { type: "h2", content: "What About Emergency Timelines?" },
      {
        type: "paragraph",
        content: "If your R22 system has already failed and you need immediate replacement, Mechanical Enterprise offers expedited service. We can often perform same-day assessments for emergencies and schedule installation within 2-3 days if equipment is available locally. Emergency replacements still qualify for full PSE&G rebates up to $18,000 plus ME credits up to $2,000 — you do not lose any rebate eligibility by acting fast. Call (862) 423-9396 to discuss your timeline.",
      },
      {
        type: "cta_box",
        content: "Ready to start the process? Book your free 20-minute assessment and get your timeline started.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },

  {
    title: "The Complete NJ Homeowner Guide to Replacing Your R22 System with a Heat Pump",
    slug: "r22-heat-pump-nj-complete-guide",
    date: "April 8, 2026",
    readTime: "8 min read",
    category: "Residential",
    metaDescription: "Everything NJ homeowners need to know about replacing an R22 system with a heat pump — costs, rebates, timeline, and how to get up to $20K back.",
    excerpt: "The complete guide to replacing your R22 system with a heat pump in NJ — costs, rebates, timeline, and how to get up to $20K back.",
    sections: [
      {
        type: "intro",
        content: "This is the comprehensive guide for NJ homeowners considering R22 system replacement. Whether you are just learning about the R22 ban or ready to schedule your replacement, this guide covers everything — what R22 is, how to check your system, your replacement options, costs, rebates, the process, and how to choose a contractor.",
      },
      { type: "h2", content: "What Is R22 and Why Does It Matter?" },
      {
        type: "paragraph",
        content: "R22, also known as Freon, was the standard refrigerant in residential air conditioning from the 1970s through the mid-2000s. It was banned by the EPA on January 1, 2020 because it depletes the ozone layer. No new R22 can be manufactured or imported into the United States. The only R22 available is reclaimed from old systems, which is why prices have risen to $100 to $200 per pound. If your AC was installed before 2010, there is a high probability it uses R22. Check the nameplate on your outdoor unit or look up your model number online to confirm. See our guide to checking your R22 system for step-by-step instructions.",
      },
      { type: "h2", content: "Your Replacement Options" },
      {
        type: "paragraph",
        content: "When replacing an R22 system, you have several options. A central heat pump replaces your existing central AC and can also replace your furnace, providing both heating and cooling from one system. A ductless mini-split heat pump is ideal for homes without ductwork or for adding zones to specific rooms. A hybrid system pairs a heat pump with your existing gas furnace for homes in extremely cold areas, though modern cold-climate heat pumps handle NJ winters without backup. Mechanical Enterprise evaluates your home and recommends the best option for your specific situation, always with an eye toward maximizing your rebate eligibility.",
      },
      {
        type: "checklist",
        items: [
          "Central heat pump — best for homes with existing ductwork, replaces AC + furnace",
          "Ductless mini-split — best for homes without ducts or adding targeted zones",
          "Multi-zone system — best for larger homes needing room-by-room temperature control",
          "Hybrid system — pairs heat pump with existing furnace for extreme cold backup",
        ],
      },
      { type: "h2", content: "Costs and Rebates — The Full Picture" },
      {
        type: "paragraph",
        content: "R22 system replacement in NJ costs $8,000 to $15,000 before rebates, depending on home size and system type. PSE&G Clean Heat rebates cover up to $18,000 for qualifying installations. Mechanical Enterprise credits add up to $2,000. The federal 25C tax credit provides up to $2,000 on your tax return. Combined, these incentives total up to $22,000 — which exceeds the installation cost for most homes. Many NJ homeowners pay nothing out of pocket. Even those who do not qualify for the maximum typically pay 20-40% of the total cost after rebates. Read our detailed cost breakdown for specific numbers by home size and system type.",
      },
      { type: "stat_box", content: "Before Rebates: $8,000-$15,000 | PSE&G Rebate: Up to $18,000 | ME Credit: Up to $2,000 | Federal Tax Credit: Up to $2,000 | Net Cost: Often $0" },
      { type: "h2", content: "The Replacement Process Step by Step" },
      {
        type: "numbered_list",
        items: [
          "Free assessment — 20-30 minutes, we evaluate your system, home, and rebate eligibility",
          "Proposal — detailed written quote showing costs, rebates, and net out-of-pocket expense",
          "Equipment ordering — 3-5 business days for delivery after you approve",
          "Installation — 1-2 days for standard systems, minimal disruption to your home",
          "System testing — thorough performance verification before crew leaves",
          "Rebate submission — we file all PSE&G paperwork within 1-2 weeks of installation",
          "Rebate receipt — PSE&G mails your check within 6-12 weeks of approval",
        ],
      },
      { type: "h2", content: "How to Choose the Right Contractor" },
      {
        type: "paragraph",
        content: "Not all contractors are equal when it comes to R22 replacement and rebate maximization. Look for a contractor that is licensed in NJ, has specific experience with PSE&G rebate applications, and handles all paperwork for you. Ask how many PSE&G rebate applications they have filed and what percentage have been approved at the maximum tier. Mechanical Enterprise has processed hundreds of successful PSE&G applications and maintains a near-perfect approval rate at the highest rebate tiers. We are also WMBE certified and serve all 15 NJ counties. Read our guide to PSE&G rebate contractors for more on what to look for.",
      },
      { type: "h2", content: "Frequently Asked Questions" },
      {
        type: "paragraph",
        content: "Can I just recharge my R22 system? Technically yes, if a technician has reclaimed R22 available. But it costs $500 to $2,000 per recharge and does not fix the underlying problem. Can I switch to R410A without replacing the whole system? No. R22 and R410A operate at different pressures and require different components. The entire system must be replaced. Will my new system work in cold NJ winters? Yes. Modern cold-climate heat pumps operate efficiently down to -15 degrees Fahrenheit, well below NJ minimum temperatures. How long will the rebate programs last? PSE&G programs are funded annually and can be modified or reduced. Current rebate levels are not guaranteed for future years. Call (862) 423-9396 to get started while maximum rebates are available.",
      },
      {
        type: "cta_box",
        content: "Ready to replace your R22 system? Start with a free assessment — we handle everything from equipment selection to rebate paperwork.",
        buttonText: "Book Free Assessment",
        buttonUrl: "https://mechanicalenterprise.com/rebate-calculator",
      },
    ],
  },
];
