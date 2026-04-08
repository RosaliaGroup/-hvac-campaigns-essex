import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle, Phone, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";

const BASE = "https://mechanicalenterprise.com";
const REBATE_URL = `${BASE}/rebate-calculator`;
const PHONE = "(862) 423-9396";
const PHONE_TEL = "tel:+18624239396";

type CompetitorPageProps = {
  competitor: string;
  slug: string;
};

const COMPARISON_ROWS = [
  { feature: "Free Assessment", us: "Always free", them: "Fees apply", usGood: true, themGood: false },
  { feature: "NJ Rebate Assistance", us: "Up to $16,000", them: "Limited", usGood: true, themGood: null },
  { feature: "Federal Tax Credit Help", us: "Up to $2,000", them: "Varies", usGood: true, themGood: null },
  { feature: "Rebate Paperwork", us: "We handle it all", them: "You handle it", usGood: true, themGood: false },
  { feature: "Local Newark Based", us: "Newark, NJ", them: "Regional chain", usGood: true, themGood: false },
  { feature: "WMBE/SBE Certified", us: "Certified", them: "No", usGood: true, themGood: false },
  { feature: "Installation Focus", us: "Specialists", them: "Service calls", usGood: true, themGood: null },
];

const WHY_CARDS = [
  { icon: "💰", title: "Rebate Specialists", desc: "We specialize in NJ rebate programs. Most competitors don't maximize your rebate eligibility — we do." },
  { icon: "📋", title: "We Handle Everything", desc: "Assessment, installation, permits, all rebate paperwork done for you. No runaround, no surprises." },
  { icon: "🏘️", title: "Local Newark Business", desc: "We're based in Newark and serve our community. Not a regional chain with a call center." },
  { icon: "⚡", title: "Installation Specialists", desc: "We focus on heat pump and HVAC installations — not just service calls. We're here to upgrade your system." },
];

// Unique per-competitor content for SEO depth
const COMPETITOR_CONTENT: Record<string, string[]> = {
  "aj-perri": [
    "A.J. Perri is a well-known regional HVAC and plumbing company that has served New Jersey homeowners for decades. As a large operation with multiple service vans across the state, they offer broad coverage but operate more like a general service company than a specialized installation firm. If you're considering A.J. Perri for a new heat pump or HVAC system, it's worth understanding how the experience differs from working with a local, installation-focused contractor like Mechanical Enterprise.",
    "The biggest difference between Mechanical Enterprise and A.J. Perri is our approach to NJ rebates and incentives. Mechanical Enterprise was built around the NJ Clean Energy rebate programs — it's the core of what we do. We assess every property for maximum rebate qualification, select equipment specifically to hit the highest rebate tiers, and file all PSE&G and NJ Clean Energy paperwork on your behalf at no extra charge. Many of our customers qualify for $8,000 to $16,000 in NJ rebates plus the $2,000 federal tax credit. A.J. Perri offers HVAC installation among many other services, but rebate optimization is not their primary focus — homeowners often end up handling their own rebate paperwork or not qualifying for the maximum amounts.",
    "Pricing transparency is another key differentiator. Mechanical Enterprise provides detailed written quotes showing equipment costs, labor, permits, and exact rebate amounts you can expect — so you know your true out-of-pocket cost before committing. With NJ's On-Bill Repayment (OBR) program, many of our customers pay $0 upfront and repay through their utility bill at zero interest. A.J. Perri uses a flat-rate pricing model that can make it harder to understand exactly what you're paying for. Their diagnostic fees, which typically range from $80 to $120, are charged even for assessment visits — Mechanical Enterprise assessments are always 100% free.",
    "Mechanical Enterprise is a WMBE (Women/Minority Business Enterprise) and SBE (Small Business Enterprise) certified contractor, meaning we meet rigorous state certification standards. We are locally based in Newark, NJ and serve 15 NJ counties. Our team focuses exclusively on HVAC installation and system upgrades — we don't do general plumbing, drain cleaning, or appliance repair. This specialization means every installation gets our full engineering attention. When you call Mechanical Enterprise, you talk to the people who will actually install your system — not a call center.",
  ],
};

function StatusIcon({ good }: { good: boolean | null }) {
  if (good === true) return <CheckCircle className="h-5 w-5 text-green-600 inline mr-1.5 shrink-0" />;
  if (good === false) return <XCircle className="h-5 w-5 text-red-500 inline mr-1.5 shrink-0" />;
  return <AlertTriangle className="h-5 w-5 text-yellow-500 inline mr-1.5 shrink-0" />;
}

