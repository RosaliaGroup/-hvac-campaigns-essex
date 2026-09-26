import { Button } from "@/components/ui/button";
import { Phone, ArrowRight, ShieldCheck } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import InlineLeadCapture from "@/components/InlineLeadCapture";
import BuyFinanceMemberComparison from "@/components/BuyFinanceMemberComparison";
import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";
import { VERIFIED_FACTS } from "@shared/verifiedFacts";

/**
 * docs/positioning-warranty-spec.md §3. Body copy is the spec's verbatim
 * text; two FAQ answers and the terms-disclosure line carry visible
 * [CONFIRM] placeholders the owner must resolve before merge (spec §8 —
 * PR checklist blocks merge until they're filled).
 *
 * Meta description is trimmed from the spec's literal text (170 chars) to
 * fit the site's 155-char meta limit (shared/seoLinter.ts's meta_too_long
 * rule) without changing its meaning.
 */
const BASE = "https://mechanicalenterprise.com";
const PHONE = "(862) 423-9396";
const PHONE_TEL = "tel:+18624239396";
const { warranty } = VERIFIED_FACTS;

export default function Warranty() {
  useSEO({
    title: "10-Year Parts & Labor HVAC Coverage | Mechanical Enterprise",
    description: "Optional 10-year parts & labor coverage for new HVAC installs and qualifying existing systems in NJ. No deductible on covered repairs. Call (862) 423-9396.",
    ogUrl: `${BASE}/warranty`,
  });

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: "Is coverage required?", a: "No. It's an optional add-on, quoted with your installation or after an eligibility inspection." },
    { q: "Does coverage transfer if I sell the property?", a: "[CONFIRM WITH PROVIDER TERMS — typical programs allow one transfer.]" },
    { q: "Is maintenance required?", a: "[CONFIRM — if the program requires annual maintenance, state it here.]" },
    { q: "How do I file a claim?", a: `Call Mechanical Enterprise at ${PHONE}. We diagnose the issue, confirm coverage with the administrator, and complete the repair.` },
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "Service",
        "serviceType": warranty.headline,
        "provider": { "@type": "HVACBusiness", "name": "Mechanical Enterprise LLC", "telephone": PHONE, "url": BASE },
        "areaServed": "New Jersey",
        "description": "Optional 10-year parts and labor coverage for new HVAC installations and qualifying existing systems in New Jersey.",
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": faqs.map((faq) => ({
          "@type": "Question", "name": faq.q,
          "acceptedAnswer": { "@type": "Answer", "text": faq.a },
        })),
      }) }} />
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[400px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-white/90" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              10-Year Parts &amp; Labor Coverage for Your HVAC System
            </h1>
            <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto">
              Optional extended coverage for new installations and for qualifying existing systems — so a compressor,
              control board or blower failure in year six doesn't become a four-figure bill.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-3xl mx-auto space-y-12">
            <div>
              <h2 className="text-2xl font-bold text-[#0a1628] mb-4">What it covers</h2>
              <p className="text-gray-600 leading-relaxed">
                Parts and labor for covered repairs on the enrolled equipment for 10 years from the coverage start
                date. No deductible on covered claims. Available for all major brands.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0a1628] mb-4">Who can enroll</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                <strong>New installations.</strong> Any system installed by Mechanical Enterprise can add coverage at
                the time of installation or within the enrollment window stated in your agreement.
              </p>
              <p className="text-gray-600 leading-relaxed">
                <strong>Existing systems.</strong> Coverage may be available for equipment we didn't install, subject
                to an eligibility inspection. Systems must be in good working condition and meet the program's age
                and maintenance criteria. We'll tell you at the inspection whether the system qualifies and what the
                coverage costs.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0a1628] mb-4">How it works</h2>
              <p className="text-gray-600 leading-relaxed">
                Coverage is provided through a third-party extended service agreement backed by A-rated insurers and
                administered independently of Mechanical Enterprise. You receive the written agreement at enrollment;
                it is the governing document and lists exact terms, exclusions and the claims process. Covered
                repairs are performed by Mechanical Enterprise.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0a1628] mb-4">What it doesn't cover</h2>
              <p className="text-gray-600 leading-relaxed">
                Routine maintenance, filters and consumables, refrigerant top-offs not tied to a covered repair,
                damage from neglect, accident or improper use, and pre-existing conditions on existing equipment. See
                the written agreement for the full list.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Buy / finance / member comparison (docs/positioning-warranty-spec.md §9a) */}
      <BuyFinanceMemberComparison />

      {/* Comfort Membership quote CTA */}
      <section className="py-12 bg-white">
        <div className="container">
          <div className="max-w-lg mx-auto">
            <InlineLeadCapture
              variant="membership"
              pageContext="warranty-membership"
              defaultService="Comfort Membership"
              formType="membership_quote"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold text-center text-[#0a1628] mb-10">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-lg border overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-5 font-semibold text-[#0a1628] flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <span className="pr-4">{faq.q}</span>
                  <span className="text-[#1e3a5f] text-xl shrink-0">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t pt-4">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section className="py-16 bg-white" id="quote">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <h2 className="text-3xl font-bold text-[#0a1628] mb-4">Pricing</h2>
            <p className="text-gray-600 leading-relaxed">
              Coverage is priced per system and quoted with your installation or after the eligibility inspection.
            </p>
          </div>
          <div className="max-w-lg mx-auto">
            <InlineLeadCapture
              variant="warranty"
              pageContext="warranty"
              defaultService="Warranty Coverage"
              formType="warranty_quote"
              title="Request a Coverage Quote"
            />
          </div>
        </div>
      </section>

      {/* Terms disclosure */}
      <section className="py-8 bg-[#f7f8fa] border-t">
        <div className="container">
          <p className="max-w-2xl mx-auto text-xs text-gray-500 text-center leading-relaxed">
            Terms disclosure: Extended service agreements are administered by [PROVIDER LEGAL NAME] and underwritten
            by [INSURER(S) AS STATED IN THE AGREEMENT]. Full terms: [link to provider terms PDF].
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-[#1e3a5f]">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Questions About Coverage?</h2>
            <p className="text-lg text-white/90 mb-8">Call us — we'll walk you through eligibility and pricing.</p>
            <a href={PHONE_TEL}>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                <Phone className="mr-2 h-5 w-5" /> Call {PHONE} <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
