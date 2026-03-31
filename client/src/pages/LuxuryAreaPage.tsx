import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";

const BASE = "https://mechanicalenterprise.com";
const REBATE_URL = `${BASE}/rebate-calculator`;
const PHONE = "(862) 419-1763";
const PHONE_TEL = "tel:+18624191763";

type LuxuryAreaPageProps = { area: string; slug: string; county: string; incomeContext: string };

const PREMIUM_SYSTEMS = [
  { brand: "Carrier Infinity Series", desc: "The quietest, most efficient system available. Smart home integration included." },
  { brand: "Trane XV Series", desc: "Military-grade durability with industry-leading efficiency ratings." },
  { brand: "Lennox Signature Collection", desc: "Ultimate comfort with SilentComfort protection and precise temperature control." },
  { brand: "Custom Multi-Zone Systems", desc: "Whole-home zoning for large properties. Every room its own temperature." },
];

export default function LuxuryAreaPage({ area, slug, county, incomeContext }: LuxuryAreaPageProps) {
  useSEO({
    title: `Premium HVAC Installation ${area} NJ | Carrier Trane Lennox | Mechanical Enterprise`,
    description: `Premium heat pump and HVAC installation in ${area} NJ. Carrier, Trane, Lennox systems. Smart zoning. NJ rebates up to $16,000. Free assessment. Call ${PHONE}.`,
    ogUrl: `${BASE}/hvac-${slug}-nj`,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: `What are the best HVAC systems for large homes in ${area}?`, a: `For larger ${area} homes, we typically recommend multi-zone heat pump systems from Carrier, Trane, or Lennox. These provide independent temperature control for each room and integrate with smart home systems. We assess your property and design a custom solution during your free consultation.` },
    { q: `Can I get smart home integration with my new HVAC system?`, a: `Absolutely. All of our premium systems — Carrier Infinity, Trane XV, and Lennox Signature — include smart home integration. Control your system remotely, set zone-by-zone temperatures, and monitor efficiency from your phone.` },
    { q: `How long does installation take for a whole-home system?`, a: `Whole-home premium installations in ${area} typically take 2-4 days depending on the number of zones and complexity. We coordinate everything including permits and inspections to minimize disruption.` },
    { q: `Do premium systems qualify for NJ rebates?`, a: `Yes — even premium Carrier, Trane, and Lennox systems qualify for full NJ rebates up to $16,000 plus a $2,000 federal tax credit. Most ${area} homeowners receive the maximum rebate amounts.` },
    { q: `What warranty do premium HVAC systems come with?`, a: `Premium systems come with manufacturer warranties of 10-12 years on parts and compressors. We also offer extended service agreements for complete peace of mind. Our installation workmanship is guaranteed.` },
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HVACBusiness",
        "name": "Mechanical Enterprise LLC", "telephone": PHONE,
        "email": "sales@mechanicalenterprise.com", "url": BASE,
        "areaServed": { "@type": "City", "name": `${area}, New Jersey` },
        "priceRange": "Free Assessment", "openingHours": "Mo-Su 00:00-23:59",
        "description": `Premium heat pump and HVAC installation in ${area} NJ. Carrier, Trane, Lennox systems with NJ rebates up to $16,000.`,
      }) }} />
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[440px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1a2d4a]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-sm uppercase tracking-widest text-white/50 mb-4">{county} County, New Jersey</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Premium HVAC Installation in {area}, NJ
            </h1>
            <p className="text-lg md:text-xl text-white/75 mb-8 leading-relaxed max-w-2xl mx-auto">
              Whole-home comfort systems · Smart zoning · Top-tier brands · NJ rebates up to $16,000
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-6 text-lg w-full sm:w-auto">
                  💰 Check My Rebate Eligibility
                </Button>
              </a>
              <a href={BASE}>
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  📅 Book Free Consultation
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 bg-white border-b">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-center">
            {[
              { big: "Up to $16,000", small: "NJ Rebates Available" },
              { big: "Up to $2,000", small: "Federal Tax Credit" },
              { big: "Free", small: "Consultation & Design" },
              { big: "Premium Brands", small: "Carrier · Trane · Lennox" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-bold text-[#0a1628]">{s.big}</div>
                <div className="text-sm text-gray-500 mt-1">{s.small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Systems */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#0a1628] mb-4 text-center">
              Premium Systems for {area} Homes
            </h2>
            <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
              {area} homeowners choose Mechanical Enterprise for premium heat pump and HVAC systems from top brands. We design custom whole-home comfort solutions with smart zoning, remote monitoring, and maximum efficiency.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {PREMIUM_SYSTEMS.map((sys, i) => (
                <Card key={i} className="border-l-4 border-l-[#0a1628]">
                  <CardContent className="pt-6">
                    <h3 className="font-bold text-lg text-[#0a1628] mb-2">{sys.brand}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{sys.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rebate Section */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#0a1628] mb-3">Rebates & Tax Credits</h2>
            <p className="text-gray-600 mb-8">Even premium systems qualify for full NJ rebates. Most {area} homeowners receive $16,000+ in combined rebates and tax credits.</p>
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
            <p className="text-xs text-gray-400 mb-6">* Eligibility depends on equipment, property type, and utility provider.</p>
            <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-5 text-base">
                Check My Eligibility <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-[#0a1628]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-white mb-10">
            Why {area} Homeowners Choose Us
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: "🏠", title: "Custom Whole-Home Design", desc: `We design complete comfort systems tailored to ${area} properties — not one-size-fits-all solutions.` },
              { icon: "💰", title: "Full Rebate Maximization", desc: "We handle all rebate paperwork and ensure you receive every dollar you're entitled to." },
              { icon: "⚡", title: "Premium Brand Specialists", desc: "Factory-trained on Carrier, Trane, and Lennox premium product lines." },
              { icon: "📞", title: "Dedicated Project Manager", desc: `Your ${area} installation gets a single point of contact from consultation through completion.` },
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

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">
            Frequently Asked Questions — {area}, NJ
          </h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-50 rounded-lg border overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 font-semibold text-[#0a1628] flex justify-between items-center hover:bg-gray-100 transition-colors">
                  <span className="pr-4">{faq.q}</span>
                  <span className="text-[#e8813a] text-xl shrink-0">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t pt-4">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#e8813a]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Schedule Your Free Consultation</h2>
            <p className="text-lg text-white/90 mb-8">No cost. No obligation. We come to you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={BASE}>
                <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg w-full sm:w-auto">
                  📅 Book Free Consultation <ArrowRight className="ml-2 h-5 w-5" />
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
