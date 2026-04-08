import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";

const BASE = "https://mechanicalenterprise.com";
const REBATE_URL = `${BASE}/rebate-calculator`;
const PHONE = "(862) 423-9396";
const PHONE_TEL = "tel:+18624239396";

type CityPageProps = { city: string; slug: string };

// Unique per-city content for SEO — prevents soft 404 / thin content flags
const CITY_CONTENT: Record<string, { county: string; intro: string; details: string }> = {
  livingston: {
    county: "Essex County",
    intro: "Livingston is an affluent Essex County suburb with a housing stock largely built between the 1960s and 1980s. Many homes in Livingston still rely on original forced-air furnaces and central AC systems that are well past their expected lifespan. These older systems not only waste energy but also fail to meet the efficiency thresholds required for today's NJ rebate programs.",
    details: "Livingston homeowners have one of the highest rebate qualification rates in Essex County because the age and condition of existing equipment makes replacement highly cost-effective. With PSE&G as the primary electric and gas utility serving Livingston, residents qualify for the full NJ Clean Energy rebate stack. Livingston's tree-lined neighborhoods and larger lot sizes make heat pump installations particularly straightforward — outdoor condensing units can be placed without tight-space challenges common in more urban areas. Mechanical Enterprise has completed dozens of heat pump and central AC installations throughout Livingston, from the homes near Livingston Mall to the neighborhoods along South Orange Avenue and Northfield Road. We handle every step: on-site assessment, equipment selection, permits, installation, and all PSE&G rebate paperwork. Livingston families consistently qualify for $8,000 to $16,000 in combined rebates when upgrading from older gas furnaces to modern heat pump systems.",
  },
  "short-hills": {
    county: "Essex County",
    intro: "Short Hills, part of the Township of Millburn, is one of New Jersey's most affluent communities with a median household income consistently ranking among the highest in the nation. Homes in Short Hills tend to be larger — many exceeding 3,000 square feet — with complex multi-zone HVAC needs that require careful engineering and premium equipment.",
    details: "Short Hills homeowners are among the highest-qualifying candidates for maximum NJ rebate amounts because their larger homes require higher-capacity systems that carry larger per-unit rebates. Many Short Hills residences have aging boiler-and-radiator setups or oversized central systems installed during original construction in the mid-20th century. Replacing these with modern variable-speed heat pump systems delivers dramatic comfort improvements and energy savings. Mechanical Enterprise specializes in whole-home HVAC replacements for Short Hills properties, including multi-zone ductless systems for the large colonial and Tudor-style homes common along Old Short Hills Road, Hobart Avenue, and the neighborhoods surrounding the Short Hills Club. PSE&G serves the Short Hills area, providing access to the full suite of NJ Clean Energy incentives. We regularly see Short Hills homeowners qualify for the full $16,000 NJ rebate plus the $2,000 federal tax credit, bringing out-of-pocket costs for premium installations to a fraction of the total project cost.",
  },
  guttenberg: {
    county: "Hudson County",
    intro: "Guttenberg, located in Hudson County, is the most densely populated municipality in the United States. With its mix of mid-rise apartment buildings, condominiums, and commercial storefronts packed into just 0.19 square miles, Guttenberg presents unique HVAC challenges that require contractors experienced with urban installations and multi-unit buildings.",
    details: "Guttenberg's dense urban environment means most HVAC installations involve ductless mini-split systems, which are ideal for buildings without existing ductwork and apartments where space is at a premium. Commercial properties along Bergenline Avenue — one of the busiest shopping corridors in Hudson County — qualify for NJ Direct Install and commercial rebate programs that can cover up to 80% of total installation costs. Residential property owners and condo associations in Guttenberg qualify for NJ rebates up to $16,000 per unit when replacing older PTAC or window AC systems with high-efficiency heat pumps. PSE&G serves Guttenberg, and the town's location within the NJ Clean Energy program zone makes every residential and commercial property eligible for assessment. Mechanical Enterprise has completed installations throughout Guttenberg's multi-family buildings and commercial spaces, navigating the tight mechanical rooms, rooftop placements, and permitting requirements that come with working in one of NJ's most densely built municipalities. We handle the full scope — assessment, engineering, installation, and every rebate application.",
  },
  woodbridge: {
    county: "Middlesex County",
    intro: "Woodbridge Township is one of New Jersey's largest municipalities, spanning over 24 square miles across Middlesex County with a population exceeding 100,000. The township encompasses diverse neighborhoods including Woodbridge proper, Iselin, Colonia, Avenel, Port Reading, Sewaren, Fords, Keasbey, and Hopelawn — each with distinct housing types ranging from post-war Cape Cods to newer developments.",
    details: "Woodbridge's size and housing diversity mean that HVAC needs vary widely across the township. Older sections like Woodbridge proper and Avenel have homes from the 1940s-1960s that often still run on original oil-fired boilers or early forced-air systems — prime candidates for heat pump conversion and maximum rebate qualification. Newer developments in Iselin and Colonia may have central air systems from the 1990s-2000s that, while functional, fall well below current efficiency standards. PSE&G and JCP&L both serve portions of Woodbridge Township, and both utility territories participate in NJ Clean Energy rebate programs. Mechanical Enterprise serves all of Woodbridge Township and has completed residential and commercial installations from Route 1 corridor businesses to the residential neighborhoods surrounding Woodbridge Center Mall. We assess each property individually because rebate eligibility depends on current equipment, utility provider, and system capacity — and we make sure Woodbridge homeowners capture every available incentive.",
  },
  "north-bergen": {
    county: "Hudson County",
    intro: "North Bergen is a densely populated township in Hudson County, situated directly across the Hudson River from Manhattan. With a mix of residential neighborhoods, commercial corridors along Tonnelle Avenue and Bergenline Avenue, and industrial areas, North Bergen's HVAC landscape spans everything from single-family homes on the Palisades bluffs to large commercial and multi-family buildings in the flatlands below.",
    details: "North Bergen is served by PSE&G, which means every residential and commercial property in the township qualifies for the full range of NJ Clean Energy rebate programs. The town's proximity to New York City means property values and energy costs are both high, making HVAC efficiency upgrades particularly cost-effective for North Bergen homeowners and landlords. Many residential buildings in North Bergen were built in the 1950s-1970s and rely on outdated heating systems — steam boilers, old PTACs, or window units — that are expensive to operate and uncomfortable. Converting to modern heat pump systems with NJ rebates up to $16,000 dramatically reduces both upfront and ongoing costs. Commercial properties along Tonnelle Avenue and the Route 1-9 corridor qualify for NJ Direct Install programs that cover lighting, HVAC, and refrigeration upgrades at up to 80% off. Mechanical Enterprise serves all of North Bergen and has experience with the specific permitting requirements of Hudson County municipalities. We coordinate directly with PSE&G for rebate processing and handle all installation work from assessment through final inspection.",
  },
};


