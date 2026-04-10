import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Star, Download, FileText, Mail, Shield, Award } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

export default function LPRebateGuide() {
  const { toast } = useToast();
  useSEO({
    title: "Free 2026 NJ HVAC Incentive Guide — $16,000+ Available | Mechanical Enterprise",
    description: "Download the complete 2026 NJ HVAC incentive guide. Learn how to stack PSE&G, NJ Clean Energy, and federal tax credits for maximum savings on heat pump installations.",
    ogUrl: "https://mechanicalenterprise.com/lp/rebate-guide",
  });
  const [form, setForm] = useState({ firstName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call (862) 423-9396", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      toast({ title: "Please enter your email address", variant: "destructive" });
      return;
    }
    captureLead.mutate({
      firstName: form.firstName,
      email: form.email,
      phone: form.phone,
      captureType: "download_gate",
      pageUrl: window.location.href,
      message: "Email LP: Rebate Guide Download",
    });
  };

  const guideContents = [
    "Complete list of all 2026 NJ HVAC incentive programs",
    "Step-by-step application guide for PSE&G rebates",
    "How to claim the 30% Federal Tax Credit",
    "NJ Clean Energy Program eligibility checklist",
    "Commercial 179D deduction explained",
    "How to stack multiple programs for maximum savings",
    "Timeline: from application to incentive check",
    "Frequently asked questions answered by our experts",
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm">
        📥 Free Download: The Complete 2026 NJ HVAC Incentive Guide — <strong className="text-[#ff6b35]">$16,000+ Available</strong>
      </div>

      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Guide Preview */}
            <div>
              <Badge className="mb-4 bg-[#ff6b35]/10 text-[#ff6b35] border border-[#ff6b35]/20">Free Download · No Credit Card Required</Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] leading-tight mb-4">
                The Complete 2026 NJ HVAC Incentive Guide
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Everything NJ homeowners and business owners need to know about stacking PSE&G, NJ Clean Energy, and federal incentives — written by the experts at Mechanical Enterprise.
              </p>

              {/* Guide Contents */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-[#ff6b35]" />
                  <span className="font-bold text-[#1e3a5f]">What's Inside (32 Pages):</span>
                </div>
                <div className="space-y-2">
                  {guideContents.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> Trusted by 4,000+ NJ Homeowners</span>
                <span className="flex items-center gap-1"><Award className="h-4 w-4 text-[#ff6b35]" /> Written by WMBE/SBE Certified Experts</span>
              </div>
            </div>

            {/* Download Form */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              {submitted ? (
                <div className="text-center py-8">
                  <Download className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Check Your Inbox!</h3>
                  <p className="text-gray-600 mb-2">Your free guide is on its way to <strong>{form.email}</strong></p>
                  <p className="text-gray-500 text-sm mb-6">Didn't receive it? Check your spam folder or call us directly.</p>
                  <div className="space-y-3">
                    <a href="tel:+18624239396">
                      <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold">
                        <Phone className="h-4 w-4 mr-2" /> Call for a Free Estimate
                      </Button>
                    </a>
                    <a href="/residential">
                      <Button variant="outline" className="w-full">
                        View Residential Services
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center mb-5">
                    <div className="w-16 h-16 bg-[#ff6b35]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Download className="h-8 w-8 text-[#ff6b35]" />
                    </div>
                    <h2 className="text-xl font-bold text-[#1e3a5f]">Get Your Free Guide</h2>
                    <p className="text-sm text-gray-500 mt-1">Sent instantly to your email</p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                    <Input type="email" placeholder="Email Address *" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base">
                      {captureLead.isPending ? "Sending..." : "📥 Send Me the Free Guide"}
                    </Button>
                  </form>
                  <div className="mt-4 space-y-2 text-xs text-gray-400">
                    <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> Delivered instantly to your inbox</div>
                    <div className="flex items-center gap-2"><Shield className="h-3 w-3" /> We never sell your information</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Incentive Programs Overview */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Programs Covered in the Guide</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { program: "PSE&G Residential Rebate", amount: "Up to $6,000", type: "Residential" },
              { program: "JCP&L Heat Pump Rebate", amount: "Up to $4,000", type: "Residential" },
              { program: "NJ Clean Energy Program", amount: "Up to $3,000", type: "Residential & Commercial" },
              { program: "Federal Tax Credit (25C)", amount: "30% of cost", type: "Residential" },
              { program: "PSE&G Commercial Rebate", amount: "Up to $200/ton", type: "Commercial" },
              { program: "Federal 179D Deduction", amount: "Up to $5/sq ft", type: "Commercial" },
              { program: "NJ Clean Energy Business", amount: "Up to 30% of cost", type: "Commercial" },
              { program: "MACRS Accelerated Depreciation", amount: "5-year schedule", type: "Commercial" },
            ].map((item) => (
              <div key={item.program} className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <div>
                  <div className="font-medium text-sm">{item.program}</div>
                  <div className="text-xs text-white/50">{item.type}</div>
                </div>
                <div className="font-bold text-[#ff6b35] text-sm">{item.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-gray-50 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-[#1e3a5f] mb-3">Ready to Get Started?</h2>
          <p className="text-gray-600 mb-6">Download the guide or call us directly to schedule your free in-home estimate.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <Download className="h-5 w-5 mr-2" /> Download Free Guide
            </Button>
            <a href="tel:+18624239396">
              <Button size="lg" variant="outline" className="border-[#1e3a5f] text-[#1e3a5f]">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
