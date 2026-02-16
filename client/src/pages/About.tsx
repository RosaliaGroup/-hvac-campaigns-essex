import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Award, Target, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function About() {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[400px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white">About Us</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Dedicated HVAC Experts
            </h1>
            <p className="text-xl text-white/90">
              Delivering high-end HVAC improvements with cutting-edge technology across New Jersey
            </p>
          </div>
        </div>
      </section>

      {/* Company Overview */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-6">Who We Are</h2>
            <div className="space-y-4 text-lg text-muted-foreground">
              <p>
                Mechanical Enterprise is a dedicated group within HVAC, specializing in VRV/VRF systems and complex solutions for industry, IoT, factories, residential, and hospitality. Our team brings over 20 years of combined HVAC experience, accelerating the adoption of new technologies and delivering high-end improvements.
              </p>
              <p>
                We use the latest technology to meet the specific demands of each sector and provide effective solutions for our clients, making their daily operations simpler, smarter, and more efficient.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-6">What We Do</h2>
            <p className="text-lg text-muted-foreground mb-8">
              We focus on HVAC design improvements by applying Smart Building concepts with BIM technology. Our team supplies, installs, commissions, and starts up all types of HVAC equipment, ensuring compliance with manufacturer standards and customer satisfaction.
            </p>
            <p className="text-lg text-muted-foreground mb-8">
              Our technicians bring over 20 years of extensive experience in heavy industry, food production, residential buildings, restaurants, hospitality, and healthcare environments, and more.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                  <CardTitle>Our Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>System Installation and Commissioning</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Service & maintenance programs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Plans & diagrams processing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Optimal systems set up</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Balancing on start-up</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Running tests inspections</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Audits & surveys at any time</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Target className="h-8 w-8 text-[#ff6b35] mb-2" />
                  <CardTitle>Industries Served</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Heavy Industry & Manufacturing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Food Production Facilities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Residential Buildings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Restaurants & Hospitality</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Healthcare Environments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Commercial Office Buildings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>IoT & Smart Buildings</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Past Performance */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">Past Performance</h2>
            <p className="text-xl text-muted-foreground">
              Proven track record of successful projects across New Jersey
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">4,000+</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Residential Houses</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">2.6M</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Sq Ft Commercial</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">30+</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Stories Hotels</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">75+</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Restaurant Construction</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">90+</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Shops Installation & Maintenance</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-[#1e3a5f]">4,000+</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">Accomplished Services</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Award className="h-16 w-16 text-[#ff6b35] mx-auto mb-4" />
              <h2 className="text-4xl font-bold mb-4">Certifications & Codes</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">WMBE/SBE Certificate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/80">
                    Certified Minority and Small Business Enterprise, demonstrating our commitment to diversity and excellence in the HVAC industry.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">NAICS 238220</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/80">
                    Classified under Plumbing, Heating, and Air-Conditioning Contractors, ensuring compliance with industry standards.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
