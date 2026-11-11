import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, DollarSign, Zap, Award, MapPin, Users, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ResidentialCaseStudies from "@/components/ResidentialCaseStudies";
import WarrantyCoverageSection from "@/components/WarrantyCoverageSection";
import BuyFinanceMemberComparison from "@/components/BuyFinanceMemberComparison";
import { useSEO } from "@/hooks/useSEO";
import AiFaqSection from "@/components/AiFaqSection";

/* Design Philosophy: Modern Corporate with Tech-Forward Edge
   Residential focus with warm, family-friendly tone */

export default function ResidentialCampaigns() {
  useSEO({
    title: "Residential HVAC & Heat Pump Installation NJ | Mechanical Enterprise",
    description: "Free HVAC assessments for NJ homeowners. Heat pump, AC and furnace replacement sized to your home, with optional 10-year parts & labor coverage. Book online today.",
    ogUrl: "https://mechanicalenterprise.com/residential",
  });

  return (
    <div className="min-h-screen">
      <Navigation />
      {/* Hero Section */}
      <section className="relative min-h-[500px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Residential Homeowners</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Upgrade Your Home Comfort
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Heat pump, central AC and furnace replacement sized to your home, with a written quote before you decide and flexible payment options.
            </p>
          </div>
        </div>
      </section>

      {/* Protect the Investment — 10-Year Coverage (docs/positioning-warranty-spec.md §4) */}
      <WarrantyCoverageSection />

      {/* Buy / finance / member comparison (docs/positioning-warranty-spec.md §9a) */}
      <BuyFinanceMemberComparison />

      {/* Google Form Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Get Your Free Quote</h2>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Fill out the form below to receive a personalized quote for your home
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white rounded-lg p-2">
            <iframe 
              src="https://docs.google.com/forms/d/e/1FAIpQLSelUjWmZt7pXF1epkCafLwyB54KsKQ-vnIL1XnqTW5WjnHgwQ/viewform?embedded=true"
              width="100%"
              height="1200"
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              className="rounded-lg"
            >
              Loading…
            </iframe>
          </div>        </div>
      </section>


      {/* Service Area Coverage */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-[#1e3a5f] mb-4">Serving 15 Counties Across New Jersey</h3>
            <p className="text-lg text-muted-foreground mb-8">
              Bergen, Burlington, Camden, Essex, Gloucester, Hudson, Hunterdon, Mercer, Middlesex, Monmouth, Morris, Ocean, Passaic, Somerset, Union
            </p>
            <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
              View Service Area Map <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <AiFaqSection path="/residential" name="Residential HVAC installation in NJ" />

      <Footer />
    </div>
  );
}
