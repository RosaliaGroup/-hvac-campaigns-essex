import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Flame,
  Snowflake,
  DollarSign,
  Zap,
  Home,
  Phone,
  Calendar,
  ArrowRight,
  Star,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";

const BOOKING_URL = "https://calendar.app.google/hmqUZUKYWoyjv5ke6";

const caseStudies = [
  {
    title: "Single-Family Home Upgrade",
    location: "Montclair, NJ",
    size: "3 BR / 2 BA · 1,800 sq ft",
    oldSystem: "40-year-old oil furnace + 5 window AC units",
    newSystem: "Multi-Zone Heat Pump System",
    installCost: "$23,500",
    rebate: "$14,000",
    outOfPocket: "$9,500",
    monthly: "$79/mo",
    beforeEnergy: "$385/mo",
    afterEnergy: "$165/mo",
    annualSavings: "$2,640",
    netSavings: "+$141/month",
    propertyValue: "$15,000 – $20,000",
    savings: "57%",
    benefits: [
      "Eliminated oil tank and delivery costs",
      "Replaced 5 noisy window units",
      "Year-round comfort with one modern system",
      "Increased home value for future resale",
    ],
  },
  {
    title: "Colonial Home Modernization",
    location: "Summit, NJ",
    size: "4 BR / 3 BA · 2,600 sq ft",
    oldSystem: "Steam radiators (gas boiler) + aging central AC",
    newSystem: "Ducted Heat Pump System",
    installCost: "$29,800",
    rebate: "$16,000",
    outOfPocket: "$13,800",
    monthly: "$115/mo",
    beforeEnergy: "$520/mo",
    afterEnergy: "$235/mo",
    annualSavings: "$3,420",
    netSavings: "+$170/month",
    propertyValue: "$20,000 – $25,000",
    savings: "55%",
    benefits: [
      "Removed old radiators and freed up wall space",
      "Even temperature throughout all rooms",
      "Smart thermostat with zone control",
      "Eliminated gas utility connection fees",
    ],
  },
  {
    title: "Ranch Home Transformation",
    location: "Edison, NJ",
    size: "5 BR / 3 BA · 3,200 sq ft",
    oldSystem: "20-year-old gas furnace + outdated AC system",
    newSystem: "Ducted Heat Pump System with Smart Controls",
    installCost: "$34,500",
    rebate: "$16,000",
    outOfPocket: "$18,500",
    monthly: "$154/mo",
    beforeEnergy: "$640/mo",
    afterEnergy: "$290/mo",
    annualSavings: "$4,200",
    netSavings: "+$196/month",
    propertyValue: "$25,000 – $30,000",
    savings: "55%",
    benefits: [
      "Upgraded from 15 SEER to 20+ SEER efficiency",
      "Whole-home dehumidification included",
      "Improved indoor air quality",
      "Future-proof energy-efficient system",
    ],
  },
];

