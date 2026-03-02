import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, Clock, Phone, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function RebateGuide() {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[400px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-3xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white">Step-by-Step Guide</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Rebate Application Guide
            </h1>
            <p className="text-xl text-white/90">
              Everything you need to know about applying for HVAC rebates and incentives
            </p>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="py-12 bg-white">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <CardTitle className="text-2xl">How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our team at Mechanical Enterprise will guide you through the entire rebate application process. We handle most of the paperwork and work directly with rebate programs to maximize your incentives. The typical process takes 4-8 weeks from application to rebate payment.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Step-by-Step Process */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">Application Process</h2>
            <p className="text-xl text-muted-foreground">
              Follow these steps to secure your rebate
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {/* Step 1 */}
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35] text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-xl">Initial Consultation & Assessment</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Timeline: 1-2 days</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Contact us for a free consultation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>We assess your current HVAC system and building</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Determine rebate eligibility and estimate amounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Provide detailed project proposal with costs</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="border-l-4 border-l-[#1e3a5f]">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-[#1e3a5f] text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <CardTitle className="text-xl">Pre-Approval Application</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Timeline: 3-5 days</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Required Documents (we help you gather these):</strong>
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                    <span>Recent utility bills (last 12 months)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                    <span>Building ownership or authorization documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                    <span>Current HVAC system specifications and age</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                    <span>Building square footage and usage details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                    <span>Business tax ID or EIN number</span>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-3 bg-blue-50 p-3 rounded">
                  <strong>Note:</strong> We submit the pre-approval application on your behalf and handle all communication with the rebate program.
                </p>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35] text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <CardTitle className="text-xl">Rebate Approval & Project Agreement</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Timeline: 1-2 weeks</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Receive rebate pre-approval confirmation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Review and sign project agreement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Schedule installation timeline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Finalize equipment selection and specifications</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="border-l-4 border-l-[#1e3a5f]">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-[#1e3a5f] text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <CardTitle className="text-xl">Installation & Commissioning</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Timeline: 1-3 weeks (varies by project size)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Professional installation by certified technicians</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>System testing and balancing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Staff training on new system operation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Documentation of installation for rebate submission</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 5 */}
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35] text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    5
                  </div>
                  <div>
                    <CardTitle className="text-xl">Final Rebate Submission</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Timeline: 1-2 days after installation</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>We compile all required documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Submit final rebate application with proof of installation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Include equipment specifications and efficiency ratings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Provide before/after energy usage documentation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 6 */}
            <Card className="border-l-4 border-l-green-600">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    6
                  </div>
                  <div>
                    <CardTitle className="text-xl">Rebate Payment</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Timeline: 2-4 weeks after submission</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Rebate program reviews and approves final application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Rebate check issued directly to you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>We follow up to ensure you receive payment</span>
                  </li>
                </ul>
                <div className="mt-4 bg-green-50 p-4 rounded border border-green-200">
                  <p className="text-sm font-semibold text-green-900">
                    💰 Total Timeline: 4-8 weeks from application to rebate payment
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Important Information */}
      <section className="py-12 bg-white">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-[#1e3a5f] mb-6">Important Information</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#ff6b35]" />
                    Timing Matters
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>• Apply <strong>before</strong> installation begins</p>
                  <p>• Rebate programs have annual funding limits</p>
                  <p>• Early applications have better approval rates</p>
                  <p>• Some programs operate on a first-come, first-served basis</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#ff6b35]" />
                    Eligibility Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>• Must be replacing existing HVAC equipment</p>
                  <p>• New equipment must meet efficiency standards</p>
                  <p>• Building must be in eligible service area</p>
                  <p>• Installation must be performed by licensed contractor</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-white/90 mb-8">
              Let us handle the rebate process for you. Contact us today for a free consultation and rebate assessment.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                  Get Free Consultation <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20">
                <a href="tel:+18624191763" className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  (862) 419-1763
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
