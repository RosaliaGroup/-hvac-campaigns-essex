import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Phone, Shield, Clock, FileText, ArrowRight,
  Award, Square, ChevronDown, Star, AlertTriangle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

export default function LPPsegChecklist() {
  const { toast } = useToast();
  useSEO({
    title: "Free PSE&G Rebate Checklist — What You Need Before You Apply | Mechanical Enterprise NJ",
    description: "Download the free NJ PSE&G rebate checklist. Avoid the top 3 rejection reasons. Or let a certified contractor handle everything for you. Serving 15 NJ counties.",
    ogUrl: "https://mechanicalenterprise.com/pseg-rebate-checklist",
  });
  const [form, setForm] = useState({
    firstName: "",
    phone: "",
    email: "",
    propertyType: "residential" as "residential" | "commercial",
  });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", {
          send_to: "AW-17768263516/pseg_checklist_download",
        });
      }
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please call us directly at (862) 419-1763",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email && !form.phone) {
      toast({ title: "Please enter your email or phone number", variant: "destructive" });
      return;
    }
    captureLead.mutate({
      firstName: form.firstName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      captureType: "pseg_checklist_download",
      pageUrl: window.location.href,
      message: `Property Type: ${form.propertyType}`,
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        <span className="text-[#ff6b35]">FREE DOWNLOAD:</span> The NJ PSE&G Rebate Checklist — What You Need Before You Apply
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-[#ff6b35] text-white text-xs px-3 py-1">
                FREE CHECKLIST
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                Free Download: The NJ PSE&G Rebate Checklist —{" "}
                <span className="text-[#ff6b35]">What You Need Before You Apply</span>
              </h1>
              <p className="text-lg text-white/90 mb-6">
                Most PSE&G rebate applications get rejected for 3 avoidable reasons. This
                checklist shows you exactly what to prepare — and how a certified contractor
                eliminates all of it.
              </p>

              {/* Warning callout */}
              <div className="bg-white/10 rounded-lg p-4 mb-6 border border-white/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#ff6b35] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Top 3 Rejection Reasons:</p>
                    <ul className="text-sm text-white/80 mt-1 space-y-1">
                      <li>1. Missing or incorrect equipment documentation</li>
                      <li>2. Application submitted after the deadline window</li>
                      <li>3. Non-qualifying contractor or installation</li>
                    </ul>
                  </div>
                </div>
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
                <div className="text-center py-6">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Checklist sent!</h3>
                  <p className="text-gray-600 mb-2">
                    Check your email for the full PSE&G Rebate Checklist.
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    Want us to handle the entire application for you? Book a free assessment.
                  </p>
                  <a href="tel:+18624191763">
                    <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-3">
                      <Phone className="h-4 w-4 mr-2" /> Call Now: (862) 419-1763
                    </Button>
                  </a>
                  <a href="/pseg-rebate-contractor-nj">
                    <Button variant="outline" className="w-full mt-3 border-[#1e3a5f] text-[#1e3a5f]">
                      Book Free Assessment — We Do All Paperwork
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-5 w-5 text-[#ff6b35]" />
                    <h2 className="text-xl font-bold text-[#1e3a5f]">Send Me the Free Checklist</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Instant download — we'll email you the complete checklist
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                      placeholder="First Name"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    />
                    <Input
                      type="tel"
                      placeholder="Phone Number"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email Address"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Property Type</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`border rounded-lg p-2.5 text-sm font-medium transition-colors ${
                            form.propertyType === "residential"
                              ? "border-[#ff6b35] bg-orange-50 text-[#ff6b35]"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                          onClick={() => setForm({ ...form, propertyType: "residential" })}
                        >
                          Residential
                        </button>
                        <button
                          type="button"
                          className={`border rounded-lg p-2.5 text-sm font-medium transition-colors ${
                            form.propertyType === "commercial"
                              ? "border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                          onClick={() => setForm({ ...form, propertyType: "commercial" })}
                        >
                          Commercial
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={captureLead.isPending}
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base"
                    >
                      {captureLead.isPending ? "Sending..." : "Send Me the Free Checklist →"}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">
                      No spam. We respect your privacy.
                    </p>
                  </form>
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4 text-[#ff6b35]" /> Instant delivery to your inbox
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Checklist Preview */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-2">
            What's in the Checklist
          </h2>
          <p className="text-center text-gray-500 mb-8">
            Here's a preview — the full version has 15+ items with detailed instructions
          </p>

          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            {[
              {
                text: "Equipment age and model number",
                note: "PSE&G requires your current system details to calculate rebate eligibility",
                checked: false,
              },
              {
                text: "Utility account number",
                note: "Must match the property address on your PSE&G bill exactly",
                checked: false,
              },
              {
                text: "Property ownership proof",
                note: "Deed or tax record — renters need landlord authorization",
                checked: false,
              },
              {
                text: "Contractor certification",
                note: "Must be a PSE&G-certified contractor — we handle this",
                checked: true,
              },
              {
                text: "Application timing (critical — most people miss this)",
                note: "There's a window after installation — miss it and you lose the rebate",
                checked: true,
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  item.checked ? "bg-green-50 border border-green-200" : "bg-gray-50"
                }`}
              >
                {item.checked ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Square className="h-5 w-5 text-gray-300 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-medium text-sm ${item.checked ? "text-green-800" : "text-gray-800"}`}>
                    {item.text}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>
                  {item.checked && (
                    <Badge className="mt-1 bg-green-100 text-green-700 text-xs">
                      We handle this for you
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-4 border-t text-center">
              <p className="text-sm text-gray-500 mb-3">
                The full checklist has <strong>15+ items</strong> with step-by-step instructions
              </p>
              <Button
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                Get the Full Checklist Free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why use a contractor */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#1e3a5f] mb-2">
            Or Skip the Checklist Entirely
          </h2>
          <p className="text-gray-500 mb-8">
            A certified contractor eliminates every item on this checklist. Here's how:
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "We Know the Requirements",
                desc: "As a PSE&G certified contractor, we know exactly what equipment qualifies and file the correct documentation every time.",
                color: "border-t-[#ff6b35]",
              },
              {
                title: "We Handle All Timing",
                desc: "We submit your application within the required window — the #1 reason DIY applications get rejected.",
                color: "border-t-[#1e3a5f]",
              },
              {
                title: "You Pay Nothing Extra",
                desc: "Our rebate filing service is completely free. We make our money from the installation — not from paperwork fees.",
                color: "border-t-green-500",
              },
            ].map((item) => (
              <div key={item.title} className={`border-t-4 ${item.color} rounded-lg p-5 shadow-sm`}>
                <h3 className="font-bold text-[#1e3a5f] mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-[#1e3a5f] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <FileText className="h-12 w-12 text-[#ff6b35] mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">
            Get the Free Checklist — Or Let Us Handle Everything
          </h2>
          <p className="text-white/80 mb-6">
            Either way, you'll know exactly what's required for your PSE&G rebate.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Get Free Checklist <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <a href="tel:+18624191763">
              <Button
                size="lg"
                className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8"
              >
                <Phone className="h-5 w-5 mr-2" /> Call (862) 419-1763
              </Button>
            </a>
          </div>
          <p className="text-white/50 text-xs mt-4">
            PSE&G Certified · WMBE/SBE Certified · Serving 15 NJ Counties · Licensed & Insured
          </p>
        </div>
      </section>
    </div>
  );
}
