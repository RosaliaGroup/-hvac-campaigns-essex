import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Zap, Award, ArrowRight, CheckCircle, Wrench, Clock, Shield, Home as HomeIcon } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

/* Design Philosophy: Modern Corporate with Tech-Forward Edge
   Professional HVAC company homepage showcasing expertise and services */

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
          <div 
            className="absolute top-0 right-0 w-full h-full opacity-20"
            style={{
              background: 'linear-gradient(135deg, transparent 0%, transparent 40%, #ff6b35 40%, #ff6b35 60%, transparent 60%)',
            }}
          />
        </div>
        
        <div className="container relative z-10 py-20">
          <div className="max-w-3xl">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">WMBE/SBE Certified | 5 Years of Excellence</Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Expert HVAC Solutions for New Jersey
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Specialized in VRV/VRF systems and complex HVAC solutions for residential, commercial, and industrial properties across 15 counties.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/contact">
                <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                  Get a Free Quote <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20">
                  Our Services
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Why Choose Mechanical Enterprise</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Delivering high-end HVAC improvements with cutting-edge technology and expert craftsmanship
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <Shield className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">WMBE/SBE Certified</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Certified minority-owned business with proven track record</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Zap className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">VRV/VRF Specialists</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Expert in variable refrigerant flow systems and BIM technology</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <Clock className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">24/7 Emergency Service</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Round-the-clock support for all your HVAC emergencies</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Award className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">5 Years Experience</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Proven expertise across residential, commercial, and industrial</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Our Services</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive HVAC solutions for every need
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <Wrench className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-xl">Installation & Commissioning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">Professional system installation with expert commissioning</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>New system design & installation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>BIM technology integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>System balancing & start-up</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-xl">Maintenance & Repair</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">Keep your systems running at peak performance</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Preventive maintenance programs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Emergency repair services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Running tests & inspections</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-xl">VRV/VRF Systems</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">Advanced variable refrigerant flow technology</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Energy-efficient solutions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Multi-zone climate control</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Smart building integration</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Link href="/services">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                View All Services <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Market Segments */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Who We Serve</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Specialized solutions for residential and commercial properties
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <HomeIcon className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-2xl">Residential Services</CardTitle>
                <CardDescription>Comfort solutions for your home</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Over 4,000 residential installations completed with expert care and attention to detail.
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Single-family homes</li>
                  <li>• Multi-family properties</li>
                  <li>• Heat pump installations</li>
                  <li>• Up to $16K rebates available</li>
                </ul>
                <Link href="/residential">
                  <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                    Residential Campaigns <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#1e3a5f]">
              <CardHeader>
                <Building2 className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-2xl">Commercial Services</CardTitle>
                <CardDescription>Professional solutions for businesses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  2.6 million sq ft of commercial space served including hotels, restaurants, and healthcare facilities.
                </p>
                <ul className="space-y-2 text-sm">
                  <li>• Office buildings</li>
                  <li>• Retail & hospitality</li>
                  <li>• Industrial facilities</li>
                  <li>• Commercial incentives available</li>
                </ul>
                <Link href="/commercial">
                  <Button className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
                    Commercial Campaigns <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Brand Partners */}
      <section className="py-16 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Authorized Dealer & Service Provider</h3>
            <p className="text-muted-foreground">We work with industry-leading brands</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-70">
            <span className="text-lg font-semibold text-[#1e3a5f]">Mitsubishi</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Fujitsu</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">LG</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Trane</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Lennox</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Carrier</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Daikin</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Samsung HVAC</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Hitachi</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Toshiba</span>
            <span className="text-lg font-semibold text-[#1e3a5f]">Gree</span>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-white/90 mb-8">
              Contact us today for a free consultation and quote. Serving 15 counties across New Jersey with expert HVAC solutions.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                  Get Your Free Quote <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20">
                <a href="tel:+19737500759">(973) 750-0759</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
