/**
 * SEO landing-page content (Phase 3 integration).
 *
 * 15 residential + commercial service/repair landing pages for
 * mechanicalenterprise.com, rendered by pages/SeoLandingPage.tsx and
 * registered as routes in App.tsx.
 *
 * Slugs use the site's `<topic>-nj` convention and are intentionally set at
 * REPAIR / SERVICE intent so they do NOT cannibalize the existing
 * INSTALLATION pages (/heat-pump-installation-nj, etc.).
 *
 * Geography: New Jersey only — matches the business's real service area and
 * schema (areaServed = "New Jersey"). No NYC claims.
 *
 * Documented placeholders (see seo-landing-pages/phase2/03-manifest.json):
 * these pages intentionally make NO review, rating, license-number, or street
 * -address claim because no verified value exists in the codebase. Supply real
 * values before adding any such claim.
 */

export interface LpFaq {
  q: string;
  a: string;
}
export interface LpCard {
  icon: string;
  title: string;
  desc: string;
}
export interface LpLink {
  href: string;
  label: string;
  sub: string;
}
export interface SeoLandingPageData {
  slug: string;
  category: "residential" | "commercial";
  service: string;
  serviceType: string;
  /** For future lead-form wiring to /api/trpc/leadCaptures.create (Stage 2). */
  formCaptureType: string;
  h1: string;
  heroSub: string;
  metaTitle: string;
  metaDescription: string;
  introHeading: string;
  intro: string;
  cards: LpCard[];
  faqs: LpFaq[];
  related: LpLink[];
  ctaHeading: string;
  ctaSub: string;
  /**
   * Service-led commercial pages: hides the financing/rebate block, the
   * incentive stat and the rebate CTA, and swaps in service-only "why us"
   * points (owner direction Oct 2026: these pages sell paid service work).
   */
  serviceOnly?: boolean;
  /** Page-specific long-form sections rendered after the service cards (unique copy for search). */
  deepDive?: LpSection[];
  /** "What to send us" checklist so a request can be scoped on the first call. */
  sendUs?: { heading: string; items: string[] };
}
export interface LpSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

const HUB_RES: LpLink = { href: "/residential", label: "All Residential HVAC", sub: "Browse home services" };
const HUB_COM: LpLink = { href: "/commercial", label: "All Commercial HVAC", sub: "Browse business services" };
const REBATE_LINK: LpLink = { href: "/rebate-calculator", label: "Rebate Calculator", sub: "See your NJ savings" };
const PM_HUB: LpLink = { href: "/commercial/for-property-management", label: "HVAC for Property Managers", sub: "Request a portfolio review" };

