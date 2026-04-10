import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Star, Clock, Building2, ArrowRight, TrendingDown, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

export default function LPFBCommercial() {
  const { toast } = useToast();
  useSEO({
    title: "80% Off Commercial HVAC — NJ Business Incentives | Mechanical Enterprise",
    description: "NJ utility rebates, state programs, and federal deductions can cover up to 80% of your commercial HVAC upgrade. 500+ NJ businesses served. Free incentive analysis.",
    ogUrl: "https://mechanicalenterprise.com/lp/fb-commercial",
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", sqft: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Lead");
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call (862) 423-9396", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email && !form.phone) {
      toast({ title: "Please enter your email or phone number", variant: "destructive" });
      return;
    }
    captureLead.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      captureType: "lp_fb_commercial",
      pageUrl: window.location.href,
      message: `Facebook LP: Commercial Business | Company: ${form.company} | Sq Ft: ${form.sqft}`,
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        🏢 NJ Business Owners: Cut Commercial HVAC Costs by Up to <strong className="text-[#ff6b35]">80%</strong> with Stacked Incentives
      </div>

      {/* Hero */}
      <section className="py-12 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-800 border border-blue-200">🏢 NJ Commercial Property Owners & Managers</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] leading-tight mb-4">
            Your Business Could Qualify for <span className="text-[#ff6b35]">80% Off</span> a New HVAC System
          </h1>
          <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            NJ utility rebates, state programs, and federal deductions can cover up to 80% of your commercial HVAC upgrade. Mechanical Enterprise has done this for 500+ NJ businesses.
          </p>

          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Building2 className="h-4 w-4 text-[#ff6b35]" /> 2.6M+ Sq Ft Served</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> 4.9★ Rating</span>
            <span className="flex items-center gap-1"><Shield className="h-4 w-4 text-green-500" /> Licensed & Bonded</span>
          </div>

          {/* Lead Form */}
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Request Received!</h3>
                <p className="text-gray-600 text-sm mb-4">A commercial HVAC specialist will contact you within 4 business hours with a custom incentive analysis for your property.</p>
                <a href="tel:+18624239396">
                  <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold">
                    <Phone className="h-4 w-4 mr-2" /> Call (862) 423-9396
                  </Button>
                </a>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#1e3a5f] mb-1 text-center">Get Your Free Incentive Analysis</h2>
                <p className="text-xs text-gray-400 text-center mb-4">We'll calculate exactly how much your business can save.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                    <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                  <Input placeholder="Company / Property Name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  <Input placeholder="Approx. Square Footage" value={form.sqft} onChange={(e) => setForm({ ...form, sqft: e.target.value })} />
                  <Input type="email" placeholder="Business Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white font-bold py-4">
                    {captureLead.isPending ? "Analyzing..." : "Get My Free Analysis →"}
                  </Button>
                </form>
                <p className="text-xs text-gray-400 text-center mt-3">No obligation. Response within 4 business hours.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ROI Calculator Preview */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2">Commercial Incentive Breakdown</h2>
          <p className="text-white/70 text-center mb-8">Example: 10,000 sq ft office building in Essex County</p>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3">
              {[
                { label: "Estimated Install Cost", value: "$85,000", note: "VRV/VRF system, full building" },
                { label: "JCP&L / PSE&G Rebate", value: "- $18,000", note: "$200/ton for qualifying systems" },
                { label: "NJ Clean Energy Business", value: "- $25,500", note: "30% of eligible costs" },
                { label: "Federal 179D Deduction", value: "- $25,000", note: "$5/sq ft tax deduction" },
                { label: "MACRS Depreciation Benefit", value: "- $8,000", note: "5-year accelerated schedule" },
              ].map((item, i) => (
                <div key={item.label} className={`flex justify-between items-start p-3 rounded-lg ${i === 4 ? "border-t border-white/30 pt-4" : ""}`}>
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-white/50">{item.note}</div>
                  </div>
                  <div className={`font-bold text-lg ${item.value.startsWith("-") ? "text-green-400" : "text-white"}`}>{item.value}</div>
                </div>
              ))}
              <div className="bg-[#ff6b35] rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold text-lg">Net Cost After Incentives</div>
                  <div className="text-white/80 text-sm">~76% covered by incentives</div>
                </div>
                <div className="text-3xl font-bold">$8,500</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white/10 rounded-xl p-5">
                <TrendingDown className="h-8 w-8 text-green-400 mb-2" />
                <div className="text-2xl font-bold text-green-400">40–60%</div>
                <div className="font-semibold">Energy Cost Reduction</div>
                <p className="text-sm text-white/70 mt-1">VRV/VRF systems dramatically reduce energy consumption vs. traditional commercial HVAC</p>
              </div>
              <div className="bg-white/10 rounded-xl p-5">
                <Clock className="h-8 w-8 text-[#ff6b35] mb-2" />
                <div className="text-2xl font-bold text-[#ff6b35]">2–3 Years</div>
                <div className="font-semibold">Typical Payback Period</div>
                <p className="text-sm text-white/70 mt-1">After incentives, most commercial customers recoup their investment within 2–3 years through energy savings</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Trusted by NJ Businesses</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { type: "Office Buildings", detail: "Multi-zone control for open-plan offices" },
              { type: "Hotels & Hospitality", detail: "Individual room systems with central management" },
              { type: "Restaurants", detail: "Kitchen exhaust integration + dining comfort" },
              { type: "Healthcare", detail: "ASHRAE-compliant precision climate control" },
              { type: "Retail Spaces", detail: "Energy-efficient comfort for high-traffic areas" },
              { type: "Industrial", detail: "Large-scale systems for warehouses & manufacturing" },
            ].map((item) => (
              <div key={item.type} className="border border-gray-100 rounded-lg p-4 hover:border-[#ff6b35] transition-colors">
                <div className="font-bold text-[#1e3a5f] mb-1">{item.type}</div>
                <div className="text-sm text-gray-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Ready to Cut Your HVAC Costs?</h2>
          <p className="text-white/80 mb-6">Free commercial site survey and incentive analysis. No obligation. Serving 15 NJ counties.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18624239396">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
              </Button>
            </a>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Get Free Analysis <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
