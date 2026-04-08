import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";

const BASE = "https://mechanicalenterprise.com";
const REBATE_URL = `${BASE}/rebate-calculator`;
const PHONE = "(862) 423-9396";
const PHONE_TEL = "tel:+18624239396";

type ServicePageProps = { service: string; slug: string; description: string };

export default function ServicePage({ service, slug, description }: ServicePageProps) {
  useSEO({
    title: `${service} Installation NJ | Free Assessment & Rebates | Mechanical Enterprise`,
    description: `${service} installation in NJ. Free assessment, rebates up to $16,000, federal tax credit up to $2,000. Licensed NJ contractor. Call ${PHONE}.`,
    ogUrl: `${BASE}/${slug}`,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: `How much does ${service.toLowerCase()} installation cost in NJ?`, a: `Costs vary by system size and property. With NJ rebates up to $16,000 and a federal tax credit up to $2,000, many NJ homeowners significantly reduce their out-of-pocket cost. Book a free assessment to get your exact numbers.` },
    { q: `What rebates are available for ${service.toLowerCase()} installation in NJ?`, a: `NJ homeowners may qualify for state rebates up to $16,000 plus a federal tax credit up to $2,000. Eligibility depends on your equipment and property. We assess your exact eligibility for free.` },
    { q: `How long does ${service.toLowerCase()} installation take?`, a: `Most residential installations take 1-2 days. We handle all permits, inspections, and rebate paperwork so you don't have to.` },
    { q: `Do you handle the rebate paperwork for ${service.toLowerCase()} installation?`, a: `Yes — we handle 100% of the rebate paperwork for you. Assessment, installation, permits, and all rebate applications are included at no extra charge.` },
    { q: `How do I get started with ${service.toLowerCase()} installation?`, a: `Call ${PHONE} or book online. We come to your property, assess your system, and show you every rebate you qualify for — completely free, no obligation.` },
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HVACBusiness",
        "name": "Mechanical Enterprise LLC", "telephone": PHONE,
        "email": "sales@mechanicalenterprise.com", "url": BASE,
        "areaServed": "New Jersey", "priceRange": "Free Assessment",
        "openingHours": "Mo-Su 00:00-23:59",
        "description": `${service} installation in NJ. Free assessments, NJ rebates up to $16,000, federal tax credit up to $2,000.`,
      }) }} />
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[440px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              {service} Installation in New Jersey
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

      {/* Stats Bar */}
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

      {/* Service Detail */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-[#0a1628] mb-6 text-center">
              About {service} Installation
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg text-center mb-8">{description}</p>
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
            <p className="text-xs text-gray-400 mb-6 text-center">
              * Rebate eligibility depends on equipment, property type, and utility provider. We determine exactly what you qualify for at no cost during your free assessment.
            </p>
            <div className="text-center">
              <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-5 text-base">
                  Check My Eligibility <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-[#0a1628]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-white mb-10">
            Why NJ Homeowners Choose Mechanical Enterprise
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: "📋", title: "We Handle Everything", desc: "Assessment, installation, permits, and all rebate paperwork — done for you." },
              { icon: "💰", title: "Maximize Your Rebates", desc: "We know every NJ rebate program and make sure you get every dollar you're entitled to." },
              { icon: "⚡", title: "Licensed NJ Contractor", desc: "Fully licensed, bonded, and insured. WMBE/SBE certified. Serving NJ since day one." },
              { icon: "📞", title: "Local & Responsive", desc: `Based in Newark. Serving all of NJ. Call ${PHONE}.` },
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
            Frequently Asked Questions
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get Your Free Assessment Today</h2>
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
