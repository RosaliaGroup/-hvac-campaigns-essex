import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Shield, Star, Clock, Zap, ArrowRight, Award, FileText, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

export default function LPPsegRebate() {
  const { toast } = useToast();
  useSEO({
    title: "PSE&G Certified HVAC Contractor NJ — We Handle All Rebate Paperwork | Mechanical Enterprise",
    description: "Looking for a PSE&G certified contractor? We file your entire rebate application for free. Up to $20,000 in combined rebates. Free 20-minute assessment, zero paperwork on your end.",
    ogUrl: "https://mechanicalenterprise.com/pseg-rebate-contractor-nj",
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/pseg_rebate_lp" });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call us directly at (862) 419-1763", variant: "destructive" });
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
      email: form.email || undefined,
      phone: form.phone || undefined,
      captureType: "lp_heat_pump",
      pageUrl: window.location.href,
      message: "Google Ads LP: PSE&G Rebate Contractor",
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        <span className="text-[#ff6b35]">PSE&G CERTIFIED CONTRACTOR</span> — We Handle Your Entire Rebate Application. Free.
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-[#ff6b35] text-white text-xs px-3 py-1">PSE&G Certified Contractor</Badge>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                Looking for a PSE&G Certified Contractor in NJ?{" "}
                <span className="text-[#ff6b35]">We Handle Your Entire Rebate Application — Free.</span>
              </h1>
              <p className="text-lg text-white/90 mb-6">
                Most people visit PSE&G's website, get overwhelmed by the paperwork, and never claim their rebate. We do the entire application for you.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  "We file every PSE&G rebate application for you",
                  "Up to $20,000 in combined rebates",
                  "Free 20-minute assessment — no obligation",
                  "Zero paperwork on your end",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                <span className="flex items-center gap-1"><Award className="h-4 w-4" /> PSE&G Certified</span>
                <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> WMBE/SBE Certified</span>
                <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400" /> 15 NJ Counties</span>
              </div>
            </div>

            {/* Lead Form */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">You're all set!</h3>
                  <p className="text-gray-600 mb-4">We'll call you within 2 business hours to schedule your free assessment.</p>
                  <a href="tel:+18624191763">
                    <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-3">
                      <Phone className="h-4 w-4 mr-2" /> Call Now: (862) 419-1763
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-[#1e3a5f] mb-1">Book Free Assessment</h2>
                  <p className="text-sm text-gray-500 mb-4">We handle all PSE&G paperwork — you just enjoy the savings</p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                      <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <Input type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base">
                      {captureLead.isPending ? "Sending..." : "Book Free Assessment — We Handle All Paperwork →"}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">No spam. Call us at (862) 419-1763</p>
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

      {/* Rebate Breakdown */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-2">PSE&G Rebate Breakdown</h2>
          <p className="text-center text-gray-500 mb-8">Residential and commercial — we handle every application</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-t-4 border-t-[#ff6b35] rounded-lg p-6 shadow-sm bg-white">
              <h3 className="font-bold text-[#1e3a5f] mb-1 text-lg">Residential</h3>
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">PSE&G Rebate</span>
                  <span className="font-bold text-[#1e3a5f]">Up to $18,000</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">ME Additional Incentive</span>
                  <span className="font-bold text-[#ff6b35]">$2,000</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-[#1e3a5f] text-white rounded-lg px-4">
                  <span className="font-semibold">Total Combined</span>
                  <span className="font-bold text-2xl text-[#ff6b35]">$20,000</span>
                </div>
              </div>
            </div>
            <div className="border-t-4 border-t-[#1e3a5f] rounded-lg p-6 shadow-sm bg-white">
              <h3 className="font-bold text-[#1e3a5f] mb-1 text-lg">Commercial</h3>
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Direct Install Program</span>
                  <span className="font-bold text-[#1e3a5f]">80% Covered</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">On-Bill Repayment (OBR)</span>
                  <span className="font-bold text-[#ff6b35]">Covers Balance</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Lighting Upgrades</span>
                  <span className="font-bold text-green-600">100% Free</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-[#1e3a5f] text-white rounded-lg px-4">
                  <span className="font-semibold">Your Out-of-Pocket</span>
                  <span className="font-bold text-2xl text-green-400">$0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Process */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#1e3a5f] mb-2">How It Works</h2>
          <p className="text-gray-500 mb-8">We handle everything — you just say yes</p>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              { step: "1", title: "Free Assessment", desc: "Free 20-min assessment of your property" },
              { step: "2", title: "Identify Rebates", desc: "We identify every rebate you qualify for" },
              { step: "3", title: "File Applications", desc: "We file all PSE&G applications for you" },
              { step: "4", title: "Installation", desc: "Installation scheduled at your convenience" },
              { step: "5", title: "Rebate Paid", desc: "Rebate paid — you keep the savings" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#ff6b35] text-white font-bold text-xl flex items-center justify-center mx-auto mb-3">{item.step}</div>
                <h3 className="font-bold text-[#1e3a5f] mb-1 text-sm">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 px-4 bg-white border-y">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {[
              { icon: <Shield className="h-5 w-5 text-[#1e3a5f]" />, text: "PSE&G Certified" },
              { icon: <Award className="h-5 w-5 text-[#ff6b35]" />, text: "WMBE Certified" },
              { icon: <Award className="h-5 w-5 text-[#1e3a5f]" />, text: "SBE Certified" },
              { icon: <Star className="h-5 w-5 text-yellow-500" />, text: "15 NJ Counties" },
              { icon: <CheckCircle className="h-5 w-5 text-green-500" />, text: "Free Assessment" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm font-medium text-gray-700">
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              { q: "Do I need to apply to PSE&G myself?", a: "No — we handle the entire PSE&G rebate application for you. From initial paperwork to final submission, our team manages every step. You don't need to create a PSE&G account, fill out any forms, or deal with any bureaucracy." },
              { q: "How long does the PSE&G rebate take?", a: "Typical processing time is 6-8 weeks after installation is complete and all paperwork is submitted. Since we've done this hundreds of times, we know exactly how to submit for fastest approval. You'll receive your rebate check directly from PSE&G." },
              { q: "What if I already started an application?", a: "We can pick up where you left off. If you've already begun the PSE&G application process but got stuck or overwhelmed, we'll take it over and handle everything from that point forward. Bring us whatever you have and we'll sort it out." },
              { q: "Is the assessment really free?", a: "Yes, 100% free with no obligation. We'll visit your property, assess what qualifies for PSE&G rebates, and give you a complete breakdown of available incentives. If you decide not to proceed, you owe nothing." },
              { q: "What areas do you serve?", a: "We serve 15 counties across New Jersey including Essex, Morris, Union, Bergen, Passaic, Hudson, Middlesex, Somerset, Mercer, Monmouth, Ocean, Burlington, Camden, Gloucester, and Atlantic counties." },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border">
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-[#1e3a5f] text-sm">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <FileText className="h-12 w-12 text-[#ff6b35] mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Stop Fighting PSE&G Paperwork</h2>
          <p className="text-white/80 mb-6">We're a certified NJ contractor who files every rebate application for you. Up to $20,000 in combined savings.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18624191763">
              <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 419-1763
              </Button>
            </a>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Book Free Assessment <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
          <p className="text-white/50 text-xs mt-4">PSE&G Certified · WMBE/SBE Certified · Serving 15 NJ Counties · Licensed & Insured</p>
        </div>
      </section>
    </div>
  );
}