export default function PromosLanding() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f2340 60%, #1a3a6b 100%)",
        }}
      >
        {/* Decorative flames/ice */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -left-20 top-0 w-72 h-full opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at left, #ff6b35 0%, #ff4500 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute -right-20 top-0 w-72 h-full opacity-25"
            style={{
              background:
                "radial-gradient(ellipse at right, #4fc3f7 0%, #0288d1 40%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-14 text-center">
          {/* Logo + brand */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border-2 border-[#ff6b35]">
              <span className="text-2xl">🦊</span>
            </div>
            <div className="text-left">
              <p className="text-[#ff6b35] font-bold text-sm tracking-widest uppercase">
                Mechanical Enterprise
              </p>
              <p className="text-white/70 text-xs">Essex County, NJ · Licensed & Insured</p>
            </div>
          </div>

          <Badge className="mb-4 bg-[#ff6b35] text-white text-sm px-4 py-1 uppercase tracking-wide">
            🔥 Limited-Time Residential Promos
          </Badge>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-4">
            Replace & Upgrade
            <br />
            <span className="text-[#ffd700]">Your HVAC System!</span>
          </h1>

          <p className="text-xl text-white/85 mb-6 max-w-2xl mx-auto">
            Get up to{" "}
            <span className="text-[#ffd700] font-bold">$16,000 in rebates</span> for
            energy-efficient heat pump installation.{" "}
            <span className="text-white font-semibold">No money out of pocket.</span>
          </p>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-8">
            {[
              { icon: <DollarSign className="w-5 h-5" />, label: "Up to $16K Rebates" },
              { icon: <Zap className="w-5 h-5" />, label: "0% Financing" },
              { icon: <ShieldCheck className="w-5 h-5" />, label: "No Money Down" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/10 backdrop-blur-sm rounded-xl py-3 px-2 border border-white/20 flex flex-col items-center gap-1"
              >
                <span className="text-[#ff6b35]">{s.icon}</span>
                <span className="text-white text-xs font-semibold text-center">{s.label}</span>
              </div>
            ))}
          </div>

          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-[#ff6b35] hover:bg-[#e55a25] text-white font-bold text-lg px-10 py-6 rounded-full shadow-xl"
            >
              <Calendar className="mr-2 w-5 h-5" />
              Book FREE Assessment Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>

          <p className="text-white/50 text-xs mt-3">
            No obligation · Free consultation · Serving 15 NJ counties
          </p>
        </div>
      </section>

      {/* ── Starburst promo banner ─────────────────────────────────── */}
      <section className="bg-[#ff6b35] py-5">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6 text-white text-center">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Flame className="w-6 h-6 text-[#ffd700]" />
            UTILITY REBATES &amp; 0% FINANCING AVAILABLE!
          </div>
          <div className="flex items-center gap-2 font-bold text-lg">
            <Snowflake className="w-6 h-6 text-blue-200" />
            BRAND NEW HEAT PUMP SYSTEM
          </div>
          <div className="flex items-center gap-2 font-bold text-lg">
            <DollarSign className="w-6 h-6 text-[#ffd700]" />
            NO MONEY OUT OF POCKET
          </div>
        </div>
      </section>

      {/* ── Featured Program ──────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-[#ff6b35]/10 text-[#ff6b35] border border-[#ff6b35]/30">
              🔥 Featured Program
            </Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1e3a5f]">
              Residential Decarbonization Program
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">
              Up to $16,000 in rebates for homeowners upgrading to energy-efficient heat pumps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <DollarSign className="w-8 h-8 text-[#ff6b35]" />,
                title: "Up to $16,000",
                desc: "Substantial rebates available for residential heat pump installations",
                bg: "bg-orange-50 border-orange-200",
              },
              {
                icon: <TrendingDown className="w-8 h-8 text-green-600" />,
                title: "50% Energy Savings",
                desc: "Modern heat pumps dramatically reduce your monthly utility bills",
                bg: "bg-green-50 border-green-200",
              },
              {
                icon: <Home className="w-8 h-8 text-[#1e3a5f]" />,
                title: "Year-Round Comfort",
                desc: "One system for both heating and cooling your entire home",
                bg: "bg-blue-50 border-blue-200",
              },
            ].map((f) => (
              <Card key={f.title} className={`border ${f.bg} shadow-sm`}>
                <CardContent className="pt-6 text-center">
                  <div className="flex justify-center mb-3">{f.icon}</div>
                  <h3 className="font-bold text-[#1e3a5f] text-lg mb-1">{f.title}</h3>
                  <p className="text-gray-500 text-sm">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Case Studies ──────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1e3a5f]">
              Real Homeowner Results
            </h2>
            <p className="text-gray-500 mt-2">
              See how NJ homeowners are saving money and increasing property value
            </p>
          </div>

          <div className="space-y-8">
            {caseStudies.map((cs, i) => (
              <Card
                key={i}
                className="border border-gray-200 shadow-md overflow-hidden"
              >
                <div className="bg-[#1e3a5f] px-6 py-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-white font-bold text-lg">{cs.title}</h3>
                    <p className="text-white/70 text-sm">
                      {cs.location} · {cs.size}
                    </p>
                  </div>
                  <Badge className="bg-[#ff6b35] text-white font-bold text-base px-4 py-1">
                    {cs.savings} Energy Reduction
                  </Badge>
                </div>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: financials */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Old System", value: cs.oldSystem, color: "text-red-600" },
                          { label: "New System", value: cs.newSystem, color: "text-green-600" },
                          { label: "Installation Cost", value: cs.installCost, color: "text-gray-700" },
                          { label: "Rebate Received", value: cs.rebate, color: "text-[#ff6b35] font-bold" },
                          { label: "Out of Pocket", value: cs.outOfPocket, color: "text-[#1e3a5f] font-bold" },
                          { label: "Monthly Payment", value: `${cs.monthly} (10 yrs)`, color: "text-gray-700" },
                        ].map((item) => (
                          <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{item.label}</p>
                            <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Net savings callout */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-green-700 font-extrabold text-2xl">{cs.netSavings}</p>
                        <p className="text-green-600 text-sm font-medium">Net Monthly Savings</p>
                        <p className="text-gray-500 text-xs mt-1">
                          Energy savings cover the monthly payment!
                        </p>
                      </div>
                    </div>

                    {/* Right: energy + benefits */}
                    <div className="space-y-4">
                      {/* Energy costs */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-semibold">
                          Monthly Energy Costs
                        </p>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 text-center">
                            <p className="text-red-500 text-xs font-semibold">Before</p>
                            <p className="text-red-600 font-extrabold text-xl">{cs.beforeEnergy}</p>
                          </div>
                          <ArrowRight className="text-gray-400 w-5 h-5 flex-shrink-0" />
                          <div className="flex-1 text-center">
                            <p className="text-green-500 text-xs font-semibold">After</p>
                            <p className="text-green-600 font-extrabold text-xl">{cs.afterEnergy}</p>
                          </div>
                        </div>
                        <div className="mt-3 text-center">
                          <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                            Annual Savings: {cs.annualSavings}
                          </span>
                        </div>
                      </div>

                      {/* Property value */}
                      <div className="bg-[#1e3a5f]/5 border border-[#1e3a5f]/20 rounded-xl p-4 text-center">
                        <p className="text-[#1e3a5f] text-xs font-semibold uppercase tracking-wide mb-1">
                          Property Value Increase
                        </p>
                        <p className="text-[#1e3a5f] font-extrabold text-xl">{cs.propertyValue}</p>
                        <p className="text-gray-400 text-xs mt-1">Based on comparable home sales</p>
                      </div>

                      {/* Benefits */}
                      <ul className="space-y-2">
                        {cs.benefits.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── On-Bill Repayment ─────────────────────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-[#1e3a5f] text-white">
              💡 Flexible Payment Option
            </Badge>
            <h2 className="text-3xl font-extrabold text-[#1e3a5f]">
              On-Bill Repayment — No Upfront Costs
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">
              Pay through your monthly utility bill. No money down for qualifying homeowners.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Homeowner Approval", desc: "Review and approve the proposed work and payment terms" },
              { step: "2", title: "Professional Installation", desc: "Our certified technicians complete the heat pump installation" },
              { step: "3", title: "Inspection & Verification", desc: "Official inspection confirms work is completed to standards" },
              { step: "4", title: "Rebate Processing", desc: "Rebate application processed and project finalized" },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#ff6b35] text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-3">
                  {s.step}
                </div>
                <h4 className="font-bold text-[#1e3a5f] text-sm mb-1">{s.title}</h4>
                <p className="text-gray-500 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-[#1e3a5f] rounded-2xl p-6 text-white text-center">
            <p className="text-[#ffd700] font-bold text-lg mb-1">
              Start saving on energy costs immediately
            </p>
            <p className="text-white/80 text-sm">
              Spread payments over 10 years through your utility bill. Utility account must be in
              good standing to qualify.
            </p>
          </div>
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────────────────── */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "4,000+", label: "Residential Installations" },
              { value: "15", label: "NJ Counties Served" },
              { value: "$16K", label: "Max Rebate Available" },
              { value: "55%+", label: "Average Energy Reduction" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold text-[#ff6b35]">{s.value}</p>
                <p className="text-gray-500 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section
        className="py-16"
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className="w-6 h-6 text-[#ffd700] fill-[#ffd700]" />
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Ready to Start Saving?
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Book your FREE assessment today. No obligation. Our experts will evaluate your home and
            show you exactly how much you can save.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="bg-[#ff6b35] hover:bg-[#e55a25] text-white font-bold text-lg px-10 py-6 rounded-full shadow-xl w-full sm:w-auto"
              >
                <Calendar className="mr-2 w-5 h-5" />
                Book FREE Assessment Now
              </Button>
            </a>
            <a href="tel:+18624239396">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white bg-white/10 hover:bg-white/20 font-bold text-lg px-10 py-6 rounded-full w-full sm:w-auto"
              >
                <Phone className="mr-2 w-5 h-5" />
                (862) 423-9396
              </Button>
            </a>
          </div>

          <p className="text-white/40 text-xs mt-6">
            Serving Bergen, Burlington, Camden, Essex, Gloucester, Hudson, Hunterdon, Mercer,
            Middlesex, Monmouth, Morris, Ocean, Passaic, Somerset, Union counties
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-[#0a1628] py-6 text-center text-white/40 text-xs">
        <p>
          © {new Date().getFullYear()} Mechanical Enterprise · WMBE/SBE Certified · NJ Licensed ·
          Fully Insured
        </p>
        <p className="mt-1">
          <a href="https://mechanicalenterprise.com" className="hover:text-white/70 underline">
            mechanicalenterprise.com
          </a>{" "}
          · (862) 423-9396 · sales@mechanicalenterprise.com
        </p>
      </footer>
    </div>
  );
}
