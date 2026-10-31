import { useState, useRef } from "react";
import { captureContext } from "@/lib/captureContext";
import { trackConversion } from "@/lib/conversions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Turnstile from "@/components/Turnstile";
import HoneypotFields, { type HoneypotValues } from "@/components/HoneypotFields";
import { TcpaDisclosure } from "@/components/TcpaDisclosure";
import { TCPA_FORM_VERSION } from "@shared/leadFormVersion";
import { CheckCircle, Phone, Star, Clock, Home, ArrowRight, DollarSign, Leaf } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

export default function LPFBResidential() {
  const { toast } = useToast();
  useSEO({
    title: "NJ Heat Pump Rebates Up to $16,000 | Free Assessment | Mechanical Enterprise",
    description: "NJ homeowners may qualify for up to $16,000 in heat pump rebates. Free in-home assessment from a licensed NJ HVAC contractor — we handle the rebate paperwork.",
    ogUrl: "https://mechanicalenterprise.com/lp/fb-residential",
  });
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  // Spam protection: honeypot decoy fields + form-load timestamp (too-fast submit).
  const [honeypot, setHoneypot] = useState<HoneypotValues>({ website: "", company_url: "" });
  const loadedAt = useRef(Date.now());
  // Stable per-mount idempotency key for the GA4 conversion.
  const [convKey] = useState(() => `lp_fb_residential-${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setTurnstileToken("");
      // Existing Facebook Pixel + Google Ads conversions — left untouched.
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Lead");
      }
      // The shared helper below sends one verified Quote Request Ads action.
      // Do not emit the former placeholder conversion label "fb_residential_lp".
      // Additive GA4 conversion (no PII) — fires only when GA4 is configured.
      trackConversion(
        "residential_quote_request",
        { form_type: "lp_fb_residential", service_category: "residential", customer_segment: "residential", lead_source_surface: "lp_fb_residential" },
        { dedupeKey: convKey },
      );
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
      captureType: "lp_fb_residential",
      ...captureContext(),
      message: "Facebook LP: Residential Homeowners Rebate",
      website: honeypot.website || undefined,
      company_url: honeypot.company_url || undefined,
      _ts: loadedAt.current,
      cfTurnstileResponse: turnstileToken || undefined,
      formVersion: TCPA_FORM_VERSION,
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
          <Badge className="mb-4 bg-green-100 text-green-800 border border-green-200">✅ For NJ Homeowners — Free Assessment</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] leading-tight mb-4">
            NJ Homeowners May Qualify for <span className="text-[#ff6b35]">Up to $16,000</span> in Heat Pump Rebates
          </h1>
          <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            Replacing an old furnace, boiler or central AC? A licensed NJ contractor checks your eligibility at a free in-home assessment, and we handle the rebate paperwork.
          </p>

          {/* Social Proof Bar */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm text-gray-500">
            <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> Licensed NJ HVAC contractor</span>
            <span className="flex items-center gap-1"><Home className="h-4 w-4 text-[#ff6b35]" /> Free in-home assessment</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-[#1e3a5f]" /> We handle the rebate paperwork</span>
          </div>

          {/* Lead Form — centered, prominent */}
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">You're In!</h3>
                <p className="text-gray-600 text-sm mb-4">We'll call you to check your eligibility and schedule your free assessment.</p>
                <a href="tel:+18624239396">
                  <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold">
                    <Phone className="h-4 w-4 mr-2" /> Call (862) 423-9396
                  </Button>
                </a>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#1e3a5f] mb-1 text-center">Check Your Eligibility — Free</h2>
                <p className="text-xs text-gray-400 text-center mb-4">Takes 30 seconds. No obligation.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <HoneypotFields values={honeypot} onChange={setHoneypot} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                    <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                  <Input type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <Turnstile className="flex justify-center" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />
                  <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4">
                    {captureLead.isPending ? "Checking..." : "Check My Eligibility →"}
                  </Button>
                <TcpaDisclosure />
                  </form>
                <p className="text-xs text-gray-400 text-center mt-3">We never sell your info. Unsubscribe anytime.</p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* How it works — verified facts only (VERIFIED_FACTS: up to $16,000 residential rebate). No price
          estimates or testimonials until real, attributable ones exist. */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-2">How It Works</h2>
          <p className="text-white/70 mb-8">Three steps from old system to new heat pump</p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: "1. Free assessment", sub: "We look at your home, your current system and which rebates you may qualify for.", icon: Home },
              { label: "2. Clear quote", sub: "You get a written quote and the eligible rebate amount before you decide anything.", icon: DollarSign },
              { label: "3. Install + paperwork", sub: "Licensed installation, and we file the rebate paperwork for you.", icon: Leaf },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-5 text-left">
                <item.icon className="h-6 w-6 text-[#ff6b35] mb-2" />
                <div className="font-semibold mb-1">{item.label}</div>
                <div className="text-sm text-white/70">{item.sub}</div>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs mt-4">Rebates of up to $16,000 are available to eligible NJ homeowners. Eligibility and amounts depend on your utility, home and equipment, and are confirmed at the assessment.</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-[#ff6b35] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Find Out What You Qualify For</h2>
          <p className="text-white/90 mb-6">The assessment is free and there is no obligation.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+18624239396">
              <Button size="lg" className="bg-white text-[#ff6b35] hover:bg-gray-100 font-bold px-8">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
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
