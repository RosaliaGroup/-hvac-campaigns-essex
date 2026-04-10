export interface AdCopyEntry {
  name: string;
  category: "r22" | "aging-system" | "rebate" | "county" | "commercial" | "essex-campaign";
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
}

export const AD_COPY_LIBRARY: AdCopyEntry[] = [
  // ── 3 Pre-configured Essex County Campaigns ──────────────────────────
  {
    name: "ME — Rebate Hunter",
    category: "essex-campaign",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "Up to $16,000 NJ Heat Pump Rebate",
      "See Your Rebate in 2 Minutes",
      "NJ Clean Heat Rebate — Apply Now",
      "Heat Pump Rebates Essex County NJ",
      "Free Rebate Estimate — No Obligation",
      "$16K Back on Heat Pump Upgrades",
      "Mechanical Enterprise — Local HVAC",
      "WMBE Certified HVAC Contractor NJ",
      "0% Financing + Rebates Available",
      "Replace Oil Heat — Get $16K Back",
      "Heat Pump Installation New Jersey",
      "Check Your Rebate Eligibility Now",
      "NJ Homeowners — Big Rebates Available",
      "No Money Down Heat Pump Options",
      "Free 2-Min Rebate Calculator",
    ],
    descriptions: [
      "Essex County homeowners qualify for up to $16,000 in rebates and incentives on a new heat pump. See your estimate in 2 minutes — no commitment required.",
      "Mechanical Enterprise is a WMBE-certified local HVAC contractor serving Essex County. 0% financing, no money down options, and up to $16,000 in program rebates.",
      "Replace your oil, gas, or electric system with a high-efficiency heat pump. NJ Clean Heat program covers up to $16,000. Free assessment — book online today.",
      "Check what rebates and incentives you qualify for in 2 minutes. Serving all of Essex County NJ. WMBE/SBE certified. Call (862) 423-9396 or get your estimate online.",
    ],
  },
  {
    name: "ME — Oil Replacement",
    category: "essex-campaign",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "Switch From Oil — Get Up to $16K Back",
      "Oil to Heat Pump Conversion NJ",
      "Replace Oil Heat — Big Rebates Available",
      "NJ Clean Heat — Oil Replacement Rebates",
      "Free Oil Replacement Estimate",
      "Ditch Oil Heat — Save Every Month",
      "Oil Boiler Replacement Essex County",
      "Heat Pump Replaces Oil — 0% Financing",
      "Up to $16,000 Oil Conversion Rebate",
      "Mechanical Enterprise — Oil Conversion",
      "No Money Down Oil Replacement",
      "Oil Tank Decommission Included",
      "Switch to Heat Pump — Lower Bills",
      "NJ Homeowners — Drop Oil This Year",
      "Free 2-Min Rebate Calculator",
    ],
    descriptions: [
      "Switching from oil to a heat pump in New Jersey qualifies for up to $16,000 in rebates and incentives. Oil tank decommissioning included. Free estimate in 2 minutes.",
      "Mechanical Enterprise handles the full oil-to-heat pump conversion — decommissioning, installation, and rebate paperwork. Serving Essex County NJ. Call (862) 423-9396.",
      "Stop paying high oil prices. A new heat pump costs less to run and qualifies for up to $16,000 in NJ Clean Heat rebates. 0% financing, no money down options available.",
      "Essex County homeowners: replace your oil system and get up to $16,000 back through the NJ Clean Heat program. WMBE-certified local contractor. Book your free assessment today.",
    ],
  },
  {
    name: "ME — HVAC Replacement",
    category: "essex-campaign",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Essex County NJ",
      "New Heat Pump Installation NJ",
      "Central AC Installation New Jersey",
      "Local HVAC Contractor — Free Quote",
      "Mechanical Enterprise — Essex County",
      "WMBE Certified HVAC Contractor",
      "Heat Pump + AC — One System",
      "0% Financing on New HVAC Systems",
      "Up to $16,000 in Rebates Available",
      "Free HVAC Assessment — Book Online",
      "High-Efficiency Heat Pumps NJ",
      "Full System Replacement — No Money Down",
      "Serving All of Essex County NJ",
      "VRV/VRF Specialists",
      "Call (862) 423-9396 — Free Estimate",
    ],
    descriptions: [
      "Mechanical Enterprise installs high-efficiency heat pumps and central AC systems throughout Essex County NJ. Up to $16,000 in rebates available. Free assessment — book online.",
      "Local WMBE-certified HVAC contractor serving Essex County. New heat pump systems starting with 0% financing and no money down. Check your rebate eligibility in 2 minutes.",
      "Replace your old HVAC system with a high-efficiency heat pump. Heating and cooling in one unit. Up to $16,000 in NJ Clean Heat rebates. Call (862) 423-9396 today.",
      "Mechanical Enterprise handles full HVAC replacements for Essex County homeowners. VRV/VRF specialists. Free assessment, no obligation. See your rebate estimate online now.",
    ],
  },

  // ── R22 Campaigns ────────────────────────────────────────────────────
  {
    name: "ME - R22 Refrigerant Replacement NJ",
    category: "r22",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "R22 System? Time to Replace",
      "Up to $20K in NJ Rebates",
      "Free Assessment Today",
    ],
    descriptions: [
      "Your R22 AC system cannot be recharged — R22 is banned. Replace now and get up to $20K in rebates.",
      "Licensed NJ contractor. Free assessment. We handle all PSE&G rebate paperwork. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - R22 Freon Replacement NJ",
    category: "r22",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "Old Freon AC? Replace It Now",
      "PSE&G Pays Up to $18K",
      "Free NJ Assessment",
    ],
    descriptions: [
      "R22 freon is banned. Stop paying for repairs on a dead system. Replace and get up to $20K back.",
      "Free assessment. We handle PSE&G rebate paperwork. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - R22 AC Repair vs Replace NJ",
    category: "r22",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "R22 Repair Not Worth It",
      "Replace and Get $20K Back",
      "Free NJ Assessment",
    ],
    descriptions: [
      "Repairing an R22 system costs more every year. Replace now and get up to $20K in NJ rebates.",
      "Free assessment. Licensed NJ contractor. We handle all paperwork. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - R22 Phase Out NJ",
    category: "r22",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "R22 Is Banned — Act Now",
      "Up to $20K NJ Rebates",
      "Replace Your Old AC",
    ],
    descriptions: [
      "R22 refrigerant was banned in 2020. Your old AC system qualifies for up to $20K in NJ rebates now.",
      "Free assessment. We handle PSE&G paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - R22 System Cost NJ",
    category: "r22",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "R22 Replacement Cost NJ",
      "PSE&G Covers Up to $18K",
      "Free Quote No Obligation",
    ],
    descriptions: [
      "R22 system replacement costs $8K-$15K. PSE&G rebates cover up to $18K. You may pay nothing.",
      "Free assessment and quote. We handle all rebate paperwork. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - R22 Emergency NJ",
    category: "r22",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "R22 System Failed?",
      "Same-Day Replacement NJ",
      "Get $20K Back in Rebates",
    ],
    descriptions: [
      "R22 AC broke down? Cannot be repaired cheaply. Replace now and get up to $20K in NJ rebates.",
      "Same-day assessment available. Licensed NJ contractor. Call (862) 423-9396 now.",
    ],
  },

  // ── Aging System Campaigns ───────────────────────────────────────────
  {
    name: "ME - Old AC Unit Replacement NJ",
    category: "aging-system",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "Old AC System? Replace It",
      "Up to $20K NJ Rebates",
      "Free Assessment Today",
    ],
    descriptions: [
      "AC systems over 10 years old qualify for up to $20K in NJ rebates. Replace before summer.",
      "Free assessment. We handle PSE&G rebate paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - AC Unit 10 Years Old NJ",
    category: "aging-system",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "10+ Year Old AC? Replace Now",
      "PSE&G Covers Up to $18K",
      "Free NJ Home Assessment",
    ],
    descriptions: [
      "If your AC is 10+ years old you qualify for major NJ rebates. Most homeowners get $12K-$20K back.",
      "Free assessment. We handle all paperwork. WMBE certified NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Inefficient AC Replacement NJ",
    category: "aging-system",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "High AC Bills? Replace It",
      "Cut Bills and Get $20K Back",
      "Free NJ Assessment",
    ],
    descriptions: [
      "Old inefficient AC costs $200+ more per month. Replace and get up to $20K in NJ rebates now.",
      "Free assessment. We handle PSE&G paperwork. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Central AC Replacement NJ",
    category: "aging-system",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "Central AC Replacement NJ",
      "Up to $20K in Rebates",
      "Free Assessment No Obligation",
    ],
    descriptions: [
      "Replace your central AC and get up to $20K in combined NJ rebates. Free assessment and quote.",
      "Licensed NJ contractor. We handle all PSE&G paperwork. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC System Too Old NJ",
    category: "aging-system",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "When to Replace Your HVAC",
      "NJ Rebates Up to $20K",
      "Find Out in 20 Minutes Free",
    ],
    descriptions: [
      "Most HVAC systems over 10 years qualify for major NJ rebates. Free 20-min assessment tells you exactly.",
      "We handle all PSE&G rebate paperwork at no cost. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Oil to Heat Pump NJ",
    category: "aging-system",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "Replace Oil Heat with Heat Pump",
      "Get Up to $20K in Rebates",
      "Free NJ Assessment Today",
    ],
    descriptions: [
      "Switch from oil to a heat pump and get up to $20K in combined NJ rebates. Cut heating bills by 60%.",
      "Free assessment. We handle PSE&G paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },

  // ── Rebate / Incentive Campaigns ─────────────────────────────────────
  {
    name: "ME - PSE&G Rebate Contractor NJ",
    category: "rebate",
    finalUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj",
    headlines: [
      "PSE&G Certified Contractor NJ",
      "We File Your Rebate For You",
      "Up to $20K Combined Rebates",
    ],
    descriptions: [
      "We are a PSE&G certified NJ contractor. We handle your entire rebate application at no extra cost.",
      "Free assessment. Up to $20K in combined rebates. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - PSE&G Clean Heat NJ",
    category: "rebate",
    finalUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj",
    headlines: [
      "PSE&G Clean Heat Rebates NJ",
      "Up to $18K Back on Heat Pump",
      "We Handle All Paperwork Free",
    ],
    descriptions: [
      "PSE&G Clean Heat Program pays up to $18K for heat pump installation. We file everything for you.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - NJ Clean Energy Rebate HVAC",
    category: "rebate",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "NJ Clean Energy HVAC Rebates",
      "Up to $20K Combined Available",
      "Free Assessment Today NJ",
    ],
    descriptions: [
      "NJ Clean Energy Program offers major HVAC rebates. We identify every rebate you qualify for free.",
      "Free assessment. We handle all applications. WMBE certified NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - NJ Heat Pump Incentives",
    category: "rebate",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "NJ Heat Pump Incentives 2026",
      "PSE&G Plus Federal Tax Credit",
      "Up to $20K Total Available",
    ],
    descriptions: [
      "NJ homeowners get PSE&G rebates plus federal tax credits for heat pumps in 2026. Up to $20K total.",
      "Free assessment. We handle all paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Rebate Application NJ",
    category: "rebate",
    finalUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj",
    headlines: [
      "We File Your HVAC Rebate",
      "Up to $20K NJ Available",
      "Free Assessment No Forms",
    ],
    descriptions: [
      "We handle your entire NJ HVAC rebate application at no cost. You fill out zero forms. Free assessment.",
      "Licensed NJ contractor. WMBE certified. Up to $20K combined. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Tax Credit 2026 NJ",
    category: "rebate",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Tax Credit 2026 NJ",
      "Up to $2K Federal Tax Credit",
      "Plus PSE&G Rebates Up to $18K",
    ],
    descriptions: [
      "Combine federal 25C tax credit with PSE&G rebates for up to $20K total on HVAC replacement in NJ.",
      "Free assessment. We handle all paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },

  // ── County-Targeted Campaigns ────────────────────────────────────────
  {
    name: "ME - HVAC Replacement Essex County",
    category: "county",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Essex County",
      "Up to $20K in NJ Rebates",
      "Same-Day Assessment Available",
    ],
    descriptions: [
      "Essex County HVAC replacement with up to $20K in PSE&G rebates. Serving Newark Montclair West Orange.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Replacement Hudson County",
    category: "county",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Hudson County",
      "PSE&G Rebates Up to $20K",
      "Free Assessment Jersey City",
    ],
    descriptions: [
      "Hudson County HVAC replacement with up to $20K in rebates. Serving Jersey City Hoboken Bayonne.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Replacement Bergen County",
    category: "county",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Bergen County",
      "Up to $20K NJ Rebates",
      "Free Assessment Today",
    ],
    descriptions: [
      "Bergen County HVAC replacement with up to $20K in PSE&G rebates. Serving Hackensack Paramus Teaneck.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Replacement Passaic County",
    category: "county",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Passaic County",
      "PSE&G Rebates Up to $20K",
      "Free Assessment Paterson Area",
    ],
    descriptions: [
      "Passaic County HVAC replacement with up to $20K in rebates. Serving Paterson Clifton Wayne Passaic.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Replacement Union County",
    category: "county",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Union County",
      "Up to $20K in NJ Rebates",
      "Free Assessment Elizabeth Area",
    ],
    descriptions: [
      "Union County HVAC replacement with up to $20K in PSE&G rebates. Serving Elizabeth Union Linden.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - HVAC Replacement Middlesex County",
    category: "county",
    finalUrl: "https://mechanicalenterprise.com/rebate-calculator",
    headlines: [
      "HVAC Replacement Middlesex",
      "PSE&G Rebates Up to $20K",
      "Free Assessment Edison Area",
    ],
    descriptions: [
      "Middlesex County HVAC replacement with up to $20K in rebates. Serving New Brunswick Edison Woodbridge.",
      "Free assessment. Licensed NJ contractor. WMBE certified. Call (862) 423-9396.",
    ],
  },

  // ── Commercial Campaigns ─────────────────────────────────────────────
  {
    name: "ME - Commercial R22 Replacement NJ",
    category: "commercial",
    finalUrl: "https://mechanicalenterprise.com/commercial",
    headlines: [
      "Commercial R22 Replacement NJ",
      "80% Covered by PSE&G",
      "Free Commercial Assessment",
    ],
    descriptions: [
      "Commercial R22 systems must be replaced. PSE&G Direct Install covers up to 80% of replacement cost.",
      "Free commercial assessment. We handle all paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Commercial HVAC Rebate NJ",
    category: "commercial",
    finalUrl: "https://mechanicalenterprise.com/commercial",
    headlines: [
      "Commercial HVAC Rebate NJ",
      "Up to 80% PSE&G Coverage",
      "Free Commercial Assessment",
    ],
    descriptions: [
      "NJ commercial HVAC rebates cover up to 80% of replacement costs through PSE&G Direct Install Program.",
      "Free assessment. We handle all paperwork. WMBE certified NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Office Building HVAC NJ",
    category: "commercial",
    finalUrl: "https://mechanicalenterprise.com/commercial",
    headlines: [
      "Office HVAC Replacement NJ",
      "PSE&G Covers Up to 80%",
      "Free Building Assessment",
    ],
    descriptions: [
      "Office building HVAC replacement with up to 80% covered by PSE&G. Lighting 100% free included.",
      "Free assessment. We handle all paperwork. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Restaurant HVAC NJ",
    category: "commercial",
    finalUrl: "https://mechanicalenterprise.com/commercial",
    headlines: [
      "Restaurant HVAC Replacement NJ",
      "Up to 80% Covered by PSE&G",
      "Free Assessment for Restaurants",
    ],
    descriptions: [
      "Restaurant HVAC replacement with up to 80% covered by PSE&G Direct Install. Lighting 100% free.",
      "Free assessment. Fast installation. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Church Nonprofit HVAC NJ",
    category: "commercial",
    finalUrl: "https://mechanicalenterprise.com/commercial",
    headlines: [
      "Church HVAC Rebates NJ",
      "Up to 80% Covered Free",
      "Nonprofits Qualify Too",
    ],
    descriptions: [
      "Churches and nonprofits qualify for PSE&G HVAC rebates covering up to 80% of replacement costs.",
      "Free assessment. We handle all paperwork. WMBE certified NJ contractor. Call (862) 423-9396.",
    ],
  },
  {
    name: "ME - Warehouse HVAC NJ",
    category: "commercial",
    finalUrl: "https://mechanicalenterprise.com/commercial",
    headlines: [
      "Warehouse HVAC Replacement NJ",
      "PSE&G Covers Up to 80%",
      "Free Commercial Assessment",
    ],
    descriptions: [
      "Warehouse and industrial HVAC replacement with up to 80% covered by PSE&G Direct Install Program.",
      "Free assessment. We serve large commercial properties. Licensed NJ contractor. Call (862) 423-9396.",
    ],
  },
];

export const CATEGORY_LABELS: Record<AdCopyEntry["category"], string> = {
  "essex-campaign": "Essex County Campaigns",
  "r22": "R22 Refrigerant Campaigns",
  "aging-system": "Aging System Campaigns",
  "rebate": "Rebate & Incentive Campaigns",
  "county": "County-Targeted Campaigns",
  "commercial": "Commercial Campaigns",
};
