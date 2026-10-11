import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PortfolioPricingRequestForm from "@/components/PortfolioPricingRequestForm";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";

type Audience = "property-management" | "contractors-developers" | "commercial-partners";
const CONTENT: Record<Audience, { title: string; description: string; eyebrow: string; benefits: string[]; related: string }> = {
  "property-management": {
    eyebrow: "Property managers, condo boards & multifamily owners",
    title: "NJ Property Management HVAC Services & Maintenance",
    description: "Request a portfolio HVAC review for preventive maintenance, emergency service, PTAC replacements and capital planning across multiple buildings.",
    benefits: ["Multi-building maintenance and service coordination", "PTAC, heat pump, RTU and VRF replacement planning", "Condition reporting and utility incentive eligibility review"],
    related: "/commercial/property-managers",
  },
  "contractors-developers": {
    eyebrow: "General contractors & developers",
    title: "NJ Commercial HVAC Subcontractor for GCs & Developers",
    description: "Share your project scope for HVAC installation, equipment replacement, retrofit work or bid support. We review plans and scheduling needs before proposing a scope.",
    benefits: ["Commercial and multifamily mechanical scopes", "Equipment selection and replacement planning", "Bid review, coordination and project scheduling"],
    related: "/commercial/hvac-service-contracts",
  },
  "commercial-partners": {
    eyebrow: "Commercial brokers, facility teams & referral partners",
    title: "NJ Commercial HVAC Partner for Brokers & Facility Teams",
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
  const relatedLinks = audience === "property-management"
    ? [{ href: "/commercial/property-managers", label: "Portfolio HVAC maintenance and pricing" }, { href: "/commercial/hvac-service-contracts", label: "Commercial HVAC service contracts" }]
    : audience === "contractors-developers"
      ? [{ href: "/commercial-hvac-installation-nj", label: "Commercial HVAC installation in NJ" }, { href: "/vrv-vrf-installation-nj", label: "VRF and VRV HVAC installation" }]
      : [{ href: "/commercial-hvac-service-nj", label: "Commercial HVAC service in NJ" }, { href: "/commercial/property-managers", label: "Property portfolio maintenance" }];
  const guides = audience === "property-management"
    ? [{ href: "/blog/fall-hvac-maintenance-nj-property-managers", label: "Fall HVAC checklist for NJ property managers" }, { href: "/blog/nj-condo-ptac-replacement-planning", label: "Condo PTAC replacement planning" }]
    : audience === "contractors-developers"
      ? [{ href: "/blog/what-gcs-need-from-hvac-subcontractor", label: "What general contractors need from an HVAC subcontractor" }, { href: "/blog/commercial-property-hvac-due-diligence-nj", label: "Commercial HVAC due diligence" }]
      : [{ href: "/blog/commercial-property-hvac-due-diligence-nj", label: "HVAC due diligence for commercial property buyers" }, { href: "/blog/fall-hvac-maintenance-nj-property-managers", label: "Fall maintenance planning for managed buildings" }];
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
      <section className="bg-white pb-12">
        <div className="container max-w-5xl">
          <h2 className="text-xl font-bold text-[#142c48] mb-4">Explore related commercial HVAC services</h2>
          <div className="flex flex-wrap gap-4">
            {relatedLinks.map(item => <Link key={item.href} href={item.href} className="text-blue-700 underline underline-offset-2">{item.label}</Link>)}
          </div>
        </div>
      </section>
      <section className="bg-slate-50 py-10" aria-label="Commercial HVAC resources">
        <div className="container max-w-5xl">
          <h2 className="text-xl font-bold text-[#142c48] mb-3">Helpful guides for your building or project</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {guides.map(guide => <Link key={guide.href} href={guide.href} className="rounded-lg border bg-white p-4 font-medium text-blue-700 underline underline-offset-2">{guide.label}</Link>)}
          </div>
        </div>
      </section>
      <section id="request" className="bg-slate-50 py-12">
        <div className="container max-w-xl">
          <h2 className="text-2xl font-bold text-center mb-5">{audience === "property-management" ? "Request a portfolio HVAC review" : audience === "contractors-developers" ? "Send us your HVAC project or bid scope" : "Discuss your commercial property or client needs"}</h2>
          <PortfolioPricingRequestForm pageContext={`audience-${audience}`} audienceMode={audience === "property-management" ? "portfolio" : audience === "commercial-partners" ? "partner" : "project"} />
          <p className="text-center text-sm mt-5"><Link href={data.related} className="text-blue-700 underline">Explore related HVAC services</Link></p>
        </div>
      </section>
    </main>
    <Footer />
  </div>;
}
