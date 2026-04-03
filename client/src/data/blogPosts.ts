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
  // ──────────────────────────────────────────────────────────────
  // POST 1 — Original post (kept)
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Heat Pump Rebates 2026: How to Get Up to $20,000",
    slug: "nj-heat-pump-rebates-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "Complete guide to NJ heat pump rebates in 2026. Learn how to qualify for up to $20,000 in rebates (PSE&G $18K + $2K qualifying credit) plus a $2,000 federal tax credit.",
    excerpt: "NJ homeowners can qualify for up to $20,000 in heat pump rebates in 2026. Here's exactly how to get every dollar you're entitled to.",
    sections: [
      { type: "intro", content: "If you're a New Jersey homeowner thinking about replacing your heating or cooling system, 2026 is the best time to do it. Between PSE&G rebates and the Mechanical Enterprise qualifying credit, you could receive up to $20,000 back on a new heat pump installation — and we handle all the paperwork for free." },
      { type: "h2", content: "What Rebates Are Available for NJ Homeowners in 2026?" },
      { type: "paragraph", content: "New Jersey homeowners installing qualifying heat pump systems can access two major rebate programs in 2026. PSE&G's Clean Heat Program provides up to $18,000 depending on your current system and equipment. Mechanical Enterprise offers an additional qualifying credit of up to $2,000. Combined, that's up to $20,000 in rebates applied directly to your installation cost." },
      { type: "stat_box", content: "PSE&G Clean Heat: Up to $18,000 | ME Qualifying Credit: Up to $2,000 | Combined Total: Up to $20,000" },
      { type: "paragraph", content: "Plus: Federal 25C Tax Credit — claim an additional 30% (up to $2,000) on your taxes separately. See our guide on the federal 25C tax credit for how to file it." },
      { type: "h2", content: "Who Qualifies for NJ Heat Pump Rebates?" },
      { type: "paragraph", content: "Most New Jersey homeowners qualify for at least some rebate amount. Eligibility depends on several factors including your current heating system, the type of heat pump you install, your utility provider, and your property type. Residential homeowners generally qualify for higher rebate amounts than commercial properties, though commercial buildings can receive rebates covering up to 80% of total installation costs." },
      { type: "checklist", items: ["Own a home or commercial property in New Jersey", "Install a qualifying high-efficiency heat pump system", "Work with a licensed NJ HVAC contractor", "Submit rebate applications within the required timeframe", "Meet minimum efficiency requirements (varies by program)"] },
      { type: "h2", content: "What Types of Heat Pumps Qualify?" },
      { type: "paragraph", content: "Not all heat pumps qualify for maximum rebates. To receive the highest rebate amounts, your system must meet specific efficiency requirements. Central heat pump systems, ductless mini-split heat pumps, and cold climate heat pumps are all eligible. The key requirement is that the system must meet minimum HSPF2 and SEER2 efficiency ratings set by the rebate programs." },
      { type: "h2", content: "How to Apply for NJ Heat Pump Rebates" },
      { type: "paragraph", content: "The rebate application process can be complex — there are multiple programs, each with their own forms, deadlines, and requirements. This is why most homeowners miss out on thousands of dollars they're entitled to. At Mechanical Enterprise, we handle the entire rebate application process for you at no additional cost. Here's how it works:" },
      { type: "numbered_list", items: ["Book a free assessment — we come to your home and evaluate your current system", "We identify every rebate program you qualify for", "We recommend qualifying equipment that maximizes your rebate amount", "We complete the installation and all rebate paperwork", "You receive your rebate checks directly"] },
      { type: "cta_box", content: "Want to know exactly how much you qualify for? Book a free assessment and we will calculate your exact rebate amount at no cost.", buttonText: "Book Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
      { type: "h2", content: "How Much Can You Save in Each NJ County?" },
      { type: "paragraph", content: "Rebate amounts can vary slightly depending on your location and utility provider across New Jersey. Homeowners in Essex, Bergen, Hudson, Union, Morris, and Passaic counties are typically served by PSE&G and may qualify for specific utility rebates in addition to state and federal programs. Regardless of your county, Mechanical Enterprise will identify and apply for every available incentive." },
      { type: "h2", content: "Heat Pump vs Gas Furnace: Is It Worth Switching?" },
      { type: "paragraph", content: "Many NJ homeowners wonder whether switching from a gas furnace to a heat pump makes financial sense. In most cases, when you factor in available rebates and long-term energy savings, the answer is yes. Modern heat pumps are up to 300% more efficient than gas furnaces and provide both heating and cooling in one system. With rebates covering a significant portion of installation costs, the payback period is often 3-5 years — after which you enjoy lower energy bills indefinitely." },
      { type: "h2", content: "2026 Rebate Deadlines: Act Now" },
      { type: "paragraph", content: "NJ rebate programs operate on annual funding cycles and can be reduced or modified when funding runs low. Homeowners who schedule their installation earlier in the year typically secure the highest available rebate amounts. Waiting until summer or fall — when demand for HVAC services peaks — can mean longer wait times and potentially reduced incentives." },
      { type: "h2", content: "Get Your Free Rebate Assessment Today" },
      { type: "paragraph", content: "Mechanical Enterprise serves all 15 NJ counties and specializes in maximizing rebate amounts for every customer. Our free assessment includes a full evaluation of your current system, a calculation of every rebate you qualify for, and a no-obligation quote for installation. There is no cost and no pressure — just clear information about what you qualify for and what a new system would cost after rebates." },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 2 — Complete Guide (No Fluff, Just Numbers)
  // ──────────────────────────────────────────────────────────────
  {
    title: "The Complete Guide to NJ HVAC Rebates in 2026 (No Fluff, Just Numbers)",
    slug: "nj-hvac-rebates-2026-complete-guide",
    date: "March 31, 2026",
    readTime: "10 min read",
    category: "Rebates & Incentives",
    metaDescription: "Every NJ HVAC rebate in 2026 broken down with exact dollar amounts. PSE&G up to $18,000, federal 25C tax credit, on-bill repayment. Real example included.",
    excerpt: "If $20,000 sounds too good to be true, here's exactly where every dollar comes from. No fluff — just the numbers NJ homeowners need.",
    sections: [
      { type: "intro", content: "If $20,000 sounds too good to be true, here's exactly where every dollar comes from. We've helped hundreds of NJ homeowners navigate the rebate landscape, and we're laying out every program, every dollar amount, and every qualification requirement — no marketing fluff, just numbers you can take to the bank." },
      { type: "h2", content: "The Four Rebate Programs You Can Stack in 2026" },
      { type: "paragraph", content: "New Jersey homeowners have access to four separate incentive programs that can be combined — or \"stacked\" — on a single heat pump installation. Most contractors only mention one or two. Here's the full picture." },
      { type: "stat_box", content: "PSE&G Rebate: Up to $18,000 | NJ Clean Heat: Up to $2,000 | Federal 25C: 30% (up to $2,000) | On-Bill Repayment: $0 Upfront" },
      { type: "h2", content: "Program 1: PSE&G Residential Rebates — Up to $18,000" },
      { type: "paragraph", content: "PSE&G offers the largest single rebate available to NJ homeowners. The amount depends on your current heating system and what you're replacing it with. Homeowners switching from oil or propane to a qualifying heat pump receive the highest rebates — up to $18,000. Switching from electric resistance heating qualifies for $10,000-$14,000. Even gas-to-heat-pump conversions qualify for $6,000-$10,000 depending on system efficiency. These rebates are paid directly to you after installation and come on top of every other program." },
      { type: "h2", content: "Program 2: Mechanical Enterprise Qualifying Credit — Up to $2,000" },
      { type: "paragraph", content: "Mechanical Enterprise provides an additional qualifying credit of up to $2,000 for homeowners who complete their installation through our company. This credit is applied directly to your project cost and can be combined with all other rebate programs. It's our way of making the transition to a heat pump as affordable as possible for NJ families." },
      { type: "h2", content: "Program 3: Federal 25C Tax Credit — 30% Back" },
      { type: "paragraph", content: "The federal Energy Efficient Home Improvement Credit (Section 25C) provides a 30% tax credit on qualifying heat pump installations, up to a maximum of $2,000 per year. This isn't a deduction — it's a dollar-for-dollar reduction of your federal tax bill. If your installation costs $15,000, you could receive $2,000 back when you file your taxes. This credit has been extended through 2032 under the Inflation Reduction Act." },
      { type: "h2", content: "Program 4: On-Bill Repayment — $0 Upfront" },
      { type: "paragraph", content: "Here's where it gets interesting. NJ's on-bill repayment program allows homeowners to finance their remaining installation cost directly through their utility bill — at 0% interest. After rebates, your remaining balance is spread over monthly payments that go right on your PSE&G bill. In most cases, the energy savings from your new heat pump exceed the monthly payment, meaning your total utility bill actually goes down from day one." },
      { type: "h2", content: "Real Example: 3-Bedroom Newark Home" },
      { type: "paragraph", content: "Let's walk through a real assessment we completed for a 3-bedroom home in Newark with an aging oil furnace. The homeowner was paying $3,200/year in heating oil plus $1,400/year in electric for window AC units — $4,600 total annually." },
      { type: "numbered_list", items: ["Total installation cost for a 3-ton cold climate heat pump system: $22,400", "PSE&G rebate (oil-to-heat-pump conversion): -$18,000", "Mechanical Enterprise qualifying credit: -$1,400", "Remaining cost after rebates: $3,000", "Federal 25C tax credit (filed on taxes): -$2,000", "True out-of-pocket after all incentives: $1,000", "Annual energy savings vs old system: $1,800/year"] },
      { type: "paragraph", content: "This homeowner's $1,000 net cost was recovered in less than 7 months through energy savings. Their total annual heating and cooling cost dropped from $4,600 to $2,800 — a savings of $1,800 every year, indefinitely." },
      { type: "stat_box", content: "Installation: $22,400 | Total Rebates: $21,400 | Out of Pocket: $1,000 | Annual Savings: $1,800" },
      { type: "h2", content: "Who Qualifies? The Quick Checklist" },
      { type: "checklist", items: ["You own a home in New Jersey (not renting)", "Your home is in PSE&G, JCP&L, or Atlantic City Electric service territory", "Your current heating system is 10+ years old OR uses oil/propane", "You have not received a heat pump rebate in the last 10 years", "Your home has adequate electrical capacity (we check this at the assessment)"] },
      { type: "h2", content: "What If I Don't Qualify for the Full Amount?" },
      { type: "paragraph", content: "Not every homeowner qualifies for $20,000. If your home uses natural gas and has a relatively new furnace, your rebate amount will be lower — typically $6,000-$10,000. That's still significant. And with on-bill repayment covering the remaining cost at 0% interest, many homeowners still end up paying less per month after the upgrade than they were paying before." },
      { type: "h2", content: "How to Get Started" },
      { type: "paragraph", content: "The first step is a free assessment. We come to your home, evaluate your current system, calculate your exact rebate eligibility across all four programs, and give you a clear breakdown of costs and savings. There's no cost, no obligation, and no pressure. The assessment takes about 20 minutes and you'll leave with exact numbers — not estimates." },
      { type: "cta_box", content: "Ready to see your exact rebate amount? Our free assessment takes 20 minutes and covers all four rebate programs.", buttonText: "Check My Rebate Eligibility \u2192", buttonUrl: "https://mechanicalenterprise.com/rebate-calculator" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 3 — PSE&G Rebates Explained
  // ──────────────────────────────────────────────────────────────
  {
    title: "PSE&G Heat Pump Rebates Explained: What They Cover, What They Don't",
    slug: "pseg-heat-pump-rebates-explained",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Rebates & Incentives",
    metaDescription: "PSE&G heat pump rebates in 2026 explained. Amounts by equipment type, what qualifies, what doesn't, and how to stack with federal credits. Real Newark example.",
    excerpt: "PSE&G offers up to $18,000 in heat pump rebates — but not everything qualifies. Here's exactly what's covered and what's not.",
    sections: [
      { type: "intro", content: "PSE&G's residential rebate program is the single largest incentive available to NJ homeowners — up to $18,000 for qualifying heat pump installations. But the details matter. Not every system qualifies, not every home qualifies, and the amount varies significantly based on what you're replacing. Here's the full breakdown." },
      { type: "h2", content: "PSE&G Rebate Amounts by Equipment Type (2026)" },
      { type: "paragraph", content: "PSE&G determines your rebate amount based on two factors: what heating system you're replacing and what heat pump system you're installing. The highest rebates go to homeowners replacing the least efficient systems — oil and propane — with high-efficiency heat pumps." },
      { type: "stat_box", content: "Oil/Propane to Heat Pump: Up to $18,000 | Electric to Heat Pump: Up to $14,000 | Gas to Heat Pump: Up to $10,000" },
      { type: "paragraph", content: "Within each category, the exact amount depends on the efficiency rating of the heat pump you install. Systems with higher SEER2 and HSPF2 ratings qualify for higher rebates. Cold climate heat pumps — designed to operate efficiently in NJ winters — receive the maximum amounts." },
      { type: "h2", content: "What PSE&G Rebates Don't Cover" },
      { type: "paragraph", content: "PSE&G rebates have specific exclusions that catch some homeowners off guard. Window AC units and portable heat pumps do not qualify. Geothermal systems are covered under a separate program with different amounts. Replacement of a heat pump with another heat pump may qualify for a reduced rebate but not the full conversion amount. And critically, you must use a licensed NJ HVAC contractor — DIY installations are not eligible." },
      { type: "checklist", items: ["Window AC units — not eligible", "Portable heat pumps — not eligible", "DIY installation — not eligible", "Heat pump replacing another heat pump — reduced rebate", "Geothermal — separate program, different amounts", "Commercial buildings — separate commercial program"] },
      { type: "h2", content: "How to Stack PSE&G + NJ Clean Heat + Federal Credit" },
      { type: "paragraph", content: "The real power of the 2026 rebate landscape is stacking. PSE&G rebates can be combined with the NJ Clean Heat program (additional $1,000-$2,000) and the federal 25C tax credit (30%, up to $2,000). These programs are administered by different agencies and have separate applications — but they all apply to the same installation." },
      { type: "paragraph", content: "This is where working with a contractor who specializes in rebates makes a real difference. At Mechanical Enterprise, we submit applications to all three programs simultaneously after your installation. Most homeowners receive their PSE&G rebate within 6-8 weeks, the NJ Clean Heat rebate within 8-12 weeks, and claim their federal credit on their next tax return." },
      { type: "h2", content: "Real Example: Newark 3BR Home" },
      { type: "paragraph", content: "A Newark homeowner with a 25-year-old oil boiler replaced it with a cold climate heat pump system. Their PSE&G rebate: $18,000. NJ Clean Heat: $1,400. Federal 25C credit: $2,000. Total incentives: $21,400 on a $22,400 installation. Out-of-pocket cost: $1,000. Their annual heating cost dropped from $3,200 (oil) to $1,400 (electric heat pump) — saving $1,800 per year." },
      { type: "h2", content: "How to Apply" },
      { type: "paragraph", content: "PSE&G rebate applications must be submitted after installation by a participating contractor. The process involves documenting your old system, the new equipment specifications, and proof of installation. We handle all of this — you don't fill out a single form. Book a free assessment and we'll calculate your exact PSE&G rebate amount before you commit to anything." },
      { type: "cta_box", content: "Find out your exact PSE&G rebate amount with a free 20-minute assessment. No cost, no obligation.", buttonText: "Book Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 4 — Heat Pump vs Gas Furnace
  // ──────────────────────────────────────────────────────────────
  {
    title: "Heat Pump vs Gas Furnace in New Jersey: An Honest Comparison (2026)",
    slug: "heat-pump-vs-gas-furnace-nj-2026",
    date: "March 31, 2026",
    readTime: "9 min read",
    category: "Installation Guides",
    metaDescription: "Honest comparison of heat pumps vs gas furnaces for NJ homeowners in 2026. Costs, efficiency, rebates, and when gas still makes sense.",
    excerpt: "Heat pump or gas furnace? We break down the real costs, efficiency numbers, and rebate math for NJ homeowners — honestly.",
    sections: [
      { type: "intro", content: "Every NJ homeowner replacing their heating system faces the same question: heat pump or gas furnace? The internet is full of opinions, but most articles are written by companies trying to sell you one or the other. Here's an honest comparison using real NJ energy prices, real rebate numbers, and real-world performance data." },
      { type: "h2", content: "Upfront Cost: Gas Wins — Before Rebates" },
      { type: "paragraph", content: "A new gas furnace installed in a typical NJ home costs $5,000-$8,000. A heat pump system costs $12,000-$22,000 depending on size and efficiency. On sticker price alone, gas furnaces are significantly cheaper. But sticker price is only half the story." },
      { type: "h2", content: "Upfront Cost After Rebates: Heat Pump Wins — Dramatically" },
      { type: "paragraph", content: "This is where 2026 changes the math completely. Gas furnaces receive zero state rebates and minimal federal credits. Heat pumps receive PSE&G rebates up to $18,000, NJ Clean Heat credits, and the federal 25C tax credit of 30%. After all incentives, a $22,000 heat pump installation can cost as little as $1,000-$3,000 out of pocket. A $6,000 gas furnace costs... $6,000." },
      { type: "stat_box", content: "Gas Furnace After Rebates: $5,000-$8,000 | Heat Pump After Rebates: $1,000-$3,000 | Heat Pump Saves: $4,000-$5,000 Upfront" },
      { type: "h2", content: "Monthly Operating Costs at NJ Energy Prices" },
      { type: "paragraph", content: "NJ natural gas prices average $1.35/therm. NJ electricity averages $0.17/kWh. A gas furnace operating at 95% efficiency in a 2,000 sq ft NJ home costs approximately $1,200-$1,600/year to heat. A heat pump operating at an average COP of 3.0 costs approximately $800-$1,100/year to heat the same home — and also provides air conditioning in summer, which a furnace cannot." },
      { type: "paragraph", content: "When you add summer cooling costs ($400-$800/year for central AC), the gas furnace + central AC combination costs $1,600-$2,400/year total. The heat pump handles both for $1,200-$1,600/year — saving $400-$800 annually on operating costs." },
      { type: "h2", content: "Cold Weather Performance: The Myth vs Reality" },
      { type: "paragraph", content: "The biggest objection we hear: \"Heat pumps don't work in cold weather.\" This was true 15 years ago. Modern cold climate heat pumps — the type we install — are rated to operate efficiently down to -13\u00B0F. The lowest temperature ever recorded in Newark is 0\u00B0F. In real-world NJ conditions, today's heat pumps maintain 100% heating capacity at temperatures well below anything we experience in a normal winter." },
      { type: "paragraph", content: "The Carrier, Trane, and Lennox cold climate systems we install have been tested and rated for NJ winters specifically. We've installed hundreds of these systems across Essex, Bergen, Hudson, and Morris counties — they perform exactly as rated, even during January cold snaps." },
      { type: "h2", content: "When Gas Still Makes Sense — Being Honest" },
      { type: "paragraph", content: "We're not going to tell you heat pumps are right for everyone. If your gas furnace is less than 5 years old, the rebates may not justify replacing a working system. If your home has inadequate electrical capacity and a panel upgrade would cost $3,000-$5,000, the math gets tighter. And if you're in an area not served by PSE&G, JCP&L, or ACE, the utility rebates are smaller." },
      { type: "paragraph", content: "That said, for the vast majority of NJ homeowners — especially those with systems 10+ years old, those using oil or propane, or those who also need AC — the heat pump wins on every metric when 2026 rebates are factored in." },
      { type: "h2", content: "The $20,000 Rebate Math Changes Everything" },
      { type: "paragraph", content: "Without rebates, a heat pump is a long-term investment that pays off over 8-12 years. With 2026 NJ rebates, it pays off immediately. You spend less upfront than a gas furnace, spend less monthly on energy, get both heating and cooling in one system, and increase your home's resale value. The only reason not to switch is if your current system is new and working well." },
      { type: "cta_box", content: "Not sure which is right for your home? Our free assessment compares both options with your exact numbers — no pressure, no obligation.", buttonText: "Get My Free Comparison \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 5 — NJ Clean Heat Program
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Clean Heat Program 2026: Everything You Need to Know Before You Apply",
    slug: "nj-clean-heat-program-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "NJ Clean Heat Program 2026 guide. Rebate amounts, income-qualified tiers, application process, common mistakes, and timeline. We handle the paperwork.",
    excerpt: "The NJ Clean Heat Program offers additional rebates on top of PSE&G incentives. Here's how it works, who qualifies, and how to avoid common application mistakes.",
    sections: [
      { type: "intro", content: "The NJ Clean Heat Program is a state-administered rebate program separate from your utility company's rebates. It can be stacked on top of PSE&G, JCP&L, or ACE rebates for additional savings — but the application process has specific requirements that trip up many homeowners. Here's everything you need to know." },
      { type: "h2", content: "What Is the NJ Clean Heat Program?" },
      { type: "paragraph", content: "NJ Clean Heat is part of New Jersey's broader decarbonization strategy. It provides cash rebates to homeowners who replace fossil fuel heating systems with qualifying heat pump equipment. Unlike utility rebates which are funded by your electric company, Clean Heat rebates come from state-administered funds and have their own separate application process." },
      { type: "h2", content: "2026 Rebate Amounts by Equipment" },
      { type: "paragraph", content: "NJ Clean Heat rebates range from $500 to $2,000 depending on the equipment type and your household income. Central ducted heat pumps qualify for $1,000-$2,000. Ductless mini-split systems qualify for $500-$1,500 per indoor unit (up to a cap). Cold climate heat pumps receive the highest amounts. The exact rebate is determined by the system's AHRI certificate and efficiency ratings." },
      { type: "stat_box", content: "Central Heat Pump: $1,000-$2,000 | Ductless Mini-Split: $500-$1,500/unit | Cold Climate HP: Maximum Amount" },
      { type: "h2", content: "Income-Qualified Tiers: Higher Rebates for Lower Incomes" },
      { type: "paragraph", content: "NJ Clean Heat has income-qualified tiers that provide higher rebate amounts for moderate and low-income households. If your household income is below 80% of area median income (AMI), you may qualify for enhanced rebates that are 50-100% higher than the standard amounts. For a family of four in Essex County, 80% AMI is approximately $82,000/year. Even households earning up to 150% AMI ($153,000) receive some enhancement." },
      { type: "h2", content: "Step-by-Step Application Process" },
      { type: "numbered_list", items: ["Confirm your home qualifies — must be replacing a fossil fuel system (oil, propane, or gas)", "Select qualifying equipment — must meet minimum SEER2 and HSPF2 requirements", "Complete installation with a licensed NJ contractor", "Submit application with proof of purchase, installation photos, and old system documentation", "Provide utility account information for verification", "Wait 8-12 weeks for rebate processing and payment"] },
      { type: "h2", content: "Common Mistakes That Get Applications Rejected" },
      { type: "paragraph", content: "We've seen dozens of NJ Clean Heat applications get rejected or delayed. The most common mistakes: submitting without the AHRI certificate number, not documenting the old system before removal, using a contractor not registered with the program, and missing the application deadline after installation. Each of these can delay your rebate by months or result in denial." },
      { type: "checklist", items: ["Always photograph your old system before removal", "Get the AHRI certificate from your contractor before installation", "Verify your contractor is registered with NJ Clean Heat", "Submit the application within 90 days of installation", "Include all required utility account information"] },
      { type: "h2", content: "Timeline: When Will You Get the Money?" },
      { type: "paragraph", content: "After submitting a complete application, NJ Clean Heat typically processes rebates in 8-12 weeks. During peak periods (spring and fall), processing can extend to 16 weeks. Payment is sent directly to the homeowner via check. This is separate from PSE&G rebates, which have their own processing timeline of 6-8 weeks." },
      { type: "h2", content: "We Handle the Paperwork — All of It" },
      { type: "paragraph", content: "At Mechanical Enterprise, we submit NJ Clean Heat applications for every qualifying customer. We document the old system, collect the AHRI certificates, prepare the application, and submit it on your behalf. You don't fill out a single form. This is included in our service — there's no additional charge for rebate processing." },
      { type: "cta_box", content: "Find out if you qualify for enhanced NJ Clean Heat rebates. Free assessment, we handle all paperwork.", buttonText: "Book Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 6 — Essex County Rebates (Hyper-Local)
  // ──────────────────────────────────────────────────────────────
  {
    title: "HVAC Rebates in Essex County NJ: What Local Homeowners Are Actually Getting in 2026",
    slug: "hvac-rebates-essex-county-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Local Guides",
    metaDescription: "HVAC rebate amounts for Essex County NJ homeowners in 2026. Real data from Newark, Montclair, Bloomfield, West Orange, Maplewood, Livingston, and Millburn.",
    excerpt: "We've completed hundreds of assessments across Essex County. Here's what homeowners in Newark, Montclair, West Orange, and surrounding towns are actually qualifying for.",
    sections: [
      { type: "intro", content: "We're based in Newark and have completed hundreds of HVAC assessments across Essex County. Instead of giving you generic rebate ranges, here's what homeowners in your specific town are actually qualifying for in 2026 — based on real assessments, not estimates." },
      { type: "h2", content: "Why Essex County Homeowners Qualify for Top Rebates" },
      { type: "paragraph", content: "Essex County is a sweet spot for HVAC rebates for two reasons. First, the entire county is in PSE&G's service territory, which means access to the largest utility rebate program in the state — up to $18,000. Second, Essex County has some of the oldest housing stock in NJ, which means most homes still have oil boilers, aging gas furnaces, or outdated electric systems. Older systems qualify for the highest rebate amounts." },
      { type: "h2", content: "Real Assessment Ranges by Town" },
      { type: "paragraph", content: "Based on assessments completed in the past 12 months, here's what homeowners in Essex County towns are typically qualifying for in total combined rebates:" },
      { type: "stat_box", content: "Newark: $16,000-$21,400 | Montclair: $14,000-$19,000 | West Orange: $15,000-$20,000" },
      { type: "paragraph", content: "Bloomfield homeowners have been qualifying for $14,000-$18,000 — many older homes in Bloomfield still use oil heat, which triggers the maximum PSE&G rebate. Maplewood and South Orange homes, often built in the 1920s-1950s, typically qualify for $15,000-$19,000. Livingston and Millburn homes trend slightly lower at $12,000-$16,000 because more homes already have gas furnaces, but the combined rebate still covers 60-80% of installation costs." },
      { type: "h2", content: "The Essex County Advantage: Older Homes = Higher Rebates" },
      { type: "paragraph", content: "Here's something most people don't realize: the older and less efficient your current system is, the more money you get back. A Newark home with a 30-year-old oil boiler qualifies for significantly more than a Livingston home with a 10-year-old gas furnace. This means Essex County's older housing stock is actually an advantage — homes that haven't been updated in decades are sitting on the highest available rebates." },
      { type: "h2", content: "How Essex County Assessments Work" },
      { type: "paragraph", content: "Our free assessment for Essex County homes takes about 20 minutes. We evaluate your current system's age and fuel type, measure your home's heating and cooling needs, check your electrical panel capacity, and calculate your exact rebate eligibility across all four programs (PSE&G, NJ Clean Heat, Mechanical Enterprise credit, and federal 25C). You leave with a specific dollar amount — not a range." },
      { type: "h2", content: "Essex County Homeowners: Book Now" },
      { type: "paragraph", content: "We're based right here in Newark and serve every town in Essex County. Our assessment schedule fills up quickly during spring and fall — the two busiest seasons for HVAC installations. If you're thinking about replacing your system in 2026, booking your assessment now ensures you lock in current rebate amounts and get on the installation schedule before the summer rush." },
      { type: "cta_box", content: "Essex County homeowners: find out your exact rebate amount with a free 20-minute assessment. We come to you.", buttonText: "Book My Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 7 — What Happens at a Free Assessment
  // ──────────────────────────────────────────────────────────────
  {
    title: "What Happens at a Free HVAC Assessment? (We Walk Through Every Step)",
    slug: "what-happens-free-hvac-assessment",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "How It Works",
    metaDescription: "Walk through every step of a free HVAC assessment. What we look at, what questions we ask, what you leave with. Zero obligation — just clear information.",
    excerpt: "Wondering what actually happens during a free HVAC assessment? We walk through every step — no surprises, no pressure, just information.",
    sections: [
      { type: "intro", content: "\"Free assessment\" can sound like code for \"high-pressure sales pitch.\" We get it. That's not what this is. Here's a transparent, step-by-step walkthrough of exactly what happens when one of our technicians visits your home — so you know what to expect before you book." },
      { type: "h2", content: "Step 1: You Schedule Online or by Phone" },
      { type: "paragraph", content: "Book at mechanicalenterprise.com or call (862) 419-1763. You pick the date and time window that works for you. We confirm the appointment by text and email. If something comes up, you can reschedule — no penalties, no guilt trips." },
      { type: "h2", content: "Step 2: Our Tech Arrives — On Time" },
      { type: "paragraph", content: "A licensed Mechanical Enterprise technician arrives during your scheduled window. They're in uniform, they have ID, and they'll introduce themselves. The entire visit takes 15-25 minutes depending on your home's setup. They're not salespeople — they're technicians who understand heating and cooling systems." },
      { type: "h2", content: "Step 3: What We Look At" },
      { type: "paragraph", content: "The technician evaluates four things: your current heating system (brand, model, age, fuel type, condition), your home's size and layout (square footage, number of rooms, insulation quality), your electrical panel (to confirm it can support a heat pump without expensive upgrades), and your existing ductwork or lack thereof (this determines whether a ducted or ductless system is the better fit)." },
      { type: "checklist", items: ["Current system: brand, model, age, fuel type", "Home size: square footage, room count, insulation", "Electrical panel: capacity, available circuits", "Ductwork: condition, size, layout (or if ductless is better)"] },
      { type: "h2", content: "Step 4: What Questions We Ask You" },
      { type: "paragraph", content: "We'll ask about your heating and cooling habits, any rooms that are too hot or too cold, your average utility bills, and whether you're planning any renovations. These aren't trick questions — they help us recommend the right size and type of system. We'll also ask about your utility provider (PSE&G, JCP&L, ACE) because it determines which rebate programs apply." },
      { type: "h2", content: "Step 5: What You Leave With" },
      { type: "paragraph", content: "At the end of the assessment, you receive a clear summary: your exact rebate eligibility across all programs (PSE&G, NJ Clean Heat, federal 25C, Mechanical Enterprise credit), the recommended system type and size, the total installation cost, and your out-of-pocket cost after all rebates. This is a specific number — not a vague estimate." },
      { type: "h2", content: "What We Don't Do" },
      { type: "paragraph", content: "We don't pressure you to sign anything. We don't call you repeatedly after the visit. We don't add hidden fees or change the price later. The assessment is genuinely free — it's how we earn your trust. If the numbers make sense for you, great. If they don't, we'll tell you that too. Some homeowners we assess honestly aren't good candidates for a heat pump right now, and we tell them so." },
      { type: "cta_box", content: "Ready to see your numbers? 20 minutes, zero pressure, completely free.", buttonText: "Book My 20-Minute Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 8 — On-Bill Repayment ($0 Upfront)
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ On-Bill Repayment: How to Replace Your HVAC System With $0 Upfront",
    slug: "nj-on-bill-repayment-zero-upfront-hvac",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Financing",
    metaDescription: "NJ on-bill repayment explained. Replace your HVAC with $0 upfront. Monthly payments on your utility bill. How it works with rebates for true $0 cost.",
    excerpt: "NJ's on-bill repayment program lets you replace your HVAC system with $0 upfront. Payments go on your utility bill — and most homeowners pay less per month than before.",
    sections: [
      { type: "intro", content: "What if you could replace your entire heating and cooling system with zero money upfront — and your monthly utility bill actually went down? That's not a gimmick. It's NJ's on-bill repayment program, and when combined with available rebates, it's making HVAC upgrades genuinely free for many NJ homeowners." },
      { type: "h2", content: "How On-Bill Repayment Works" },
      { type: "paragraph", content: "On-bill repayment is simple: after your rebates are applied, any remaining installation cost is financed at 0% interest and added to your monthly utility bill. There's no separate loan, no credit check in most cases, and no lump-sum payment due. The payments are spread over 5-10 years and appear as a line item on your existing PSE&G, JCP&L, or ACE bill. Commercial property owners can also use OBR through the [Direct Install Program](/blog/on-bill-repayment-commercial-hvac-nj)." },
      { type: "h2", content: "Who Qualifies" },
      { type: "paragraph", content: "To qualify for on-bill repayment, you must own your home (not renting), have the utility account in your name, be current on your utility payments (no outstanding balance), and install qualifying equipment through a participating contractor. There is no minimum credit score requirement in most cases — the financing is secured by your utility account, not a traditional credit check." },
      { type: "checklist", items: ["Own your home (not renting)", "Utility account in your name", "Current on utility payments (no outstanding balance)", "Install qualifying equipment", "Use a participating contractor (Mechanical Enterprise qualifies)"] },
      { type: "h2", content: "Monthly Payment Examples" },
      { type: "paragraph", content: "Here's where the math gets exciting. After rebates, most homeowners have $1,000-$5,000 remaining. Spread over 7 years at 0% interest, that's $12-$60 per month added to your utility bill. But here's the key: your energy costs drop by $100-$200 per month because the new heat pump is dramatically more efficient than your old system." },
      { type: "stat_box", content: "Remaining After Rebates: $3,000 | Monthly Payment (7yr): $36/mo | Monthly Energy Savings: $150/mo | Net Monthly Savings: $114/mo" },
      { type: "paragraph", content: "In the example above, the homeowner's total utility bill goes DOWN by $114 per month even with the repayment charge included. They're paying less every month than before the upgrade — from day one." },
      { type: "h2", content: "How It Combines With Rebates" },
      { type: "paragraph", content: "On-bill repayment is applied after all rebates. So if your installation costs $20,000 and you receive $18,000 in combined PSE&G and other rebates, only $2,000 goes on the repayment plan. At $24/month over 7 years, most homeowners never notice it — especially since their energy savings exceed the payment amount." },
      { type: "h2", content: "The Fine Print — Explained Honestly" },
      { type: "paragraph", content: "The repayment obligation stays with the property, not the homeowner. If you sell your house, the remaining balance transfers to the new owner (it's disclosed at closing). The 0% interest rate is guaranteed for the full repayment term. There are no prepayment penalties — you can pay it off early at any time. If you fall behind on utility payments, the utility company can eventually disconnect service, just as they would for unpaid electric charges." },
      { type: "h2", content: "Getting Started" },
      { type: "paragraph", content: "We set up on-bill repayment for our customers as part of the installation process. After your rebates are calculated and applied, we submit the on-bill repayment application on your behalf. Approval typically takes 1-2 weeks. The first payment appears on your utility bill approximately 60 days after installation." },
      { type: "cta_box", content: "See if you qualify for $0 upfront HVAC replacement. Free assessment includes on-bill repayment calculation.", buttonText: "Check My Eligibility \u2192", buttonUrl: "https://mechanicalenterprise.com/rebate-calculator" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 9 — Commercial HVAC Rebates
  // ──────────────────────────────────────────────────────────────
  {
    title: "Commercial HVAC Rebates in NJ: Up to 80% Covered — 2026 Guide for Property Owners",
    slug: "commercial-hvac-rebates-nj-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Commercial",
    metaDescription: "Commercial HVAC rebates in NJ cover up to 80% of installation costs in 2026. Guide for office, retail, and building owners. Free commercial assessment.",
    excerpt: "NJ commercial properties can get up to 80% of HVAC installation costs covered through rebate programs. Here's how it works for building owners.",
    sections: [
      { type: "intro", content: "If you own or manage a commercial property in New Jersey, the 2026 rebate landscape is remarkable. Between utility programs, state incentives, and federal credits, commercial buildings can receive rebates covering up to 80% of a new HVAC system's total cost. Here's how it works." },
      { type: "h2", content: "Commercial Decarbonization Program Overview" },
      { type: "paragraph", content: "NJ's commercial decarbonization program targets buildings that currently use fossil fuel heating systems. The program provides significant financial incentives for commercial property owners who transition to high-efficiency heat pump or VRV/VRF systems. Unlike residential programs which cap at specific dollar amounts, commercial rebates are calculated as a percentage of total project cost \u2014 and that percentage can reach 80%. For a complete breakdown of the [NJ Direct Install Program](/blog/nj-direct-install-program-commercial-guide), see our commercial guide." },
      { type: "stat_box", content: "Commercial Rebate: Up to 80% of Cost | Federal Credit: 30% (up to $5/sq ft) | PSE&G Commercial: Additional Incentives" },
      { type: "h2", content: "Qualifying Building Types" },
      { type: "paragraph", content: "Almost every commercial building type qualifies: office buildings, retail stores, restaurants, healthcare facilities, warehouses, industrial buildings, multi-family residential (5+ units), houses of worship, and non-profit facilities. The building must currently use a fossil fuel heating system (gas, oil, or propane) and be located in an NJ utility service territory." },
      { type: "checklist", items: ["Office buildings (any size)", "Retail stores and shopping centers", "Restaurants and hospitality", "Healthcare facilities and medical offices", "Warehouses and distribution centers", "Multi-family residential (5+ units)", "Houses of worship and non-profits"] },
      { type: "h2", content: "How 80% Coverage Works" },
      { type: "paragraph", content: "The 80% figure comes from stacking multiple programs. A typical commercial project might receive 40-50% from the NJ commercial decarbonization program, 10-20% from PSE&G commercial incentives, and an additional 10-30% from the federal Commercial Clean Energy tax credit. On a $200,000 VRV/VRF installation for a mid-size office building, total incentives can reach $140,000-$160,000." },
      { type: "h2", content: "How to Apply for Commercial Rebates" },
      { type: "numbered_list", items: ["Schedule a free commercial assessment — we evaluate your building's current system and energy usage", "We design a replacement system (typically VRV/VRF for larger buildings, commercial heat pump for smaller ones)", "We submit pre-approval applications to applicable rebate programs", "After approval, we complete installation", "We submit all post-installation documentation and rebate claims", "You receive rebate payments (typically 60-120 days after completion)"] },
      { type: "h2", content: "Real Example: Small Office Building in Newark" },
      { type: "paragraph", content: "A 5,000 sq ft office building in Newark with an aging gas boiler replaced it with a VRV/VRF system. Total installation cost: $85,000. NJ commercial decarbonization rebate: $42,500 (50%). PSE&G commercial incentive: $12,750 (15%). Federal commercial credit: $12,750 (15%). Total incentives: $68,000. Out-of-pocket cost: $17,000 for a complete new HVAC system. Annual energy savings: $8,500/year — payback in under 2 years." },
      { type: "h2", content: "Stacking Commercial Rebates" },
      { type: "paragraph", content: "The key to maximizing commercial rebates is proper sequencing. Not every program allows stacking with every other program, and some require pre-approval before installation begins. Mechanical Enterprise has completed commercial rebate applications for buildings across NJ and understands exactly which programs stack, which require pre-approval, and how to maximize total incentive amounts." },
      { type: "cta_box", content: "Commercial property owners: find out how much you can save. Free commercial assessment with rebate calculation.", buttonText: "Book Commercial Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 10 — Federal 25C Tax Credit
  // ──────────────────────────────────────────────────────────────
  {
    title: "The Federal 25C Tax Credit for HVAC in 2026: How to Claim Your 30%",
    slug: "federal-25c-tax-credit-hvac-2026",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Rebates & Incentives",
    metaDescription: "Federal 25C tax credit for HVAC 2026. How to claim 30% back (up to $2,000). Which equipment qualifies. How to stack with NJ rebates. File before April 15.",
    excerpt: "The federal 25C tax credit gives you 30% back on qualifying HVAC installations — up to $2,000. Here's how to claim it and stack it with NJ rebates.",
    sections: [
      { type: "intro", content: "The federal Energy Efficient Home Improvement Credit — known as Section 25C — gives NJ homeowners 30% back on qualifying heat pump installations, up to $2,000 per year. It's a dollar-for-dollar tax credit (not a deduction), it stacks with every NJ rebate program, and it's available through 2032. Here's how to claim it." },
      { type: "h2", content: "What 25C Covers" },
      { type: "paragraph", content: "Section 25C covers the cost of qualifying energy-efficient home improvements including heat pumps (central and mini-split), central air conditioning systems, heat pump water heaters, biomass stoves, and home energy audits. For HVAC specifically, the credit applies to both the equipment cost and installation labor — the full project cost qualifies." },
      { type: "h2", content: "The 30% Calculation With Dollar Examples" },
      { type: "paragraph", content: "The credit is 30% of your total qualifying project cost, up to a maximum of $2,000 per year. If your heat pump installation costs $15,000 (before NJ rebates), your 25C credit would be $2,000 (the $4,500 calculated amount is capped at $2,000). If your installation costs $6,000, your credit would be $1,800 (30% of $6,000). The credit applies to the pre-rebate cost — NJ rebates don't reduce your federal credit calculation." },
      { type: "stat_box", content: "Credit Rate: 30% of Cost | Annual Cap: $2,000 | Available Through: 2032 | Type: Dollar-for-Dollar Tax Credit" },
      { type: "h2", content: "How to Stack With PSE&G $18,000 and NJ Clean Heat" },
      { type: "paragraph", content: "Here's the best part: the federal 25C credit is calculated on your total installation cost before state and utility rebates are applied. So if your installation costs $20,000 and you receive $18,000 in PSE&G and NJ Clean Heat rebates, your 25C credit is still calculated on the full $20,000 — giving you $2,000 back on your taxes. That means your total incentives can actually exceed your project cost in some cases." },
      { type: "numbered_list", items: ["Installation cost: $20,000", "PSE&G rebate: -$18,000 (received as check after installation)", "Federal 25C credit: -$2,000 (claimed on tax return)", "Total incentives: $20,000", "Your out-of-pocket cost: $0"] },
      { type: "h2", content: "Which Equipment Qualifies" },
      { type: "paragraph", content: "To qualify for the 25C credit, your heat pump must meet specific efficiency standards set by the IRS. For 2026, qualifying systems must meet or exceed CEE Tier 1 efficiency levels. All of the Carrier, Trane, and Lennox systems we install at Mechanical Enterprise meet or exceed these requirements. We provide the manufacturer certification (IRS Form 5695 supporting documentation) with every installation." },
      { type: "checklist", items: ["Central heat pumps meeting CEE Tier 1 or higher", "Ductless mini-split heat pumps meeting CEE Tier 1 or higher", "Central air conditioning systems (SEER2 16+)", "Heat pump water heaters (UEF 2.2+)", "Must be installed in your primary residence (not rental property)"] },
      { type: "h2", content: "How to File on Your Taxes" },
      { type: "paragraph", content: "Claiming the 25C credit requires IRS Form 5695 (Residential Energy Credits) filed with your annual tax return. You'll need the manufacturer's certification statement (we provide this) and your installation invoice showing the total cost. The credit reduces your tax liability dollar for dollar — if you owe $5,000 in federal taxes and claim a $2,000 25C credit, you pay $3,000." },
      { type: "h2", content: "Tax Season Timing" },
      { type: "paragraph", content: "If your heat pump was installed in 2025, you claim the credit on your 2025 tax return (due April 15, 2026). If installed in 2026, you claim it on your 2026 return (due April 15, 2027). The credit resets annually — you can claim up to $2,000 each year for different qualifying improvements. We recommend consulting with your tax preparer and providing them the documentation we include with your installation." },
      { type: "cta_box", content: "We provide all the tax documentation you need to claim your 25C credit. Book a free assessment to get started.", buttonText: "Check My Rebate Eligibility \u2192", buttonUrl: "https://mechanicalenterprise.com/rebate-calculator" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 11 — Is the Rebate Worth It? (Honest Answer)
  // ──────────────────────────────────────────────────────────────
  {
    title: "Is the NJ HVAC Rebate Actually Worth It? An Honest Answer.",
    slug: "is-nj-hvac-rebate-worth-it-honest-answer",
    date: "March 31, 2026",
    readTime: "5 min read",
    category: "Advice",
    metaDescription: "Is the NJ HVAC rebate worth it? Honest answer with three scenarios. Self-qualification checklist. Not worth it for everyone — here's how to know.",
    excerpt: "Not every NJ homeowner should jump on the HVAC rebate. Here's an honest answer about when it's worth it — and when it's not.",
    sections: [
      { type: "intro", content: "We could tell you that every NJ homeowner should replace their HVAC system right now. That would be good for business. But it wouldn't be honest. The truth is: the NJ HVAC rebate is life-changing for some homeowners, a good deal for others, and not the right move for a few. Here's how to know which category you're in." },
      { type: "h2", content: "Scenario 1: Absolutely Worth It" },
      { type: "paragraph", content: "If your heating system is 10+ years old, you're in PSE&G service territory, and you own your home — the rebate is almost certainly worth it. This is especially true if you currently heat with oil or propane, because you qualify for the maximum PSE&G rebate of up to $18,000. Combined with the federal 25C credit and NJ Clean Heat, your total incentives can cover 85-100% of installation cost. You'd be spending $1,000-$3,000 for a brand new system that saves $1,500-$2,000 per year in energy costs. The math is overwhelming." },
      { type: "h2", content: "Scenario 2: Worth Checking" },
      { type: "paragraph", content: "If you own a commercial property — office building, retail space, restaurant, warehouse — the commercial rebate program can cover up to 80% of installation costs regardless of your current system's age. Even if your current system is functional, the economics of replacing it with rebates covering most of the cost can make sense, especially if energy costs are a significant line item. A free commercial assessment will give you the exact numbers." },
      { type: "h2", content: "Scenario 3: Not the Right Time" },
      { type: "paragraph", content: "If you're renting (not the property owner), or if your heating system was installed in the last 3-5 years and is working well, or if you're planning to sell your home in the next 6 months — the rebate probably isn't the right move right now. Renters can't apply for homeowner rebates. Newer systems won't generate enough energy savings to justify replacement even with rebates. And if you're selling soon, the installation timeline may not align with your move." },
      { type: "h2", content: "The 5-Question Self-Qualification Checklist" },
      { type: "paragraph", content: "Answer these five questions honestly. If you answer yes to three or more, the rebate is likely worth pursuing:" },
      { type: "checklist", items: ["Is your heating system more than 10 years old?", "Do you own your home (not renting)?", "Are you in PSE&G, JCP&L, or ACE service territory?", "Are your annual heating costs above $1,500?", "Do you also need air conditioning (or have an old AC unit)?"] },
      { type: "h2", content: "If You Answered Yes to 3 or More" },
      { type: "paragraph", content: "You're very likely a strong candidate for the NJ HVAC rebate. The assessment is free, takes 20 minutes, and gives you exact numbers — not estimates. There's no obligation, no pressure, and no sales pitch. If the numbers don't make sense for your situation, we'll tell you. We'd rather be honest and earn your trust than push a sale that doesn't benefit you." },
      { type: "paragraph", content: "That's how we've built our reputation across Essex County and the rest of NJ — by being straight with people about what makes sense and what doesn't. If it's worth it for you, we'll show you exactly how much you'll save. If it's not, we'll tell you that too." },
      { type: "cta_box", content: "Answered yes to 3+ questions? Your free assessment takes 20 minutes and there's zero obligation.", buttonText: "Book My Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 12 — Nonprofit Lighting + HVAC Direct Install
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Nonprofits: Your Lighting Is 100% Free and HVAC Is 80% Off — Here's How",
    slug: "nj-nonprofit-lighting-hvac-direct-install",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ Direct Install Program covers 100% of lighting and up to 80% of HVAC for nonprofits. Every building qualifies separately. Free assessment. Mechanical Enterprise handles all paperwork.",
    excerpt: "NJ nonprofits can get lighting replaced for free — 100% covered — and HVAC for 80% off. Every building in your portfolio qualifies separately.",
    sections: [
      { type: "intro", content: "Here's the most powerful number in NJ energy programs right now: 100%. That's how much of your nonprofit's commercial lighting is covered under the NJ Direct Install Program. Not 80%. Not a rebate you apply for and wait months to receive. One hundred percent — installed, done, zero cost, zero On-Bill Repayment. And that's just the lighting. HVAC is covered up to 80%, with the remaining balance on OBR. If your organization operates multiple buildings, every single one qualifies separately." },
      { type: "h2", content: "Who Qualifies for the NJ Direct Install Program?" },
      { type: "paragraph", content: "Any 501(c)(3) nonprofit organization operating commercial space in New Jersey qualifies. This includes churches, mosques, synagogues, and houses of worship of all faiths. Community centers and recreation facilities. Charter schools, tutoring centers, and education nonprofits. Food banks, shelters, and social service organizations. Nonprofit hospitals, clinics, and health organizations. Arts organizations, museums, and cultural institutions. If you have a commercial electric meter and a 501(c)(3) designation, you almost certainly qualify." },
      { type: "checklist", items: ["Churches, mosques, synagogues, and all houses of worship", "Community centers and recreation facilities", "Charter schools and education nonprofits", "Food banks, shelters, and social service organizations", "Nonprofit hospitals and health clinics", "Arts organizations, museums, and cultural institutions", "Any NJ 501(c)(3) with a commercial electric meter"] },
      { type: "h2", content: "Lighting Coverage: 100% Free — No OBR" },
      { type: "paragraph", content: "Let's be very clear about what 100% means: you pay nothing. No upfront cost. No On-Bill Repayment. No financing. No monthly payments. The Direct Install Program replaces your existing commercial lighting — interior fluorescents, exterior building lights, parking lot lights, all of it — with modern LED fixtures at zero cost to your organization. The energy savings start immediately on your next electric bill." },
      { type: "stat_box", content: "Lighting Coverage: 100% Free | OBR Required: No | Out of Pocket: $0 | Energy Savings: 40-70%" },
      { type: "h2", content: "HVAC Coverage: Up to 80% — OBR for the Balance" },
      { type: "paragraph", content: "HVAC replacement through Direct Install covers up to 80% of total installation cost. The remaining 20% is covered via On-Bill Repayment — added to your utility bill at 0% interest over 5-10 years. In most cases, the energy savings from your new system exceed the OBR payment, meaning your total utility bill goes down from day one even with the repayment included. This covers heat pumps, VRV/VRF systems, rooftop units, and full HVAC system replacement." },
      { type: "h2", content: "The Portfolio Play: Every Building Qualifies Separately" },
      { type: "paragraph", content: "This is where the program becomes transformational for larger nonprofits. If your organization operates 5 buildings, each building qualifies for Direct Install independently. Five buildings means five separate 100% lighting coverages and five separate 80% HVAC coverages. For a nonprofit with 5 mid-size buildings, we're talking about $200,000-$500,000 in total covered improvements across the portfolio." },
      { type: "numbered_list", items: ["Building 1 — Community center: Lighting $15,000 (100% free) + HVAC $60,000 (80% = $48,000 covered)", "Building 2 — Administrative office: Lighting $8,000 (100% free) + HVAC $35,000 (80% = $28,000 covered)", "Building 3 — Youth center: Lighting $12,000 (100% free) + HVAC $45,000 (80% = $36,000 covered)", "Building 4 — Warehouse/food bank: Lighting $20,000 (100% free) + HVAC $25,000 (80% = $20,000 covered)", "Building 5 — Worship space: Lighting $18,000 (100% free) + HVAC $55,000 (80% = $44,000 covered)", "Total portfolio: $73,000 free lighting + $176,000 HVAC covered = $249,000 in covered improvements"] },
      { type: "h2", content: "We Handle All the Paperwork" },
      { type: "paragraph", content: "Mechanical Enterprise is a PSE&G Trade Ally () and WMBE/SBE Certified contractor. We handle every piece of the Direct Install process for your nonprofit: the initial assessment (free, 30 minutes per building), the program application, equipment specification, installation scheduling, and all post-installation documentation. Your facilities team doesn't fill out a single form. For multi-building portfolios, we assign a dedicated project coordinator who manages the entire rollout." },
      { type: "h2", content: "FAQ: Common Nonprofit Questions" },
      { type: "paragraph", content: "Does my church qualify for free lighting? Yes — all houses of worship with a commercial electric meter qualify for 100% lighting coverage under Direct Install. No cost, no OBR." },
      { type: "paragraph", content: "Can we get both lighting and HVAC covered? Absolutely. Both are part of the same program and can be assessed and installed in a single coordinated project. Lighting at 100% and HVAC at up to 80%." },
      { type: "paragraph", content: "What if we have 10 buildings? Every building qualifies separately. We coordinate multi-building rollouts and can phase the work to minimize disruption. The more buildings you have, the more your organization saves." },
      { type: "cta_box", content: "Find out what your nonprofit qualifies for. Free assessment — 30 minutes per building, we handle every form.", buttonText: "Book Free Nonprofit Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 13 — NJ Direct Install Complete Guide
  // ──────────────────────────────────────────────────────────────
  {
    title: "The NJ Direct Install Program: Complete Guide for Commercial Property Owners (2026)",
    slug: "nj-direct-install-program-commercial-guide",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Commercial",
    metaDescription: "NJ Direct Install Program covers up to 80% of commercial HVAC and 100% of lighting for NJ businesses. Complete guide for property owners. Free assessment.",
    excerpt: "The most underused commercial energy incentive in NJ. Here's everything property owners need to know in 2026 \u2014 real numbers, no jargon.",
    sections: [
      { type: "intro", content: "The NJ Direct Install Program is the single most valuable energy incentive available to commercial property owners in New Jersey \u2014 and most don't know it exists. It covers up to 80% of your HVAC replacement cost and [100% of your lighting](/blog/commercial-lighting-100-percent-free-nj) at zero cost. Here's the complete guide." },
      { type: "h2", content: "What Is the NJ Direct Install Program?" },
      { type: "paragraph", content: "Direct Install is a state-administered program that pays for energy efficiency upgrades in commercial and nonprofit buildings. Unlike residential rebates where you pay first and get reimbursed, Direct Install covers costs upfront \u2014 you never write a check for the covered portion. HVAC replacement is covered at up to 80%. The remaining 20% goes on [On-Bill Repayment (OBR)](/blog/on-bill-repayment-commercial-hvac-nj) at 0% interest, added directly to your utility bill." },
      { type: "h2", content: "Who Qualifies?" },
      { type: "paragraph", content: "Any commercial or nonprofit property in NJ with a commercial electric meter qualifies. This includes [restaurants](/blog/restaurant-hvac-lighting-direct-install-nj), [office buildings](/blog/office-building-direct-install-nj), retail stores, [warehouses](/blog/warehouse-lighting-hvac-direct-install-nj), healthcare facilities, houses of worship, schools, and any 501(c)(3) nonprofit. There are no income limits and no minimum or maximum project size." },
      { type: "h2", content: "HVAC: 80% Covered, OBR for Balance" },
      { type: "paragraph", content: "Direct Install covers up to 80% of qualifying HVAC replacement \u2014 heat pumps, VRV/VRF systems, rooftop units, split systems, and more. The remaining 20% is financed through OBR at 0% interest over 5-7 years. In most cases, your energy savings exceed the OBR payment, meaning your total utility bill actually goes down from day one." },
      { type: "h2", content: "Lighting: 100% Free, No OBR" },
      { type: "paragraph", content: "This is the part most property owners miss: [commercial lighting is covered at 100%](/blog/commercial-lighting-100-percent-free-nj) \u2014 no cost, no OBR, no financing. Interior LED, high-bay warehouse lighting, exterior building lights, parking lot lights, and emergency lighting are all covered. You can get lighting done without touching your HVAC, or bundle both in one project." },
      { type: "stat_box", content: "Direct Install HVAC: Up to 80% | OBR for Balance: 0% Interest | Lighting: 100% Free | Net Upfront Cost: $0" },
      { type: "h2", content: "Can You Get Both in One Visit?" },
      { type: "paragraph", content: "Yes. We assess lighting and HVAC simultaneously during your free walkthrough. Both are part of the same program and can be installed in a single coordinated project. Most property owners bundle both because the lighting is free and the combined energy savings make the HVAC OBR payments negligible." },
      { type: "h2", content: "How to Apply: 6 Steps" },
      { type: "numbered_list", items: ["Schedule a free assessment \u2014 we visit your property and evaluate lighting + HVAC", "We calculate your exact coverage amounts and projected energy savings", "We submit the Direct Install application on your behalf", "After approval, we schedule installation around your business hours", "Lighting installed (100% free) and HVAC installed (80% covered)", "OBR for HVAC balance begins on your next utility bill \u2014 typically less than your savings"] },
      { type: "h2", content: "Real Example: 5,000 Sq Ft Newark Office" },
      { type: "paragraph", content: "A Newark office building replaced aging HVAC and fluorescent lighting through Direct Install. HVAC project: $45,000 total, $36,000 covered (80%), OBR payment $180/month over 5 years. Monthly energy savings: $310. Net monthly benefit: +$130. Lighting project: $12,000 value, $0 cost, saves additional $180/month. Combined: the property owner saves $510/month in energy costs, pays $180/month in OBR, and nets +$330/month from day one." },
      { type: "stat_box", content: "HVAC Covered: $36,000 (80%) | OBR: $180/month | Energy Savings: $510/month | Net Benefit: +$330/month" },
      { type: "cta_box", content: "Find out what your commercial property qualifies for. Free assessment, we handle all paperwork.", buttonText: "Book Free Commercial Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 14 — Commercial Lighting 100% Free
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Commercial Lighting Is 100% Free Under Direct Install \u2014 Here's How to Get It",
    slug: "commercial-lighting-100-percent-free-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ commercial lighting replacement is 100% free under Direct Install. No cost, no OBR, no financing. Interior, exterior, parking lot. Free assessment.",
    excerpt: "New Jersey is replacing commercial lighting for free \u2014 100%, no catch. Here's exactly who qualifies and how to get it done.",
    sections: [
      { type: "intro", content: "This is not a rebate. Not a loan. Not a financing program. The NJ Direct Install Program pays 100% of commercial lighting replacement \u2014 you pay nothing, ever. No On-Bill Repayment. No monthly payments. Just free new LED lighting for your business." },
      { type: "h2", content: "What Qualifies for 100% Lighting Coverage?" },
      { type: "paragraph", content: "Interior LED retrofits and replacements for offices, retail, and commercial spaces. High-bay lighting for [warehouses](/blog/warehouse-lighting-hvac-direct-install-nj) and [manufacturing plants](/blog/manufacturing-direct-install-nj). Exterior building lighting and parking lot lighting. Emergency and exit lighting. Retail display lighting. Classroom and common-area lighting for [schools and churches](/blog/churches-houses-of-worship-direct-install-nj). Essentially, if it's a commercial light fixture, it qualifies." },
      { type: "h2", content: "What Doesn't Qualify" },
      { type: "checklist", items: ["Purely decorative lighting (chandeliers, neon signs)", "Residential units within mixed-use buildings", "Fixtures already upgraded to LED in the last 5 years", "Temporary or portable lighting"] },
      { type: "h2", content: "The Energy Savings Math" },
      { type: "paragraph", content: "Commercial LED lighting uses 60-75% less energy than fluorescent and HID alternatives. For a 10,000 sq ft [office building](/blog/office-building-direct-install-nj), that translates to $800-$1,400/month in energy savings. For a 50,000 sq ft warehouse with high-bay lighting, savings reach $2,000-$4,000/month. These savings start on day one and continue for 15-20 years (the lifespan of LED fixtures)." },
      { type: "stat_box", content: "Energy Reduction: 60-75% | Installation Cost: $0 | Monthly Savings: Day 1 | LED Lifespan: 15-20 Years" },
      { type: "h2", content: "Combine With HVAC for Maximum Benefit" },
      { type: "paragraph", content: "While lighting is the fastest win (100% free, immediate savings), bundling with HVAC makes the overall project even more compelling. HVAC is covered at 80% with OBR for the balance. When you combine free lighting savings with HVAC energy savings, the HVAC OBR payment is typically covered entirely by the combined energy reduction. Net result: lower total utility bill from day one with zero upfront cost." },
      { type: "h2", content: "Every Industry Qualifies" },
      { type: "paragraph", content: "Hotels, restaurants, retail stores, warehouses, offices, medical facilities, auto dealerships, gyms, salons, and every other commercial building type. Nonprofits including churches, community centers, and schools also qualify. There are no industry restrictions \u2014 if you have a commercial electric meter in NJ, your lighting qualifies." },
      { type: "cta_box", content: "Get your commercial lighting replaced for free. Assessment takes 30 minutes. We handle everything.", buttonText: "Book Free Lighting Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 15 — On-Bill Repayment Commercial
  // ──────────────────────────────────────────────────────────────
  {
    title: "On-Bill Repayment for Commercial HVAC in NJ: How $0 Upfront Actually Works",
    slug: "on-bill-repayment-commercial-hvac-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ On-Bill Repayment covers the remaining 20% of commercial HVAC after Direct Install pays 80%. Monthly OBR payments typically less than energy savings.",
    excerpt: "Direct Install covers 80% of commercial HVAC. On-Bill Repayment handles the rest \u2014 added to your utility bill, often less than your energy savings.",
    sections: [
      { type: "intro", content: "After the [NJ Direct Install Program](/blog/nj-direct-install-program-commercial-guide) covers 80% of your commercial HVAC replacement, the remaining 20% doesn't require a check, a loan, or a line of credit. It goes on On-Bill Repayment \u2014 added directly to your utility bill at 0% interest. Here's exactly how it works." },
      { type: "h2", content: "What Is Commercial On-Bill Repayment?" },
      { type: "paragraph", content: "OBR is not a loan. It's a utility-administered repayment mechanism tied to your electric meter \u2014 not to you personally or your credit. The remaining HVAC balance after Direct Install's 80% coverage is spread over 5-7 years at 0% interest and appears as a line item on your monthly utility bill. No bank, no credit check, no separate payment." },
      { type: "h2", content: "Real Math: Essex County Restaurant" },
      { type: "paragraph", content: "A 3,000 sq ft restaurant in Essex County replaced its aging rooftop unit through Direct Install. Total HVAC cost: $38,000. Direct Install covered: $30,400 (80%). OBR balance: $7,600. Monthly OBR payment over 5 years: $127. Monthly energy savings from new system: $290. Net monthly benefit: +$163. The restaurant saves money from day one." },
      { type: "stat_box", content: "OBR Payment: ~$127/month | Energy Savings: ~$290/month | Net Benefit: +$163/month | Upfront Cost: $0" },
      { type: "h2", content: "Key OBR Facts" },
      { type: "checklist", items: ["0% interest \u2014 the balance never grows", "Tied to the meter, not the owner \u2014 no personal credit check", "Transfers with building sale \u2014 disclosed at closing, new owner assumes", "5-7 year repayment terms", "No early payoff penalty \u2014 pay it off anytime", "Appears on your existing utility bill \u2014 no separate payment"] },
      { type: "h2", content: "What Happens When You Sell?" },
      { type: "paragraph", content: "The OBR obligation stays with the property. If you sell your building, the remaining OBR balance transfers to the new owner and is disclosed during the closing process. This is standard \u2014 it works the same way as any utility obligation. The new owner benefits from the energy-efficient equipment and continues the payments." },
      { type: "h2", content: "Lighting Has No OBR" },
      { type: "paragraph", content: "Important distinction: [commercial lighting is 100% free](/blog/commercial-lighting-100-percent-free-nj) under Direct Install with zero OBR. Only HVAC has the 80/20 split. This means you can get all your lighting replaced at zero cost with zero ongoing payments, even if you decide to wait on HVAC." },
      { type: "h2", content: "Nonprofits and OBR" },
      { type: "paragraph", content: "[Nonprofit organizations](/blog/nonprofit-direct-install-complete-guide-nj) benefit from the same OBR structure. For nonprofits with multiple buildings, each building's OBR is separate \u2014 managed independently on each meter. This makes budgeting and board approval straightforward." },
      { type: "cta_box", content: "See your exact OBR payment and energy savings. Free commercial assessment, no obligation.", buttonText: "Calculate My OBR \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 16 — Nonprofit Complete Guide
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Nonprofits: Lighting 100% Free + HVAC 80% Off \u2014 Complete Direct Install Guide",
    slug: "nonprofit-direct-install-complete-guide-nj",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Commercial",
    metaDescription: "NJ nonprofits qualify for 100% free lighting and 80% HVAC under Direct Install. Every building qualifies separately. Churches, schools, food banks. Free assessment.",
    excerpt: "NJ nonprofits are leaving millions on the table every year by not claiming Direct Install. Here's the complete guide for 501c3 organizations.",
    sections: [
      { type: "intro", content: "If you run a nonprofit in New Jersey, the Direct Install Program is the single most impactful financial decision you can make this year. [Lighting is 100% free](/blog/commercial-lighting-100-percent-free-nj). HVAC is 80% covered. And if your organization has multiple buildings, every single one qualifies separately." },
      { type: "h2", content: "Why Nonprofits Are the Biggest Winners" },
      { type: "paragraph", content: "Nonprofits face no income limits, no revenue caps, and no restrictions beyond having a commercial electric meter. Any 501(c)(3) qualifies \u2014 [churches and houses of worship](/blog/churches-houses-of-worship-direct-install-nj), food banks, charter schools, community centers, health nonprofits, and arts organizations. The program treats nonprofits identically to commercial properties." },
      { type: "h2", content: "The Portfolio Math: 5 Buildings" },
      { type: "paragraph", content: "For a nonprofit with 5 buildings, Direct Install covers each building separately. Total HVAC across 5 buildings: $200,000 \u2014 $160,000 covered (80%), OBR $670/month total. Total lighting across 5 buildings: $75,000 value \u2014 $0 cost. Combined monthly energy savings: $1,870. Net monthly benefit after OBR: +$1,200." },
      { type: "stat_box", content: "5 Buildings | $235,000 Covered | $0 Upfront | $14,400+ Annual Net Benefit" },
      { type: "h2", content: "Who Qualifies?" },
      { type: "checklist", items: ["Churches, mosques, synagogues, and all houses of worship", "Food banks, shelters, and social service organizations", "Charter schools, tutoring centers, and education nonprofits", "Community centers and recreation facilities", "Nonprofit hospitals and health clinics", "Arts organizations, museums, and cultural institutions", "Any NJ 501(c)(3) with a commercial electric meter"] },
      { type: "h2", content: "Lighting First Strategy" },
      { type: "paragraph", content: "For nonprofits unsure about committing to HVAC, start with lighting. It's the fastest win \u2014 100% free, no OBR, no board vote needed for financing. Once your board sees the lighting savings on the first utility bill, the HVAC conversation becomes much easier." },
      { type: "h2", content: "Board Presentation Package" },
      { type: "paragraph", content: "We prepare a complete building-by-building breakdown for your board \u2014 current energy costs, projected savings, OBR schedule, and net benefit analysis. This package is designed to give your board everything they need for an informed vote. It's free and there's no obligation." },
      { type: "cta_box", content: "Find out what your nonprofit qualifies for. Free assessment, we prepare your board presentation.", buttonText: "Book Nonprofit Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 17 — Restaurant Direct Install
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Restaurants: Replace HVAC for 80% Off and Get Free Lighting \u2014 Direct Install Guide",
    slug: "restaurant-hvac-lighting-direct-install-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ restaurants qualify for 80% HVAC and 100% free lighting under Direct Install. OBR for balance. Free assessment. PSE&G certified contractor.",
    excerpt: "Restaurant HVAC is the third-largest operating cost in the industry. Direct Install covers 80% and throws in free lighting. Here's how.",
    sections: [
      { type: "intro", content: "Restaurant HVAC replacement costs $25,000-$60,000 \u2014 the kind of expense that keeps owners up at night. The NJ Direct Install Program covers 80% of that cost. And it throws in 100% free lighting for your entire restaurant. Kitchen, dining room, bar, exterior, parking \u2014 all free." },
      { type: "h2", content: "What Direct Install Covers for Restaurants" },
      { type: "paragraph", content: "A typical $40,000 restaurant HVAC project: $32,000 covered by Direct Install (80%). Remaining $8,000 on [OBR](/blog/on-bill-repayment-commercial-hvac-nj) at $133/month over 5 years. Monthly energy savings from the new system: $200-$400. Net result: you save money from day one while running a brand new HVAC system." },
      { type: "stat_box", content: "HVAC Covered: $32,000 (80%) | OBR: $133/month | Savings: $200-$400/month | Lighting: $0 Cost" },
      { type: "h2", content: "Restaurant Lighting: 100% Free" },
      { type: "paragraph", content: "Kitchen lighting, dining room ambiance, bar and lounge lighting, restrooms, exterior and signage lighting, parking lot \u2014 all covered at 100%. A typical restaurant lighting upgrade is worth $8,000-$15,000 and you pay nothing. Modern LED restaurant lighting also provides better color rendering for food presentation and creates the atmosphere your guests expect." },
      { type: "h2", content: "Scheduling Around Your Business" },
      { type: "paragraph", content: "We understand restaurants can't shut down. Installation is phased around your operating hours \u2014 lighting during closed hours, HVAC during your slowest periods. Most restaurant lighting installations complete in 1-2 days. HVAC timelines depend on system complexity but we coordinate every step with your schedule." },
      { type: "cta_box", content: "See what your restaurant qualifies for. Free assessment, we work around your schedule.", buttonText: "Book Restaurant Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/direct-install/hotels-nj" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 18 — Warehouse Direct Install
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Warehouses: Free High-Bay Lighting + HVAC 80% Off \u2014 Direct Install Guide",
    slug: "warehouse-lighting-hvac-direct-install-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ warehouses qualify for 100% free high-bay lighting and 80% HVAC under Direct Install. No size cap. OBR for balance. Free assessment.",
    excerpt: "Warehouse lighting and HVAC are 60-70% of energy costs. Direct Install covers both \u2014 lighting free, HVAC 80% off. No project size cap.",
    sections: [
      { type: "intro", content: "Warehouse energy costs are dominated by two things: high-bay lighting and climate control. The [NJ Direct Install Program](/blog/nj-direct-install-program-commercial-guide) covers both simultaneously \u2014 lighting at 100% free and HVAC at 80% covered. There is no project size cap." },
      { type: "h2", content: "High-Bay Lighting: 100% Free" },
      { type: "paragraph", content: "Replacing 400W metal halide with 150W LED high-bay fixtures cuts lighting energy by 60%. For a 50,000 sq ft warehouse, that's $2,000-$4,000/month in savings. Direct Install covers 100% of this upgrade \u2014 no cost, no OBR. Loading dock lighting, office areas within the facility, exterior security lighting, and parking areas are all included." },
      { type: "h2", content: "HVAC for Warehouses: 80% Covered" },
      { type: "paragraph", content: "Warehouse HVAC includes loading dock air curtains, break room and office climate control, temperature-controlled storage areas, and general warehouse heating. All qualify for 80% coverage with [OBR for the balance](/blog/on-bill-repayment-commercial-hvac-nj). No project size cap \u2014 500,000 sq ft qualifies the same as 5,000 sq ft." },
      { type: "h2", content: "Real Example: 100,000 Sq Ft Warehouse" },
      { type: "paragraph", content: "Lighting project: $180,000 value, $0 cost, saves $4,200/month. HVAC project: $220,000 total, $176,000 covered (80%), OBR $733/month over 5 years, saves $1,100/month. Combined monthly benefit: $4,200 lighting savings + $1,100 HVAC savings - $733 OBR = $4,567 net monthly savings." },
      { type: "stat_box", content: "Lighting Savings: $4,200/month | HVAC Savings: $1,100/month | OBR: $733/month | Net: +$4,567/month" },
      { type: "h2", content: "Phased Installation" },
      { type: "paragraph", content: "Active warehouses can't shut down for weeks. We phase installations bay by bay, working during off-peak hours or scheduled maintenance windows. Your operations continue uninterrupted. For [manufacturing facilities](/blog/manufacturing-direct-install-nj), we coordinate with production schedules for zero downtime." },
      { type: "cta_box", content: "Get your warehouse assessed for free. No size limit, no obligation.", buttonText: "Book Warehouse Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 19 — Office Building Direct Install
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Office Buildings: Free Lighting + 80% Off HVAC Through Direct Install",
    slug: "office-building-direct-install-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ office buildings qualify for 100% free LED lighting and 80% HVAC under Direct Install. Multi-floor buildings. OBR for balance. Free assessment.",
    excerpt: "Lighting and HVAC are 70-80% of office energy costs. Direct Install covers both \u2014 free lighting, 80% off HVAC. Here's how it works for office properties.",
    sections: [
      { type: "intro", content: "For NJ office building owners and [property managers](/blog/property-manager-direct-install-nj), the Direct Install Program eliminates the two largest energy expenses in one project. [Lighting is 100% free](/blog/commercial-lighting-100-percent-free-nj). HVAC is 80% covered. And the process works for multi-floor buildings with one application covering the entire property." },
      { type: "h2", content: "What Qualifies for Office Lighting?" },
      { type: "paragraph", content: "Open office areas, private offices, conference rooms, lobbies, hallways, restrooms, parking garages, and exterior building lighting. All covered at 100%. Modern LED office lighting reduces eye strain, improves worker productivity by up to 20%, and serves as a tenant retention tool. It's the easiest building upgrade you'll ever make \u2014 because it costs nothing." },
      { type: "h2", content: "Multi-Floor Buildings" },
      { type: "paragraph", content: "One application covers your entire building regardless of floor count. Installation is phased floor by floor to minimize tenant disruption. We coordinate with your building management team and schedule work during off-hours when possible. Most office lighting installations complete in 1-2 days per floor." },
      { type: "h2", content: "HVAC: Central Systems, RTUs, VRF \u2014 All Qualify" },
      { type: "paragraph", content: "Central HVAC systems, rooftop units, split systems, and VRF \u2014 all qualify for 80% coverage. For a 20,000 sq ft office building: $120,000 HVAC project, $96,000 covered by Direct Install, [OBR](/blog/on-bill-repayment-commercial-hvac-nj) $400/month, energy savings $600-$900/month. Net benefit from day one." },
      { type: "stat_box", content: "HVAC Covered: $96,000 (80%) | OBR: $400/month | Savings: $600-$900/month | Lighting: Free" },
      { type: "cta_box", content: "Get your office building assessed for free. We handle multi-floor coordination.", buttonText: "Book Office Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 20 — Churches and Houses of Worship
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Churches and Houses of Worship: Free Lighting + 80% Off HVAC \u2014 Complete Guide",
    slug: "churches-houses-of-worship-direct-install-nj",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Commercial",
    metaDescription: "NJ churches, mosques, synagogues qualify for 100% free lighting and 80% HVAC under Direct Install. Multiple buildings each qualify separately. Free assessment.",
    excerpt: "Faith communities across NJ are replacing aging HVAC and lighting at zero cost through Direct Install. Here is the complete guide.",
    sections: [
      { type: "intro", content: "Houses of worship qualify exceptionally well for the [NJ Direct Install Program](/blog/nj-direct-install-program-commercial-guide) because they're classified as nonprofit commercial properties \u2014 no income limits, no restrictions. If your faith community has multiple buildings, each one qualifies separately for [100% free lighting](/blog/commercial-lighting-100-percent-free-nj) and 80% HVAC coverage." },
      { type: "h2", content: "Multiple Buildings Each Qualify Separately" },
      { type: "paragraph", content: "This is the key advantage for houses of worship. Your sanctuary, education wing, fellowship hall, administrative office, and any other building on a separate electric meter each qualifies independently. A church with 3 buildings gets 3 separate lighting upgrades (all free) and 3 separate HVAC projects (each 80% covered)." },
      { type: "h2", content: "Sanctuary Lighting" },
      { type: "paragraph", content: "Modern LED sanctuary lighting provides ambient, accent, and task lighting with full color temperature control and dimming. The result is better atmosphere for worship while using 60-70% less energy. All covered at 100% \u2014 no cost to your congregation." },
      { type: "h2", content: "Real Example: West Orange Church" },
      { type: "paragraph", content: "A West Orange church with 3 buildings (sanctuary, education wing, fellowship hall): Lighting across all 3 buildings: $48,000 value at $0 cost. HVAC across all 3 buildings: $85,000 total, $68,000 covered (80%). [OBR](/blog/on-bill-repayment-commercial-hvac-nj) payment: $283/month. Combined energy savings: $520/month. Net benefit: +$237/month. The church saves $2,844 per year while running brand new HVAC and lighting." },
      { type: "stat_box", content: "3 Buildings | Lighting: $48,000 Free | HVAC: $68,000 Covered | Net Savings: +$237/month" },
      { type: "h2", content: "We Work Around Your Schedule" },
      { type: "paragraph", content: "We schedule all work around your service times, events, and programs. No work during worship. No disruption to your congregation. Most lighting installations complete in 1-2 days per building. HVAC is scheduled during your quietest periods." },
      { type: "cta_box", content: "Find out what your house of worship qualifies for. Free assessment, every building evaluated.", buttonText: "Book Church Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 21 — Manufacturing Direct Install
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Manufacturing: Free Industrial Lighting + HVAC 80% Off \u2014 Direct Install Guide",
    slug: "manufacturing-direct-install-nj",
    date: "March 31, 2026",
    readTime: "7 min read",
    category: "Commercial",
    metaDescription: "NJ manufacturing plants qualify for 100% free industrial lighting and 80% HVAC under Direct Install. No project size cap. OBR for balance. Free assessment.",
    excerpt: "NJ manufacturers have the highest energy costs in commercial real estate. Direct Install covers both industrial lighting and HVAC simultaneously.",
    sections: [
      { type: "intro", content: "Manufacturing facilities have the highest energy density of any commercial building type in NJ. The [Direct Install Program](/blog/nj-direct-install-program-commercial-guide) covers both industrial lighting (100% free) and HVAC (80% covered) with no project size cap. A 500,000 sq ft plant qualifies the same as a 5,000 sq ft shop." },
      { type: "h2", content: "Industrial Lighting: 100% Free" },
      { type: "paragraph", content: "High-bay production floor lighting, loading dock lighting, exterior security lighting, and office areas within the facility \u2014 all covered at [100% with zero cost](/blog/commercial-lighting-100-percent-free-nj). LED high-bay fixtures provide better visibility for workers, last 50,000+ hours, and use 60% less energy than metal halide or fluorescent alternatives." },
      { type: "h2", content: "No Project Size Cap" },
      { type: "paragraph", content: "Unlike some incentive programs with dollar caps, Direct Install has no maximum project size for manufacturing facilities. Whether your lighting project is $20,000 or $500,000, coverage is 100%. HVAC coverage at 80% also has no cap. This makes the program especially valuable for large [warehouse](/blog/warehouse-lighting-hvac-direct-install-nj) and manufacturing operations." },
      { type: "h2", content: "HVAC for Manufacturing" },
      { type: "paragraph", content: "Make-up air units, rooftop units, warehouse heaters, office climate control within the facility, and process cooling \u2014 all qualify for 80% coverage. [OBR for the remaining 20%](/blog/on-bill-repayment-commercial-hvac-nj) at 0% interest. Energy savings from modern HVAC typically exceed the OBR payment." },
      { type: "h2", content: "Zero Production Downtime" },
      { type: "paragraph", content: "We phase installations bay by bay, scheduling work during maintenance windows, shift changes, or weekend shutdowns. Your production line runs continuously. For multi-shift operations, we coordinate with your plant manager to find the optimal installation windows." },
      { type: "stat_box", content: "Lighting: 100% Free | HVAC: 80% Covered | Size Cap: None | Downtime: Zero" },
      { type: "cta_box", content: "Get your manufacturing facility assessed. No size limit, no obligation, no downtime.", buttonText: "Book Manufacturing Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 22 — Property Manager Playbook
  // ──────────────────────────────────────────────────────────────
  {
    title: "NJ Property Managers: Direct Install Is the Easiest CapEx Win of 2026",
    slug: "property-manager-direct-install-nj",
    date: "March 31, 2026",
    readTime: "6 min read",
    category: "Commercial",
    metaDescription: "NJ property managers remove HVAC from CapEx with Direct Install covering 80%. Lighting 100% free. Multi-property coordination. OBR for balance. Free assessment.",
    excerpt: "For NJ property managers, Direct Install turns a major capital expense into a zero-upfront budget win. Here is the portfolio playbook.",
    sections: [
      { type: "intro", content: "If you manage commercial properties in NJ, the [Direct Install Program](/blog/nj-direct-install-program-commercial-guide) turns your biggest CapEx headache into an OpEx line item that pays for itself. HVAC moves off the capital budget entirely. [Lighting is free](/blog/commercial-lighting-100-percent-free-nj). And your tenants get a better building." },
      { type: "h2", content: "Take HVAC Off CapEx" },
      { type: "paragraph", content: "A $100,000 HVAC project becomes: $80,000 covered by Direct Install (off your books), $20,000 on [OBR](/blog/on-bill-repayment-commercial-hvac-nj) at $333/month (OpEx, on the utility bill), offset by $500-$800/month in energy savings. Net impact on your operating budget: positive from day one. No capital expenditure request. No bank financing. No board approval for capital." },
      { type: "h2", content: "Free Lighting Across Every Property" },
      { type: "paragraph", content: "For a portfolio of 10 properties, that's $100,000-$300,000 in free lighting upgrades. LED lighting is the #1 tenant satisfaction improvement you can make \u2014 and it costs you nothing. Every property gets assessed individually. Every qualifying fixture gets replaced. Zero out of pocket." },
      { type: "h2", content: "Multi-Property Coordination" },
      { type: "paragraph", content: "One point of contact, one team, one coordinated rollout. We schedule around tenant hours across all your properties. No need to manage multiple contractors or applications. We handle every assessment, every application, and every installation across your entire portfolio." },
      { type: "h2", content: "Tenant Retention Impact" },
      { type: "paragraph", content: "HVAC and lighting are the top two factors in commercial tenant renewal decisions. Modern HVAC means consistent temperature, better air quality, and quieter operation. LED lighting means better work environments and lower common-area energy costs. Both delivered at zero upfront cost to you." },
      { type: "h2", content: "The Report We Provide" },
      { type: "paragraph", content: "We prepare a property-by-property breakdown: current energy costs, recommended upgrades, projected savings, OBR schedule, and net benefit analysis. This report is formatted for ownership presentation \u2014 the kind of document that gets immediate approval because the math is undeniable." },
      { type: "cta_box", content: "Get your portfolio assessed. One contact, all properties, zero upfront cost.", buttonText: "Book Portfolio Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/commercial" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 23 — How to Apply for a PSE&G Rebate
  // ──────────────────────────────────────────────────────────────
  {
    title: "How to Apply for a PSE&G Rebate in NJ \u2014 And Why Most People Use a Contractor to Do It",
    slug: "how-to-apply-pseg-rebate-nj",
    date: "April 1, 2026",
    readTime: "5 min read",
    category: "Residential",
    metaDescription: "Step-by-step guide to applying for a PSE&G rebate in NJ. Most homeowners use a certified contractor to handle the application \u2014 here's why.",
    excerpt: "PSE&G offers thousands in rebates for NJ homeowners \u2014 but the application process stops most people cold. Here's the full breakdown and the easier path.",
    sections: [
      { type: "intro", content: "PSE&G offers some of the most generous energy rebates in the country. NJ homeowners can get up to $18,000 back on heat pumps, HVAC systems, and energy-efficient upgrades. Add in the Mechanical Enterprise incentive and you\u2019re looking at $20,000. But there\u2019s a problem: the application process is where most people give up." },
      { type: "h2", content: "What PSE&G Rebates Actually Cover" },
      { type: "paragraph", content: "PSE&G rebates apply to a wide range of residential upgrades. Heat pump installations are the biggest \u2014 up to $18,000 for qualifying cold-climate systems. Central air conditioning replacements, ductless mini-split systems, and high-efficiency furnaces all qualify for various rebate tiers. On the commercial side, the [Direct Install Program](/blog/nj-direct-install-program-commercial-guide) covers 80% of HVAC costs and [100% of lighting](/blog/commercial-lighting-100-percent-free-nj). The rebate amounts depend on equipment efficiency ratings, your existing system, and whether you\u2019re a PSE&G electric or gas customer. Most homeowners don\u2019t know their exact eligibility until an assessment is done \u2014 which is free when you work with a [certified contractor](/pseg-rebate-contractor-nj)." },
      { type: "h2", content: "The Actual Application Process" },
      { type: "paragraph", content: "Here\u2019s what applying for a PSE&G rebate looks like if you do it yourself. First, you need to identify which rebate programs you qualify for \u2014 PSE&G runs multiple programs simultaneously and the requirements differ. Then you need your utility account number, property deed or ownership proof, and your current equipment details including make, model, age, and efficiency ratings." },
      { type: "numbered_list", items: [
        "Determine which PSE&G rebate programs apply to your property and equipment",
        "Gather documentation: utility account number, property ownership proof, existing equipment details",
        "Select qualifying replacement equipment that meets PSE&G\u2019s minimum efficiency requirements (SEER2, HSPF2 ratings)",
        "Get quotes from a PSE&G-certified contractor \u2014 non-certified contractors disqualify your application",
        "Complete the rebate application with equipment specifications, contractor information, and property details",
        "Schedule and complete the installation with all required permits and inspections",
        "Submit post-installation documentation within 90 days: paid invoice, AHRI certificate, permit records",
        "Wait 6\u20138 weeks for PSE&G to process and mail the rebate check"
      ]},
      { type: "paragraph", content: "Each step has specific requirements that must be met exactly. Miss the 90-day post-installation window and your rebate is gone. Use a non-certified contractor and your application is automatically denied. Submit the wrong efficiency rating documentation and you\u2019re starting over." },
      { type: "h2", content: "Why Most People Abandon the Application" },
      { type: "paragraph", content: "The drop-off rate on PSE&G rebate applications is staggering. Most homeowners start the process, realize how much documentation is required, and either delay until they miss the window or give up entirely. The most common sticking points are identifying the correct rebate program, finding a certified contractor, and assembling post-installation paperwork within the deadline. It\u2019s not that any single step is impossible. It\u2019s that there are eight steps, each with specific requirements, and one mistake at any point can invalidate the entire application." },
      { type: "h2", content: "The 3 Most Common Rejection Reasons" },
      { type: "checklist", items: [
        "Wrong timing \u2014 application submitted outside the 90-day post-installation window",
        "Missing documentation \u2014 incorrect or incomplete equipment specifications, AHRI certificates, or permit records",
        "Non-certified contractor \u2014 the installing contractor was not on PSE&G\u2019s approved list at the time of installation"
      ]},
      { type: "paragraph", content: "All three of these are completely avoidable when a certified contractor manages the process. That\u2019s why the majority of successful PSE&G rebate applications come through contractors, not individual homeowners." },
      { type: "h2", content: "What a Certified PSE&G Contractor Does Differently" },
      { type: "paragraph", content: "A [PSE&G certified contractor](/blog/pseg-certified-hvac-contractor-nj) already knows which programs you qualify for based on your property and current equipment. They select equipment that meets the exact efficiency thresholds. They submit applications with the correct documentation the first time. And they track the 90-day window automatically because it\u2019s built into their workflow." },
      { type: "stat_box", content: "Contractor-filed applications: 90%+ approval rate | DIY applications: significantly lower due to documentation errors and missed deadlines" },
      { type: "h2", content: "How Mechanical Enterprise Handles It" },
      { type: "paragraph", content: "We\u2019re a PSE&G certified contractor, WMBE certified, and SBE certified. When you book a free 20-minute assessment with us, here\u2019s what happens: we assess your property, identify every rebate you qualify for (PSE&G, NJ Clean Energy, federal tax credit), file all applications, schedule installation at your convenience, and track every deadline. You don\u2019t fill out a single form. The entire rebate filing service is free \u2014 we make our money from the installation, not from paperwork fees. Most of our customers receive between $12,000 and $20,000 in combined rebates." },
      { type: "cta_box", content: "Stop fighting PSE&G paperwork. Book a free 20-minute assessment and we handle every application for you.", buttonText: "Book Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj" },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // POST 24 — PSE&G Certified Contractor Explained
  // ──────────────────────────────────────────────────────────────
  {
    title: "What Is a PSE&G Certified Contractor and Why Does It Matter for Your Rebate?",
    slug: "pseg-certified-hvac-contractor-nj",
    date: "April 1, 2026",
    readTime: "4 min read",
    category: "Residential",
    metaDescription: "PSE&G certified contractors can file rebate applications on your behalf in NJ. Here\u2019s what certification means and why it saves you thousands.",
    excerpt: "Not all HVAC contractors can file PSE&G rebate applications. Here\u2019s what PSE&G certification means, why it matters, and what happens if you skip it.",
    sections: [
      { type: "intro", content: "If you\u2019re planning to claim a PSE&G rebate in NJ, one requirement trips up more homeowners than any other: the contractor must be PSE&G certified. Use a non-certified contractor \u2014 even a licensed, insured, excellent one \u2014 and your rebate application is automatically denied. Here\u2019s everything you need to know." },
      { type: "h2", content: "What PSE&G Contractor Certification Means" },
      { type: "paragraph", content: "PSE&G maintains a list of approved contractors who have met their specific requirements for training, insurance, licensing, and installation quality standards. Certification is not the same as a state HVAC license. A contractor can be fully licensed by the State of New Jersey and still not be on PSE&G\u2019s certified list. PSE&G certification requires additional training on their rebate programs, familiarity with qualifying equipment specifications, and a track record of compliant installations. The certification also means the contractor can file rebate applications directly on behalf of the homeowner \u2014 which eliminates most of the paperwork burden that causes DIY applications to fail." },
      { type: "h2", content: "Why Only Certified Contractors Can File Direct Install Applications" },
      { type: "paragraph", content: "The [NJ Direct Install Program](/blog/nj-direct-install-program-commercial-guide) \u2014 which covers 80% of commercial HVAC costs and [100% of lighting](/blog/commercial-lighting-100-percent-free-nj) \u2014 is exclusively available through PSE&G certified contractors. This isn\u2019t optional or flexible. The program requires certified contractors because they\u2019ve been trained on the specific assessment protocols, equipment standards, and documentation requirements. A certified contractor conducts the initial energy assessment, selects qualifying equipment, performs the installation to program standards, and submits all required documentation directly to PSE&G. The business owner never touches an application form." },
      { type: "h2", content: "What Happens If You Use a Non-Certified Contractor" },
      { type: "paragraph", content: "The consequences are straightforward and expensive. If your HVAC installation is performed by a contractor who isn\u2019t on PSE&G\u2019s certified list, your residential rebate application will be denied. You cannot retroactively certify the contractor or re-submit. You cannot transfer the installation to a certified contractor\u2019s paperwork. The rebate is simply lost. For commercial properties, it\u2019s even more restrictive: without a certified contractor, you cannot access the Direct Install Program at all. That means paying full price for equipment and installation that would have been 80% covered." },
      { type: "stat_box", content: "Rebate denied with non-certified contractor: 100% of cases | Direct Install without certification: not available | Cost difference: up to $20,000 in lost rebates" },
      { type: "h2", content: "How to Verify a Contractor Is PSE&G Certified" },
      { type: "paragraph", content: "Before signing any contract for HVAC work in NJ, verify certification directly. Ask the contractor for their PSE&G certification number or Trade Ally status. You can also check PSE&G\u2019s website for their current list of approved contractors, or call PSE&G\u2019s energy efficiency department to confirm. Don\u2019t rely on a contractor claiming to be \u201cPSE&G approved\u201d or \u201cfamiliar with PSE&G rebates.\u201d There\u2019s a difference between knowing about the programs and being authorized to file applications. Only certified contractors can do the latter." },
      { type: "checklist", items: [
        "Ask for the contractor\u2019s PSE&G certification number or Trade Ally documentation",
        "Verify directly with PSE&G\u2019s energy efficiency department if uncertain",
        "Confirm the contractor can file rebate applications on your behalf (not just \u201chelp with paperwork\u201d)",
        "For commercial projects: confirm Direct Install Program authorization specifically"
      ]},
      { type: "h2", content: "What Mechanical Enterprise\u2019s Certification Covers" },
      { type: "paragraph", content: "Mechanical Enterprise is a PSE&G certified contractor, WMBE (Women/Minority Business Enterprise) certified, and SBE (Small Business Enterprise) certified. Our certification covers residential rebate applications (heat pumps, central AC, ductless mini-splits, furnaces), commercial Direct Install Program (HVAC and lighting), and the On-Bill Repayment program for commercial customers. We serve 15 NJ counties and have filed hundreds of successful PSE&G rebate applications. Our approval rate exceeds 90% because we know exactly what documentation PSE&G requires and we submit it correctly the first time." },
      { type: "paragraph", content: "When you [book a free assessment](/pseg-rebate-contractor-nj) with us, certification is already handled. We assess your property, identify every rebate program you qualify for \u2014 PSE&G, NJ Clean Energy, federal tax credit \u2014 and [file all applications](/blog/how-to-apply-pseg-rebate-nj) at no cost to you. The entire process from assessment to rebate check takes 8\u201312 weeks for most homeowners." },
      { type: "cta_box", content: "Work with a verified PSE&G certified contractor. Free 20-minute assessment, we handle every application.", buttonText: "Book Free Assessment \u2192", buttonUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj" },
    ],
  },
];