export const SEO_LANDING_PAGES: SeoLandingPageData[] = [
  // ─────────────────────────── RESIDENTIAL ───────────────────────────
  {
    slug: "ac-repair-nj",
    category: "residential",
    service: "AC Repair",
    serviceType: "Air Conditioning Repair",
    formCaptureType: "qualify_form",
    h1: "AC Not Cooling? We'll Have You Comfortable Today.",
    heroSub:
      "Same-day air conditioning repair across New Jersey for central AC, ductless, and heat-pump systems. Licensed techs, all makes and models, and an upfront price before we start.",
    metaTitle: "AC Repair NJ | Same-Day Air Conditioning Repair | Mechanical Enterprise",
    metaDescription:
      "Same-day AC repair across New Jersey. Licensed techs, all makes, upfront pricing, rebates on upgrades. Call (862) 423-9396.",
    introHeading: "Fast, Reliable Air Conditioning Repair in NJ",
    intro:
      "When your AC quits during a New Jersey heat wave, every hour matters. Our EPA-certified technicians find the real problem, quote a flat price before touching a tool, and carry common parts to finish most repairs in a single visit.",
    cards: [
      { icon: "❄️", title: "Not Cooling / Warm Air", desc: "Low refrigerant, failing compressor, or a dirty coil — we find the root cause, not just top off refrigerant." },
      { icon: "💧", title: "Leaks & Frozen Coils", desc: "Clogged condensate lines and frozen evaporator coils that cause water damage and shutdowns." },
      { icon: "🔌", title: "Won't Turn On", desc: "Bad capacitors, tripped breakers, thermostat faults, and control-board failures diagnosed fast." },
      { icon: "🔊", title: "Noises & Odors", desc: "Grinding, buzzing, or musty smells that signal motor, bearing, or electrical trouble." },
      { icon: "📈", title: "Rising Energy Bills", desc: "Efficiency tune-ups and airflow fixes that lower runtime and monthly cost." },
      { icon: "🌀", title: "Central, Ductless & Heat Pump", desc: "Full service for split systems, mini-splits, and heat pumps from every major brand." },
    ],
    faqs: [
      { q: "How much does AC repair cost in NJ?", a: "Most common repairs — capacitors, contactors, thermostats, and refrigerant service — fall between $150 and $650. We give you an exact flat-rate price before any work begins." },
      { q: "Can you come out the same day?", a: "Yes. We hold same-day slots and offer 24/7 emergency dispatch across New Jersey. Call (862) 423-9396 and we'll confirm a window quickly." },
      { q: "Should I repair or replace my air conditioner?", a: "As a rule of thumb, replace if the system is 12–15+ years old, uses discontinued R-22, or the repair exceeds about half of replacement cost. If replacement makes sense, we'll show you the NJ rebates and financing that make it affordable." },
      { q: "Do you repair ductless mini-splits and heat pumps?", a: "Yes — we're factory-trained on Mitsubishi, Daikin, Fujitsu, and all major ductless and heat-pump brands, plus conventional central air." },
      { q: "Are your technicians licensed and insured?", a: "Every technician is EPA-certified, fully licensed, and insured. Mechanical Enterprise is a WMBE/SBE-certified NJ contractor and all repairs are warrantied." },
      { q: "Do you serve my town?", a: "We serve all of New Jersey from our Newark base — Essex, Hudson, Bergen, Union, Passaic, Morris and surrounding counties." },
    ],
    related: [
      { href: "/central-ac-installation-nj", label: "Central AC Installation", sub: "Time for a new system?" },
      { href: "/heat-pump-repair-nj", label: "Heat Pump Repair", sub: "Ducted & ductless" },
      { href: "/emergency-hvac-repair-nj", label: "Emergency HVAC", sub: "24/7 response" },
      REBATE_LINK,
    ],
    ctaHeading: "Stop Sweating — Get Your AC Fixed Today",
    ctaSub: "Same-day appointments across New Jersey. Upfront pricing and every rebate you qualify for on upgrades.",
  },
  {
    slug: "heating-repair-nj",
    category: "residential",
    service: "Heating Repair",
    serviceType: "Heating System Repair",
    formCaptureType: "qualify_form",
    h1: "No Heat? We'll Get Your Home Warm Again — Fast.",
    heroSub:
      "Same-day and 24/7 heating repair across New Jersey for furnaces, boilers, and heat pumps. Honest diagnosis, upfront pricing, and warm air before nightfall.",
    metaTitle: "Heating Repair NJ | Same-Day No-Heat Service | Mechanical Enterprise",
    metaDescription:
      "Fast heating repair across NJ — furnaces, boilers & heat pumps. Same-day & 24/7 no-heat service, upfront pricing. Call (862) 423-9396.",
    introHeading: "Expert Heating Repair for New Jersey Winters",
    intro:
      "A cold NJ night is no time to wait. We service every type of heating system, diagnose the true cause instead of guessing, and quote a flat price before we start — so you're never surprised.",
    cards: [
      { icon: "🔥", title: "No Heat At All", desc: "Ignition, thermostat, control-board, and fuel-supply faults diagnosed and repaired fast." },
      { icon: "🌡️", title: "Uneven / Not Enough Heat", desc: "Airflow, zoning, and distribution problems that leave rooms cold." },
      { icon: "🔁", title: "Short Cycling", desc: "Systems that turn on and off constantly — overheating, sensor, or sizing issues." },
      { icon: "🔊", title: "Strange Noises", desc: "Banging, rattling, or whistling that points to motors, bearings, or ductwork." },
      { icon: "🧯", title: "Safety Concerns", desc: "Carbon-monoxide risks, cracked heat exchangers, and gas issues checked and made safe." },
      { icon: "♨️", title: "Furnaces, Boilers & Heat Pumps", desc: "One team for every heating system in your home, from every major brand." },
    ],
    faqs: [
      { q: "How fast can you fix my heat in NJ?", a: "We keep same-day slots and run 24/7 emergency dispatch. For no-heat calls in winter, call (862) 423-9396 and we'll prioritize you." },
      { q: "How much does heating repair cost?", a: "Typical repairs run $150–$700 depending on the part and system. You approve an exact flat-rate price before we begin." },
      { q: "My heat works but some rooms are cold — can you help?", a: "Yes. Uneven heating is usually airflow, zoning, or distribution. We diagnose the cause and fix it rather than just band-aiding symptoms." },
      { q: "Do you handle both gas and electric heating?", a: "We service gas and electric furnaces, gas and oil boilers, and electric/gas heat pumps." },
      { q: "When should I replace instead of repair?", a: "If the system is old, unsafe, or facing a major repair, replacement may be smarter — and NJ rebates up to $16,000 can offset the cost. We'll give you an honest recommendation." },
      { q: "Are you licensed and insured?", a: "Yes — fully licensed, insured, WMBE/SBE-certified NJ contractor with warrantied workmanship." },
    ],
    related: [
      { href: "/furnace-repair-nj", label: "Furnace Repair", sub: "Gas & electric" },
      { href: "/boiler-repair-nj", label: "Boiler Repair", sub: "Steam & hot-water" },
      { href: "/heat-pump-repair-nj", label: "Heat Pump Repair", sub: "Year-round comfort" },
      { href: "/emergency-hvac-repair-nj", label: "Emergency HVAC", sub: "24/7 no-heat" },
    ],
    ctaHeading: "Get Your Heat Back On Today",
    ctaSub: "Same-day and 24/7 heating repair across New Jersey. Upfront pricing, no surprises.",
  },
  {
    slug: "furnace-repair-nj",
    category: "residential",
    service: "Furnace Repair",
    serviceType: "Furnace Repair",
    formCaptureType: "qualify_form",
    h1: "No Heat? We'll Get Your Furnace Running Tonight.",
    heroSub:
      "Gas and electric furnace repair across New Jersey. Same-day and 24/7 no-heat service, thorough safety checks, and an upfront flat price.",
    metaTitle: "Furnace Repair NJ | 24/7 No-Heat Service | Mechanical Enterprise",
    metaDescription:
      "Gas & electric furnace repair across NJ. Same-day & 24/7 no-heat service, safety checks, upfront pricing. Call (862) 423-9396.",
    introHeading: "Trusted Furnace Repair Across New Jersey",
    intro:
      "From a furnace that won't ignite to one blowing cold air, we diagnose the real cause and repair it safely. Every visit includes a combustion and carbon-monoxide safety check at no extra charge.",
    cards: [
      { icon: "🔥", title: "Won't Ignite / No Heat", desc: "Igniters, flame sensors, gas valves, and control boards repaired the same day." },
      { icon: "🌬️", title: "Blowing Cold Air", desc: "Blower, limit-switch, and thermostat faults that leave you shivering." },
      { icon: "🔁", title: "Short Cycling", desc: "Overheating, dirty filters, and airflow problems that shorten furnace life." },
      { icon: "🧯", title: "Cracked Heat Exchanger & CO", desc: "Safety-critical inspections to protect your family from carbon monoxide." },
      { icon: "🔊", title: "Banging & Rattling", desc: "Ignition delays and loose components that signal trouble ahead." },
      { icon: "🧰", title: "All Brands", desc: "Carrier, Trane, Lennox, Goodman, Rheem, and every major furnace brand." },
    ],
    faqs: [
      { q: "How much does furnace repair cost in NJ?", a: "Most furnace repairs run $150–$700. Igniters and flame sensors are on the lower end; blower motors and control boards are higher. You get an exact price upfront." },
      { q: "Is a cracked heat exchanger dangerous?", a: "Yes — it can leak carbon monoxide. If we find one we'll show you the evidence and your safe options. We never scare you into a sale." },
      { q: "Can you repair my furnace the same day?", a: "Usually yes. We stock common parts on the truck and offer 24/7 emergency service. Call (862) 423-9396." },
      { q: "Why does my furnace keep shutting off?", a: "Short cycling is often a dirty filter, a failing limit switch, or an oversized system. We pinpoint the exact cause." },
      { q: "Should I repair or replace my furnace?", a: "If it's 15+ years old or facing a major repair, replacement may pay off — and NJ rebates up to $16,000 can offset a new high-efficiency system. We'll advise honestly." },
      { q: "Do you offer maintenance to prevent breakdowns?", a: "Yes — a seasonal tune-up prevents most no-heat emergencies and keeps your warranty valid." },
    ],
    related: [
      { href: "/heating-repair-nj", label: "Heating Repair", sub: "All heating systems" },
      { href: "/boiler-repair-nj", label: "Boiler Repair", sub: "Steam & hot-water" },
      { href: "/hvac-system-replacement-nj", label: "System Replacement", sub: "Time for an upgrade?" },
      { href: "/emergency-hvac-repair-nj", label: "Emergency HVAC", sub: "24/7 response" },
    ],
    ctaHeading: "Warm Up Your Home Tonight",
    ctaSub: "Same-day and 24/7 furnace repair across New Jersey, with a free safety check on every visit.",
  },
  {
    slug: "boiler-repair-nj",
    category: "residential",
    service: "Boiler Repair",
    serviceType: "Boiler Repair",
    formCaptureType: "qualify_form",
    h1: "No Heat or Hot Water? We'll Get Your Boiler Running Again.",
    heroSub:
      "Steam and hot-water boiler repair across New Jersey — common in older homes and brownstones. Same-day and 24/7 service with upfront pricing.",
    metaTitle: "Boiler Repair NJ | Steam & Hot-Water Boilers | Mechanical Enterprise",
    metaDescription:
      "Boiler repair across NJ — steam & hot-water systems, no heat, leaks, low pressure. Same-day & 24/7 service. Call (862) 423-9396.",
    introHeading: "Boiler Repair Specialists for New Jersey Homes",
    intro:
      "Boilers run many of New Jersey's older homes and multi-families, and they need a technician who truly knows hydronic and steam systems. We diagnose leaks, pressure problems, and no-heat faults and fix them right.",
    cards: [
      { icon: "🔥", title: "No Heat / No Hot Water", desc: "Ignition, aquastat, circulator, and control failures diagnosed fast." },
      { icon: "💧", title: "Leaks & Low Pressure", desc: "Leaking valves, expansion tanks, and pressure issues that shut a boiler down." },
      { icon: "🌡️", title: "Cold Radiators & Baseboards", desc: "Air-bound zones, bad circulators, and balancing problems resolved." },
      { icon: "🔊", title: "Banging & Knocking Pipes", desc: "Water hammer and steam-system issues traced and corrected." },
      { icon: "⚙️", title: "Gas & Oil Boilers", desc: "Full service for both fuel types and for steam and hot-water systems." },
      { icon: "🧯", title: "Safety & Efficiency", desc: "Combustion and safety checks plus tune-ups that cut fuel use." },
    ],
    faqs: [
      { q: "How much does boiler repair cost in NJ?", a: "Common repairs run $200–$900 depending on the component. Circulators, valves, and controls vary in price — you approve an exact figure before we start." },
      { q: "Do you work on both steam and hot-water boilers?", a: "Yes. We service steam and hot-water (hydronic) boilers, gas and oil, including the older systems common in NJ." },
      { q: "Why are some of my radiators cold?", a: "Usually trapped air, a failing circulator, or a balancing issue. We diagnose the exact cause instead of guessing." },
      { q: "Can you come out the same day?", a: "Yes — same-day and 24/7 emergency service. No heat or no hot water in winter is a priority call. Ring (862) 423-9396." },
      { q: "Is it worth repairing an old boiler?", a: "Often yes, but if it's inefficient or failing we'll show you replacement options — high-efficiency systems may qualify for NJ rebates up to $16,000." },
      { q: "Are you licensed and insured?", a: "Fully licensed, insured, WMBE/SBE-certified NJ contractor with warrantied repairs." },
    ],
    related: [
      { href: "/heating-repair-nj", label: "Heating Repair", sub: "All heating systems" },
      { href: "/furnace-repair-nj", label: "Furnace Repair", sub: "Gas & electric" },
      { href: "/emergency-hvac-repair-nj", label: "Emergency HVAC", sub: "24/7 no-heat" },
      HUB_RES,
    ],
    ctaHeading: "Get Your Boiler Fixed Today",
    ctaSub: "Same-day and 24/7 boiler repair across New Jersey from true hydronic and steam specialists.",
  },
  {
    slug: "indoor-air-quality-nj",
    category: "residential",
    service: "Indoor Air Quality",
    serviceType: "Indoor Air Quality Services",
    formCaptureType: "qualify_form",
    h1: "Breathe Cleaner, Healthier Air in Every Room.",
    heroSub:
      "Whole-home indoor air quality solutions across New Jersey — purifiers, advanced filtration, UV lights, humidity control, and duct sealing.",
    metaTitle: "Indoor Air Quality NJ | Air Purifiers & Filtration | Mechanical Enterprise",
    metaDescription:
      "Improve your NJ home's air — purifiers, filtration, UV lights, humidity control & duct sealing. Free assessment. Call (862) 423-9396.",
    introHeading: "Healthier Air for Your New Jersey Home",
    intro:
      "Dust, pollen, humidity, and pollutants build up in NJ homes year-round. We assess your air and recommend the right mix of filtration, purification, and humidity control — integrated with your existing HVAC system.",
    cards: [
      { icon: "🍃", title: "Whole-Home Air Purifiers", desc: "Capture and neutralize allergens, bacteria, viruses, and odors at the source." },
      { icon: "🧫", title: "Advanced Filtration", desc: "HEPA and high-MERV media filters that far outperform basic 1-inch filters." },
      { icon: "☀️", title: "UV Germicidal Lights", desc: "Stop mold and microbial growth on coils and in your ductwork." },
      { icon: "💦", title: "Humidity Control", desc: "Whole-home humidifiers and dehumidifiers for comfort and mold prevention." },
      { icon: "🌀", title: "Duct Cleaning & Sealing", desc: "Remove built-up debris and seal leaks that spread dust and waste energy." },
      { icon: "🏠", title: "Ventilation / Fresh Air", desc: "Balanced ventilation and ERVs that bring in fresh air without wasting energy." },
    ],
    faqs: [
      { q: "How do I know if I have an air-quality problem?", a: "Persistent dust, allergy or asthma flare-ups, stuffy or musty odors, uneven humidity, and frequent illness are common signs. A free assessment pinpoints the cause." },
      { q: "What's the best air-quality upgrade for the money?", a: "It depends on your home and health goals. For many NJ households a high-MERV media filter plus humidity control delivers the biggest improvement per dollar." },
      { q: "Can you help with mold and humidity in my basement?", a: "Yes — humidity control, ventilation, and UV treatment address the damp conditions common in NJ basements." },
      { q: "Do these systems work with my current HVAC?", a: "In most cases, yes. We integrate purifiers, filters, UV, and humidity control with your existing furnace, heat pump, or air handler." },
      { q: "Do air-quality upgrades qualify for rebates?", a: "Some efficiency-related upgrades may qualify; many IAQ add-ons don't. We confirm exactly what's eligible during your assessment rather than overpromising." },
      { q: "Is the assessment really free?", a: "Yes — we assess your home's air quality and options at no cost or obligation." },
    ],
    related: [
      { href: "/ac-repair-nj", label: "AC Repair", sub: "Cooling service" },
      { href: "/heating-repair-nj", label: "Heating Repair", sub: "Warm & healthy" },
      { href: "/ductless-mini-split-repair-nj", label: "Mini-Split Repair", sub: "Ductless comfort" },
      HUB_RES,
    ],
    ctaHeading: "Start Breathing Easier",
    ctaSub: "Book a free indoor-air-quality assessment for your New Jersey home today.",
  },
  {
    slug: "heat-pump-repair-nj",
    category: "residential",
    service: "Heat Pump Repair",
    serviceType: "Heat Pump Repair",
    formCaptureType: "lp_heat_pump",
    h1: "Heat Pump Trouble? We Repair Every Make and Model.",
    heroSub:
      "Expert heat-pump repair across New Jersey for ducted and ductless systems — no heat, no cooling, defrost problems, and refrigerant faults. All brands.",
    metaTitle: "Heat Pump Repair NJ | Ducted & Ductless | Mechanical Enterprise",
    metaDescription:
      "Expert heat pump repair across NJ — no heat/cooling, defrost & refrigerant faults, all brands. Upgrade rebates. Call (862) 423-9396.",
    introHeading: "Heat Pump Repair Done Right in New Jersey",
    intro:
      "Heat pumps heat and cool in one system, so a fault affects your comfort year-round. Our technicians know cold-climate heat pumps inside and out — from reversing valves to defrost boards — and fix the true cause fast.",
    cards: [
      { icon: "🔥", title: "No Heat in Winter", desc: "Reversing-valve, defrost-board, and auxiliary-heat faults diagnosed and repaired." },
      { icon: "❄️", title: "Not Cooling in Summer", desc: "Refrigerant, compressor, and capacitor issues that kill your cooling." },
      { icon: "🧊", title: "Frozen or Iced Outdoor Unit", desc: "Defrost-cycle failures that leave the outdoor unit encased in ice." },
      { icon: "🔁", title: "Constant Cycling", desc: "Short cycling and mode-switching problems that waste energy and wear parts." },
      { icon: "🔊", title: "Noises & Error Codes", desc: "Communication faults and error codes on modern inverter systems, decoded." },
      { icon: "🧰", title: "Ducted & Ductless, All Brands", desc: "Mitsubishi, Daikin, Fujitsu, Bosch, Carrier, and more." },
    ],
    faqs: [
      { q: "Why is my heat pump not heating in cold weather?", a: "Common causes are a stuck reversing valve, a failed defrost board, low refrigerant, or a fault in the backup heat. We diagnose the exact issue rather than guessing." },
      { q: "Why is my outdoor unit covered in ice?", a: "A little frost is normal; a solid block of ice usually means the defrost cycle has failed. We repair the defrost control and sensors." },
      { q: "How much does heat pump repair cost in NJ?", a: "Most repairs run $200–$900 depending on the part. Inverter boards and compressors are higher. You get an exact price upfront." },
      { q: "Should I repair or replace my heat pump?", a: "If it's newer, repair is usually best. If it's aging or facing a major repair, a new cold-climate heat pump may qualify for NJ rebates up to $16,000 — we'll show you the numbers." },
      { q: "Do you service ductless mini-split heat pumps?", a: "Yes — see our dedicated mini-split repair service, and we handle multi-zone systems from every major brand." },
      { q: "Are you licensed and insured?", a: "Fully licensed, insured, WMBE/SBE-certified NJ contractor with warrantied repairs." },
    ],
    related: [
      { href: "/heat-pump-installation-nj", label: "Heat Pump Installation", sub: "New system & rebates" },
      { href: "/ductless-mini-split-repair-nj", label: "Mini-Split Repair", sub: "Ductless systems" },
      { href: "/heat-pump-rebates-nj", label: "Heat Pump Rebates", sub: "Up to $16K in NJ" },
      { href: "/emergency-hvac-repair-nj", label: "Emergency HVAC", sub: "24/7 response" },
    ],
    ctaHeading: "Get Your Heat Pump Back in Action",
    ctaSub: "Same-day heat-pump repair across New Jersey for ducted and ductless systems, all brands.",
  },
  {
    slug: "ductless-mini-split-repair-nj",
    category: "residential",
    service: "Ductless Mini-Split Repair",
    serviceType: "Ductless Mini-Split Repair",
    formCaptureType: "qualify_form",
    h1: "Mini-Split Not Working? We Fix Every Zone.",
    heroSub:
      "Ductless mini-split repair across New Jersey — not cooling or heating, water leaks, error codes, and communication faults. Single- and multi-zone, all brands.",
    metaTitle: "Ductless Mini-Split Repair NJ | All Brands | Mechanical Enterprise",
    metaDescription:
      "Mini-split repair across NJ — not cooling, leaks, error codes, comm faults. Mitsubishi, Daikin, Fujitsu & more. Call (862) 423-9396.",
    introHeading: "Ductless Mini-Split Repair Across New Jersey",
    intro:
      "Mini-splits deliver quiet, zoned comfort — but inverter systems need a technician who understands them. We repair indoor and outdoor units, decode error codes, and get every zone working again.",
    cards: [
      { icon: "❄️", title: "Not Cooling or Heating", desc: "Refrigerant, compressor, and inverter-board faults across one or many zones." },
      { icon: "💧", title: "Water Leaking Indoors", desc: "Clogged condensate drains and lines that drip from the indoor head." },
      { icon: "⚠️", title: "Blinking Lights / Error Codes", desc: "We decode manufacturer fault codes and fix the underlying issue." },
      { icon: "🔌", title: "Communication Faults", desc: "Indoor-to-outdoor communication and wiring problems on multi-zone systems." },
      { icon: "🔊", title: "Noises & Odors", desc: "Fan, bearing, and mold issues that affect comfort and air quality." },
      { icon: "🧰", title: "All Major Brands", desc: "Mitsubishi, Daikin, Fujitsu, LG, Gree, and more — single and multi-zone." },
    ],
    faqs: [
      { q: "Why is my mini-split leaking water inside?", a: "Almost always a clogged condensate drain or line. We clear it and check the slope and pump so it doesn't recur." },
      { q: "What do the blinking lights on my mini-split mean?", a: "They're a fault code specific to your brand. We read the code, confirm the cause, and repair it — no guesswork." },
      { q: "One zone works but another doesn't — can you fix that?", a: "Yes. Multi-zone issues are often a communication fault, a failed indoor board, or a refrigerant problem to that head. We isolate and repair the affected zone." },
      { q: "How much does mini-split repair cost in NJ?", a: "Most repairs run $150–$800 depending on the fault. Drain clearing is on the low end; inverter boards are higher. You get an exact price upfront." },
      { q: "Do you install new mini-splits too?", a: "We do — and new ductless heat-pump systems may qualify for NJ rebates up to $16,000. Ask us during your visit." },
      { q: "Are you factory-trained on my brand?", a: "We're trained across Mitsubishi, Daikin, Fujitsu, and all major ductless brands." },
    ],
    related: [
      { href: "/ductless-mini-split-installation-nj", label: "Mini-Split Installation", sub: "New ductless system" },
      { href: "/heat-pump-repair-nj", label: "Heat Pump Repair", sub: "Ducted & ductless" },
      { href: "/ac-repair-nj", label: "AC Repair", sub: "Cooling service" },
      { href: "/indoor-air-quality-nj", label: "Indoor Air Quality", sub: "Cleaner air" },
    ],
    ctaHeading: "Restore Comfort to Every Room",
    ctaSub: "Same-day ductless mini-split repair across New Jersey for single- and multi-zone systems.",
  },
  {
    slug: "emergency-hvac-repair-nj",
    category: "commercial",
    service: "Emergency HVAC Repair",
    serviceType: "Emergency HVAC Repair",
    formCaptureType: "lp_emergency",
    serviceOnly: true,
    h1: "Emergency HVAC Repair for Occupied NJ Buildings",
    heroSub:
      "No heat in an apartment building, cooling down in an office or store, a rooftop unit that won't restart — call (862) 423-9396 and tell us what failed. We'll triage the problem, tell you when a technician can be on site, and work the repair around the people inside.",
    metaTitle: "Emergency HVAC Repair NJ | Buildings & Multifamily",
    metaDescription:
      "Emergency HVAC repair for NJ apartment, office and retail buildings: no heat, no cooling, failed RTUs and boilers. Call (862) 423-9396 to report a failure.",
    introHeading: "When Heat or Cooling Fails in a Building People Depend On",
    intro:
      "A failure in an occupied building is different from a failure in a single home. Residents call the management office, commercial occupants lose a workday, and every hour adds pressure on the person responsible for the property. Mechanical Enterprise works with property managers, superintendents and building owners across northern and central New Jersey to get failed heating and cooling equipment diagnosed and repaired, and to keep the people in the building informed while it happens.",
    cards: [
      { icon: "🔥", title: "No Heat in a Multifamily Building", desc: "Boiler lockouts, failed circulator pumps, ignition and flame-safeguard faults, and zone valves that leave whole lines of apartments cold." },
      { icon: "❄️", title: "Cooling Down in Offices and Stores", desc: "Rooftop units, split systems and VRF equipment that stop cooling occupied commercial space." },
      { icon: "🏢", title: "Rooftop Unit Won't Restart", desc: "Tripped safeties, failed compressors, burnt contactors, economizer faults and control failures on packaged equipment." },
      { icon: "🌀", title: "PTACs and Ductless Systems", desc: "Individual unit failures in apartments, hotels and condo buildings, including units that keep tripping breakers." },
      { icon: "💧", title: "Leaks and Frozen Equipment", desc: "Condensate overflows, frozen coils and refrigerant leaks that threaten ceilings, finishes and equipment." },
      { icon: "🎛️", title: "Controls and Thermostat Failures", desc: "Building controls, timeclocks and thermostats that lock out equipment even though the hardware still works." },
    ],
    deepDive: [
      {
        heading: "How an Emergency Call Works",
        paragraphs: [
          "Call (862) 423-9396 and describe what stopped working, which part of the building is affected and who is on site. We ask a few triage questions up front — is the whole building affected or one zone, are any breakers or safeties tripped, is water leaking — because the answers decide which technician and which parts should be sent.",
          "Before anyone is dispatched we tell you when a technician can realistically be there. When the technician arrives, they confirm the cause, explain the options and get approval before repair work starts. If a part has to be ordered, you get a plan for temporary heat or cooling where it is practical, and a clear next step rather than an open-ended wait.",
        ],
      },
      {
        heading: "Keeping Residents and Tenants Informed",
        paragraphs: [
          "Most of the stress in a building outage comes from silence. We give the property manager or superintendent a plain-language status after diagnosis and again after the repair, written so it can be forwarded to residents or commercial occupants without editing.",
          "For multifamily buildings we ask which lines or floors are affected so updates match what residents are actually experiencing. For offices, retail and medical space we ask about business hours, alarm codes and who can approve work, so a repair doesn't stall waiting for a decision.",
        ],
      },
      {
        heading: "After the Repair: Preventing the Next Emergency",
        paragraphs: [
          "Every emergency call ends with a short written record: what failed, what was replaced, and what else the technician saw that is likely to cause the next call. That record is what lets you separate a one-off failure from equipment that is wearing out.",
          "If the same building keeps generating emergency calls, a preventive maintenance agreement is usually the cheaper path. Agreements are priced per unit per year and quoted for your portfolio, with quarterly reporting so you can see equipment condition before it fails.",
        ],
        bullets: [
          "Written summary of the failure and the repair",
          "Notes on related equipment that needs attention",
          "Recommendation: repair, monitor, or plan a replacement",
        ],
      },
    ],
    sendUs: {
      heading: "What to Have Ready When You Call",
      items: [
        "Building address and the affected units, floors or zones",
        "Type of equipment if known (boiler, rooftop unit, split system, PTAC, VRF)",
        "What the occupants are reporting and when it started",
        "Any error codes, tripped breakers or alarms on the equipment",
        "Roof, mechanical room and after-hours access contacts",
        "Who can approve repair work on site",
      ],
    },
    faqs: [
      { q: "What kinds of buildings do you handle emergency HVAC repairs for?", a: "Multifamily and condo buildings, offices, retail, restaurants, medical space, warehouses and mixed-use properties in northern and central New Jersey." },
      { q: "How do I report a heating or cooling failure?", a: "Call (862) 423-9396. Tell us the address, what failed, which areas are affected and who is on site. We triage on the phone and tell you when a technician can be there." },
      { q: "Will you tell me the repair cost before you start?", a: "Yes. The technician diagnoses the problem first, explains the options and gets approval from the person you designate before repair work begins." },
      { q: "What if a part has to be ordered?", a: "We tell you what part is needed and the next step, and where practical we help plan temporary heat or cooling for the affected area while it is on order." },
      { q: "Can you help us avoid repeat emergency calls?", a: "Yes. Every call ends with notes on related equipment, and a preventive maintenance agreement, priced per unit per year with quarterly reporting, can catch failures before they happen." },
      { q: "Do you write updates we can send to residents?", a: "Yes. We give the manager a plain-language status after diagnosis and after the repair that can be forwarded to residents or occupants." },
    ],
    related: [
      PM_HUB,
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC Service", sub: "Repairs & service calls" },
      { href: "/blog/nj-multifamily-no-heat-hvac-service-checklist", label: "No-Heat Checklist", sub: "Guide for multifamily managers" },
      { href: "/blog/commercial-hvac-response-sla-checklist", label: "Response Agreements", sub: "What an SLA should include" },
    ],
    ctaHeading: "Report a Heating or Cooling Failure",
    ctaSub: "Call (862) 423-9396 with the address and what failed, and we'll tell you when a technician can be on site.",
  },
  {
    slug: "commercial-hvac-service-nj",
    category: "commercial",
    service: "Commercial HVAC Service",
    serviceType: "Commercial HVAC Service and Repair",
    formCaptureType: "lp_commercial_vrv",
    serviceOnly: true,
    h1: "Commercial HVAC Service and Repair for NJ Buildings",
    heroSub:
      "Service calls, diagnostics and repairs for rooftop units, split systems, VRF, PTACs and building controls in offices, retail, multifamily and mixed-use properties across northern and central New Jersey.",
    metaTitle: "Commercial HVAC Service & Repair NJ | RTU, VRF, PTAC",
    metaDescription:
      "Commercial HVAC repair and service calls for NJ offices, retail and multifamily buildings: RTUs, splits, VRF, PTACs and controls. Call (862) 423-9396.",
    introHeading: "One Service Contractor for the Whole Building",
    intro:
      "Property managers rarely deal with one type of equipment. A single mixed-use building can have packaged rooftop units over the retail floor, split systems in offices, PTACs or ductless units in apartments, and a set of controls nobody has documented. Mechanical Enterprise services all of it, so you have one number to call, one service history and one contractor accountable for finding the real cause of a problem instead of resetting it until the next failure.",
    cards: [
      { icon: "🏢", title: "Rooftop Units", desc: "Diagnostics and repair of packaged RTUs: compressors, fan motors, belts, economizers, gas heat sections and safeties." },
      { icon: "🌀", title: "VRF / VRV Systems", desc: "Troubleshooting variable-refrigerant systems serving multi-zone offices and mixed-use floors." },
      { icon: "🧊", title: "Split and Ductless Systems", desc: "Condensers, air handlers, mini-splits and heat pumps in tenant spaces, lobbies and common areas." },
      { icon: "🛏️", title: "PTACs", desc: "Repair and replacement of packaged terminal units in apartments, condos and hotel-style buildings." },
      { icon: "🎛️", title: "Controls and Thermostats", desc: "Schedules, zoning, timeclocks and thermostats that waste energy or lock equipment out." },
      { icon: "📋", title: "Service Records", desc: "Written findings after every visit so you can track equipment condition across buildings." },
    ],
    deepDive: [
      {
        heading: "What a Commercial Service Call Includes",
        paragraphs: [
          "A service call starts with the symptom you or your occupants reported, but the technician's job is to find the cause. That means checking electrical components, refrigerant circuits, airflow, controls and the conditions around the equipment — a clogged condensate line or a failing contactor is a quick fix, while a compressor drawing high amps is a planning conversation.",
          "Before repair work starts you get the diagnosis, the recommended fix and any alternatives, and the person you designate approves the work. After the visit you receive a written summary you can file against the unit, share with ownership or forward to an occupant.",
        ],
      },
      {
        heading: "Repair or Replace? Getting a Straight Answer",
        paragraphs: [
          "Older rooftop units and split systems reach a point where each repair buys less time. When a technician sees that pattern — repeated compressor or motor failures, corroded coils, refrigerant that is expensive or hard to source — we say so, and we separate what has to be fixed today from what belongs in next year's capital plan.",
          "If replacement makes sense, we can scope it with you: equipment sizing, curb and access requirements, electrical needs and the schedule that least disrupts the building. Optional 10-year parts and labor coverage is available as a separately purchased add-on for new installations.",
        ],
      },
      {
        heading: "Mixed-Use and Older Buildings",
        paragraphs: [
          "Many New Jersey properties have equipment that was added one tenant or one renovation at a time. A building might have a newer rooftop unit next to one that is decades old, split systems installed by different contractors, and thermostats wired in ways nobody remembers. Part of a first service call in a building like that is simply documenting what is there: where each unit is, what it serves and what condition it is in.",
          "That inventory makes every later call faster and cheaper, and it gives ownership an honest picture of which equipment is reliable and which is living on borrowed time.",
        ],
      },
      {
        heading: "Built for Property Managers and Building Owners",
        paragraphs: [
          "Managing several buildings means juggling access, approvals and occupants. We work with superintendents, on-site staff and ownership so the right person is reached at the right time, and we schedule disruptive work around business hours or resident needs whenever the repair allows.",
          "For portfolios, a single service relationship across buildings gives you consistent records and one point of contact. Maintenance agreements are priced per unit per year and quoted for your portfolio, with quarterly reporting on the equipment we look after.",
        ],
        bullets: [
          "Offices and professional buildings",
          "Retail, restaurants and mixed-use properties",
          "Multifamily, condo and co-op buildings",
          "Warehouses and light industrial space",
        ],
      },
    ],
    sendUs: {
      heading: "What to Send Us With a Service Request",
      items: [
        "Property address and the unit, suite or zone affected",
        "Equipment type, plus make, model and serial if available",
        "What occupants are reporting and when it started",
        "Recent service history or previous repairs on the unit",
        "Roof and mechanical room access details and contacts",
        "Who approves repairs and any purchase-order requirements",
      ],
    },
    faqs: [
      { q: "What commercial HVAC equipment do you service?", a: "Packaged rooftop units, split and ductless systems, heat pumps, VRF/VRV systems, PTACs and the controls and thermostats that run them." },
      { q: "Which areas of New Jersey do you cover?", a: "Buildings in Essex, Hudson, Bergen, Passaic, Union, Middlesex, Morris, Sussex and Somerset counties." },
      { q: "Do I approve the repair before work starts?", a: "Yes. The technician diagnoses the problem, explains the recommended fix and alternatives, and the person you designate approves the work before it begins." },
      { q: "Can you schedule work around our business hours or residents?", a: "Yes. Tell us the building's hours and constraints when you call, and we plan access and any shutdowns around them whenever the repair allows." },
      { q: "Will I get a written record of the visit?", a: "Yes. Every service call ends with a written summary of what was found, what was done and any equipment that needs attention." },
      { q: "Do you offer service agreements for multiple buildings?", a: "Yes. Maintenance agreements are priced per unit per year, quoted by portfolio, with quarterly reporting. See our commercial maintenance page for details." },
    ],
    related: [
      PM_HUB,
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Agreements", sub: "Planned service" },
      { href: "/blog/commercial-rooftop-hvac-repair-request-nj", label: "RTU Repair Requests", sub: "What to include" },
      { href: "/blog/commercial-hvac-response-sla-checklist", label: "Response Agreements", sub: "What an SLA should include" },
    ],
    ctaHeading: "Request Commercial HVAC Service",
    ctaSub: "Call (862) 423-9396 or send a request with the address and equipment, and we'll schedule a technician.",
  },
  {
    slug: "commercial-rtu-service-nj",
    category: "commercial",
    service: "Commercial RTU Service",
    serviceType: "Rooftop Unit (RTU) Service and Repair",
    formCaptureType: "lp_commercial_vrv",
    serviceOnly: true,
    h1: "Rooftop Unit (RTU) Service and Repair in New Jersey",
    heroSub:
      "Diagnostics, repair and planned service for packaged rooftop units on NJ retail, office, restaurant and multifamily buildings — cooling, gas heat, economizers, fans and controls.",
    metaTitle: "Rooftop Unit (RTU) Repair & Service NJ | Commercial",
    metaDescription:
      "Commercial rooftop unit repair and service in NJ: compressors, gas heat, economizers, belts and controls on packaged RTUs. Call (862) 423-9396.",
    introHeading: "Packaged Rooftop Units, Serviced by People Who Go on the Roof",
    intro:
      "Rooftop units are out of sight until they fail, and then they affect everyone below them. A single packaged unit can carry the heating, cooling and ventilation for a store, a restaurant dining room or an office floor. Mechanical Enterprise diagnoses and repairs RTUs across northern and central New Jersey and keeps records by unit, so you can see which equipment is healthy, which needs work, and which is heading toward replacement.",
    cards: [
      { icon: "❄️", title: "Cooling Failures", desc: "Compressors, condenser fans, contactors, capacitors, refrigerant leaks and dirty or damaged coils." },
      { icon: "🔥", title: "Gas Heat Sections", desc: "Ignition, inducer motors, flame sensing, limit switches and heat exchanger inspection." },
      { icon: "🌬️", title: "Economizers and Ventilation", desc: "Dampers, actuators and sensors that bring in outside air — a common source of comfort complaints and wasted energy." },
      { icon: "⚙️", title: "Fans, Belts and Motors", desc: "Blower motors, belts, pulleys and bearings that wear out on high-run-time equipment." },
      { icon: "🎛️", title: "Controls and Thermostats", desc: "Unit controllers, thermostats, schedules and safeties that shut units down or keep them from staging." },
      { icon: "🧾", title: "Unit-by-Unit Records", desc: "Findings recorded against each RTU's make, model and serial so condition is easy to track." },
    ],
    deepDive: [
      {
        heading: "Common RTU Problems We Diagnose",
        paragraphs: [
          "Most rooftop unit calls fall into a handful of patterns: a unit that runs but doesn't cool, a heat section that won't light, a unit that trips its safeties and shuts down, or one that runs constantly while the space stays uncomfortable. Each has several possible causes, and the repair that lasts is the one aimed at the actual cause.",
          "Our technicians check the electrical side, the refrigerant circuit, the gas heat section, airflow and the economizer, then explain what they found. If one failure was caused by another — a seized condenser fan that overheated a compressor, for example — we tell you, so the same failure doesn't repeat.",
        ],
        bullets: [
          "Unit running but blowing warm air",
          "No heat or repeated ignition lockouts",
          "Short cycling or tripping on safeties",
          "Noise, vibration or belt squeal",
          "Water leaking through the roof deck or ceiling",
        ],
      },
      {
        heading: "Roof Access, Safety and Scheduling",
        paragraphs: [
          "RTU work depends on getting to the roof safely. When you request service, tell us how the roof is reached — hatch, stairs or ladder — and whether keys, escorts or building notices are needed. That detail saves a wasted trip and gets the technician to the unit faster.",
          "For restaurants and retail we plan work around opening hours whenever the repair allows. For office and multifamily buildings we coordinate with the superintendent or property manager so occupants know if heating or cooling will be off during the repair.",
          "If your buildings have several rooftop units, we label findings by unit location as well as nameplate data, so the next technician — or your own maintenance staff — can find the right unit on a crowded roof without guessing.",
        ],
      },
      {
        heading: "When an RTU Should Be Replaced",
        paragraphs: [
          "Every rooftop unit reaches a point where repairs stop making sense: a failed compressor on an aging unit, a cracked heat exchanger, coils corroded past cleaning, or a unit that is undersized for how the space is used today. We give you a straight recommendation and, where it applies, a replacement scope that covers curb fit, crane or rigging needs, electrical requirements and scheduling.",
          "New rooftop installations can be paired with optional 10-year parts and labor coverage, purchased separately, and with a maintenance agreement so the new equipment is looked after from day one.",
        ],
      },
    ],
    sendUs: {
      heading: "What to Send Us About Your Rooftop Units",
      items: [
        "Property address and which RTU or area is affected",
        "Make, model and serial from the unit nameplate, if available",
        "Symptoms and when they started",
        "How the roof is accessed and who provides keys or escorts",
        "Recent repairs or service reports for the unit",
        "Business hours or occupancy constraints for the space below",
      ],
    },
    faqs: [
      { q: "What brands of rooftop units do you service?", a: "We service packaged rooftop units from the major commercial manufacturers. Send the make and model from the nameplate when you request service so the technician can prepare." },
      { q: "Do you repair both the cooling and gas heat sections of an RTU?", a: "Yes. We diagnose and repair the refrigeration circuit, condenser and evaporator sections, the gas heat section, economizers, fans and unit controls." },
      { q: "What do you need to know about roof access?", a: "How the roof is reached, any keys, escorts or ladder requirements, and who on site can let the technician in. That avoids delays when the technician arrives." },
      { q: "How do I know whether to repair or replace an old RTU?", a: "We look at the age and condition of the unit, the cost of the failed component and the repair history, then give you a recommendation and a replacement scope if it makes sense." },
      { q: "Can you service every RTU in our portfolio?", a: "Yes. A maintenance agreement priced per unit per year, quoted by portfolio, covers scheduled service with quarterly reporting across your buildings." },
      { q: "Do you handle rooftop unit replacements, including crane lifts?", a: "Yes. A replacement scope covers curb fit, rigging or crane needs, electrical work, permits and scheduling around the building's occupants." },
    ],
    related: [
      PM_HUB,
      { href: "/commercial-hvac-maintenance-nj", label: "RTU Maintenance Plans", sub: "Scheduled service" },
      { href: "/blog/commercial-rooftop-hvac-repair-request-nj", label: "RTU Repair Requests", sub: "What to include" },
      { href: "/blog/rooftop-hvac-replacement-quote-checklist-nj", label: "RTU Replacement Quotes", sub: "Owner checklist" },
    ],
    ctaHeading: "Get a Rooftop Unit Looked At",
    ctaSub: "Call (862) 423-9396 or send the address, unit details and roof access information to request RTU service.",
  },
  {
    slug: "commercial-hvac-maintenance-nj",
    category: "commercial",
    service: "Commercial HVAC Maintenance",
    serviceType: "Commercial HVAC Preventive Maintenance",
    formCaptureType: "lp_maintenance",
    serviceOnly: true,
    h1: "Commercial HVAC Maintenance Agreements in New Jersey",
    heroSub:
      "Planned maintenance for rooftop units, split systems, mini-splits, PTACs and VRF across your NJ buildings — priced per unit per year, quoted by portfolio, with quarterly reporting on every unit we maintain.",
    metaTitle: "Commercial HVAC Maintenance Agreements NJ | Portfolios",
    metaDescription:
      "Preventive HVAC maintenance agreements for NJ commercial and multifamily buildings, priced per unit per year with quarterly reports. (862) 423-9396.",
    introHeading: "Planned Maintenance Instead of Surprise Breakdowns",
    intro:
      "Most HVAC emergencies start as small problems nobody was looking for: a belt fraying, a drain line slowly clogging, a coil packed with debris, a capacitor drifting out of range. A maintenance agreement puts a technician in front of every unit on a schedule, so those problems are caught on a planned visit instead of during a heat wave or the first cold night. For property managers, it also produces something just as valuable — a written record of what every unit in the portfolio looks like.",
    cards: [
      { icon: "🏢", title: "Rooftop Units", desc: "Filters, belts, coils, drains, electrical connections, gas heat and economizer checks on packaged equipment." },
      { icon: "🧊", title: "Split Systems and Mini-Splits", desc: "Indoor and outdoor sections cleaned and inspected, refrigerant circuit and controls checked." },
      { icon: "🛏️", title: "PTACs", desc: "Filter and coil cleaning, drain checks and operating tests on apartment and condo units." },
      { icon: "🌀", title: "VRF / VRV", desc: "Scheduled checks on variable-refrigerant systems and the indoor units they serve." },
      { icon: "📊", title: "Quarterly Reporting", desc: "Condition reports by unit and by building so ownership can see what is healthy and what needs budget." },
      { icon: "🗓️", title: "Seasonal Scheduling", desc: "Visits timed ahead of cooling and heating seasons, coordinated with on-site staff." },
    ],
    deepDive: [
      {
        heading: "How Portfolio Pricing Works",
        paragraphs: [
          "Maintenance agreements are priced per unit per year and quoted for your portfolio as a whole. That keeps the cost predictable for budgeting, and it scales cleanly as buildings or units are added. Unit types we cover include PTACs, mini-splits, rooftop units and split systems.",
          "To prepare a quote we need an equipment list — even a rough one — with building addresses, unit types and approximate counts. If you don't have a current list, the first round of visits can build one for you, with make, model and serial recorded against each unit.",
        ],
      },
      {
        heading: "What a Maintenance Visit Covers",
        paragraphs: [
          "Each visit follows a checklist for the type of equipment: cleaning and inspecting coils, changing or checking filters, clearing condensate drains, checking belts, motors and electrical connections, testing safeties and controls, and checking heating and cooling operation. Anything that needs repair is written up with a recommendation rather than left for the next breakdown.",
          "Visits are timed ahead of the seasons that stress equipment most — cooling checks before summer, heating checks before the first cold weather — and coordinated with superintendents or on-site staff so access to roofs, mechanical rooms and occupied apartments is arranged in advance. Small fixes found during a visit, like a worn belt or a blocked drain, can often be handled on the spot with your approval.",
        ],
        bullets: [
          "Coil, filter and drain service",
          "Belt, motor and electrical connection checks",
          "Safety and control testing",
          "Heating and cooling operating checks",
          "Written findings and repair recommendations by unit",
        ],
      },
      {
        heading: "Quarterly Reports for Owners and Managers",
        paragraphs: [
          "The quarterly report is where maintenance pays off for a property manager. It shows each building, each unit, what was done and what condition the equipment is in, so you can answer ownership's questions, plan next year's repairs and replacements, and spot the units that keep generating service calls.",
          "Reports can go to the property manager, the owner's asset manager or both, and the same unit identifiers are used every quarter, so trends are easy to follow. If a building changes hands or management, the history stays with the equipment instead of leaving with a person.",
          "When a unit is approaching the end of its useful life, the report says so early enough to plan a replacement on your schedule. New installations can be paired with optional 10-year parts and labor coverage, purchased separately, and eligible existing systems may qualify for that coverage after an inspection.",
        ],
      },
    ],
    sendUs: {
      heading: "What to Send Us for a Maintenance Quote",
      items: [
        "Building addresses in the portfolio",
        "Equipment list or approximate counts by type (RTU, split, mini-split, PTAC, VRF)",
        "Any recent service reports or known problem units",
        "Preferred visit timing and occupancy constraints",
        "On-site contacts for access at each building",
        "Who receives the quarterly reports",
      ],
    },
    faqs: [
      { q: "How are commercial HVAC maintenance agreements priced?", a: "Per unit per year, quoted for your portfolio. Send us your building list and equipment counts and we'll prepare a quote." },
      { q: "What equipment can be covered under an agreement?", a: "PTACs, mini-splits, rooftop units and split systems, plus VRF systems on request, across commercial and multifamily buildings." },
      { q: "What do the quarterly reports include?", a: "Each building and unit serviced, the work performed, the equipment's condition and any recommended repairs or replacements." },
      { q: "We don't have an equipment list. Can you still quote?", a: "Yes. Give us the addresses and rough counts, and the first round of visits records make, model and serial for each unit so you end up with a complete list." },
      { q: "Which New Jersey counties do you cover for maintenance?", a: "Essex, Hudson, Bergen, Passaic, Union, Middlesex, Morris, Sussex and Somerset counties." },
      { q: "Does maintenance include the optional 10-year coverage?", a: "No — coverage is a separate, optional purchase. It is available on new installations, and eligible existing systems may qualify after an inspection." },
    ],
    related: [
      PM_HUB,
      { href: "/commercial/hvac-service-contracts", label: "Portfolio Service Contracts", sub: "Multi-building agreements" },
      { href: "/blog/fall-hvac-maintenance-nj-property-managers", label: "Fall Maintenance Checklist", sub: "For property managers" },
      { href: "/blog/closed-loop-pump-rotation-checklist-nj", label: "Pump Rotation Checklist", sub: "For building engineers" },
    ],
    ctaHeading: "Get a Maintenance Quote for Your Buildings",
    ctaSub: "Send your building list and equipment counts, or call (862) 423-9396, and we'll prepare a per-unit annual quote.",
  },
  {
    slug: "restaurant-hvac-nj",
    category: "commercial",
    service: "Restaurant HVAC",
    serviceType: "Restaurant HVAC and Kitchen Ventilation Services",
    formCaptureType: "lp_commercial_vrv",
    h1: "Keep Your Kitchen Cool, Your Dining Room Comfortable, and Your Doors Open.",
    heroSub:
      "Restaurant HVAC and kitchen ventilation across New Jersey — exhaust hoods, makeup air, dining-room comfort, and RTUs. Off-hours service to avoid costly closures.",
    metaTitle: "Restaurant HVAC & Kitchen Ventilation NJ | Mechanical Enterprise",
    metaDescription:
      "Restaurant HVAC across NJ — kitchen exhaust & makeup air, dining comfort, RTUs. Off-hours service to avoid closures. Call (862) 423-9396.",
    introHeading: "Restaurant HVAC & Ventilation Specialists in NJ",
    intro:
      "Restaurants live and die by comfort and code. We balance kitchen exhaust and makeup air, keep the dining room comfortable, and service your rooftop units — scheduling around your hours so you never lose a shift.",
    cards: [
      { icon: "🔥", title: "Kitchen Exhaust & Hoods", desc: "Exhaust hood and fan service that keeps kitchens safe and code-compliant." },
      { icon: "🌬️", title: "Makeup Air Systems", desc: "Balanced makeup air so exhaust works and doors aren't hard to open." },
      { icon: "🍽️", title: "Dining-Room Comfort", desc: "Balanced cooling and heating that keeps guests comfortable year-round." },
      { icon: "🏢", title: "Rooftop Units", desc: "RTU repair, maintenance, and replacement for restaurants." },
      { icon: "📋", title: "Ventilation & Code", desc: "Airflow balancing to meet NJ ventilation requirements and pass inspections." },
      { icon: "🕐", title: "Off-Hours Service", desc: "We work overnight and between shifts to avoid closing your restaurant." },
    ],
    faqs: [
      { q: "Why is my kitchen so hot even with the exhaust running?", a: "Usually an imbalance between exhaust and makeup air. If makeup air can't keep up, the kitchen overheats and doors are hard to open. We balance the system." },
      { q: "Can you service us without closing the restaurant?", a: "Yes — we schedule overnight and between-shift work to keep you open and serving." },
      { q: "Do you handle both kitchen ventilation and dining comfort?", a: "We handle the whole picture — exhaust, makeup air, RTUs, and dining-room comfort — so it all works together." },
      { q: "How fast can you respond if our AC or hood fails?", a: "We offer 24/7 emergency dispatch to prevent a closure. Call (862) 423-9396." },
      { q: "Do restaurant HVAC upgrades qualify for incentives?", a: "Often — PSE&G Direct Install and efficiency programs can cover a significant share of qualifying upgrades. We handle the paperwork." },
      { q: "Are you licensed and insured for commercial work?", a: "Yes — licensed, insured, WMBE/SBE-certified NJ commercial contractor with COIs on request." },
    ],
    related: [
      { href: "/commercial-rtu-service-nj", label: "RTU Service", sub: "Rooftop units" },
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC", sub: "Full-service repair" },
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Plans", sub: "Avoid closures" },
      { href: "/direct-install", label: "Direct Install", sub: "Up to 80% covered" },
    ],
    ctaHeading: "Keep Service Running Smoothly",
    ctaSub: "Restaurant HVAC and kitchen ventilation across New Jersey, scheduled around your hours.",
  },
  {
    slug: "warehouse-hvac-nj",
    category: "commercial",
    service: "Warehouse HVAC",
    serviceType: "Warehouse and Distribution Center HVAC",
    formCaptureType: "lp_commercial_vrv",
    h1: "Keep Your Warehouse Comfortable, Compliant, and Productive.",
    heroSub:
      "Warehouse and distribution HVAC across New Jersey — unit and infrared heaters, ventilation, HVLS fans, and rooftop units for large spaces. Worker comfort and compliance.",
    metaTitle: "Warehouse HVAC NJ | Heating, Ventilation & Cooling | Mechanical Enterprise",
    metaDescription:
      "Warehouse & distribution HVAC across NJ — unit heaters, ventilation, HVLS, rooftop units. Worker comfort & compliance. Call (862) 423-9396.",
    introHeading: "Large-Space HVAC for NJ Warehouses & Distribution",
    intro:
      "New Jersey's logistics corridor runs on warehouses that are hard to heat, ventilate, and cool. We design and service large-space systems that keep workers comfortable and compliant without wasting energy.",
    cards: [
      { icon: "🔥", title: "Unit & Infrared Heaters", desc: "Efficient heating for high-bay and open warehouse spaces." },
      { icon: "🌀", title: "HVLS Fans & Destratification", desc: "Big fans and destratification that even out temperature and cut costs." },
      { icon: "🌬️", title: "Ventilation & Exhaust", desc: "Air-quality and ventilation systems that meet workplace requirements." },
      { icon: "🏢", title: "Rooftop Units", desc: "RTU service for offices, break rooms, and conditioned zones." },
      { icon: "❄️", title: "Spot & Zone Cooling", desc: "Targeted cooling for packing lines, offices, and temperature-sensitive areas." },
      { icon: "🚛", title: "Loading Dock & Office Zones", desc: "Comfort and control where your team actually works." },
    ],
    faqs: [
      { q: "What's the most cost-effective way to heat a large warehouse?", a: "It depends on ceiling height, insulation, and use. High-efficiency unit or infrared heaters combined with HVLS destratification fans typically deliver the best comfort per dollar. We assess your facility and recommend the right approach." },
      { q: "Do I have to cool the whole warehouse?", a: "Rarely. Spot and zone cooling for offices, packing lines, and sensitive areas is usually far more economical than conditioning the entire space." },
      { q: "Can you help with ventilation and workplace air quality?", a: "Yes — we design ventilation and exhaust to maintain safe temperatures and air quality for your team." },
      { q: "Do you service multi-unit sites with many rooftop units?", a: "Yes — we run preventive maintenance programs across large facilities and multiple locations with consolidated reporting." },
      { q: "Do efficiency upgrades qualify for incentives?", a: "Often — NJ commercial programs and PSE&G Direct Install can cover qualifying high-efficiency heating, controls, and destratification. We handle the paperwork." },
      { q: "Are you licensed and insured for commercial work?", a: "Yes — licensed, insured, WMBE/SBE-certified NJ commercial contractor with COIs on request." },
    ],
    related: [
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC", sub: "Full-service repair" },
      { href: "/commercial-rtu-service-nj", label: "RTU Service", sub: "Rooftop units" },
      { href: "/industrial-hvac-nj", label: "Industrial HVAC", sub: "Process & plant" },
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Plans", sub: "PM agreements" },
    ],
    ctaHeading: "Comfortable, Compliant, Productive",
    ctaSub: "Warehouse and distribution HVAC across New Jersey for spaces of every size.",
  },
  {
    slug: "office-building-hvac-nj",
    category: "commercial",
    service: "Office Building HVAC",
    serviceType: "Office Building HVAC Services",
    formCaptureType: "lp_commercial_vrv",
    h1: "Keep Every Floor Comfortable — and Every Tenant Happy.",
    heroSub:
      "Office building HVAC across New Jersey — RTUs, VAV and VRF systems, chillers, controls, and indoor air quality. Fewer hot-and-cold complaints, better efficiency.",
    metaTitle: "Office Building HVAC NJ | Multi-Zone Comfort | Mechanical Enterprise",
    metaDescription:
      "Office HVAC across NJ — RTUs, VAV/VRF, chillers, controls & IAQ. Tenant comfort, fewer complaints. Call (862) 423-9396.",
    introHeading: "Office HVAC That Keeps Tenants Comfortable",
    intro:
      "Hot-and-cold complaints are the fastest way to frustrate tenants. We service and optimize multi-zone office systems, fix comfort imbalances, and improve air quality and efficiency across your building.",
    cards: [
      { icon: "🏢", title: "RTUs & Split Systems", desc: "Repair and maintenance for packaged and split office systems." },
      { icon: "🌀", title: "VAV & VRF Multi-Zone", desc: "Variable-air-volume and variable-refrigerant systems balanced for comfort." },
      { icon: "🧊", title: "Chillers & Boilers", desc: "Central plant service to keep large buildings conditioned reliably." },
      { icon: "🎛️", title: "Controls & BMS", desc: "Building-management and thermostat optimization for comfort and savings." },
      { icon: "🍃", title: "Indoor Air Quality", desc: "Filtration and ventilation upgrades for healthier office air." },
      { icon: "🌡️", title: "Tenant-Comfort Balancing", desc: "Eliminate hot and cold spots and cut down on comfort complaints." },
    ],
    faqs: [
      { q: "How do you fix hot and cold spots between offices?", a: "We diagnose the root cause — airflow balance, zoning, controls, or undersized equipment — and correct it, rather than just adjusting a thermostat." },
      { q: "Can you service the building after hours?", a: "Yes — we schedule around tenant occupancy, including evenings and weekends, to avoid disruption." },
      { q: "Do you handle controls and building-management systems?", a: "We troubleshoot and optimize controls, zoning, and BMS/thermostat programming for comfort and energy savings." },
      { q: "Can you improve air quality for our tenants?", a: "Yes — we add filtration and ventilation upgrades that noticeably improve office air quality." },
      { q: "Do office upgrades qualify for incentives?", a: "Many do — NJ commercial efficiency programs and PSE&G Direct Install can offset qualifying upgrades and controls. We handle the paperwork." },
      { q: "Are you licensed, insured, and able to provide a COI?", a: "Yes — licensed, insured, WMBE/SBE-certified NJ commercial contractor with COIs on request." },
    ],
    related: [
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC", sub: "Full-service repair" },
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Plans", sub: "PM agreements" },
      { href: "/indoor-air-quality-nj", label: "Indoor Air Quality", sub: "Healthier air" },
      { href: "/commercial-rtu-service-nj", label: "RTU Service", sub: "Rooftop units" },
    ],
    ctaHeading: "Happier Tenants, Lower Energy Bills",
    ctaSub: "Office building HVAC service and optimization across New Jersey.",
  },
  {
    slug: "industrial-hvac-nj",
    category: "commercial",
    service: "Industrial HVAC",
    serviceType: "Industrial HVAC Services",
    formCaptureType: "lp_commercial_vrv",
    h1: "Keep Production Running. Process Cooling and Plant HVAC That Doesn't Quit.",
    heroSub:
      "Industrial HVAC across New Jersey — process cooling, chillers, industrial ventilation, and makeup air for plants and manufacturing facilities. 24/7 uptime and compliance.",
    metaTitle: "Industrial HVAC NJ | Process Cooling & Chillers | Mechanical Enterprise",
    metaDescription:
      "Industrial HVAC across NJ — process cooling, chillers, ventilation & makeup air. 24/7 uptime & compliance. Call (862) 423-9396.",
    introHeading: "Industrial HVAC & Process Cooling in New Jersey",
    intro:
      "In a plant, HVAC isn't just comfort — it's uptime, product quality, and worker safety. We service industrial chillers, process cooling, and large-scale ventilation with the responsiveness critical operations demand.",
    cards: [
      { icon: "🧊", title: "Industrial Chillers", desc: "Service, repair, and replacement of chilled-water and process-cooling systems." },
      { icon: "🌡️", title: "Process & Precision Cooling", desc: "Tight temperature control for equipment, product, and process needs." },
      { icon: "🌬️", title: "Industrial Ventilation & Exhaust", desc: "Makeup air and exhaust systems that meet safety and compliance rules." },
      { icon: "♨️", title: "Large Boilers & Steam", desc: "Service for high-capacity boilers and steam systems." },
      { icon: "🎛️", title: "Controls & Redundancy", desc: "Controls, monitoring, and redundancy strategies that protect uptime." },
      { icon: "🕐", title: "24/7 Critical Response", desc: "Priority emergency service to keep production moving." },
    ],
    faqs: [
      { q: "What's the difference between process cooling and comfort cooling?", a: "Comfort cooling keeps people comfortable; process cooling holds precise temperatures for equipment or product. Process cooling is less forgiving, so it needs tighter control and faster response — which we're built for." },
      { q: "Do you service and replace industrial chillers?", a: "Yes — we service, repair, and replace chilled-water and process-cooling systems, and coordinate rigging for large equipment." },
      { q: "Can you help with ventilation and air-quality compliance?", a: "Yes — we design and service makeup air and exhaust systems to maintain safe temperatures and meet compliance requirements." },
      { q: "How fast can you respond to a critical failure?", a: "We offer 24/7 emergency dispatch and prioritize critical-process customers. Call (862) 423-9396." },
      { q: "Do you offer preventive maintenance for critical equipment?", a: "Yes — tailored PM programs with monitoring and redundancy planning to prevent unplanned downtime." },
      { q: "Are you licensed, insured, and able to provide a COI?", a: "Yes — licensed, insured, WMBE/SBE-certified NJ commercial contractor with COIs on request." },
    ],
    related: [
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC", sub: "Full-service repair" },
      { href: "/warehouse-hvac-nj", label: "Warehouse HVAC", sub: "Large facilities" },
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Plans", sub: "Protect uptime" },
      HUB_COM,
    ],
    ctaHeading: "Protect Your Production and Your People",
    ctaSub: "Industrial HVAC and process cooling across New Jersey with 24/7 critical response.",
  },
];

export const SEO_LANDING_PAGE_SLUGS: string[] = SEO_LANDING_PAGES.map((p) => p.slug);
