import { useState } from "react";
import { Gift, CheckCircle, AlertCircle, MessageSquare, Trophy, Phone, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSEO } from "@/hooks/useSEO";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/submit-referral`;

export default function Referral() {
  useSEO({
    title: "Referral Program — Earn $500 Per Referral | Mechanical Enterprise",
    description: "Know someone who needs HVAC work? Send them our way. Earn $500 when they book. No cap. Open to everyone. Newark NJ.",
    ogUrl: "https://mechanicalenterprise.com/referral",
  });

  // Simplified form — 5 fields only
  const [form, setForm] = useState({
    referrerName: "",
    referrerPhone: "",
    leadName: "",
    leadPhone: "",
    consent: false,
  });

  // Text-a-friend
  const [textFriendPhone, setTextFriendPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function validate(): string | null {
    if (!form.referrerName.trim()) return "Please enter your name.";
    const digits = (s: string) => s.replace(/\D/g, "");
    if (digits(form.referrerPhone).length < 10) return "Your phone number must be at least 10 digits.";
    if (!form.leadName.trim()) return "Please enter their name.";
    if (digits(form.leadPhone).length < 10) return "Their phone number must be at least 10 digits.";
    if (digits(form.referrerPhone) === digits(form.leadPhone)) {
      return "You can't refer yourself — their phone number must be different from yours.";
    }
    if (!form.consent) return "Please confirm they're okay with us contacting them.";
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
          ref_email: "",
          ref_payout: "",
          new_name: form.leadName,
          new_phone: form.leadPhone,
          new_email: "",
          new_address: "",
          property_type: "Residential",
          service_needed: "Not sure",
          notes: "",
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

  function handleTextAFriend() {
    const cleanPhone = textFriendPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return;
    const message = encodeURIComponent(
      "Hey — I use Mechanical Enterprise for HVAC stuff in NJ. They do free assessments and rebates up to $16K. Worth a call: (862) 419-1763 or https://mechanicalenterprise.com/rebate-calculator"
    );
    window.open(`sms:${cleanPhone}?body=${message}`, "_self");
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
              Referral Program
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Earn <span className="text-[#ff6b35]">$500</span> Per Referral
            </h1>

            <p className="text-xl md:text-2xl text-slate-200 mb-8 leading-relaxed max-w-3xl mx-auto">
              Know someone who needs HVAC work? Send them our way. We pay you when they book.
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
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-3">Send Us Their Name</h3>
                <p className="text-slate-600">
                  Fill out 4 fields — takes 30 seconds. That's it.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
                <div className="bg-[#ff6b35] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  02
                </div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-3">We Reach Out</h3>
                <p className="text-slate-600">
                  We contact them within 24 hours to help with their HVAC needs.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
                <div className="bg-[#ff6b35] w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                  03
                </div>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-3">You Get Paid</h3>
                <p className="text-slate-600">
                  They become a customer — you get $500. No cap on referrals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Form + Tiered Rewards */}
      <section id="referral-form" className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-8">

              {/* Form Column (3/5) */}
              <div className="lg:col-span-3">
                <div className="text-center lg:text-left mb-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a5f] mb-3">
                    Submit a Referral
                  </h2>
                  <p className="text-lg text-slate-600">
                    4 fields. 30 seconds. We handle the rest.
                  </p>
                </div>

                <Card className="shadow-lg">
                  <CardContent className="p-6 md:p-8">
                    {submitted ? (
                      <div className="text-center py-8">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">
                          We'll reach out to {form.leadName.split(" ")[0] || "them"} within 24 hours
                        </h3>
                        <p className="text-slate-600 mb-6">
                          You'll get an email when they book, and another when your $500 is ready.
                        </p>
                        <Button
                          onClick={() => {
                            setSubmitted(false);
                            setForm({ referrerName: form.referrerName, referrerPhone: form.referrerPhone, leadName: "", leadPhone: "", consent: false });
                          }}
                          variant="outline"
                          className="border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35]/5"
                        >
                          Refer Another Person
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-red-700 text-sm">{error}</p>
                          </div>
                        )}

                        {/* Your Info */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="referrerName" className="text-sm font-medium">Your name</Label>
                            <Input
                              id="referrerName"
                              required
                              placeholder="Your full name"
                              value={form.referrerName}
                              onChange={(e) => setForm({ ...form, referrerName: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="referrerPhone" className="text-sm font-medium">Your phone</Label>
                            <Input
                              id="referrerPhone"
                              type="tel"
                              required
                              placeholder="(555) 123-4567"
                              value={form.referrerPhone}
                              onChange={(e) => setForm({ ...form, referrerPhone: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Their Info */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="leadName" className="text-sm font-medium">Their name</Label>
                            <Input
                              id="leadName"
                              required
                              placeholder="Their full name"
                              value={form.leadName}
                              onChange={(e) => setForm({ ...form, leadName: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="leadPhone" className="text-sm font-medium">Their phone</Label>
                            <Input
                              id="leadPhone"
                              type="tel"
                              required
                              placeholder="(555) 987-6543"
                              value={form.leadPhone}
                              onChange={(e) => setForm({ ...form, leadPhone: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Consent */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id="consent"
                            checked={form.consent}
                            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#ff6b35] focus:ring-[#ff6b35]"
                          />
                          <Label htmlFor="consent" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
                            I confirm I have permission to share their info, and they're open to a call
                          </Label>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-[#ff6b35] hover:bg-[#e55a25] text-white text-lg py-6 font-semibold"
                        >
                          {loading ? "Submitting..." : "Submit Referral →"}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>

                {/* Text-a-Friend Card */}
                <Card className="shadow-lg mt-6 border-dashed border-2 border-slate-300">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <MessageSquare className="w-6 h-6 text-[#1e3a5f] mt-0.5" />
                      <div>
                        <h3 className="text-lg font-bold text-[#1e3a5f]">Or just text them directly</h3>
                        <p className="text-sm text-slate-600">
                          We'll generate a message — you send it from your phone.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Input
                        type="tel"
                        placeholder="Their phone number"
                        value={textFriendPhone}
                        onChange={(e) => setTextFriendPhone(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleTextAFriend}
                        variant="outline"
                        className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/5 whitespace-nowrap"
                      >
                        Generate Text <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Opens your phone's messaging app with a pre-written message.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tiered Rewards Column (2/5) */}
              <div className="lg:col-span-2">
                <Card className="shadow-lg border-2 border-[#ff6b35]/20 sticky top-8">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <Trophy className="w-6 h-6 text-[#ff6b35]" />
                      <h3 className="text-xl font-bold text-[#1e3a5f]">Tiered Rewards</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-5">
                      The more you refer, the more you earn per referral.
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1e3a5f]">1 referral booked</p>
                          <p className="text-xs text-slate-500">$500 per referral</p>
                        </div>
                        <p className="text-lg font-bold text-green-700">$500</p>
                      </div>

                      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1e3a5f]">3 referrals booked</p>
                          <p className="text-xs text-green-700">$666 each — bonus $500</p>
                        </div>
                        <p className="text-lg font-bold text-green-700">$2,000</p>
                      </div>

                      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1e3a5f]">5 referrals booked</p>
                          <p className="text-xs text-blue-700">$800 each — bonus $1,500</p>
                        </div>
                        <p className="text-lg font-bold text-blue-700">$4,000</p>
                      </div>

                      <div className="flex items-center justify-between bg-[#ff6b35]/5 border border-[#ff6b35]/30 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1e3a5f]">10 referrals booked</p>
                          <p className="text-xs text-[#ff6b35]">$1,000 each — bonus $5,000</p>
                        </div>
                        <p className="text-lg font-bold text-[#ff6b35]">$10,000</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                      Tiered rewards reset annually. Bonuses paid when referred customer completes installation.
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-200">
                      <p className="text-sm font-semibold text-[#1e3a5f] mb-2">Who can refer?</p>
                      <ul className="space-y-1.5 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Past customers
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Realtors & property managers
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Neighbors & friends
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Anyone in NJ
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