const SERVICES = [
  { icon: "🌡️", title: "Heat Pump Installation", desc: "High-efficiency heat pump systems fully eligible for NJ rebates and federal tax credits.", href: `${BASE}/residential` },
  { icon: "❄️", title: "Central AC Installation", desc: "New central air conditioning system installation with full rebate assistance included.", href: `${BASE}/residential` },
  { icon: "🔄", title: "Full System Replacement", desc: "Replace your entire heating and cooling system. We handle installation, permits, and all rebate paperwork.", href: `${BASE}/residential` },
  { icon: "💨", title: "Ductless Mini-Split", desc: "Perfect for homes without ductwork. Multi-zone comfort with maximum efficiency.", href: `${BASE}/residential` },
  { icon: "🏢", title: "Commercial VRV/VRF Systems", desc: "Large-scale commercial installations with rebates covering up to 80% of total costs.", href: `${BASE}/commercial` },
  { icon: "⚡", title: "Smart System Upgrade", desc: "Upgrade to a modern smart HVAC system with remote monitoring and zoning.", href: `${BASE}/residential` },
];

export default function CityPage({ city, slug }: CityPageProps) {
  useSEO({
    title: `Heat Pump Installation ${city} NJ | Up to $16K Rebates | Mechanical Enterprise`,
    description: `HVAC installation in ${city} NJ. Free assessment, NJ rebates up to $16,000, federal tax credit up to $2,000. Licensed NJ contractor. Call ${PHONE}.`,
    ogUrl: `${BASE}/hvac-${slug}-nj`,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: `How much does heat pump installation cost in ${city}, NJ?`, a: `Installation costs vary by system size and home. However, with NJ rebates up to $16,000 and a federal tax credit up to $2,000, many ${city} homeowners significantly reduce their out-of-pocket cost. Book a free assessment to get your exact numbers.` },
    { q: `What rebates are available for ${city}, NJ homeowners in 2026?`, a: `${city} homeowners may qualify for NJ rebates up to $16,000 plus a federal tax credit up to $2,000. Eligibility depends on your equipment and property. We assess your exact eligibility for free.` },
    { q: `How long does HVAC installation take in ${city}?`, a: `Most residential heat pump installations in ${city} take 1-2 days. We handle all permits, inspections, and rebate paperwork so you don't have to.` },
    { q: `Do you serve commercial properties in ${city}, NJ?`, a: `Yes — we install VRV/VRF systems and full HVAC for commercial properties in ${city}. Commercial rebates can cover up to 80% of installation costs. Free commercial assessment available.` },
    { q: `How do I get started in ${city}, NJ?`, a: `Call ${PHONE} or book online. We come to your ${city} property, assess your system, and show you every rebate you qualify for — completely free, no obligation.` },
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HVACBusiness",
        "name": "Mechanical Enterprise LLC", "telephone": PHONE,
        "email": "sales@mechanicalenterprise.com", "url": BASE,
        "areaServed": { "@type": "City", "name": `${city}, New Jersey` },
        "priceRange": "Free Assessment", "openingHours": "Mo-Su 00:00-23:59",
        "description": `Heat pump and HVAC installation in ${city} NJ. Free assessments, NJ rebates up to $16,000, federal tax credit up to $2,000.`,
      }) }} />
      <Navigation />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[440px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#e8813a] text-white hover:bg-[#e8813a]/90 text-sm px-4 py-1.5">
              Serving {city}, NJ
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Heat Pump & HVAC Installation in {city}, NJ
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">
              Free assessment · NJ rebates up to $16,000 · Federal tax credit up to $2,000 · Licensed NJ contractor
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-6 text-lg w-full sm:w-auto">
                  💰 Check My Rebate Eligibility
                </Button>
              </a>
              <a href={BASE}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  📅 Book Free Assessment
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────────────── */}
      <section className="py-8 bg-white border-b">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-center">
            {[
              { big: "Up to $16,000", small: "NJ Rebates Available" },
              { big: "Up to $2,000", small: "Federal Tax Credit" },
              { big: "Free", small: "Assessment & Paperwork" },
              { big: "Licensed & Insured", small: "NJ Contractor" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-bold text-[#e8813a]">{s.big}</div>
                <div className="text-sm text-gray-500 mt-1">{s.small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Unique City Content (SEO) ──────────────────────────────── */}
      {CITY_CONTENT[slug] && (
        <section className="py-12 bg-white">
          <div className="container">
            <div className="max-w-3xl mx-auto prose prose-gray">
              <h2 className="text-2xl font-bold text-[#0a1628] mb-4">
                HVAC Services in {city}, {CITY_CONTENT[slug].county}, NJ
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {CITY_CONTENT[slug].intro}
              </p>
              <p className="text-gray-700 leading-relaxed mb-6">
                {CITY_CONTENT[slug].details}
              </p>
              <div className="flex gap-3 not-prose">
                <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white">
                    Check Rebate Eligibility in {city} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <a href={PHONE_TEL}>
                  <Button variant="outline">
                    <Phone className="mr-2 h-4 w-4" /> Call {PHONE}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Rebate Section ────────────────────────────────────────── */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#0a1628] mb-3">
              2026 Rebate Programs — {city}, NJ Homeowners
            </h2>
            <p className="text-gray-600 mb-8">Two programs that can offset your installation cost:</p>
            <div className="rounded-xl overflow-hidden border-2 border-[#e8813a] mb-4">
              <div className="flex justify-between items-center p-5 bg-white border-b">
                <span className="font-medium text-[#0a1628]">Federal Tax Credit (IRA)</span>
                <span className="font-bold text-lg text-[#e8813a]">Up to $2,000</span>
              </div>
              <div className="flex justify-between items-center p-5 bg-white">
                <span className="font-medium text-[#0a1628]">NJ State Rebates</span>
                <span className="font-bold text-lg text-[#e8813a]">Up to $16,000</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-6">
              * Rebate eligibility depends on equipment, property type, and utility provider. We determine exactly what you qualify for at no cost during your free assessment.
            </p>
            <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-5 text-base">
                Check My Eligibility <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Services ──────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">
            HVAC Installation Services in {city}, NJ
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {SERVICES.map((svc, i) => (
              <a key={i} href={svc.href} className="block group">
                <Card className="h-full border-t-4 border-t-transparent group-hover:border-t-[#e8813a] transition-colors">
                  <CardContent className="pt-6">
                    <div className="text-3xl mb-3">{svc.icon}</div>
                    <h3 className="font-bold text-lg text-[#0a1628] mb-2">{svc.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{svc.desc}</p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ─────────────────────────────────────────── */}
      <section className="py-16 bg-[#0a1628]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-white mb-10">
            Why {city} Homeowners Choose Mechanical Enterprise
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: "📋", title: "We Handle Everything", desc: "Assessment, installation, permits, and all rebate paperwork — done for you." },
              { icon: "💰", title: "Maximize Your Rebates", desc: "We know every NJ rebate program and make sure you get every dollar you're entitled to." },
              { icon: "⚡", title: "Licensed NJ Contractor", desc: "Fully licensed, bonded, and insured. WMBE/SBE certified. Serving NJ since day one." },
              { icon: "📞", title: "Local & Responsive", desc: `Based in Newark. Serving ${city} and surrounding NJ communities. Call ${PHONE}.` },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="text-3xl shrink-0">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">
            Frequently Asked Questions — {city}, NJ
          </h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-50 rounded-lg border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 font-semibold text-[#0a1628] flex justify-between items-center hover:bg-gray-100 transition-colors"
                >
                  <span className="pr-4">{faq.q}</span>
                  <span className="text-[#e8813a] text-xl shrink-0">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────── */}
      <section className="py-16 bg-[#e8813a]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Your Free Assessment in {city}, NJ
            </h2>
            <p className="text-lg text-white/90 mb-8">No cost. No obligation. We come to you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={BASE}>
                <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg w-full sm:w-auto">
                  📅 Book Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <a href={PHONE_TEL}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  <Phone className="mr-2 h-5 w-5" /> Call {PHONE}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
