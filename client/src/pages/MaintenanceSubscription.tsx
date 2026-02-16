import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, TrendingDown, FileText, Building2, CheckCircle, ArrowRight, Users, Award } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import PaymentCalculator from "@/components/PaymentCalculator";

/* Design Philosophy: Modern Corporate with Tech-Forward Edge
   Subscription maintenance services page - high-level without pricing */

export default function MaintenanceSubscription() {
  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[500px] flex items-center overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="container relative z-10 py-16">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Subscription Maintenance</Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Predictable HVAC Maintenance Programs
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
              Subscription-based maintenance designed to lower emergency repairs, extend equipment life, and improve comfort across residential and commercial properties.
            </p>
            <Link href="/contact">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                Request Custom Quote <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Promotion Banner */}
      <section className="py-4 bg-gradient-to-r from-[#ff6b35] to-[#ff8c5a]">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white">
            <div className="flex items-center gap-3">
              <Badge className="bg-white text-[#ff6b35] hover:bg-white text-lg px-4 py-2">LIMITED TIME</Badge>
              <div>
                <div className="text-2xl font-bold">First Month FREE</div>
                <div className="text-sm opacity-90">New subscription signups only • No long-term commitment required</div>
              </div>
            </div>
            <Link href="/contact">
              <Button size="lg" className="bg-white text-[#ff6b35] hover:bg-slate-100 font-semibold shadow-lg">
                Claim Your Free Month <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Why Choose Subscription Maintenance</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Proactive care that saves money and prevents disruptions
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <TrendingDown className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Predictable Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Fixed monthly pricing eliminates budget surprises</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <Shield className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Fewer Emergencies</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Preventive care reduces unexpected breakdowns</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#ff6b35]">
              <CardHeader>
                <Clock className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Extended Equipment Life</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Regular maintenance maximizes system longevity</p>
              </CardContent>
            </Card>

            <Card className="text-center border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <FileText className="h-12 w-12 text-[#ff6b35] mx-auto mb-2" />
                <CardTitle className="text-lg">Digital Reporting</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Complete documentation and accountability</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Service Tiers */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Maintenance Subscription Options</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Flexible programs tailored to your needs - contact us for pricing
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Essential Care */}
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-2xl text-center">Essential Care</CardTitle>
                <CardDescription className="text-center">Foundation-level protection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Preventive maintenance visits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Deep cleaning service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Parts credit included</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Replacement discounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Digital condition reports</span>
                  </li>
                </ul>
                <Link href="/contact">
                  <Button className="w-full mt-4 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
                    Get Quote
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Care */}
            <Card className="border-t-4 border-t-[#ff6b35] shadow-lg scale-105">
              <CardHeader>
                <Badge className="mb-2 bg-[#ff6b35] text-white w-fit mx-auto">Most Popular</Badge>
                <CardTitle className="text-2xl text-center">Pro Care</CardTitle>
                <CardDescription className="text-center">Enhanced coverage & support</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">All Essential Care benefits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Included service calls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Increased parts credit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Higher replacement discounts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Digital service reporting</span>
                  </li>
                </ul>
                <Link href="/contact">
                  <Button className="w-full mt-4 bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                    Get Quote
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Premium Care */}
            <Card className="border-t-4 border-t-[#1e3a5f]">
              <CardHeader>
                <CardTitle className="text-2xl text-center">Premium Care</CardTitle>
                <CardDescription className="text-center">Maximum protection & priority</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">All Pro Care benefits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Multiple PM visits annually</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Emergency call support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Maximum parts credit</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Priority response & efficiency reporting</span>
                  </li>
                </ul>
                <Link href="/contact">
                  <Button className="w-full mt-4 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
                    Get Quote
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Portfolio & Commercial Programs */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="max-w-5xl mx-auto space-y-12">
            {/* Portfolio Residential */}
            <Card className="border-l-4 border-l-[#ff6b35]">
              <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                  <Building2 className="h-10 w-10 text-[#ff6b35]" />
                  <div>
                    <CardTitle className="text-3xl">Portfolio Residential Program</CardTitle>
                    <CardDescription className="text-lg">For multifamily buildings with multiple apartment HVAC units</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Designed to stabilize costs and reduce tenant complaints across large residential portfolios. Our program delivers measurable reductions in emergency calls and tenant issues.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1e3a5f]">Program Benefits:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Scheduled preventive maintenance</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Filter, airflow & performance checks</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Deep coil cleaning</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-[#1e3a5f]">Additional Features:</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Digital reporting & asset tracking</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Discounted repairs & replacements</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Predictable annual cost structure</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <Link href="/contact">
                  <Button className="mt-4 bg-[#ff6b35] hover:bg-[#ff6b35]/90">
                    Request Portfolio Quote <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Commercial Membership */}
            <Card className="border-l-4 border-l-[#1e3a5f]">
              <CardHeader>
                <div className="flex items-center gap-4 mb-2">
                  <Users className="h-10 w-10 text-[#ff6b35]" />
                  <div>
                    <CardTitle className="text-3xl">Commercial Support Membership</CardTitle>
                    <CardDescription className="text-lg">For buildings that prefer a lighter support structure</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  A flexible membership option that provides priority access, preferred pricing, and vendor partnership alignment for budgeting and planning.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Priority dispatching</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Preferred maintenance & service pricing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Preventive maintenance scheduling support</span>
                    </li>
                  </ul>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Discounted labor & replacement pricing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Vendor partnership alignment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Budgeting & planning support</span>
                    </li>
                  </ul>
                </div>
                <Link href="/contact">
                  <Button className="mt-4 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
                    Request Membership Quote <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Cost Comparison Case Studies */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Real Cost Savings</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              See how our subscription maintenance programs reduce costs, downtime, and emergency repairs
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Case Study 1: Multi-Family Property */}
            <Card className="border-2 border-[#ff6b35]/20 hover:border-[#ff6b35] transition-all">
              <CardHeader className="bg-gradient-to-br from-[#ff6b35]/10 to-white pb-6">
                <Building2 className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-2xl text-[#1e3a5f]">Multi-Family Property</CardTitle>
                <CardDescription className="text-base">48-unit residential building, Newark</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Before */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">BEFORE</span>
                    Reactive Maintenance
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-red-800">Annual PM Costs:</span>
                      <span className="font-semibold text-red-900">$8,400</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Emergency Repairs:</span>
                      <span className="font-semibold text-red-900">$14,200</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Downtime (tenant issues):</span>
                      <span className="font-semibold text-red-900">42 days</span>
                    </div>
                    <div className="flex justify-between border-t border-red-300 pt-2 mt-2">
                      <span className="text-red-800 font-bold">Total Annual Cost:</span>
                      <span className="font-bold text-red-900">$22,600</span>
                    </div>
                  </div>
                </div>

                {/* After */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">AFTER</span>
                    Our Subscription Program
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-800">Monthly Subscription:</span>
                      <span className="font-semibold text-green-900">$1,000/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800 text-xs italic">Annual Total:</span>
                      <span className="font-semibold text-green-900 text-xs">$12,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Emergency Repairs:</span>
                      <span className="font-semibold text-green-900">$2,800</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Downtime (tenant issues):</span>
                      <span className="font-semibold text-green-900">8 days</span>
                    </div>
                    <div className="flex justify-between border-t border-green-300 pt-2 mt-2">
                      <span className="text-green-800 font-bold">Total Annual Cost:</span>
                      <span className="font-bold text-green-900">$14,800</span>
                    </div>
                  </div>
                </div>

                {/* Savings */}
                <div className="bg-[#ff6b35] text-white p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold mb-1">$7,800/year</div>
                  <div className="text-sm opacity-90">35% Total Cost Reduction</div>
                  <div className="text-xs opacity-75 mt-2">81% fewer downtime days</div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 2: Commercial Office */}
            <Card className="border-2 border-[#1e3a5f]/20 hover:border-[#1e3a5f] transition-all">
              <CardHeader className="bg-gradient-to-br from-[#1e3a5f]/10 to-white pb-6">
                <Building2 className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-2xl text-[#1e3a5f]">Commercial Office</CardTitle>
                <CardDescription className="text-base">25,000 sq ft office building, Jersey City</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Before */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">BEFORE</span>
                    Reactive Maintenance
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-red-800">Annual PM Costs:</span>
                      <span className="font-semibold text-red-900">$6,200</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Emergency Repairs:</span>
                      <span className="font-semibold text-red-900">$18,500</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Productivity Loss:</span>
                      <span className="font-semibold text-red-900">$8,400</span>
                    </div>
                    <div className="flex justify-between border-t border-red-300 pt-2 mt-2">
                      <span className="text-red-800 font-bold">Total Annual Cost:</span>
                      <span className="font-bold text-red-900">$33,100</span>
                    </div>
                  </div>
                </div>

                {/* After */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">AFTER</span>
                    Our Subscription Program
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-800">Monthly Subscription:</span>
                      <span className="font-semibold text-green-900">$800/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800 text-xs italic">Annual Total:</span>
                      <span className="font-semibold text-green-900 text-xs">$9,600</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Emergency Repairs:</span>
                      <span className="font-semibold text-green-900">$3,200</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Productivity Loss:</span>
                      <span className="font-semibold text-green-900">$1,100</span>
                    </div>
                    <div className="flex justify-between border-t border-green-300 pt-2 mt-2">
                      <span className="text-green-800 font-bold">Total Annual Cost:</span>
                      <span className="font-bold text-green-900">$13,900</span>
                    </div>
                  </div>
                </div>

                {/* Savings */}
                <div className="bg-[#1e3a5f] text-white p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold mb-1">$19,200/year</div>
                  <div className="text-sm opacity-90">58% Total Cost Reduction</div>
                  <div className="text-xs opacity-75 mt-2">87% less productivity loss</div>
                </div>
              </CardContent>
            </Card>

            {/* Case Study 3: Retail Portfolio */}
            <Card className="border-2 border-[#ff6b35]/20 hover:border-[#ff6b35] transition-all">
              <CardHeader className="bg-gradient-to-br from-[#ff6b35]/10 to-white pb-6">
                <Building2 className="h-10 w-10 text-[#ff6b35] mb-3" />
                <CardTitle className="text-2xl text-[#1e3a5f]">Retail Portfolio</CardTitle>
                <CardDescription className="text-base">4 retail locations across Essex County</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Before */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">BEFORE</span>
                    Multiple Vendors
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-red-800">Annual PM Costs:</span>
                      <span className="font-semibold text-red-900">$11,600</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Emergency Repairs:</span>
                      <span className="font-semibold text-red-900">$22,400</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-800">Lost Revenue (downtime):</span>
                      <span className="font-semibold text-red-900">$15,800</span>
                    </div>
                    <div className="flex justify-between border-t border-red-300 pt-2 mt-2">
                      <span className="text-red-800 font-bold">Total Annual Cost:</span>
                      <span className="font-bold text-red-900">$49,800</span>
                    </div>
                  </div>
                </div>

                {/* After */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">AFTER</span>
                    Our Portfolio Program
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-800">Monthly Subscription:</span>
                      <span className="font-semibold text-green-900">$1,400/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800 text-xs italic">Annual Total:</span>
                      <span className="font-semibold text-green-900 text-xs">$16,800</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Emergency Repairs:</span>
                      <span className="font-semibold text-green-900">$4,200</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-800">Lost Revenue (downtime):</span>
                      <span className="font-semibold text-green-900">$2,400</span>
                    </div>
                    <div className="flex justify-between border-t border-green-300 pt-2 mt-2">
                      <span className="text-green-800 font-bold">Total Annual Cost:</span>
                      <span className="font-bold text-green-900">$23,400</span>
                    </div>
                  </div>
                </div>

                {/* Savings */}
                <div className="bg-[#ff6b35] text-white p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold mb-1">$26,400/year</div>
                  <div className="text-sm opacity-90">53% Total Cost Reduction</div>
                  <div className="text-xs opacity-75 mt-2">85% less revenue loss</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Stats */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6 text-center">Average Savings Across All Case Studies</h3>
              <div className="mb-6 text-center">
                <div className="inline-block bg-[#ff6b35] text-white px-6 py-3 rounded-lg">
                  <div className="text-sm font-semibold">💰 Monthly Payments • Less Cash Upfront • Predictable Budgeting</div>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-4xl font-bold text-[#ff6b35] mb-2">49%</div>
                  <div className="text-sm opacity-90">Average Cost Reduction</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-[#ff6b35] mb-2">84%</div>
                  <div className="text-sm opacity-90">Fewer Emergency Repairs</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-[#ff6b35] mb-2">83%</div>
                  <div className="text-sm opacity-90">Less Downtime/Revenue Loss</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Comparison Calculator */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Compare Your Savings</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                See how much you could save with our subscription model vs. traditional pay-per-service maintenance
              </p>
            </div>

            <Card className="border-2 border-[#ff6b35]/20">
              <CardContent className="p-8">
                <PaymentCalculator />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Property Managers Choose Us */}
      <section className="py-20 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] mb-4">Why Property Managers Choose Us</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Trusted partner for residential and commercial property management
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <TrendingDown className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Predictable Monthly Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Fixed pricing eliminates budget surprises and simplifies financial planning</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Fewer Emergency Repairs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Proactive maintenance reduces unexpected breakdowns and tenant complaints</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Digital Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Complete accountability with digital reports and asset tracking</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building2 className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Revenue-Share Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Value-add programs that benefit both owners and tenants</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">Trusted Local Contractor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Over 20 years of experience serving New Jersey properties</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Award className="h-8 w-8 text-[#ff6b35] mb-2" />
                <CardTitle className="text-lg">WMBE/SBE Certified</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Certified minority & woman-owned business in NJ/NY</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Stabilize Your HVAC Costs?</h2>
            <p className="text-xl text-white/90 mb-8">
              Contact us today to discuss a custom maintenance program tailored to your property portfolio. We'll help you reduce emergencies, extend equipment life, and improve tenant satisfaction.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold">
                  Request Custom Quote <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm text-white border-white hover:bg-white/20">
                <a href="tel:8624239396">Call (862) 423-9396</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
