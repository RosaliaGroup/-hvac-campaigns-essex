import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Phone, Star, ArrowRight, DollarSign,
  Users, Briefcase, Home, Building2, Gift, TrendingUp
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

const earningExamples = [
  { type: "Residential Heat Pump", rebate: "$16,000", yourCut: "$500–$1,000", icon: Home },
  { type: "Commercial HVAC Upgrade", rebate: "Up to 80%", yourCut: "$1,500–$5,000", icon: Building2 },
  { type: "Maintenance Subscription", rebate: "Recurring", yourCut: "$50–$150/yr", icon: TrendingUp },
];

const partnerTypes = [
  { label: "Real Estate Agents", desc: "Earn on every home sale referral needing HVAC upgrades", icon: Home },
  { label: "Property Managers", desc: "Refer your portfolio and earn on every property upgrade", icon: Building2 },
  { label: "General Contractors", desc: "Add HVAC to your service offerings and earn referral fees", icon: Briefcase },
  { label: "Anyone with a Network", desc: "Know homeowners or business owners? That's all you need", icon: Users },
];

const steps = [
  { num: "1", title: "Sign Up Free", desc: "Fill out the form below. No fees, no contracts, no minimums." },
  { num: "2", title: "Get Your Referral Link", desc: "We'll send you a unique link and materials to share with your network." },
  { num: "3", title: "Refer & Earn", desc: "Every time someone books through your link, you earn a referral fee — paid within 30 days of job completion." },
];

export default function LPReferralPartner() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    occupation: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/lp_referral_partner" });
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
      captureType: "lp_referral_partner",
      pageUrl: window.location.href,
      message: `Referral Partner LP: Occupation: ${form.occupation || "Not specified"}`,
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        💰 Earn Extra Income Referring HVAC Customers — No Experience Required
      </div>

      {/* Hero */}
      <section className="py-14 px-4 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <Badge className="mb-4 bg-[#ff6b35] text-white border-0">Referral Partner Program</Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              Earn <span className="text-[#ff6b35]">$500–$5,000</span> Per Referral
            </h1>
            <p className="text-white/85 text-lg mb-6">
              Partner with Mechanical Enterprise HVAC and earn referral fees every time someone you refer gets a new system, commercial upgrade, or maintenance plan. No selling. Just connecting.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-400" /> Free to join
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-400" /> No minimums
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-400" /> Paid within 30 days
              </div>
            </div>
          </div>

          {/* Sign-Up Form */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">You're In!</h3>
                <p className="text-gray-600 mb-4">
                  Welcome to the Mechanical Enterprise Referral Partner Program. We'll reach out within 24 hours with your partner link and materials.
                </p>
                <a href="tel:+18624191763">
                  <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white">
                    <Phone className="h-4 w-4 mr-2" /> Call Us Now
                  </Button>
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-1">Join the Partner Program</h3>
                <p className="text-sm text-gray-500 mb-4">Free sign-up — takes 60 seconds</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="First Name"
                      value={form.firstName}
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                    <Input
                      placeholder="Last Name"
                      value={form.lastName}
                      onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                  <Input
                    type="email"
                    placeholder="Email Address *"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                  <Input
                    type="tel"
                    placeholder="Phone Number"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Your Occupation (e.g., Realtor, Contractor)"
                    value={form.occupation}
                    onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    disabled={captureLead.isPending}
                    className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base"
                  >
                    {captureLead.isPending ? "Submitting..." : "Join Free & Start Earning →"}
                  </Button>
                </form>
                <p className="text-xs text-gray-400 text-center mt-3">
                  We'll contact you within 24 hours with your partner materials
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Earning Examples */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-2">What You Can Earn</h2>
          <p className="text-center text-gray-500 mb-8">Referral fees are paid per completed job</p>
          <div className="grid md:grid-cols-3 gap-6">
            {earningExamples.map((ex) => (
              <div key={ex.type} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
                <ex.icon className="h-10 w-10 text-[#ff6b35] mx-auto mb-3" />
                <h3 className="font-bold text-[#1e3a5f] mb-1">{ex.type}</h3>
                <p className="text-sm text-gray-500 mb-3">Customer rebate: <span className="font-semibold text-green-600">{ex.rebate}</span></p>
                <div className="bg-[#ff6b35]/10 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Your referral fee</p>
                  <p className="text-2xl font-bold text-[#ff6b35]">{ex.yourCut}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Referral fees vary by job size and type. Exact amounts confirmed at time of booking.
          </p>
        </div>
      </section>

      {/* Who Should Join */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Who Makes a Great Partner?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {partnerTypes.map((pt) => (
              <div key={pt.label} className="flex items-start gap-4 p-5 border rounded-xl hover:border-[#ff6b35] transition-colors">
                <div className="bg-[#ff6b35]/10 rounded-lg p-3 flex-shrink-0">
                  <pt.icon className="h-6 w-6 text-[#ff6b35]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1e3a5f] mb-1">{pt.label}</h3>
                  <p className="text-sm text-gray-500">{pt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">How It Works</h2>
          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.num} className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-full bg-[#ff6b35] text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {step.num}
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-[#1e3a5f] text-lg mb-1">{step.title}</h3>
                  <p className="text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">What Our Partners Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Mike T.", role: "Real Estate Agent, Montclair NJ", text: "I referred 3 clients last quarter and earned over $2,000. Takes me 5 minutes per referral." },
              { name: "Sandra L.", role: "Property Manager, Essex County", text: "My entire portfolio switched to Mechanical Enterprise. The rebates for my owners are incredible and I earn every time." },
              { name: "Carlos R.", role: "General Contractor, Newark NJ", text: "I was leaving money on the table not having an HVAC partner. Now I refer every job that needs it." },
            ].map((r) => (
              <div key={r.name} className="bg-gray-50 rounded-xl p-5">
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm text-gray-600 italic mb-3">"{r.text}"</p>
                <p className="font-semibold text-[#1e3a5f] text-sm">{r.name}</p>
                <p className="text-xs text-gray-400">{r.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Common Questions</h2>
          <div className="space-y-4">
            {[
              { q: "Do I need to be licensed or certified?", a: "No. You just need to know people who might need HVAC services. We handle all the technical work." },
              { q: "How do I track my referrals?", a: "After joining, you'll receive a unique referral link. We track all leads that come through your link and notify you when they convert." },
              { q: "When do I get paid?", a: "Referral fees are paid within 30 days of job completion via check or direct deposit." },
              { q: "Is there a limit to how much I can earn?", a: "No limit. The more you refer, the more you earn. Some of our top partners earn $10,000+ per year." },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="font-bold text-[#1e3a5f] mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 px-4 bg-[#1e3a5f] text-white text-center">
        <div className="max-w-2xl mx-auto">
          <Gift className="h-14 w-14 text-[#ff6b35] mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Ready to Start Earning?</h2>
          <p className="text-white/80 mb-6">
            Join hundreds of NJ professionals already earning with Mechanical Enterprise. Sign up takes 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Join the Partner Program <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <a href="tel:+18624191763">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 419-1763
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
