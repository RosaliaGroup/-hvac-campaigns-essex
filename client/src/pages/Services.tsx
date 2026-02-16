import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Building2, Zap, Clock, Shield, CheckCircle, ArrowRight, Settings, Gauge, FileText } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function Services() {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[400px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white">Our Services</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Comprehensive HVAC Solutions
            </h1>
            <p className="text-xl text-white/90">
              From design to maintenance, we provide complete HVAC services for residential, commercial, and industrial properties
            </p>
          </div>
        </div>
      </section>

      {/* Main Services */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Installation & Commissioning */}
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <Wrench className="h-12 w-12 text-[#ff6b35] mb-4" />
                <CardTitle className="text-2xl">Installation & Commissioning</CardTitle>
                <CardDescription>Professional system installation with expert commissioning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">New HVAC system design and installation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">BMS technology integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">System balancing and start-up</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Compliance with manufacturer standards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Smart building concepts</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Service & Maintenance */}
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Settings className="h-12 w-12 text-[#ff6b35] mb-4" />
                <CardTitle className="text-2xl">Service & Maintenance</CardTitle>
                <CardDescription>Keep your systems running at peak performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Preventive maintenance programs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">24/7 emergency repair services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Running tests and inspections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Audits and surveys at any time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Optimal system performance</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* VRV/VRF Systems */}
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <Zap className="h-12 w-12 text-[#ff6b35] mb-4" />
                <CardTitle className="text-2xl">VRV/VRF Systems</CardTitle>
                <CardDescription>Advanced variable refrigerant flow technology</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Energy-efficient climate control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Multi-zone temperature management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Smart building integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Reduced operating costs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Quiet operation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Emergency Services */}
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Clock className="h-12 w-12 text-[#ff6b35] mb-4" />
                <CardTitle className="text-2xl">Emergency Services</CardTitle>
                <CardDescription>24/7 rapid response for urgent HVAC issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Round-the-clock availability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Fast response times</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Experienced technicians</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Fully stocked service vehicles</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Priority service for emergencies</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* System Design */}
            <Card className="border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <FileText className="h-12 w-12 text-[#ff6b35] mb-4" />
                <CardTitle className="text-2xl">System Design</CardTitle>
                <CardDescription>Custom HVAC solutions tailored to your needs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Plans and diagrams processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">BMS technology application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Energy efficiency optimization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Load calculations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Code compliance assurance</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Testing & Balancing */}
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Gauge className="h-12 w-12 text-[#ff6b35] mb-4" />
                <CardTitle className="text-2xl">Testing & Balancing</CardTitle>
                <CardDescription>Ensure optimal system performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">System balancing on start-up</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Running tests and inspections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Performance verification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Air flow measurements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Detailed reporting</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Industry Specializations */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">Industry Specializations</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Over 20 years of experience across diverse sectors
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Heavy Industry</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Manufacturing facilities and industrial complexes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Food Production</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Temperature-controlled food processing environments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Hospitality</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Hotels, restaurants, and entertainment venues</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Healthcare</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Medical facilities with strict air quality standards</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-white/90 mb-8">
              Contact us today for a free consultation and discover how our expert HVAC services can benefit your property.
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                Get Your Free Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
