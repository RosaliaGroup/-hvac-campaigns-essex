import { Button } from "@/components/ui/button";
import { Phone, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";
import type { SeoLandingPageData } from "@/data/seoLandingPages";

/**
 * SeoLandingPage — data-driven service/repair landing page.
 *
 * Renders one of the SEO landing pages defined in `@/data/seoLandingPages`.
 * Design mirrors ServicePage.tsx (same Tailwind design system, Navigation,
 * Footer, useSEO) so it stays visually consistent and inherits the site's
 * responsive + accessibility behavior.
 *
 * Structured data: emits Service + FAQPage JSON-LD ONLY. The Netlify edge
 * function (netlify/edge-functions/inject-meta.ts) already injects the
 * HVACBusiness (LocalBusiness) and BreadcrumbList schema for every route, so
 * we deliberately do NOT re-emit those here to avoid duplicate nodes.
 *
 * NOTE (documented placeholders — see phase2/03-manifest.json):
 * Review rating/count, HVAC license number, and street address are NOT
 * displayed because no verified value exists in the codebase. They must be
 * supplied before any review/rating/license/address claim is added.
 */

const BASE = "https://mechanicalenterprise.com";
const REBATE_URL = `${BASE}/rebate-calculator`;
const PHONE_RESIDENTIAL = "(862) 423-9396";
const PHONE_RESIDENTIAL_TEL = "tel:+18624239396";
const PHONE_COMMERCIAL = "(862) 419-1763";
const PHONE_COMMERCIAL_TEL = "tel:+18624191763";

const WHY_US_RESIDENTIAL = [
  { icon: "⚡", title: "Fast, Local Response", desc: "Same-day and 24/7 emergency service across New Jersey. Based in Newark, serving all of NJ." },
  { icon: "🧰", title: "All Makes & Models", desc: "Factory-trained on every major brand. Honest diagnosis and an upfront price before we start." },
  { icon: "💰", title: "Repair or Upgrade — We Maximize Rebates", desc: "If replacement makes sense, we unlock every NJ rebate and federal tax credit you qualify for." },
  { icon: "🛡️", title: "Licensed & Insured", desc: "Fully licensed, bonded, and insured NJ contractor. WMBE/SBE certified. Warrantied workmanship." },
];

const WHY_US_COMMERCIAL = [
  { icon: "⏱️", title: "Minimized Downtime", desc: "Priority response and service agreements that keep your facility running. 24/7 emergency coverage." },
  { icon: "🏢", title: "Every Property Type", desc: "Offices, retail, restaurants, warehouses, and industrial facilities across New Jersey." },
  { icon: "💰", title: "Direct Install & Incentives", desc: "PSE&G Direct Install can cover up to 80% of qualifying commercial upgrades. We handle the paperwork." },
  { icon: "🛡️", title: "Licensed, Insured & Certified", desc: "Fully licensed NJ commercial contractor. WMBE/SBE certified. PSE&G Trade Ally." },
];

export default function SeoLandingPage({ data }: { data: SeoLandingPageData }) {
  const isCommercial = data.category === "commercial";
  const phone = isCommercial ? PHONE_COMMERCIAL : PHONE_RESIDENTIAL;
  const phoneTel = isCommercial ? PHONE_COMMERCIAL_TEL : PHONE_RESIDENTIAL_TEL;
  const whyUs = isCommercial ? WHY_US_COMMERCIAL : WHY_US_RESIDENTIAL;
  const canonical = `${BASE}/${data.slug}`;

  useSEO({
    title: data.metaTitle,
    description: data.metaDescription,
    ogUrl: canonical,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": data.serviceType,
    "name": data.service,
    "description": data.metaDescription,
    "areaServed": { "@type": "State", "name": "New Jersey" },
    "provider": {
      "@type": "HVACBusiness",
      "name": "Mechanical Enterprise LLC",
      "telephone": phone,
      "url": BASE,
      "areaServed": "New Jersey",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": data.faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  const stats = isCommercial
    ? [
        { big: "24/7", small: "Emergency Service" },
        { big: "Up to 80%", small: "Covered by Direct Install" },
        { big: "All Property Types", small: "Office to Industrial" },
        { big: "Licensed & Insured", small: "NJ Contractor" },
      ]
    : [
        { big: "Same-Day", small: "Service Available" },
        { big: "All Makes", small: "& Models" },
        { big: "Up to $16,000", small: "NJ Rebates on Upgrades" },
        { big: "Licensed & Insured", small: "NJ Contractor" },
      ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[440px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#e8813a] mb-4">
              {isCommercial ? "Commercial HVAC · New Jersey" : "Residential HVAC · New Jersey"}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{data.h1}</h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">{data.heroSub}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={phoneTel}>
                <Button size="lg" className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-6 text-lg w-full sm:w-auto">
                  <Phone className="mr-2 h-5 w-5" /> Call {phone}
                </Button>
              </a>
              <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  💰 Check Rebate Eligibility
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
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-3xl font-bold text-[#e8813a]">{s.big}</div>
                <div className="text-sm text-gray-500 mt-1">{s.small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intro + Service Cards */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0a1628] mb-6">{data.introHeading}</h2>
            <p className="text-gray-600 leading-relaxed text-lg">{data.intro}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {data.cards.map((c, i) => (
              <div key={i} className="bg-white rounded-xl border p-6 shadow-sm">
                <div className="text-3xl mb-3" aria-hidden="true">{c.icon}</div>
                <h3 className="font-bold text-lg text-[#0a1628] mb-2">{c.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-[#0a1628]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-white mb-10">
            Why New Jersey {isCommercial ? "Businesses" : "Homeowners"} Choose Mechanical Enterprise
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {whyUs.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="text-3xl shrink-0" aria-hidden="true">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Financing + Rebates */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="rounded-xl p-8 bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#e8813a] mb-2">Financing</p>
              <h3 className="text-2xl font-bold mb-3">Flexible Payment Options</h3>
              <p className="text-white/80 leading-relaxed mb-4">
                Comfort shouldn't wait for payday. Ask about financing on qualifying repairs and full-system replacements —
                so you can approve the fix today and pay over time.
              </p>
              <a href={phoneTel}>
                <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white">Ask About Financing</Button>
              </a>
            </div>
            <div className="rounded-xl p-8 bg-gradient-to-br from-[#1f7a41] to-[#146130] text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/90 mb-2">Rebates &amp; Tax Credits</p>
              <h3 className="text-2xl font-bold mb-3">
                {isCommercial ? "Up to 80% Covered" : "Up to $16,000 in NJ Rebates"}
              </h3>
              <p className="text-white/85 leading-relaxed mb-4">
                {isCommercial
                  ? "If your repair leads to an upgrade, PSE&G Direct Install can cover up to 80% of qualifying commercial HVAC costs. We handle the paperwork."
                  : "When replacement is the smart call, NJ rebates up to $16,000 plus a federal tax credit up to $2,000 can dramatically cut your cost. We handle every application."}
              </p>
              <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                <Button className="bg-white text-[#146130] hover:bg-white/90">See What You Qualify For</Button>
              </a>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-6 text-center max-w-3xl mx-auto">
            * Rebate and incentive eligibility depends on equipment, property type, and utility provider. We confirm exactly
            what you qualify for at no cost during your assessment.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {data.faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-lg border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="w-full text-left p-5 font-semibold text-[#0a1628] flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="pr-4">{faq.q}</span>
                  <span className="text-[#e8813a] text-xl shrink-0" aria-hidden="true">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t pt-4">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-2xl font-bold text-center text-[#0a1628] mb-8">Explore Related HVAC Services</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {data.related.map((l, i) => (
              <Link
                key={i}
                href={l.href}
                className="block bg-[#f7f8fa] border rounded-lg p-4 hover:border-[#e8813a] transition-colors"
              >
                <div className="font-semibold text-[#0a1628]">{l.label}</div>
                <div className="text-sm text-gray-500 mt-1">{l.sub}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#e8813a]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{data.ctaHeading}</h2>
            <p className="text-lg text-white/90 mb-8">{data.ctaSub}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={phoneTel}>
                <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg w-full sm:w-auto">
                  <Phone className="mr-2 h-5 w-5" /> Call {phone}
                </Button>
              </a>
              <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  Check Rebate Eligibility <ArrowRight className="ml-2 h-5 w-5" />
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
