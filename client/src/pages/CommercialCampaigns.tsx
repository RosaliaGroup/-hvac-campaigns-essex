import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Zap, Award, MapPin, Users, ArrowRight, CheckCircle, Clock } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import RebateCalculator from "@/components/RebateCalculator";
import CaseStudies from "@/components/CaseStudies";
import ScrollRebatePopup from "@/components/ScrollRebatePopup";
import { useSEO } from "@/hooks/useSEO";

/* Design Philosophy: Modern Corporate with Tech-Forward Edge
   Commercial focus with professional, ROI-driven tone */

export default function CommercialCampaigns() {
  useSEO({
    title: "Commercial HVAC Newark NJ | VRV/VRF Systems | 80% Rebates Available",
    description: "Commercial HVAC installation, VRV/VRF systems, and repair for NJ businesses. Rebates up to 80% of costs. Free commercial assessment.",
    ogUrl: "https://mechanicalenterprise.com/commercial",
  });

  return (
    <div className="min-h-screen">
      <ScrollRebatePopup pageType="commercial" />
      <Navigation />
      {/* Hero Section */}
      <section className="relative min-h-[500px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Commercial Properties</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Commercial HVAC Upgrades
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Get up to 80% rebates for energy-efficient commercial HVAC systems. Serving businesses across 15 New Jersey counties with flexible financing up to $590K.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90" asChild>
                <a href="/rebate-guide">View Rebate Guide <ArrowRight className="ml-2 h-5 w-5" /></a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Direct Replacement Program Highlight */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#ff6b35] text-white text-base px-4 py-2">🔥 Featured Program</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Commercial Direct Replacement Program</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Incentives available - up to 80% cost covered by rebates for businesses upgrading to energy-efficient systems
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <div className="bg-[#ff6b35] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Up to 80% Rebates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Get up to 80% of your costs covered through energy efficiency rebate programs</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <div className="bg-[#1e3a5f] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Reduce Operating Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Lower energy bills and improve your bottom line significantly</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-green-600">
              <CardHeader>
                <div className="bg-green-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Minimal Downtime</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Professional installation with minimal disruption to your business</p>
              </CardContent>
            </Card>
          </div>
        </div>
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
                      Preserve cash flow - pay through your monthly utility bill
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-lg mb-3 text-[#1e3a5f]">How It Works for Commercial Properties</h4>
                    <p className="text-muted-foreground mb-4">
                      Qualified businesses can add the project cost to their monthly utility bill, making large-scale HVAC upgrades manageable without impacting your operating capital.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      Eligibility Requirement
                    </h5>
                    <p className="text-sm text-muted-foreground">
                      Your commercial utility account must be in good standing to qualify for on-bill repayment.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-lg mb-3 text-[#1e3a5f]">Commercial Application Process</h4>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                        <div>
                          <p className="font-medium">Application Submission</p>
                          <p className="text-sm text-muted-foreground">Submit project details and business information</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                        <div>
                          <p className="font-medium">Rebate Program Review & Approval</p>
                          <p className="text-sm text-muted-foreground">Program reviews and approves final application</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                        <div>
                          <p className="font-medium">Professional Installation</p>
                          <p className="text-sm text-muted-foreground">Our certified team installs your new HVAC system</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="bg-[#ff6b35] text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
                        <div>
                          <p className="font-medium">Close Out Job</p>
                          <p className="text-sm text-muted-foreground">Final inspection, documentation, and project completion</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 mt-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-semibold text-[#1e3a5f] mb-2">Preserve Capital</h5>
                      <p className="text-sm text-muted-foreground">Keep your cash for core business operations</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-semibold text-[#1e3a5f] mb-2">Immediate Savings</h5>
                      <p className="text-sm text-muted-foreground">Start reducing energy costs from day one</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-semibold text-[#1e3a5f] mb-2">Simple Billing</h5>
                      <p className="text-sm text-muted-foreground">One monthly payment on your utility bill</p>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-300 rounded-lg p-4 mt-4">
                    <p className="text-sm font-medium text-green-900">
                      💡 <strong>Business Advantage:</strong> Energy savings often offset the monthly payment, resulting in net-positive cash flow from day one.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Commercial Property Types */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Commercial Property Types</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Specialized HVAC solutions for every type of commercial property
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle>Office Buildings</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Multi-zone climate control</li>
                  <li>• Energy-efficient systems</li>
                  <li>• Quiet operation</li>
                  <li>• Smart building integration</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle>Retail Spaces</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Customer comfort priority</li>
                  <li>• Flexible zoning options</li>
                  <li>• Reliable performance</li>
                  <li>• Cost-effective operation</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle>Restaurants & Hospitality</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• High-capacity systems</li>
                  <li>• Kitchen ventilation solutions</li>
                  <li>• 24/7 emergency service</li>
                  <li>• Health code compliance</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle>Warehouses & Industrial</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Large-scale systems</li>
                  <li>• Durable equipment</li>
                  <li>• Temperature regulation</li>
                  <li>• Maintenance contracts</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle>Medical Facilities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Air quality standards</li>
                  <li>• Precise temperature control</li>
                  <li>• Redundant systems</li>
                  <li>• Healthcare compliance</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle>Multi-Family Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Individual unit control</li>
                  <li>• Tenant satisfaction</li>
                  <li>• Property value increase</li>
                  <li>• Bulk pricing available</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Commercial Campaign Features */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Why Choose Us for Commercial HVAC</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="text-center">
              <CardHeader>
                <Clock className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">24/7 Emergency Service</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Round-the-clock support for your business needs</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Award className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Licensed & Insured</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Fully certified technicians and comprehensive coverage</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <DollarSign className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Flexible Financing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Multiple payment options for your business budget</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Zap className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Energy Audits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Free assessments to maximize your savings</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Rebate Calculator */}
      <section className="py-20 bg-white">
        <div className="container max-w-4xl">
          <RebateCalculator />
        </div>
      </section>

      {/* Case Studies */}
      <CaseStudies />

      {/* Google Form Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Request a Commercial Quote</h2>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Fill out the form below to receive a personalized quote and learn about available incentives for your business
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white rounded-lg p-2">
            <iframe 
              src="https://docs.google.com/forms/d/e/1FAIpQLSdc1dHJx1IAeLq6I7cZ2y4z1LS9Hn9w1Xdm8J8LririqJj4CA/viewform?embedded=true"
              width="100%"
              height="1200"
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              className="rounded-lg"
            >
              Loading…
            </iframe>
          </div>
        </div>
      </section>

      {/* Service Area */}
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

      {/* Nonprofit Direct Install Section */}
      <section className="py-20 bg-white" id="nonprofit">
        <div className="container">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#ff6b35] text-white text-base px-4 py-2">NJ Direct Install Program</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Nonprofits: Lighting Is 100% Free. HVAC Is 80% Off.</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Every building in your portfolio qualifies separately under the NJ Direct Install Program.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#1e3a5f]">💡 Lighting</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#ff6b35] mb-2">100% Covered</p>
                <p className="text-muted-foreground">$0 cost, no OBR needed. Includes interior, exterior, and parking lot lighting. Full LED upgrade at zero out of pocket.</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#1e3a5f]">❄️ HVAC</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#1e3a5f] mb-2">Up to 80% Off</p>
                <p className="text-muted-foreground">Remaining balance covered via On-Bill Repayment. Applies per building. Heat pumps, VRV/VRF, and full system replacement.</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-green-500">
              <CardHeader>
                <CardTitle className="text-2xl text-[#1e3a5f]">🏢 Portfolio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 mb-2">Per Building</p>
                <p className="text-muted-foreground">Each building qualifies separately. We coordinate multi-building rollouts. One assessment per property, one point of contact.</p>
              </CardContent>
            </Card>
          </div>
          <div className="text-center">
            <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-lg px-8 py-6 mb-4">
              <a href="https://mechanicalenterprise.com/commercial" className="text-white no-underline">Book Free Nonprofit Assessment</a>
            </Button>
            <p className="text-sm text-muted-foreground">PSE&G Trade Ally | WMBE Certified | SBE Certified | Serving NJ Nonprofits</p>
          </div>
        </div>
      </section>

      {/* Browse by Industry */}
      <section className="py-16 bg-[#f7f8fa]">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[#1e3a5f] mb-3">Browse by Industry</h2>
            <p className="text-muted-foreground">Every commercial industry in NJ qualifies for Direct Install. Find yours.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">
            {[
              ["Hotels", "hotels-nj"], ["Motels", "motels-nj"], ["B&Bs", "bed-and-breakfast-nj"], ["Event Venues", "event-venues-nj"],
              ["Banquet Halls", "banquet-halls-nj"], ["Catering", "catering-facilities-nj"], ["Dental", "dental-offices-nj"],
              ["Veterinary", "veterinary-clinics-nj"], ["Urgent Care", "urgent-care-nj"], ["Gyms", "gyms-fitness-centers-nj"],
              ["Spas & Salons", "spas-salons-nj"], ["Physical Therapy", "physical-therapy-nj"], ["Nursing Homes", "nursing-homes-nj"],
              ["Auto Dealers", "auto-dealerships-nj"], ["Auto Body", "auto-body-shops-nj"], ["Manufacturing", "manufacturing-plants-nj"],
              ["Cold Storage", "cold-storage-nj"], ["Self-Storage", "self-storage-nj"], ["Laundromats", "laundromats-nj"],
              ["Grocery", "grocery-stores-nj"], ["Pharmacies", "pharmacies-nj"], ["C-Stores", "convenience-stores-nj"],
              ["Bakeries", "bakeries-nj"], ["Barbershops", "barbershops-nj"], ["Dry Cleaners", "dry-cleaners-nj"],
              ["Nail Salons", "nail-salons-nj"], ["Law Offices", "law-offices-nj"], ["CPA Offices", "accounting-offices-nj"],
              ["Insurance", "insurance-offices-nj"], ["Real Estate", "real-estate-offices-nj"], ["Financial", "financial-advisors-nj"],
              ["Coworking", "coworking-spaces-nj"], ["Daycare", "daycare-centers-nj"], ["Private Schools", "private-schools-nj"],
              ["Tutoring", "tutoring-centers-nj"], ["Studios", "martial-arts-studios-nj"], ["Music Studios", "music-studios-nj"],
              ["Municipal", "municipal-buildings-nj"], ["Fire Stations", "fire-stations-nj"], ["Libraries", "libraries-nj"],
              ["Colleges", "community-colleges-nj"], ["Rec Centers", "recreation-centers-nj"], ["Trucking", "trucking-companies-nj"],
              ["Taxi/Limo", "taxi-limo-companies-nj"], ["Car Washes", "car-washes-nj"], ["Gas Stations", "gas-stations-nj"],
              ["Bowling", "bowling-alleys-nj"], ["Sports", "indoor-sports-facilities-nj"], ["Golf Clubs", "golf-courses-nj"],
              ["Pools", "swimming-pools-nj"], ["Mixed-Use", "mixed-use-buildings-nj"], ["Art Galleries", "art-galleries-nj"],
              ["Funeral Homes", "funeral-homes-nj"], ["Dispensaries", "cannabis-dispensaries-nj"], ["Breweries", "breweries-wineries-nj"],
            ].map(([name, slug]) => (
              <a key={slug} href={`/direct-install/${slug}`} className="bg-white rounded-lg border px-3 py-2.5 text-center text-sm font-medium text-[#1e3a5f] hover:border-[#ff6b35] hover:text-[#ff6b35] transition-colors block">
                {name}
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
