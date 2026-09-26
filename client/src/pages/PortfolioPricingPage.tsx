import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, ClipboardList, Users, ShieldCheck } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PortfolioPricingRequestForm from "@/components/PortfolioPricingRequestForm";
import { useSEO } from "@/hooks/useSEO";
import { VERIFIED_FACTS } from "@shared/verifiedFacts";

/**
 * docs/positioning-warranty-spec.md §9d. Shared template for both
 * `/commercial/property-managers` and `/commercial/hvac-service-contracts` —
 * same offer, framed for a slightly different audience. No SLA-hour figure
 * is stated anywhere (VERIFIED_FACTS.portfolioSla.responseHours is null
 * until the owner sets it — see shared/seoLinter.ts's sla_hours_mismatch
 * rule, which would BLOCK a stated number that doesn't match).
 */
type PortfolioPricingVariant = "property-managers" | "service-contracts";

const COPY: Record<PortfolioPricingVariant, { badge: string; h1: string; intro: string; audience: string }> = {
  "property-managers": {
    badge: "For Property Managers",
    h1: "Fixed Per-Unit HVAC Pricing for Your Portfolio",
    intro:
      "One fixed annual price per unit across your whole portfolio — no per-building quotes, no surprise invoices. Built for property managers running PTAC, mini-split, RTU and split systems across multiple buildings.",
    audience: "property managers",
  },
  "service-contracts": {
    badge: "Commercial Service Contracts",
    h1: "Portfolio-Wide HVAC Service Contracts",
    intro:
      "A single service contract covering every unit in your portfolio — fixed per-unit pricing, one point of contact, and a quarterly condition report instead of a stack of individual work orders.",
    audience: "commercial building owners",
  },
};

export default function PortfolioPricingPage({ variant }: { variant: PortfolioPricingVariant }) {
  const copy = COPY[variant];
  const { portfolioSla } = VERIFIED_FACTS;
  const slug = variant === "property-managers" ? "property-managers" : "hvac-service-contracts";

  useSEO({
    title: `${copy.h1} | Mechanical Enterprise`,
    description: `Fixed per-unit HVAC pricing for NJ property portfolios — ${portfolioSla.unitTypes.join(", ")}, quarterly reporting, optional parts & labor coverage. Free consultation.`,
    ogUrl: `https://mechanicalenterprise.com/commercial/${slug}`,
  });

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "Service",
        "serviceType": "Portfolio HVAC Service Contract",
        "provider": { "@type": "HVACBusiness", "name": "Mechanical Enterprise LLC", "url": "https://mechanicalenterprise.com" },
        "areaServed": "New Jersey",
        "description": copy.intro,
      }) }} />
      <Navigation />

      <section className="relative min-h-[380px] flex items-center bg-gradient-to-br from-[#0a1628] to-[#1e3a5f]">
        <div className="container py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#e8813a] text-white hover:bg-[#e8813a]/90">{copy.badge}</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{copy.h1}</h1>
            <p className="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto">{copy.intro}</p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#0a1628] mb-6 text-center">What's Included</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <Building2 className="h-8 w-8 text-[#1e3a5f] mb-2" />
                  <CardTitle className="text-lg">Fixed Per-Unit Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    One annual price per unit — {portfolioSla.unitTypes.join(", ")} — quoted for your entire portfolio, not building by building.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Users className="h-8 w-8 text-[#1e3a5f] mb-2" />
                  <CardTitle className="text-lg">One Point of Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    One relationship, one number to call, coordinated across every property in your portfolio.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <ClipboardList className="h-8 w-8 text-[#1e3a5f] mb-2" />
                  <CardTitle className="text-lg">Quarterly Condition Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    A {portfolioSla.reportingCadence} report on equipment condition across your portfolio, so nothing surprises you at renewal.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <ShieldCheck className="h-8 w-8 text-[#1e3a5f] mb-2" />
                  <CardTitle className="text-lg">Optional Portfolio Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Optional 3/5/10-year parts &amp; labor coverage available across the whole portfolio, priced with your contract.
                  </p>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Response time is confirmed for your portfolio at consultation. Pricing is {portfolioSla.pricingBasis}.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="max-w-lg mx-auto">
            <PortfolioPricingRequestForm pageContext={`commercial-${slug}`} />
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-4" />
            <p className="text-gray-600 leading-relaxed">
              Commercial equipment on your portfolio is also eligible for our optional{" "}
              <a href="/warranty" className="text-[#1e3a5f] font-medium underline hover:no-underline">10-year parts &amp; labor coverage</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
