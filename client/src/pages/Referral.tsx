import { useState } from "react";
import { Gift, CheckCircle, AlertCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/submit-referral`;

export default function Referral() {
  useSEO({
    title: "Refer a Friend — Earn $500 | Mechanical Enterprise",
    description: "Refer someone to Mechanical Enterprise for HVAC service. Earn $500 when they become a customer. No cap. Newark NJ.",
    ogUrl: "https://mechanicalenterprise.com/referral",
  });

  const [form, setForm] = useState({
    referrerName: "",
    referrerPhone: "",
    referrerEmail: "",
    paymentMethod: "",
    leadName: "",
    leadPhone: "",
    leadEmail: "",
    propertyAddress: "",
    propertyType: "",
    serviceNeeded: "",
    notes: "",
    consent: false,
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function validate(): string | null {
    if (!form.referrerName || !form.referrerPhone || !form.referrerEmail || !form.paymentMethod) {
      return "Please fill in all required fields in \"Your info\".";
    }
    if (!form.leadName || !form.leadPhone || !form.propertyAddress || !form.propertyType || !form.serviceNeeded) {
      return "Please fill in all required fields in \"Who you're referring\".";
    }
    if (!form.consent) {
      return "Please confirm that the person you're referring is okay with us contacting them.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.referrerEmail)) {
      return "Please enter a valid email address for yourself.";
    }
    if (form.leadEmail && !emailRegex.test(form.leadEmail)) {
      return "Please enter a valid email address for the person you're referring.";
    }
    const digits = (s: string) => s.replace(/\D/g, "");
    if (digits(form.referrerPhone).length < 10) {
      return "Your phone number must be at least 10 digits.";
    }
    if (digits(form.leadPhone).length < 10) {
      return "Their phone number must be at least 10 digits.";
    }
    // Self-referral check
    if (digits(form.referrerPhone) === digits(form.leadPhone)) {
      return "You can't refer yourself — the referral's phone number must be different from yours.";
    }
    if (form.leadEmail && form.referrerEmail.toLowerCase() === form.leadEmail.toLowerCase()) {
      return "You can't refer yourself — the referral's email must be different from yours.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({
          ref_name: form.referrerName,
          ref_phone: form.referrerPhone,
          ref_email: form.referrerEmail,
          ref_payout: form.paymentMethod,
          new_name: form.leadName,
          new_phone: form.leadPhone,
          new_email: form.leadEmail,
          new_address: form.propertyAddress,
          property_type: form.propertyType,
          service_needed: form.serviceNeeded,
          notes: form.notes,
          consent: form.consent,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8f] to-[#1e3a5f] text-white py-20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4wNSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#ff6b35]/20 text-[#ff6b35] px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-[#ff6b35]/30">
              <Gift className="w-4 h-4" />
              Past Client Referral Program
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Send a friend our way. <span className="text-[#ff6b35]">Pocket $500.</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-200 mb-8 leading-relaxed">
              If someone you refer becomes a paying customer — install, repair, or assessment that converts — we'll send you $500. No cap on how many you can refer.
            </p>

            <a
              href="#referral-form"
              className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#e55a25] transition-all shadow-lg hover:shadow-xl"
            >
              <Gift className="w-5 h-5" />
              Submit a Referral
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-12 text-center">
              How It Works
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
                <div className="bg-[#ff6b35] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  01
                </div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-3">Fill Out the Form</h3>
                <p className="text-slate-600">
                  Enter your info and theirs — takes less than 2 minutes.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
                <div className="bg-[#ff6b35] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  02
                </div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-3">We Reach Out</h3>
                <p className="text-slate-600">
                  We contact your referral within 24 hours to help them.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
                <div className="bg-[#ff6b35] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  03
                </div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-3">You Get Paid $500</h3>
                <p className="text-slate-600">
                  They become a customer — you get paid. Simple as that.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Form */}
      <section id="referral-form" className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-4">
                Submit a Referral
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Fill out the form below and we'll take it from here.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
              {submitted ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">Thanks! We got your referral.</h3>
                  <p className="text-slate-600">
                    We'll reach out to them within 24 hours, and you'll hear from us about your $500 once they convert.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  {error && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Section A: Your Info */}
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-1">Your info</h3>
                    <p className="text-sm text-slate-500 mb-4">So we know who to pay the $500 to</p>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="referrerName">Full name <span className="text-red-500">*</span></Label>
                        <Input
                          id="referrerName"
                          required
                          placeholder="Your full name"
                          value={form.referrerName}
                          onChange={(e) => setForm({ ...form, referrerName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="referrerPhone">Phone <span className="text-red-500">*</span></Label>
                        <Input
                          id="referrerPhone"
                          type="tel"
                          required
                          placeholder="(555) 123-4567"
                          value={form.referrerPhone}
                          onChange={(e) => setForm({ ...form, referrerPhone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="referrerEmail">Email <span className="text-red-500">*</span></Label>
                        <Input
                          id="referrerEmail"
                          type="email"
                          required
                          placeholder="you@email.com"
                          value={form.referrerEmail}
                          onChange={(e) => setForm({ ...form, referrerEmail: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentMethod">How should we pay you? <span className="text-red-500">*</span></Label>
                        <Select value={form.paymentMethod} onValueChange={(val) => setForm({ ...form, paymentMethod: val })}>
                          <SelectTrigger id="paymentMethod">
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="Zelle">Zelle</SelectItem>
                            <SelectItem value="Venmo">Venmo</SelectItem>
                            <SelectItem value="Cash App">Cash App</SelectItem>
                            <SelectItem value="Credit on next service">Credit on next service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Who You're Referring */}
                  <div>
                    <h3 className="text-xl font-bold text-[#1e3a5f] mb-1">Who you're referring</h3>
                    <p className="text-sm text-slate-500 mb-4">The more detail, the faster we can help them</p>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="leadName">Their full name <span className="text-red-500">*</span></Label>
                        <Input
                          id="leadName"
                          required
                          placeholder="Their full name"
                          value={form.leadName}
                          onChange={(e) => setForm({ ...form, leadName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="leadPhone">Their phone <span className="text-red-500">*</span></Label>
                        <Input
                          id="leadPhone"
                          type="tel"
                          required
                          placeholder="(555) 987-6543"
                          value={form.leadPhone}
                          onChange={(e) => setForm({ ...form, leadPhone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="leadEmail">Their email</Label>
                        <Input
                          id="leadEmail"
                          type="email"
                          placeholder="them@email.com"
                          value={form.leadEmail}
                          onChange={(e) => setForm({ ...form, leadEmail: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="propertyType">Property type <span className="text-red-500">*</span></Label>
                        <Select value={form.propertyType} onValueChange={(val) => setForm({ ...form, propertyType: val })}>
                          <SelectTrigger id="propertyType">
                            <SelectValue placeholder="Select property type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Residential">Residential</SelectItem>
                            <SelectItem value="Commercial">Commercial</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="propertyAddress">Property address (street, city, NJ) <span className="text-red-500">*</span></Label>
                        <Input
                          id="propertyAddress"
                          required
                          placeholder="123 Main St, Newark, NJ"
                          value={form.propertyAddress}
                          onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="serviceNeeded">What do they need? <span className="text-red-500">*</span></Label>
                        <Select value={form.serviceNeeded} onValueChange={(val) => setForm({ ...form, serviceNeeded: val })}>
                          <SelectTrigger id="serviceNeeded">
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="New install">New install</SelectItem>
                            <SelectItem value="Repair">Repair</SelectItem>
                            <SelectItem value="Emergency">Emergency</SelectItem>
                            <SelectItem value="Free assessment">Free assessment</SelectItem>
                            <SelectItem value="Maintenance">Maintenance</SelectItem>
                            <SelectItem value="Not sure">Not sure</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="notes">Anything else we should know?</Label>
                        <Textarea
                          id="notes"
                          rows={3}
                          placeholder="Any context that might help us reach out..."
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Consent Checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={form.consent}
                      onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#ff6b35] focus:ring-[#ff6b35]"
                    />
                    <Label htmlFor="consent" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
                      I've told this person I'm referring them and they're okay with Mechanical Enterprise contacting them <span className="text-red-500">*</span>
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#ff6b35] hover:bg-[#e55a25] text-white text-lg py-6 font-semibold"
                  >
                    {loading ? "Submitting..." : "Submit referral \u2192"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
