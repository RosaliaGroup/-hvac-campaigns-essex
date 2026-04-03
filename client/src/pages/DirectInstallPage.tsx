import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";
import { directInstallIndustries, type IndustryPage } from "@/data/directInstallIndustries";
import { Redirect } from "wouter";

const BASE = "https://mechanicalenterprise.com";
const COMMERCIAL_URL = `${BASE}/commercial`;
const PHONE = "(862) 419-1763";
const PHONE_TEL = "tel:+18624191763";

export default function DirectInstallPage({ slug }: { slug: string }) {
  const page = directInstallIndustries.find((p) => p.slug === slug);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useSEO({
    title: page?.title ?? "NJ Direct Install Program | Mechanical Enterprise",
    description: page?.meta ?? "NJ Direct Install Program covers 100% of lighting and up to 80% of HVAC. Free assessment.",
    ogUrl: `${BASE}/direct-install/${slug}`,
  });

  if (!page) return <Redirect to="/direct-install" />;

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "HVACBusiness",
        "name": "Mechanical Enterprise LLC", "telephone": PHONE,
        "email": "sales@mechanicalenterprise.com", "url": BASE,
        "areaServed": "New Jersey", "priceRange": "Free Assessment",
        "openingHours": "Mo-Su 00:00-23:59",
        "description": page.meta,
      }) }} />
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[420px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#e8813a] text-white hover:bg-[#e8813a]/90 text-sm px-4 py-1.5">NJ Direct Install Program</Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">{page.h1}</h1>
            <p className="text-lg text-white/75 mb-8 max-w-2xl mx-auto">Lighting 100% free · HVAC up to 80% covered · OBR for balance · PSE&G Trade Ally </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={COMMERCIAL_URL}>
                <Button size="lg" className="bg-[#e8813a] hover:bg-[#d5732f] text-white px-8 py-6 text-lg w-full sm:w-auto">Free Commercial Assessment</Button>
              </a>
              <a href={PHONE_TEL}>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg w-full sm:w-auto">
                  <Phone className="mr-2 h-5 w-5" /> {PHONE}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage Cards */}
      <section className="py-12 bg-white">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="border-t-4 border-t-[#e8813a] text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-[#e8813a] mb-1">100%</div>
                <div className="font-semibold text-[#0a1628] mb-2">Lighting Covered</div>
                <p className="text-sm text-gray-500">$0 cost, no OBR. Interior + exterior + parking.</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-[#0a1628] text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-[#0a1628] mb-1">80%</div>
                <div className="font-semibold text-[#0a1628] mb-2">HVAC Covered</div>
                <p className="text-sm text-gray-500">Balance on OBR. Heat pumps, VRV/VRF, RTU.</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-green-500 text-center">
              <CardContent className="pt-6">
                <div className="text-4xl font-bold text-green-600 mb-1">Free</div>
                <div className="font-semibold text-[#0a1628] mb-2">Assessment</div>
                <p className="text-sm text-gray-500">We handle all paperwork. No obligation.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">How Direct Install Works for {page.industry}</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {[
              { step: "1", title: "Free Assessment", desc: `We visit your ${page.industry.toLowerCase()} facility, evaluate lighting and HVAC, and calculate your exact coverage amounts.` },
              { step: "2", title: "Program Application", desc: "We submit the Direct Install application on your behalf. You don't fill out a single form." },
              { step: "3", title: "Installation", desc: "Lighting is replaced with LED at 100% coverage. HVAC is upgraded with up to 80% covered. We schedule around your hours." },
              { step: "4", title: "Savings Start", desc: "Energy savings begin immediately. Any HVAC balance goes on OBR at 0% interest — typically less than your energy savings." },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="bg-[#e8813a] text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0">{s.step}</div>
                <div>
                  <h3 className="font-bold text-lg text-[#0a1628]">{s.title}</h3>
                  <p className="text-gray-600 text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-16 bg-[#0a1628]">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-white mb-10">Why {page.industry} Choose Mechanical Enterprise</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: "💡", title: "100% Free Lighting", desc: "Every qualifying fixture replaced with LED at zero cost. No OBR, no financing, no catch." },
              { icon: "❄️", title: "80% HVAC Coverage", desc: "Up to 80% of HVAC replacement covered. Remaining balance on OBR at 0% interest." },
              { icon: "📋", title: "We Handle Everything", desc: "Assessment, application, installation, and all paperwork. PSE&G Trade Ally ." },
              { icon: "🏢", title: "Portfolio Qualified", desc: "Multiple buildings? Each one qualifies separately. We coordinate multi-site rollouts." },
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="text-3xl shrink-0">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-white/70">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {page.faqs.map((faq, i) => (
              <div key={i} className="bg-gray-50 rounded-lg border overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 font-semibold text-[#0a1628] flex justify-between items-center hover:bg-gray-100 transition-colors">
                  <span className="pr-4">{faq.q}</span>
                  <span className="text-[#e8813a] text-xl shrink-0">{openFaq === i ? "\u2212" : "+"}</span>
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t pt-4">{faq.a}</div>}
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
            <p className="text-lg text-white/90 mb-2">No cost. No obligation. We come to you.</p>
            <p className="text-sm text-white/70 mb-8">PSE&G Trade Ally | WMBE Certified | SBE Certified</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={COMMERCIAL_URL}>
                <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg w-full sm:w-auto">
                  Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
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
