import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Star, Clock, Home, ArrowRight, DollarSign, Leaf } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

export default function LPFBResidential() {
  const { toast } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Lead");
      }
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/fb_residential_lp" });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call (862) 419-1763", variant: "destructive" });
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
      captureType: "exit_popup_residential",
      pageUrl: window.location.href,
      message: "Facebook LP: Residential Homeowners Rebate",
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        🏠 NJ Homeowners: See If You Qualify for Up to <strong className="text-[#ff6b35]">$16,000</strong> in Heat Pump Incentives
      </div>

      {/* Hero — Facebook style: story-driven, visual, emotional */}
      <section className="py-12 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-green-100 text-green-800 border border-green-200">✅ NJ Homeowners Only — Limited Spots Available</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] leading-tight mb-4">
            NJ Homeowners Are Getting <span className="text-[#ff6b35]">$16,000 Back</span> on New Heat Pumps
          </h1>
          <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            Most homeowners don't know they can stack PSE&G, NJ Clean Energy, and federal incentives. We handle all the paperwork — you just enjoy the savings.
          </p>

          {/* Social Proof Bar */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> 4.9★ on Google (500+ reviews)</span>
            <span className="flex items-center gap-1"><Home className="h-4 w-4 text-[#ff6b35]" /> 4,000+ NJ Installations</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> WMBE/SBE Certified</span>
          </div>

          {/* Lead Form — centered, prominent */}
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">You're In!</h3>
                <p className="text-gray-600 text-sm mb-4">We'll call you within 2 business hours to check your eligibility and schedule a free estimate.</p>
                <a href="tel:+18624191763">
                  <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold">
                    <Phone className="h-4 w-4 mr-2" /> Call (862) 419-1763
                  </Button>
                </a>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#1e3a5f] mb-1 text-center">Check Your Eligibility — Free</h2>
                <p className="text-xs text-gray-400 text-center mb-4">Takes 30 seconds. No obligation.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                    <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                  <Input type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4">
                    {captureLead.isPending ? "Checking..." : "Check My Eligibility →"}
                  </Button>
                </form>
                <p className="text-xs text-gray-400 text-center mt-3">We never sell your info. Unsubscribe anytime.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* The Math — make it tangible */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-2">The Real Numbers</h2>
          <p className="text-white/70 mb-8">Here's what a typical NJ homeowner saves with a heat pump installation</p>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { label: "Avg. Install Cost", value: "$12,000", sub: "before incentives", icon: DollarSign },
              { label: "PSE&G Rebate", value: "-$6,000", sub: "for eligible customers", icon: CheckCircle },
              { label: "NJ + Federal", value: "-$5,000+", sub: "stacked incentives", icon: Leaf },
              { label: "Your Net Cost", value: "~$1,000", sub: "after all incentives", icon: Star },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-4">
                <item.icon className="h-6 w-6 text-[#ff6b35] mx-auto mb-2" />
                <div className="text-2xl font-bold text-[#ff6b35]">{item.value}</div>
                <div className="font-semibold text-sm">{item.label}</div>
                <div className="text-xs text-white/60">{item.sub}</div>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs mt-4">*Estimates based on average NJ installations. Actual savings vary by home size, utility provider, and system selected.</p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">NJ Homeowners Love Their New Systems</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Jennifer M.", location: "South Orange, NJ", text: "I was skeptical about the incentive amounts but Mechanical Enterprise got us $13,800 back. Our heating bill dropped 45%!", stars: 5 },
              { name: "Robert L.", location: "Nutley, NJ", text: "From first call to installation in 10 days. The team handled every form and we just got a check in the mail.", stars: 5 },
              { name: "Maria G.", location: "Bloomfield, NJ", text: "Best decision we made for our home. Quiet, efficient, and the incentives made it almost free. Highly recommend!", stars: 5 },
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
      <section className="py-12 px-4 bg-[#ff6b35] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Incentive Funds Are Limited — Act Now</h2>
          <p className="text-white/90 mb-6">PSE&G and NJ Clean Energy programs have annual funding caps. Once funds are exhausted, the programs close until next year.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18624191763">
              <Button size="lg" className="bg-white text-[#ff6b35] hover:bg-gray-100 font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 419-1763
              </Button>
            </a>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Check Eligibility <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
