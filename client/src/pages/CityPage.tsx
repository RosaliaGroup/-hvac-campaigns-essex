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
const PHONE = "(862) 419-1763";
const PHONE_TEL = "tel:+18624191763";

type CityPageProps = { city: string; slug: string };

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
