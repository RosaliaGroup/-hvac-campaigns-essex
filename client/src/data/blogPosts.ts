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
    title: "NJ Heat Pump Rebates 2026: How to Get Up to $16,000",
    slug: "nj-heat-pump-rebates-2026",
    date: "March 31, 2026",
    readTime: "8 min read",
    category: "Rebates & Incentives",
    metaDescription: "Complete guide to NJ heat pump rebates in 2026. Learn how to qualify for up to $16,000 in rebates plus a $2,000 federal tax credit. Free assessment available.",
    excerpt: "NJ homeowners can qualify for up to $16,000 in heat pump rebates in 2026. Here's exactly how to get every dollar you're entitled to.",
    sections: [
      { type: "intro", content: "If you're a New Jersey homeowner thinking about replacing your heating or cooling system, 2026 is the best time to do it. Between NJ state rebates and federal tax credits, you could receive up to $18,000 back on a new heat pump installation — and Mechanical Enterprise handles all the paperwork for free." },
      { type: "h2", content: "What Rebates Are Available for NJ Homeowners in 2026?" },
      { type: "paragraph", content: "New Jersey homeowners installing qualifying heat pump systems can access two major incentive programs in 2026. The first is NJ state rebates which can provide up to $16,000 depending on your property type, existing system, and the equipment you install. The second is the federal Investment Tax Credit (ITC) under the Inflation Reduction Act, which provides up to $2,000 as a direct tax credit." },
      { type: "stat_box", content: "NJ Rebates: Up to $16,000 | Federal Tax Credit: Up to $2,000 | Total Possible: Up to $18,000" },
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
      { type: "paragraph", content: "On-bill repayment is simple: after your rebates are applied, any remaining installation cost is financed at 0% interest and added to your monthly utility bill. There's no separate loan, no credit check in most cases, and no lump-sum payment due. The payments are spread over 5-10 years and appear as a line item on your existing PSE&G, JCP&L, or ACE bill." },
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
      { type: "paragraph", content: "NJ's commercial decarbonization program targets buildings that currently use fossil fuel heating systems. The program provides significant financial incentives for commercial property owners who transition to high-efficiency heat pump or VRV/VRF systems. Unlike residential programs which cap at specific dollar amounts, commercial rebates are calculated as a percentage of total project cost — and that percentage can reach 80%." },
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
];
