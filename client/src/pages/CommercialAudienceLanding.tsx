import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PortfolioPricingRequestForm from "@/components/PortfolioPricingRequestForm";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";

type Audience = "property-management" | "contractors-developers" | "commercial-partners";
const CONTENT: Record<Audience, { title: string; description: string; eyebrow: string; benefits: string[]; related: string }> = {
  "property-management": {
    eyebrow: "Property managers, condo boards & multifamily owners",
    title: "HVAC Service for NJ Property Portfolios",
    description: "Request a portfolio HVAC review for preventive maintenance, emergency service, PTAC replacements and capital planning across multiple buildings.",
    benefits: ["Multi-building maintenance and service coordination", "PTAC, heat pump, RTU and VRF replacement planning", "Condition reporting and utility incentive eligibility review"],
    related: "/commercial/property-managers",
  },
  "contractors-developers": {
    eyebrow: "General contractors & developers",
    title: "NJ Commercial HVAC Subcontracting Partner",
    description: "Share your project scope for HVAC installation, equipment replacement, retrofit work or bid support. We review plans and scheduling needs before proposing a scope.",
    benefits: ["Commercial and multifamily mechanical scopes", "Equipment selection and replacement planning", "Bid review, coordination and project scheduling"],
    related: "/commercial/hvac-service-contracts",
  },
  "commercial-partners": {
    eyebrow: "Commercial brokers, facility teams & referral partners",
    title: "A Commercial HVAC Resource for Your NJ Clients",
    description: "Connect building owners and occupants with commercial HVAC service, replacement assessments and planned maintenance. Discuss recurring support or a specific property.",
    benefits: ["Property condition and replacement assessments", "Responsive service and maintenance planning", "Utility incentive screening where eligible"],
    related: "/commercial",
  },
};

export default function CommercialAudienceLanding({ audience }: { audience: Audience }) {
  const data = CONTENT[audience];
  const path = `/commercial/for-${audience}`;
  useSEO({
    title: `${data.title} | Mechanical Enterprise`,
    description: data.description,
    ogUrl: `https://mechanicalenterprise.com${path}`,
  });
  return <div className="min-h-screen bg-white">
    <Navigation />
    <main>
      <section className="bg-[#142c48] text-white py-16">
        <div className="container max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">{data.eyebrow}</p>
          <h1 className="text-3xl md:text-5xl font-bold mt-3 mb-5">{data.title}</h1>
          <p className="text-lg max-w-3xl text-white/90">{data.description}</p>
          <a href="#request" className="inline-block mt-7 rounded-md bg-[#e8813a] px-6 py-3 font-semibold text-white">Request a commercial consultation</a>
        </div>
      </section>
      <section className="container max-w-5xl py-12">
        <h2 className="text-2xl font-bold text-[#142c48] mb-5">How we can help</h2>
        <div className="grid gap-4 md:grid-cols-3">{data.benefits.map(item =>
          <div key={item} className="rounded-lg border p-5 text-sm leading-relaxed">{item}</div>
        )}</div>
        <p className="text-sm text-gray-600 mt-6">Coverage, pricing, response times and any incentive eligibility are confirmed after reviewing the property or project. No rebate or warranty approval is guaranteed.</p>
      </section>
      <section id="request" className="bg-slate-50 py-12">
        <div className="container max-w-xl">
          <h2 className="text-2xl font-bold text-center mb-5">Tell us about your project or portfolio</h2>
          <PortfolioPricingRequestForm pageContext={`audience-${audience}`} />
          <p className="text-center text-sm mt-5"><Link href={data.related} className="text-blue-700 underline">Explore related HVAC services</Link></p>
        </div>
      </section>
    </main>
    <Footer />
  </div>;
}
