import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DollarSign, Zap, Award, MapPin, Users, ArrowRight, CheckCircle, Clock } from "lucide-react";

/* Design Philosophy: Modern Corporate with Tech-Forward Edge
   Commercial focus with professional, ROI-driven tone */

export default function CommercialCampaigns() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[500px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Commercial Properties</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Commercial HVAC Campaigns
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Strategic marketing campaigns designed to generate qualified commercial leads across 15 counties in New Jersey
            </p>
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
              Incentives available for businesses upgrading to energy-efficient heat pumps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <div className="bg-[#ff6b35] w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Commercial Incentives</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Financial incentives available for commercial heat pump installations</p>
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

      {/* Google Form Section - Placeholder */}
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
    </div>
  );
}
