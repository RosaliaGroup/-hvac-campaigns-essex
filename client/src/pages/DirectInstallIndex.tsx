import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { directInstallIndustries, INDUSTRY_CATEGORIES } from "@/data/directInstallIndustries";

const BASE = "https://mechanicalenterprise.com";
const PHONE = "(862) 419-1763";
const PHONE_TEL = "tel:+18624191763";

export default function DirectInstallIndex() {
  useSEO({
    title: "NJ Direct Install Program \u2014 Every Industry Qualifies | Mechanical Enterprise",
    description: "NJ Direct Install covers 100% of commercial lighting and up to 80% of HVAC for every industry. Browse by category. Free assessment. PSE&G Trade Ally PN#136.",
    ogUrl: `${BASE}/direct-install`,
  });

  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#e8813a] text-white hover:bg-[#e8813a]/90 text-sm px-4 py-1.5">NJ Direct Install Program</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Every Industry Qualifies</h1>
            <p className="text-lg text-white/75 mb-4">Lighting 100% free. HVAC up to 80% covered. OBR for balance. We handle all paperwork.</p>
            <p className="text-sm text-white/50">PSE&G Trade Ally PN#136 | WMBE Certified | SBE Certified</p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            {INDUSTRY_CATEGORIES.map((category) => {
              const pages = directInstallIndustries.filter((p) => p.category === category);
              if (pages.length === 0) return null;
              return (
                <div key={category} className="mb-12">
                  <h2 className="text-2xl font-bold text-[#0a1628] mb-4 border-b-2 border-[#e8813a] pb-2 inline-block">{category}</h2>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                    {pages.map((page) => (
                      <Link key={page.slug} href={`/direct-install/${page.slug}`}>
                        <div className="bg-white rounded-lg border px-4 py-3 text-sm font-medium text-[#0a1628] hover:border-[#e8813a] hover:text-[#e8813a] transition-colors cursor-pointer">
                          {page.industry}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#e8813a]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Don't See Your Industry?</h2>
            <p className="text-lg text-white/90 mb-8">If you have a commercial electric meter in NJ, you almost certainly qualify. Call us.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={`${BASE}/commercial`}>
                <Button size="lg" className="bg-[#0a1628] hover:bg-[#0a1628]/90 text-white px-8 py-6 text-lg w-full sm:w-auto">
                  Free Assessment <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
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

      <Footer />
    </div>
  );
}
