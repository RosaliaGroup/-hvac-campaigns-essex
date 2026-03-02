import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Shield, Star, Clock, Building2, ArrowRight, Zap, Award } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

export default function LPCommercialVRV() {
  const { toast } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/commercial_vrv_lp" });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call us at (862) 423-9396", variant: "destructive" });
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
      captureType: "exit_popup",
      pageUrl: window.location.href,
      message: `Google Ads LP: Commercial VRV/VRF | Company: ${form.company}`,
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        <span className="text-[#ff6b35]">🏢 COMMERCIAL HVAC:</span> Up to 80% Covered by Incentive Programs — VRV/VRF Specialists
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-[#ff6b35] text-white text-xs px-3 py-1">2.6M+ Sq Ft Served · WMBE/SBE Certified</Badge>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                Cut Your Commercial HVAC Costs by <span className="text-[#ff6b35]">Up to 80%</span>
              </h1>
              <p className="text-lg text-white/90 mb-6">
                VRV/VRF systems with stacked utility and state incentives. Mechanical Enterprise has served over 2.6 million sq ft of commercial space across NJ.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  "JCP&L / PSE&G Commercial Rebates",
                  "NJ Clean Energy Business Program",
                  "Federal 179D Tax Deduction",
                  "BMS integration & smart controls included",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> 2.6M Sq Ft Served</span>
                <span className="flex items-center gap-1"><Award className="h-4 w-4" /> VRV/VRF Certified</span>
                <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> Licensed & Bonded</span>
              </div>
            </div>

            {/* Lead Form */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Request Received!</h3>
                  <p className="text-gray-600 mb-4">A commercial HVAC specialist will contact you within 4 business hours to discuss your project.</p>
                  <a href="tel:+18624239396">
                    <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-3">
                      <Phone className="h-4 w-4 mr-2" /> Call Now: (862) 423-9396
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-[#1e3a5f] mb-1">Get Your Commercial Assessment</h2>
                  <p className="text-sm text-gray-500 mb-4">Free site survey — we identify every available incentive for your building</p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                      <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <Input placeholder="Company / Property Name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                    <Input type="email" placeholder="Business Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base">
                      {captureLead.isPending ? "Sending..." : "Request Free Site Survey →"}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">No obligation. Response within 4 business hours.</p>
                  </form>
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4 text-[#ff6b35]" /> Commercial specialists available Mon–Sat
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Market Segments */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Industries We Serve</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: "Office Buildings", desc: "Multi-zone VRV/VRF for open-plan and private offices" },
              { name: "Hotels & Hospitality", desc: "Individual room control with central management" },
              { name: "Restaurants & Retail", desc: "High-efficiency systems for high-occupancy spaces" },
              { name: "Healthcare Facilities", desc: "Precision climate control meeting ASHRAE standards" },
              { name: "Industrial Warehouses", desc: "Large-scale systems for manufacturing and storage" },
              { name: "Multi-Family Housing", desc: "Apartment and condo building HVAC solutions" },
            ].map((item) => (
              <div key={item.name} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-[#ff6b35]">
                <h3 className="font-bold text-[#1e3a5f] mb-1">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why VRV/VRF */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Why VRV/VRF Technology?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                { icon: Zap, title: "40–60% Energy Savings", desc: "Variable refrigerant flow adjusts output to demand — no wasted energy" },
                { icon: Building2, title: "Individual Zone Control", desc: "Each zone independently controlled — no more fighting over the thermostat" },
                { icon: Shield, title: "Minimal Ductwork", desc: "Ductless or minimal duct systems reduce installation cost and heat loss" },
                { icon: Award, title: "BMS Integration", desc: "Full Building Management System integration for centralized monitoring" },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#ff6b35]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1e3a5f]">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#1e3a5f] text-white rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4">Commercial Incentive Stack</h3>
              <div className="space-y-3">
                {[
                  { program: "JCP&L / PSE&G Rebate", value: "Up to $200/ton" },
                  { program: "NJ Clean Energy Business", value: "Up to 30% of cost" },
                  { program: "Federal 179D Deduction", value: "Up to $5/sq ft" },
                  { program: "MACRS Depreciation", value: "5-year accelerated" },
                ].map((item) => (
                  <div key={item.program} className="flex justify-between items-center border-b border-white/20 pb-2">
                    <span className="text-sm text-white/80">{item.program}</span>
                    <span className="font-bold text-[#ff6b35]">{item.value}</span>
                  </div>
                ))}
                <div className="pt-2 text-center">
                  <div className="text-3xl font-bold text-[#ff6b35]">Up to 80%</div>
                  <div className="text-sm text-white/70">of total project cost covered</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { value: "2.6M+", label: "Sq Ft Served" },
              { value: "500+", label: "Commercial Projects" },
              { value: "20+", label: "Years Experience" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-4xl font-bold text-[#ff6b35] mb-1">{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Ready to Reduce Your HVAC Costs?</h2>
          <p className="text-white/80 mb-6">Get a free commercial site survey and incentive analysis. No obligation.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18624239396">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
              </Button>
            </a>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Request Site Survey <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
          <p className="text-white/50 text-xs mt-4">Serving Essex, Morris, Union, Bergen, Passaic, Hudson Counties · Licensed & Bonded · WMBE/SBE Certified</p>
        </div>
      </section>
    </div>
  );
}
