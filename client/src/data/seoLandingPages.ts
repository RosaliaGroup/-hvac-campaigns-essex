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
}

const HUB_RES: LpLink = { href: "/residential", label: "All Residential HVAC", sub: "Browse home services" };
const HUB_COM: LpLink = { href: "/commercial", label: "All Commercial HVAC", sub: "Browse business services" };
const REBATE_LINK: LpLink = { href: "/rebate-calculator", label: "Rebate Calculator", sub: "See your NJ savings" };

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
      { q: "When should I replace instead of repair?", a: "If the system is old, unsafe, or facing a major repair, replacement may be smarter — and NJ rebates up to $16,000 plus a federal tax credit can offset the cost. We'll give you an honest recommendation." },
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
      { q: "Should I repair or replace my furnace?", a: "If it's 15+ years old or facing a major repair, replacement may pay off — and NJ rebates plus a federal tax credit can offset a new high-efficiency system. We'll advise honestly." },
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
      { q: "Is it worth repairing an old boiler?", a: "Often yes, but if it's inefficient or failing we'll show you replacement options — high-efficiency systems may qualify for NJ rebates and a federal tax credit." },
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
      { q: "Should I repair or replace my heat pump?", a: "If it's newer, repair is usually best. If it's aging or facing a major repair, a new cold-climate heat pump may qualify for NJ rebates up to $16,000 plus a federal tax credit — we'll show you the numbers." },
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
      { q: "Do you install new mini-splits too?", a: "We do — and new ductless heat-pump systems may qualify for NJ rebates and a federal tax credit. Ask us during your visit." },
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
    category: "residential",
    service: "Emergency HVAC Repair",
    serviceType: "Emergency HVAC Repair",
    formCaptureType: "lp_emergency",
    h1: "No Heat? No AC? We Answer Live and Roll a Tech Now.",
    heroSub:
      "24/7 emergency HVAC repair across New Jersey. When your heat fails in winter or your AC dies in a heat wave, we respond fast — nights, weekends, and holidays.",
    metaTitle: "Emergency HVAC Repair NJ | 24/7 No Heat / No AC | Mechanical Enterprise",
    metaDescription:
      "24/7 emergency HVAC repair across New Jersey. No heat, no AC, sudden breakdowns — fast local response. Call (862) 423-9396 now.",
    introHeading: "24/7 Emergency HVAC Service in New Jersey",
    intro:
      "HVAC emergencies don't wait for business hours — and neither do we. Call any time and reach a real person who dispatches a licensed technician to get your home safe and comfortable again, fast.",
    cards: [
      { icon: "🚨", title: "No Heat in Winter", desc: "Furnace, boiler, and heat-pump failures handled as a priority when it's freezing." },
      { icon: "🔥", title: "No AC in a Heat Wave", desc: "Rapid cooling repair to protect seniors, infants, and anyone at risk in the heat." },
      { icon: "💧", title: "Leaks & Water Damage", desc: "Condensate floods and refrigerant leaks stopped before they spread." },
      { icon: "⚡", title: "Electrical & No Power", desc: "Tripping breakers, burning smells, and control failures diagnosed safely." },
      { icon: "⚠️", title: "Gas or CO Concern", desc: "If you smell gas, leave and call 911 and your utility first — then call us to repair." },
      { icon: "🕐", title: "Nights, Weekends & Holidays", desc: "Live dispatch around the clock, every day of the year." },
    ],
    faqs: [
      { q: "How fast can you get to me?", a: "We answer live 24/7 and dispatch as quickly as possible across New Jersey. Call (862) 423-9396 and we'll give you a real ETA." },
      { q: "What counts as an HVAC emergency?", a: "No heat in freezing weather, no cooling during dangerous heat, active leaks, electrical or burning smells, and anything affecting safety. When in doubt, call — we'll advise you." },
      { q: "I smell gas — what should I do?", a: "Leave the building immediately, don't switch anything on or off, and call 911 and your gas utility first. Once it's safe, call us to diagnose and repair." },
      { q: "Do you charge more after hours?", a: "After-hours emergency rates may apply; we quote you upfront before any work so there are no surprises." },
      { q: "Do you serve weekends and holidays?", a: "Yes — 24/7/365 across New Jersey, including weekends and holidays." },
      { q: "What if my system needs replacement?", a: "We'll get you comfortable first, then show you replacement options and any NJ rebates and financing that apply — no pressure." },
    ],
    related: [
      { href: "/heating-repair-nj", label: "Heating Repair", sub: "No-heat service" },
      { href: "/ac-repair-nj", label: "AC Repair", sub: "No-cooling service" },
      { href: "/furnace-repair-nj", label: "Furnace Repair", sub: "Gas & electric" },
      { href: "/boiler-repair-nj", label: "Boiler Repair", sub: "Steam & hot-water" },
    ],
    ctaHeading: "HVAC Emergency? Call Now.",
    ctaSub: "Live 24/7 dispatch across New Jersey. A licensed technician is ready to help.",
  },

  // ─────────────────────────── COMMERCIAL ───────────────────────────
  {
    slug: "commercial-hvac-service-nj",
    category: "commercial",
    service: "Commercial HVAC Service",
    serviceType: "Commercial HVAC Service and Repair",
    formCaptureType: "lp_commercial_vrv",
    h1: "Keep Your Facility Running — With Zero Unplanned Downtime.",
    heroSub:
      "Commercial HVAC service and repair across New Jersey for every property type — rooftop units, split systems, VRF/VRV, and controls. Service agreements and 24/7 response.",
    metaTitle: "Commercial HVAC Service & Repair NJ | Mechanical Enterprise",
    metaDescription:
      "Commercial HVAC service & repair across NJ — RTUs, splits, VRF, controls. Service agreements & 24/7 response. Call (862) 419-1763.",
    introHeading: "Commercial HVAC Service for New Jersey Businesses",
    intro:
      "Downtime costs money and comfort. We service and repair every kind of commercial system, respond fast, and offer planned maintenance agreements that keep your equipment running and your budget predictable.",
    cards: [
      { icon: "🏢", title: "Rooftop Units (RTUs)", desc: "Repair, maintenance, and change-outs for packaged rooftop systems." },
      { icon: "🌀", title: "VRF / VRV Systems", desc: "Expert service for variable-refrigerant multi-zone commercial systems." },
      { icon: "🧊", title: "Splits & Chillers", desc: "Ductless, split, and chilled-water systems maintained and repaired." },
      { icon: "🎛️", title: "Controls & Thermostats", desc: "Building controls, zoning, and smart-thermostat troubleshooting." },
      { icon: "📋", title: "Service Agreements", desc: "Planned maintenance that reduces breakdowns and extends equipment life." },
      { icon: "🕐", title: "24/7 Emergency Response", desc: "Priority dispatch to minimize downtime when systems fail." },
    ],
    faqs: [
      { q: "Do you offer commercial service contracts?", a: "Yes — planned maintenance agreements tailored to your equipment and site, with priority response and member pricing. See our commercial maintenance page." },
      { q: "What property types do you serve?", a: "Offices, retail, restaurants, medical, warehouses, and industrial facilities across New Jersey." },
      { q: "Can you work after hours to avoid disrupting my business?", a: "Yes — we schedule around your operations, including nights and weekends, to keep disruption to a minimum." },
      { q: "How fast can you respond to a breakdown?", a: "We offer 24/7 emergency dispatch and prioritize contract customers. Call (862) 419-1763." },
      { q: "Do commercial upgrades qualify for incentives?", a: "Many do — PSE&G Direct Install can cover up to 80% of qualifying commercial HVAC costs. We handle the paperwork." },
      { q: "Are you licensed, insured, and able to provide a COI?", a: "Yes — fully licensed and insured NJ commercial contractor, WMBE/SBE certified, and we provide certificates of insurance on request." },
    ],
    related: [
      { href: "/commercial-rtu-service-nj", label: "RTU Service", sub: "Rooftop units" },
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Plans", sub: "PM agreements" },
      { href: "/commercial-hvac-installation-nj", label: "Commercial Install", sub: "New systems" },
      { href: "/direct-install", label: "Direct Install", sub: "Up to 80% covered" },
    ],
    ctaHeading: "Keep Your Business Comfortable and Running",
    ctaSub: "Commercial HVAC service and 24/7 support across New Jersey. Ask about a service agreement.",
  },
  {
    slug: "commercial-rtu-service-nj",
    category: "commercial",
    service: "Commercial RTU Service",
    serviceType: "Rooftop Unit (RTU) Service and Repair",
    formCaptureType: "lp_commercial_vrv",
    h1: "RTU Down? We Service Every Rooftop Unit in NJ.",
    heroSub:
      "Rooftop unit service, repair, and replacement across New Jersey — economizers, compressors, motors, and controls. Keep your facility comfortable and running.",
    metaTitle: "Commercial RTU Service & Repair NJ | Rooftop Units | Mechanical Enterprise",
    metaDescription:
      "Rooftop unit (RTU) service, repair & replacement across NJ. Economizers, compressors, PM programs. Minimize downtime. Call (862) 419-1763.",
    introHeading: "Rooftop Unit (RTU) Experts Across New Jersey",
    intro:
      "Packaged rooftop units are the workhorses of NJ commercial buildings. We repair, maintain, and replace RTUs of every tonnage and brand — with crane coordination for change-outs and preventive programs to prevent failures.",
    cards: [
      { icon: "🔧", title: "RTU Repair", desc: "Compressors, capacitors, motors, boards, and refrigerant faults fixed fast." },
      { icon: "🏗️", title: "Change-Outs & Replacement", desc: "Full unit replacements with crane coordination and curb adapters." },
      { icon: "🌬️", title: "Economizer Service", desc: "Economizer repair and calibration to cut energy use and pass inspections." },
      { icon: "⚙️", title: "Belts, Bearings & Motors", desc: "Preventive replacement of wear parts before they cause downtime." },
      { icon: "📋", title: "Rooftop PM Programs", desc: "Scheduled maintenance that catches problems early and extends unit life." },
      { icon: "🧰", title: "All Packaged Brands", desc: "Carrier, Trane, York, Lennox, Daikin, and more — every tonnage." },
    ],
    faqs: [
      { q: "How much does RTU replacement cost in NJ?", a: "It varies by tonnage, crane access, and curb adaptation. We provide a detailed quote after a site assessment, and many upgrades qualify for commercial incentives." },
      { q: "Do you handle the crane and rigging for change-outs?", a: "Yes — we coordinate crane, rigging, curb adapters, and permits for a turnkey replacement." },
      { q: "Can you service all RTU brands?", a: "We service Carrier, Trane, York, Lennox, Daikin, and all major packaged rooftop brands." },
      { q: "What's included in a rooftop PM program?", a: "Scheduled inspections, filter and belt changes, coil cleaning, economizer checks, and refrigerant/electrical testing — tailored to your unit count." },
      { q: "How quickly can you respond to a down RTU?", a: "We offer 24/7 emergency dispatch and prioritize contract customers. Call (862) 419-1763." },
      { q: "Do RTU upgrades qualify for rebates?", a: "Often — PSE&G Direct Install can cover up to 80% of qualifying commercial HVAC. We handle the paperwork." },
    ],
    related: [
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC", sub: "Full-service repair" },
      { href: "/commercial-hvac-maintenance-nj", label: "Maintenance Plans", sub: "PM agreements" },
      { href: "/warehouse-hvac-nj", label: "Warehouse HVAC", sub: "Large facilities" },
      { href: "/office-building-hvac-nj", label: "Office HVAC", sub: "Multi-zone comfort" },
    ],
    ctaHeading: "Get Your Rooftop Unit Back Online",
    ctaSub: "RTU service, repair, and replacement across New Jersey with 24/7 emergency response.",
  },
  {
    slug: "commercial-hvac-maintenance-nj",
    category: "commercial",
    service: "Commercial HVAC Maintenance",
    serviceType: "Commercial HVAC Preventive Maintenance",
    formCaptureType: "lp_maintenance",
    h1: "Fewer Breakdowns. Predictable Budgets. One Maintenance Partner.",
    heroSub:
      "Commercial HVAC preventive maintenance agreements across New Jersey. Scheduled tune-ups that reduce emergency costs, extend equipment life, and keep your facility comfortable.",
    metaTitle: "Commercial HVAC Maintenance NJ | PM Agreements | Mechanical Enterprise",
    metaDescription:
      "Commercial HVAC preventive maintenance plans across NJ. Fewer breakdowns, longer equipment life, priority service. Call (862) 419-1763.",
    introHeading: "Preventive Maintenance That Pays for Itself",
    intro:
      "Most commercial HVAC failures are preventable. Our planned maintenance agreements catch small problems before they become expensive emergencies, lower energy costs, and give you predictable, budget-friendly service.",
    cards: [
      { icon: "📋", title: "Scheduled Tune-Ups", desc: "Regular multi-point inspections tuned to your equipment and season." },
      { icon: "🧹", title: "Filter & Coil Programs", desc: "Filter, belt, and coil-cleaning schedules that protect efficiency." },
      { icon: "⚡", title: "Electrical & Refrigerant Checks", desc: "Catch failing capacitors, contactors, and refrigerant issues early." },
      { icon: "🚨", title: "Priority Emergency Response", desc: "Members get front-of-line dispatch and preferred pricing." },
      { icon: "💰", title: "Lower Energy Bills", desc: "Well-maintained systems run efficiently and cost less to operate." },
      { icon: "🏢", title: "Multi-Site Programs", desc: "One partner and one report across all your NJ locations." },
    ],
    faqs: [
      { q: "What's included in a commercial maintenance agreement?", a: "Scheduled visits, multi-point inspections, filter/belt changes, coil cleaning, electrical and refrigerant checks, and priority emergency response — customized to your equipment." },
      { q: "How often should commercial HVAC be serviced?", a: "Most systems benefit from two to four visits per year depending on equipment, runtime, and property type. We'll recommend the right cadence." },
      { q: "Does a maintenance plan really save money?", a: "Yes — preventive maintenance reduces costly emergency repairs, extends equipment life, and cuts energy use, typically paying for itself." },
      { q: "Do members get priority service?", a: "Absolutely — agreement customers get front-of-line dispatch and preferred pricing on any additional repairs." },
      { q: "Can you cover multiple locations?", a: "Yes — we run multi-site programs with consolidated scheduling and reporting across all your NJ properties." },
      { q: "Are you licensed, insured, and able to provide a COI?", a: "Fully licensed and insured NJ commercial contractor, WMBE/SBE certified, with COIs on request." },
    ],
    related: [
      { href: "/commercial-hvac-service-nj", label: "Commercial HVAC", sub: "Service & repair" },
      { href: "/commercial-rtu-service-nj", label: "RTU Service", sub: "Rooftop units" },
      { href: "/office-building-hvac-nj", label: "Office HVAC", sub: "Tenant comfort" },
      { href: "/direct-install", label: "Direct Install", sub: "Up to 80% covered" },
    ],
    ctaHeading: "Protect Your Equipment and Your Budget",
    ctaSub: "Ask about a commercial HVAC maintenance agreement for your New Jersey facility.",
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
      "Restaurant HVAC across NJ — kitchen exhaust & makeup air, dining comfort, RTUs. Off-hours service to avoid closures. Call (862) 419-1763.",
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
      { q: "How fast can you respond if our AC or hood fails?", a: "We offer 24/7 emergency dispatch to prevent a closure. Call (862) 419-1763." },
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
      "Warehouse & distribution HVAC across NJ — unit heaters, ventilation, HVLS, rooftop units. Worker comfort & compliance. Call (862) 419-1763.",
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
      "Office HVAC across NJ — RTUs, VAV/VRF, chillers, controls & IAQ. Tenant comfort, fewer complaints. Call (862) 419-1763.",
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
      "Industrial HVAC across NJ — process cooling, chillers, ventilation & makeup air. 24/7 uptime & compliance. Call (862) 419-1763.",
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
      { q: "How fast can you respond to a critical failure?", a: "We offer 24/7 emergency dispatch and prioritize critical-process customers. Call (862) 419-1763." },
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
