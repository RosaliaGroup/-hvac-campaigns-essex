import { Link } from "wouter";
import { Users, TrendingUp, FileText, Handshake, Building2, Home, Zap, DollarSign, Clock, CheckCircle2 } from "lucide-react";

export default function Partnerships() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] text-white py-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#ff6b35]/20 text-[#ff6b35] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#ff6b35]/30">
              <Handshake className="w-4 h-4" />
              Partnership Opportunities
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Earn Income Through <span className="text-[#ff6b35]">Referrals & Sales</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-200 mb-8 leading-relaxed">
              Connect businesses and property owners with cost-saving HVAC upgrades and maintenance programs
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="mailto:sales@mechanicalenterprise.com?subject=Partnership Inquiry" 
                className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#e55a25] transition-all shadow-lg hover:shadow-xl"
              >
                <Users className="w-5 h-5" />
                Become a Partner
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

      {/* Overview Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-6 text-center">
              Flexible Referral or Sales Opportunities
            </h2>
            
            <div className="prose prose-lg max-w-none text-slate-700 space-y-4">
              <p className="text-lg leading-relaxed">
                Are you a business owner, professional, or community connector with relationships in industries like retail, property management, real estate, construction, hospitality, or commercial services?
              </p>
              
              <p className="text-lg leading-relaxed">
                We're looking for motivated individuals and business owners who want to earn extra income by introducing clients to our building efficiency and maintenance programs.
              </p>
              
              <p className="text-lg leading-relaxed font-semibold text-[#1e3a5f]">
                You don't need technical experience — just the right connections and an interest in helping businesses access cost-saving upgrades and maintenance solutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Success Stories */}
      <section className="py-16 bg-gradient-to-br from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4 text-center">
              Partner Success Stories
            </h2>
            <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
              See how our partners are earning substantial income by leveraging their networks
            </p>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Success Story 1 */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-br from-[#ff6b35] to-[#e55a25] p-6 text-white">
                  <div className="text-4xl font-bold mb-1">$8,500</div>
                  <div className="text-white/90">Average Monthly Earnings</div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-[#ff6b35]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1e3a5f]">Maria R.</div>
                      <div className="text-sm text-slate-600">Property Manager</div>
                    </div>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed mb-4">
                    "I manage 12 residential buildings in Essex County. By referring my properties for HVAC upgrades and maintenance contracts, I've created a consistent income stream while improving tenant comfort."
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600 mb-1">Network Leverage:</div>
                    <div className="text-sm font-semibold text-[#1e3a5f]">Multi-family property portfolio</div>
                  </div>
                </div>
              </div>

              {/* Success Story 2 */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8f] p-6 text-white">
                  <div className="text-4xl font-bold mb-1">$12,300</div>
                  <div className="text-white/90">Average Monthly Earnings</div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center">
                      <Zap className="w-6 h-6 text-[#ff6b35]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1e3a5f]">James T.</div>
                      <div className="text-sm text-slate-600">Solar Installer</div>
                    </div>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed mb-4">
                    "Every solar customer I work with also needs efficient HVAC. By partnering with Mechanical Enterprise, I offer complete energy solutions and earn commissions on both solar and HVAC installations."
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600 mb-1">Network Leverage:</div>
                    <div className="text-sm font-semibold text-[#1e3a5f]">Existing solar customer base</div>
                  </div>
                </div>
              </div>

              {/* Success Story 3 */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-br from-[#ff6b35] to-[#e55a25] p-6 text-white">
                  <div className="text-4xl font-bold mb-1">$6,200</div>
                  <div className="text-white/90">Average Monthly Earnings</div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-[#ff6b35]/10 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#ff6b35]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#1e3a5f]">David K.</div>
                      <div className="text-sm text-slate-600">Real Estate Agent</div>
                    </div>
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed mb-4">
                    "I connect my commercial real estate clients with HVAC solutions during property transactions. It's a natural fit, and the referral model means I earn without extra work."
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-xs text-slate-600 mb-1">Network Leverage:</div>
                    <div className="text-sm font-semibold text-[#1e3a5f]">Commercial real estate clients</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-12 text-center">
              Who This Is For
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg">
                    <Building2 className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Business Owners</h3>
                    <p className="text-slate-600">
                      With existing client relationships in retail, restaurants, property management, or office operations
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Network Professionals</h3>
                    <p className="text-slate-600">
                      Individuals with strong local or professional networks in commercial sectors
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg">
                    <FileText className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Freelancers & Consultants</h3>
                    <p className="text-slate-600">
                      Agents or consultants seeking additional income streams with flexible schedules
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg">
                    <Handshake className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Community Connectors</h3>
                    <p className="text-slate-600">
                      Anyone who enjoys connecting people with valuable services and solutions
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Industries */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-6 text-center">
              Industries We Serve
            </h2>
            <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
              Connect us with decision-makers in these sectors who need HVAC upgrades or maintenance services
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
                <Building2 className="w-12 h-12 text-[#ff6b35] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Property Management</h3>
                <p className="text-sm text-slate-600">Commercial & residential property managers, real estate investors</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
                <Home className="w-12 h-12 text-[#ff6b35] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Homeowners</h3>
                <p className="text-sm text-slate-600">Residential property owners seeking energy-efficient upgrades</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
                <Building2 className="w-12 h-12 text-[#ff6b35] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Facility Managers</h3>
                <p className="text-sm text-slate-600">Commercial building operations and maintenance teams</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
                <Zap className="w-12 h-12 text-[#ff6b35] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Solar Companies</h3>
                <p className="text-sm text-slate-600">Solar installers looking to offer complementary HVAC services</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
                <Building2 className="w-12 h-12 text-[#ff6b35] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Construction & Contractors</h3>
                <p className="text-sm text-slate-600">General contractors and construction project managers</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
                <Building2 className="w-12 h-12 text-[#ff6b35] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">Retail & Hospitality</h3>
                <p className="text-sm text-slate-600">Restaurant owners, retail stores, hotels, and office spaces</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Do */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-12 text-center">
              What You'll Do
            </h2>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-[#ff6b35]">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Refer Qualified Clients</h3>
                    <p className="text-slate-600">
                      Connect us with businesses, commercial real estate owners, homeowners, property managers, investors, or facility managers who could benefit from efficiency upgrades or system improvements
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-[#ff6b35]">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                    <TrendingUp className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Close Sales Directly (Optional)</h3>
                    <p className="text-slate-600">
                      For higher commission potential, you can choose to close deals directly with support from our team
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-[#ff6b35]">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                    <DollarSign className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Help Clients Access Savings</h3>
                    <p className="text-slate-600">
                      Guide clients to available rebates, tax credits, and cost-saving options that make upgrades more affordable
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-[#ff6b35]">
                <div className="flex items-start gap-4">
                  <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                    <FileText className="w-6 h-6 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Receive Full Support</h3>
                    <p className="text-slate-600">
                      Get marketing materials, training, and ongoing support from our experienced team
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Earning Potential */}
      <section className="py-16 bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8f] text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              Earning Potential
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl border border-white/20">
                <div className="bg-[#ff6b35] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Referral Model</h3>
                <p className="text-slate-200 text-lg leading-relaxed">
                  Simply connect us with a qualified client — we handle the rest. Earn commission on every successful referral.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl border border-white/20">
                <div className="bg-[#ff6b35] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Sales Model</h3>
                <p className="text-slate-200 text-lg leading-relaxed">
                  Close deals directly to earn higher commissions. Perfect for experienced sales professionals.
                </p>
              </div>
            </div>

            <div className="bg-[#ff6b35] p-8 rounded-xl text-center">
              <p className="text-2xl font-bold mb-2">Top partners earn thousands monthly</p>
              <p className="text-lg text-white/90">Based on performance and network reach</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Join */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-12 text-center">
              Why Join Our Partnership Program
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">No Upfront Investment</h3>
                  <p className="text-slate-600">
                    No inventory, no equipment, no startup costs. Start earning immediately.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                  <Clock className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Flexible Schedule</h3>
                  <p className="text-slate-600">
                    Work full-time, part-time, or on your own terms. Perfect for side income.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                  <DollarSign className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Immediate Earning Potential</h3>
                  <p className="text-slate-600">
                    Start earning through referrals right away. No waiting period.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-[#ff6b35]/10 p-3 rounded-lg shrink-0">
                  <TrendingUp className="w-6 h-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Real Client Benefits</h3>
                  <p className="text-slate-600">
                    Programs deliver genuine financial and operational benefits to clients.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Kit Download */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8f] rounded-2xl p-8 md:p-12 text-white shadow-2xl">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 bg-[#ff6b35] px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    <FileText className="w-4 h-4" />
                    Free Download
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Download Partner Kit
                  </h2>
                  <p className="text-lg text-slate-200 mb-6 leading-relaxed">
                    Get our comprehensive partner guide with detailed commission structure, program overview, marketing materials guide, and everything you need to start earning.
                  </p>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#ff6b35]" />
                      <span>Detailed commission breakdown</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#ff6b35]" />
                      <span>Target industry profiles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#ff6b35]" />
                      <span>Getting started checklist</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#ff6b35]" />
                      <span>FAQs and support resources</span>
                    </li>
                  </ul>
                  <a 
                    href="/mechanical-enterprise-partner-kit.pdf" 
                    download
                    className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#e55a25] transition-all shadow-lg hover:shadow-xl"
                  >
                    <FileText className="w-5 h-5" />
                    Download Partner Kit (PDF)
                  </a>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-48 h-64 bg-white/10 backdrop-blur-sm rounded-lg border-2 border-white/30 flex items-center justify-center">
                    <FileText className="w-24 h-24 text-white/50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Application Form */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4">
                Apply to Become a Partner
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Fill out the form below to get started. We'll review your application and contact you within 24-48 hours to discuss next steps.
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-8">
              <iframe 
                src="https://docs.google.com/forms/d/e/1FAIpQLSeRXfVVpxfmuAQkXBS4JADVyexOb5u8RaAfx3EO5uUcCF9HjA/viewform?embedded=true" 
                width="100%" 
                height="1200" 
                frameBorder="0" 
                marginHeight={0} 
                marginWidth={0}
                className="rounded-lg"
              >
                Loading…
              </iframe>
              <p className="text-sm text-slate-500 mt-4 text-center">
                Form not loading? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeRXfVVpxfmuAQkXBS4JADVyexOb5u8RaAfx3EO5uUcCF9HjA/viewform" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">Open in new window</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Job Types */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-bold text-[#1e3a5f] mb-6">Job Types Available</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <span className="bg-white px-6 py-3 rounded-lg shadow-md border border-slate-200 font-semibold text-[#1e3a5f]">
                Full-time
              </span>
              <span className="bg-white px-6 py-3 rounded-lg shadow-md border border-slate-200 font-semibold text-[#1e3a5f]">
                Part-time
              </span>
              <span className="bg-white px-6 py-3 rounded-lg shadow-md border border-slate-200 font-semibold text-[#1e3a5f]">
                Contract
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Earning?
            </h2>
            <p className="text-xl text-slate-200 mb-8 leading-relaxed">
              Join our partnership program today and start connecting clients with valuable HVAC solutions
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="mailto:sales@mechanicalenterprise.com?subject=Partnership Inquiry" 
                className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#e55a25] transition-all shadow-lg hover:shadow-xl"
              >
                <Users className="w-5 h-5" />
                Apply Now
              </a>
              <a 
                href="tel:862-423-9396" 
                className="inline-flex items-center gap-2 bg-white text-[#1e3a5f] px-8 py-4 rounded-lg font-semibold hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl"
              >
                Call (862) 423-9396
              </a>
            </div>

            <p className="text-sm text-slate-300 mt-8">
              Questions? Email us at <a href="mailto:sales@mechanicalenterprise.com" className="text-[#ff6b35] hover:underline">sales@mechanicalenterprise.com</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
