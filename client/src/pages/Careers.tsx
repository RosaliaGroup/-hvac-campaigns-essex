import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, GraduationCap, Award, TrendingUp, Shield, Wrench, Briefcase, Heart, CheckCircle2, BookOpen, ClipboardCheck } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function Careers() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] text-white py-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90">Join Our Team</Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Build Your Career With <span className="text-[#ff6b35]">Mechanical Enterprise</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-200 mb-8 leading-relaxed">
              Join a growing WMBE/SBE certified HVAC company committed to employee development, continuing education, and professional growth
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="mailto:sales@mechanicalenterprise.com?subject=Career Inquiry" 
                className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#e55a25] transition-all shadow-lg hover:shadow-xl"
              >
                <Briefcase className="w-5 h-5" />
                Apply Now
              </a>
              <a 
                href="tel:862-423-9396" 
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/20 transition-all border border-white/30"
              >
                Call (862) 423-9396
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Why Work With Us */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-12 text-center">
              Why Choose Mechanical Enterprise
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-t-4 border-t-[#ff6b35]">
                <CardHeader>
                  <GraduationCap className="h-10 w-10 text-[#ff6b35] mb-3" />
                  <CardTitle className="text-lg">Continuing Education</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    OSHA, EPA, and industry certifications paid by the company
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-[#1e3a5f]">
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-[#ff6b35] mb-3" />
                  <CardTitle className="text-lg">Career Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Clear advancement paths from apprentice to master technician
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-[#ff6b35]">
                <CardHeader>
                  <Award className="h-10 w-10 text-[#ff6b35] mb-3" />
                  <CardTitle className="text-lg">Competitive Pay</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Industry-leading wages with performance bonuses
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-[#1e3a5f]">
                <CardHeader>
                  <Heart className="h-10 w-10 text-[#ff6b35] mb-3" />
                  <CardTitle className="text-lg">Benefits Package</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Health insurance, paid time off, and retirement plans
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-[#ff6b35]">
                <CardHeader>
                  <Wrench className="h-10 w-10 text-[#ff6b35] mb-3" />
                  <CardTitle className="text-lg">Modern Equipment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Latest tools and technology for efficient, quality work
                  </p>
                </CardContent>
              </Card>

              <Card className="border-t-4 border-t-[#1e3a5f]">
                <CardHeader>
                  <Users className="h-10 w-10 text-[#ff6b35] mb-3" />
                  <CardTitle className="text-lg">Team Culture</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Supportive environment with 20+ years of combined experience
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Employee Testimonials */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4 text-center">
              Hear From Our Team
            </h2>
            <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
              Real stories from technicians who have grown their careers with us
            </p>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Testimonial 1 */}
              <Card className="bg-white border-t-4 border-t-[#ff6b35]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#ff6b35]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1e3a5f]">Marcus J.</div>
                      <div className="text-sm text-slate-600">Lead Technician, 4 years</div>
                    </div>
                  </div>
                  <p className="text-slate-700 italic mb-4">
                    "I started as an apprentice with zero HVAC experience. The company paid for my EPA 608, OSHA 30, and NATE certifications. Now I'm leading commercial installations and earning twice what I made before. The investment in training here is real."
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">EPA 608</Badge>
                    <Badge variant="outline" className="text-xs">OSHA 30</Badge>
                    <Badge variant="outline" className="text-xs">NATE</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Testimonial 2 */}
              <Card className="bg-white border-t-4 border-t-[#1e3a5f]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#ff6b35]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1e3a5f]">Sarah L.</div>
                      <div className="text-sm text-slate-600">Service Technician, 3 years</div>
                    </div>
                  </div>
                  <p className="text-slate-700 italic mb-4">
                    "The VRF/VRV training I received here opened doors to high-end commercial projects. Plus, the company culture is supportive - senior techs actually want to teach you. I've never felt stuck or like I couldn't ask questions."
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">VRF/VRV</Badge>
                    <Badge variant="outline" className="text-xs">BAS</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Testimonial 3 */}
              <Card className="bg-white border-t-4 border-t-[#ff6b35]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#ff6b35]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1e3a5f]">David M.</div>
                      <div className="text-sm text-slate-600">Installation Specialist, 2 years</div>
                    </div>
                  </div>
                  <p className="text-slate-700 italic mb-4">
                    "Coming from another HVAC company, the difference is night and day. Here, they actually invest in you - paid certifications, modern tools, and real career progression. I've learned more in 2 years here than 5 years at my previous job."
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">OSHA 10</Badge>
                    <Badge variant="outline" className="text-xs">First Aid</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Comparison Chart */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4 text-center">
              How We Compare
            </h2>
            <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
              Our benefits package vs. industry standard
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] text-white">
                    <th className="p-4 text-left font-semibold">Benefit</th>
                    <th className="p-4 text-center font-semibold">Industry Standard</th>
                    <th className="p-4 text-center font-semibold bg-[#ff6b35]">Mechanical Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Continuing Education</td>
                    <td className="p-4 text-center text-slate-600">Limited or self-funded</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Fully company-paid</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">OSHA Certification</td>
                    <td className="p-4 text-center text-slate-600">OSHA 10 only</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ OSHA 10 & 30</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">EPA 608 Certification</td>
                    <td className="p-4 text-center text-slate-600">Employee pays</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Company-paid</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Advanced Training (VRF/VRV, BAS)</td>
                    <td className="p-4 text-center text-slate-600">Rarely offered</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Included</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Health Insurance</td>
                    <td className="p-4 text-center text-slate-600">Basic coverage</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Comprehensive plans</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Paid Time Off</td>
                    <td className="p-4 text-center text-slate-600">1-2 weeks/year</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Competitive PTO</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Retirement Plan</td>
                    <td className="p-4 text-center text-slate-600">No match</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ With company match</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Performance Bonuses</td>
                    <td className="p-4 text-center text-slate-600">Uncommon</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Regular bonuses</td>
                  </tr>
                  <tr className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Modern Tools & Equipment</td>
                    <td className="p-4 text-center text-slate-600">Basic tools</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Latest technology</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-[#1e3a5f]">Career Advancement Path</td>
                    <td className="p-4 text-center text-slate-600">Unclear</td>
                    <td className="p-4 text-center font-semibold text-green-700">✓ Defined progression</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 p-6 bg-gradient-to-br from-[#ff6b35]/10 to-white rounded-lg border-l-4 border-[#ff6b35]">
              <p className="text-slate-700">
                <strong className="text-[#1e3a5f]">Our Commitment:</strong> We believe that investing in our team's development creates better technicians, happier employees, and superior service for our clients. Every benefit listed is designed to support your long-term career growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Continuing Education Programs */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <GraduationCap className="h-16 w-16 text-[#ff6b35] mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4">
                Continuing Education & Professional Development
              </h2>
              <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                We invest in our team's growth through industry-leading training programs and certifications
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Safety & Compliance */}
              <Card className="border-l-4 border-l-[#ff6b35]">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="h-8 w-8 text-[#ff6b35]" />
                    <CardTitle className="text-2xl">Safety & Compliance Training</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">OSHA 10 & 30-Hour Certification</span>
                        <p className="text-sm text-slate-600">Construction safety standards and hazard recognition</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">EPA Section 608 Certification</span>
                        <p className="text-sm text-slate-600">Refrigerant handling and environmental compliance</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">Confined Space Entry</span>
                        <p className="text-sm text-slate-600">Safe work practices in restricted environments</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">Fall Protection & Ladder Safety</span>
                        <p className="text-sm text-slate-600">Height safety and equipment use training</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Technical Certifications */}
              <Card className="border-l-4 border-l-[#1e3a5f]">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="h-8 w-8 text-[#ff6b35]" />
                    <CardTitle className="text-2xl">Technical Certifications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">NATE Certification</span>
                        <p className="text-sm text-slate-600">North American Technician Excellence credentials</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">VRF/VRV System Training</span>
                        <p className="text-sm text-slate-600">Advanced heat pump system installation and service</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">Building Automation Systems</span>
                        <p className="text-sm text-slate-600">Smart HVAC controls and energy management</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1e3a5f]">Energy Efficiency Programs</span>
                        <p className="text-sm text-slate-600">Rebate programs and decarbonization initiatives</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Additional Training */}
            <Card className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8f] text-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="h-8 w-8 text-[#ff6b35]" />
                  <CardTitle className="text-2xl">Additional Professional Development</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>First Aid & CPR Certification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Electrical Safety Training</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Hazmat Awareness</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Lockout/Tagout Procedures</span>
                    </li>
                  </ul>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Customer Service Excellence</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Project Management Basics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Digital Tools & Technology</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                      <span>Leadership Development Program</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                  <p className="text-sm text-white/90">
                    <strong className="text-[#ff6b35]">All training costs covered by Mechanical Enterprise.</strong> We believe in investing in our team's success through continuous learning and professional development.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-12 text-center">
              Current Opportunities
            </h2>
            
            <div className="space-y-6">
              {/* HVAC Technician */}
              <Card className="border-l-4 border-l-[#ff6b35] hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl text-[#1e3a5f] mb-2">HVAC Service Technician</CardTitle>
                      <CardDescription className="text-base">Full-time • Newark, NJ • Competitive Pay</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-4">
                    Seeking experienced HVAC technicians for residential and commercial service, maintenance, and installation work across 15 NJ counties.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline">EPA 608 Required</Badge>
                    <Badge variant="outline">3+ Years Experience</Badge>
                    <Badge variant="outline">Valid Driver's License</Badge>
                  </div>
                  <a 
                    href="mailto:sales@mechanicalenterprise.com?subject=HVAC Technician Application" 
                    className="inline-flex items-center gap-2 text-[#ff6b35] hover:text-[#e55a25] font-semibold"
                  >
                    Apply Now →
                  </a>
                </CardContent>
              </Card>

              {/* HVAC Installer */}
              <Card className="border-l-4 border-l-[#1e3a5f] hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl text-[#1e3a5f] mb-2">HVAC Installation Specialist</CardTitle>
                      <CardDescription className="text-base">Full-time • Newark, NJ • Competitive Pay</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-4">
                    Join our installation team working on VRF/VRV heat pump systems, commercial upgrades, and residential decarbonization projects.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline">OSHA 10 Preferred</Badge>
                    <Badge variant="outline">2+ Years Experience</Badge>
                    <Badge variant="outline">Team Player</Badge>
                  </div>
                  <a 
                    href="mailto:sales@mechanicalenterprise.com?subject=HVAC Installer Application" 
                    className="inline-flex items-center gap-2 text-[#ff6b35] hover:text-[#e55a25] font-semibold"
                  >
                    Apply Now →
                  </a>
                </CardContent>
              </Card>

              {/* Apprentice */}
              <Card className="border-l-4 border-l-[#ff6b35] hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl text-[#1e3a5f] mb-2">HVAC Apprentice</CardTitle>
                      <CardDescription className="text-base">Full-time • Newark, NJ • Entry Level</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-4">
                    Start your HVAC career with comprehensive on-the-job training and paid certifications. No experience required - we'll train you!
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline">No Experience Required</Badge>
                    <Badge variant="outline">Paid Training</Badge>
                    <Badge variant="outline">Career Growth Path</Badge>
                  </div>
                  <a 
                    href="mailto:sales@mechanicalenterprise.com?subject=HVAC Apprentice Application" 
                    className="inline-flex items-center gap-2 text-[#ff6b35] hover:text-[#e55a25] font-semibold"
                  >
                    Apply Now →
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <ClipboardCheck className="h-16 w-16 text-[#ff6b35] mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4">
                Apply Now
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Complete the form below to submit your application. We review all applications and will contact qualified candidates within 3-5 business days.
              </p>
            </div>

            <Card className="border-2 border-[#ff6b35]/20">
              <CardContent className="p-0">
                <iframe 
                  src="https://docs.google.com/forms/d/e/1FAIpQLSd8GwaX3VjNffO3SvCnGTc-1wGwKv3QbhvGrWP__WJPYP_Vuw/viewform?embedded=true" 
                  width="100%" 
                  height="1400" 
                  frameBorder="0" 
                  marginHeight={0} 
                  marginWidth={0}
                  className="rounded-lg"
                >
                  Loading…
                </iframe>
              </CardContent>
            </Card>

            <div className="mt-6 text-center text-sm text-slate-600">
              <p>Prefer to email your resume? Send it to <a href="mailto:sales@mechanicalenterprise.com" className="text-[#ff6b35] hover:underline font-semibold">sales@mechanicalenterprise.com</a></p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Join Our Team?
            </h2>
            <p className="text-xl text-slate-200 mb-8 leading-relaxed">
              Take the next step in your HVAC career with a company that invests in your growth and success
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="mailto:sales@mechanicalenterprise.com?subject=Career Inquiry" 
                className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#e55a25] transition-all shadow-lg hover:shadow-xl"
              >
                <Briefcase className="w-5 h-5" />
                Submit Your Resume
              </a>
              <a 
                href="tel:862-423-9396" 
                className="inline-flex items-center gap-2 bg-white text-[#1e3a5f] px-8 py-4 rounded-lg font-semibold hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl"
              >
                Call (862) 423-9396
              </a>
            </div>

            <p className="text-sm text-slate-300 mt-8">
              Questions about careers? Email us at <a href="mailto:sales@mechanicalenterprise.com" className="text-[#ff6b35] hover:underline">sales@mechanicalenterprise.com</a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
