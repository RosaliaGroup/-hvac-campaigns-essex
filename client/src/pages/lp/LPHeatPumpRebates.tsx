import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Shield, Star, Clock, Zap, ArrowRight, Award } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

export default function LPHeatPumpRebates() {
  const { toast } = useToast();
  useSEO({
    title: "Get Up to $16,000 in Heat Pump Incentives | Mechanical Enterprise NJ",
    description: "Stack PSE&G, NJ Clean Energy, and Federal Tax Credit incentives on your new heat pump. Free estimate — we handle all rebate paperwork. Serving Essex, Morris, Union, Bergen, Passaic, Hudson Counties.",
    ogUrl: "https://mechanicalenterprise.com/lp/heat-pump-rebates",
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      // Google Ads conversion tracking
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/heat_pump_lp" });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call us directly at (862) 423-9396", variant: "destructive" });
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
      captureType: "lp_heat_pump",
      pageUrl: window.location.href,
      message: "Google Ads LP: Heat Pump Rebates",
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        <span className="text-[#ff6b35]">⚡ LIMITED TIME:</span> NJ Heat Pump Incentives — Up to $16,000 Available in 2026
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left: Headline + Proof */}
            <div>
              <Badge className="mb-4 bg-[#ff6b35] text-white text-xs px-3 py-1">WMBE/SBE Certified Contractor</Badge>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                Get Up to <span className="text-[#ff6b35]">$16,000</span> in Heat Pump Incentives
              </h1>
              <p className="text-lg text-white/90 mb-6">
                Stack PSE&G, NJ Clean Energy, and Federal Tax Credit incentives. Mechanical Enterprise handles all paperwork — you just enjoy the savings.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  "PSE&G Rebate: Up to $6,000",
                  "NJ Clean Energy Program: Up to $3,000",
                  "Federal Tax Credit: 30% of install cost",
                  "Free in-home estimate — no obligation",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                <span className="flex items-center gap-1"><Award className="h-4 w-4" /> 4,000+ Installations</span>
                <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400" /> 4.9★ Rating</span>
                <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> Licensed & Insured</span>
              </div>
            </div>

            {/* Right: Lead Form */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">You're on the list!</h3>
                  <p className="text-gray-600 mb-4">We'll call you within 2 business hours to schedule your free in-home estimate.</p>
                  <a href="tel:+18624239396">
                    <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-3">
                      <Phone className="h-4 w-4 mr-2" /> Call Now: (862) 423-9396
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-[#1e3a5f] mb-1">Check Your Incentive Eligibility</h2>
                  <p className="text-sm text-gray-500 mb-4">Free estimate — we handle all rebate paperwork for you</p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                      <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <Input type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base">
                      {captureLead.isPending ? "Sending..." : "Get My Free Estimate →"}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">No spam. We respect your privacy. Call us at (862) 423-9396</p>
                  </form>
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4 text-[#ff6b35]" /> We respond within 2 business hours
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#1e3a5f] mb-2">How It Works</h2>
          <p className="text-gray-500 mb-8">We make it simple — from estimate to incentive check</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Free Estimate", desc: "We assess your home and identify all eligible incentives" },
              { step: "2", title: "We Handle Paperwork", desc: "Our team files all PSE&G, NJ Clean Energy, and federal forms" },
              { step: "3", title: "Expert Installation", desc: "Certified technicians install your new heat pump system" },
              { step: "4", title: "You Get Paid", desc: "Incentive checks arrive — up to $16,000 back in your pocket" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#ff6b35] text-white font-bold text-xl flex items-center justify-center mx-auto mb-3">{item.step}</div>
                <h3 className="font-bold text-[#1e3a5f] mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Incentive Breakdown */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Available Incentives</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "PSE&G Rebate", amount: "Up to $6,000", desc: "For PSE&G customers replacing old systems with qualifying heat pumps", color: "border-[#ff6b35]" },
              { name: "NJ Clean Energy", amount: "Up to $3,000", desc: "State program for high-efficiency heat pump installations", color: "border-[#1e3a5f]" },
              { name: "Federal Tax Credit", amount: "30% of Cost", desc: "IRS Section 25C credit — up to $2,000 per year on your tax return", color: "border-green-500" },
            ].map((item) => (
              <div key={item.name} className={`border-t-4 ${item.color} rounded-lg p-5 shadow-sm`}>
                <h3 className="font-bold text-[#1e3a5f] mb-1">{item.name}</h3>
                <div className="text-2xl font-bold text-[#ff6b35] mb-2">{item.amount}</div>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-[#1e3a5f] text-white rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-[#ff6b35] mb-1">$16,000+</div>
            <div className="text-lg font-semibold mb-1">Maximum Combined Incentives</div>
            <p className="text-white/80 text-sm">When all programs are stacked — Mechanical Enterprise handles every application</p>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Michael R.", location: "Montclair, NJ", text: "Mechanical Enterprise saved us $14,200 in combined incentives. The team handled everything — we just signed the paperwork.", stars: 5 },
              { name: "Sarah T.", location: "Livingston, NJ", text: "From estimate to installation in under 2 weeks. Our energy bills dropped 40% and we got a $6,000 PSE&G check.", stars: 5 },
              { name: "David K.", location: "Maplewood, NJ", text: "Best HVAC contractor in Essex County. Professional, fast, and they really know the rebate programs inside out.", stars: 5 },
            ].map((review) => (
              <div key={review.name} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: review.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 mb-3 italic">"{review.text}"</p>
                <div className="font-semibold text-[#1e3a5f] text-sm">{review.name}</div>
                <div className="text-xs text-gray-400">{review.location}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Zap className="h-12 w-12 text-[#ff6b35] mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Don't Leave Money on the Table</h2>
          <p className="text-white/80 mb-6">Incentive programs have limited funding. Secure your spot before allocations run out.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18624239396">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
              </Button>
            </a>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Get Free Estimate <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
          <p className="text-white/50 text-xs mt-4">Serving Essex, Morris, Union, Bergen, Passaic, Hudson Counties · Licensed & Insured · WMBE/SBE Certified</p>
        </div>
      </section>
    </div>
  );
}
