import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, DollarSign, Zap, Award, MapPin, Users, ArrowRight, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ResidentialCaseStudies from "@/components/ResidentialCaseStudies";

/* Design Philosophy: Modern Corporate with Tech-Forward Edge
   Residential focus with warm, family-friendly tone */

export default function ResidentialCampaigns() {
  return (
    <div className="min-h-screen">
      <Navigation />
      {/* Hero Section */}
      <section className="relative min-h-[500px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Residential Homeowners</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Residential HVAC Campaigns
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Strategic marketing campaigns designed to generate qualified residential leads across 15 counties in New Jersey
            </p>
          </div>
        </div>
      </section>

      {/* Decarbonization Program Highlight */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#ff6b35] text-white text-base px-4 py-2">🔥 Featured Program</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Residential Decarbonization Program</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Up to $16,000 in rebates for homeowners upgrading to energy-efficient heat pumps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <div className="bg-[#ff6b35] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Up to $16,000</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Substantial rebates available for residential heat pump installations</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <div className="bg-[#1e3a5f] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle>50% Energy Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Modern heat pumps dramatically reduce your monthly utility bills</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-green-600">
              <CardHeader>
                <div className="bg-green-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Year-Round Comfort</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">One system for both heating and cooling your entire home</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Residential Case Studies */}
      <ResidentialCaseStudies />

      {/* Google Form Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Get Your Free Quote</h2>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Fill out the form below to receive a personalized quote and learn about available rebates for your home
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

      {/* On-Bill Repayment Option */}
      <section className="py-16 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Card className="border-2 border-green-600">
              <CardHeader className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8" />
                  <div>
                    <CardTitle className="text-2xl">Flexible Payment Option: On-Bill Repayment</CardTitle>
                    <CardDescription className="text-white/90 mt-1">
                      No upfront costs - pay through your monthly utility bill
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-lg mb-3 text-[#1e3a5f]">How It Works</h4>
                    <p className="text-muted-foreground mb-4">
                      Qualified homeowners can add the project cost to their monthly utility bill, making energy-efficient upgrades more accessible with no money down.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      Eligibility Requirement
                    </h5>
                    <p className="text-sm text-muted-foreground">
                      Your utility account must be in good standing to qualify for on-bill repayment.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-lg mb-3 text-[#1e3a5f]">Simple 4-Step Process</h4>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                        <div>
                          <p className="font-medium">Homeowner Approval</p>
                          <p className="text-sm text-muted-foreground">Review and approve the proposed work and payment terms</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                        <div>
                          <p className="font-medium">Professional Installation</p>
                          <p className="text-sm text-muted-foreground">Our certified technicians complete the heat pump installation</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                        <div>
                          <p className="font-medium">Inspection & Verification</p>
                          <p className="text-sm text-muted-foreground">Official inspection confirms work is completed to standards</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
                        <div>
                          <p className="font-medium">Rebate Processing & Close Out</p>
                          <p className="text-sm text-muted-foreground">Rebate application processed and project finalized</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-300 rounded-lg p-4 mt-4">
                    <p className="text-sm font-medium text-green-900">
                      💡 <strong>Benefit:</strong> Start saving on energy costs immediately while spreading payments over time through your utility bill.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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

      <Footer />
    </div>
  );
}