export default function CompetitorPage({ competitor, slug }: CompetitorPageProps) {
  useSEO({
    title: `${competitor} Alternative NJ | Free Assessment & $16K Rebates | Mechanical Enterprise`,
    description: `Looking for an alternative to ${competitor} in NJ? Mechanical Enterprise offers free HVAC assessments, NJ rebates up to $16,000, and local Newark-based service. Call ${PHONE}.`,
    ogUrl: `${BASE}/vs-${slug}`,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: `How does Mechanical Enterprise compare to ${competitor}?`,
      a: `Mechanical Enterprise is a Newark-based HVAC installation specialist focused on heat pumps and system upgrades. We offer free assessments and specialize in maximizing NJ rebates up to $16,000 for qualifying homeowners.`,
    },
    {
      q: `Why should I choose Mechanical Enterprise over ${competitor}?`,
      a: `We're locally based in Newark, WMBE/SBE certified, and focused on installation and rebate maximization — not just service calls. Our assessments are always free.`,
    },
    {
      q: `Does Mechanical Enterprise offer better rebates than ${competitor}?`,
      a: `We specialize in NJ rebate programs and handle all paperwork for you. Many homeowners qualify for up to $16,000 in NJ rebates plus a $2,000 federal tax credit.`,
    },
    {
      q: `How do I get started with Mechanical Enterprise?`,
      a: `Book a free assessment online or call ${PHONE}. We come to you, assess your system, and show you exactly what rebates you qualify for — no cost, no obligation.`,
    },
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "HVACBusiness",
        "name": "Mechanical Enterprise LLC",
        "telephone": PHONE,
        "email": "sales@mechanicalenterprise.com",
        "url": BASE,
        "address": { "@type": "PostalAddress", "addressLocality": "Newark", "addressRegion": "NJ", "addressCountry": "US" },
        "areaServed": "New Jersey",
        "priceRange": "$100-$275",
        "openingHours": "Mo-Su 00:00-23:59",
        "description": `Expert HVAC solutions in NJ. Heat pumps, VRV/VRF systems, free assessments with rebates up to $16,000. Alternative to ${competitor}.`,
      }) }} />
      <Navigation />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[420px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Looking for an Alternative to {competitor} in NJ?
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 leading-relaxed max-w-2xl mx-auto">
              Mechanical Enterprise offers free assessments, NJ rebates up to $16,000, and local Newark-based service with no large-company runaround.
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

      {/* ── Comparison Table ──────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0a1628] mb-10">
            Mechanical Enterprise vs {competitor}
          </h2>
          <div className="max-w-3xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#0a1628] text-white">
                  <th className="text-left p-4 font-semibold text-sm">Feature</th>
                  <th className="text-left p-4 font-semibold text-sm">Mechanical Enterprise</th>
                  <th className="text-left p-4 font-semibold text-sm">{competitor}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="p-4 text-sm font-medium text-[#0a1628]">{row.feature}</td>
                    <td className="p-4 text-sm">
                      <span className="flex items-center">
                        <StatusIcon good={row.usGood} />
                        <span className="text-green-700 font-medium">{row.us}</span>
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <span className="flex items-center">
                        <StatusIcon good={row.themGood} />
                        <span className="text-gray-600">{row.them}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Competitor information based on publicly available data. We encourage you to compare all options before deciding.
            </p>
          </div>
        </div>
      </section>

      {/* ── Detailed Comparison Content ──────────────────────────── */}
      {COMPETITOR_CONTENT[slug] && (
        <section className="py-12 bg-gray-50">
          <div className="container">
            <div className="max-w-3xl mx-auto prose prose-gray">
              <h2 className="text-2xl font-bold text-[#0a1628] mb-6">
                Mechanical Enterprise vs {competitor}: A Detailed Comparison
              </h2>
              {COMPETITOR_CONTENT[slug].map((para, i) => (
                <p key={i} className="text-gray-700 leading-relaxed mb-4">{para}</p>
              ))}
              <div className="not-prose mt-6">
                <a href={REBATE_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-[#e8813a] hover:bg-[#d5732f] text-white">
                    Get a Free Assessment — See the Difference <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Why Choose Us ─────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#0a1628] mb-10">
            Why NJ Homeowners Choose Us
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {WHY_CARDS.map((card, i) => (
              <Card key={i} className="border-t-4 border-t-[#e8813a]">
                <CardContent className="pt-6">
                  <div className="text-3xl mb-3">{card.icon}</div>
                  <h3 className="font-bold text-lg text-[#0a1628] mb-2">{card.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{card.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rebate Breakdown ──────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-8">
              Available Rebates & Credits
            </h2>
            <div className="rounded-xl overflow-hidden border-2 border-[#e8813a]">
              <div className="flex justify-between items-center p-5 bg-gray-50 border-b">
                <span className="font-medium text-[#0a1628]">Federal Tax Credit (IRA)</span>
                <span className="font-bold text-lg text-[#e8813a]">Up to $2,000</span>
              </div>
              <div className="flex justify-between items-center p-5">
                <span className="font-medium text-[#0a1628]">NJ State Rebates</span>
                <span className="font-bold text-lg text-[#e8813a]">Up to $16,000</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Most competitors don't specialize in rebate maximization. We do — and we handle all the paperwork for free.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">
            Frequently Asked Questions
          </h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-lg border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 font-semibold text-[#0a1628] flex justify-between items-center hover:bg-gray-50 transition-colors"
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
              Get Your Free Assessment Today
            </h2>
            <p className="text-lg text-white/90 mb-8">
              No cost. No obligation. We come to you.
            </p>
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
