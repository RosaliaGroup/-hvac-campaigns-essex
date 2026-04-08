import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Phone, Clock, Wrench, Star, Shield,
  ArrowRight, Calendar, Zap, Home, Building2, TrendingUp
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    name: "Essential",
    tag: "Most Popular",
    tagColor: "bg-[#ff6b35]",
    icon: Home,
    audience: "Homeowners",
    description: "Annual tune-up + priority scheduling for residential systems",
    features: [
      "1 annual HVAC tune-up (heating + cooling)",
      "Filter replacement included",
      "Priority scheduling (within 24 hrs)",
      "10% discount on all repairs",
      "Written inspection report",
    ],
    cta: "Sign Up — Essential",
    value: "Essential Residential",
  },
  {
    name: "Pro",
    tag: "Best Value",
    tagColor: "bg-[#1e3a5f]",
    icon: Zap,
    audience: "Homeowners & Small Commercial",
    description: "Bi-annual service + emergency coverage for peace of mind",
    features: [
      "2 tune-ups per year (spring + fall)",
      "Filter replacements included",
      "Priority emergency service (same day)",
      "15% discount on all repairs",
      "Refrigerant top-off included",
      "Thermostat calibration",
    ],
    cta: "Sign Up — Pro",
    value: "Pro Residential/Commercial",
  },
  {
    name: "Premium",
    tag: "Full Coverage",
    tagColor: "bg-green-600",
    icon: Shield,
    audience: "Commercial & Multi-Unit",
    description: "Comprehensive coverage for commercial properties and multi-unit buildings",
    features: [
      "Quarterly inspections (4x/year)",
      "All filters included",
      "24/7 emergency priority line",
      "20% discount on all parts & labor",
      "Refrigerant included",
      "BMS/controls inspection",
      "Annual performance report",
    ],
    cta: "Sign Up — Premium",
    value: "Premium Commercial",
  },
];

const included = [
  "Full system inspection (heating & cooling)",
  "Filter replacement (standard 1\" filter)",
  "Coil cleaning and refrigerant check",
  "Thermostat calibration",
  "Electrical connections tightened",
  "Written report with recommendations",
];

export default function LPMaintenanceOffer() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/lp_maintenance_subscription" });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call (862) 423-9396", variant: "destructive" });
    },
  });

  const handlePlanSelect = (planValue: string) => {
    setSelectedPlan(planValue);
    setTimeout(() => {
      document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

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
      captureType: "lp_maintenance_subscription",
      pageUrl: window.location.href,
      message: `Maintenance Subscription LP: Plan: ${selectedPlan || "Not selected"} | Address: ${form.address || "Not provided"}`,
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Top Bar */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-center text-sm font-medium">
        🔧 Maintenance Subscription Plans — First Month FREE for New Sign-Ups
      </div>

      {/* Hero */}
      <section className="py-14 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-green-100 text-green-800 border border-green-200">✅ No Long-Term Contracts</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1e3a5f] leading-tight mb-4">
            Never Worry About Your HVAC Again
          </h1>
          <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            Choose a maintenance subscription plan and get priority service, annual tune-ups, and exclusive discounts — all year long. <span className="font-semibold text-[#ff6b35]">First month FREE</span> for new subscribers.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            {[
              { icon: CheckCircle, text: "No long-term contracts" },
              { icon: Clock, text: "Priority scheduling" },
              { icon: Shield, text: "Certified NJ technicians" },
              { icon: Wrench, text: "All major brands serviced" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-gray-600">
                <item.icon className="h-4 w-4 text-green-500" />
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-2">Choose Your Plan</h2>
          <p className="text-center text-gray-500 mb-8">Contact us for custom pricing — we will match your budget and property needs</p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border-2 p-6 relative transition-all ${
                  selectedPlan === plan.value
                    ? "border-[#ff6b35] shadow-lg shadow-[#ff6b35]/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`absolute -top-3 left-6 ${plan.tagColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                  {plan.tag}
                </div>
                <plan.icon className="h-10 w-10 text-[#ff6b35] mb-3" />
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-400 mb-2">{plan.audience}</p>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full font-bold ${
                    selectedPlan === plan.value
                      ? "bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white"
                      : "bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
                  }`}
                  onClick={() => handlePlanSelect(plan.value)}
                >
                  {plan.cta} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">
            All plans include a free first-month trial. Cancel anytime with 30 days notice.
          </p>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">What Every Tune-Up Includes</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {included.map((item) => (
              <div key={item} className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            Plus: If we find any issues, we will provide a written estimate with no pressure to proceed.
          </p>
        </div>
      </section>

      {/* Sign-Up Form */}
      <section id="signup-form" className="py-14 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] rounded-2xl p-8 text-white">
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">You are Signed Up!</h3>
                <p className="text-white/80 mb-4">
                  Thank you for joining our maintenance program. We will call within 2 hours to confirm your plan and schedule your first service.
                </p>
                <a href="tel:+18624239396">
                  <Button className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white">
                    <Phone className="h-4 w-4 mr-2" /> Call Us Now
                  </Button>
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-1 text-center">
                  {selectedPlan ? `Sign Up for ${selectedPlan} Plan` : "Sign Up for a Maintenance Plan"}
                </h3>
                <p className="text-white/70 text-center mb-6 text-sm">
                  First month FREE · No contracts · Cancel anytime
                </p>
                {selectedPlan && (
                  <div className="bg-white/10 rounded-lg p-3 mb-4 text-center text-sm">
                    Selected: <span className="font-bold text-[#ff6b35]">{selectedPlan}</span>
                    <button
                      className="ml-2 text-white/60 underline text-xs"
                      onClick={() => setSelectedPlan(null)}
                    >
                      Change
                    </button>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="First Name"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      value={form.firstName}
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    />
                    <Input
                      placeholder="Last Name"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      value={form.lastName}
                      onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    />
                  </div>
                  <Input
                    type="email"
                    placeholder="Email Address *"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                  <Input
                    type="tel"
                    placeholder="Phone Number"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Property Address (optional)"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  />
                  <Button
                    type="submit"
                    disabled={captureLead.isPending}
                    className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base"
                  >
                    {captureLead.isPending ? "Submitting..." : "Start My Free Month"}
                  </Button>
                </form>
                <p className="text-xs text-white/50 text-center mt-3">
                  We will call within 2 hours to confirm your plan and schedule your first service
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { icon: Wrench, stat: "15-20%", label: "More Efficient", desc: "Properly maintained systems use significantly less energy" },
              { icon: Clock, stat: "5-7 Years", label: "Longer Lifespan", desc: "Regular tune-ups extend your system's life by years" },
              { icon: Shield, stat: "90%", label: "Fewer Breakdowns", desc: "Most emergency repairs are prevented by annual maintenance" },
            ].map((item) => (
              <div key={item.label} className="p-5">
                <item.icon className="h-10 w-10 text-[#ff6b35] mx-auto mb-3" />
                <div className="text-3xl font-bold text-[#1e3a5f] mb-1">{item.stat}</div>
                <div className="font-semibold text-[#1e3a5f] mb-2">{item.label}</div>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">What Subscribers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Karen B.", location: "West Orange, NJ", text: "Quick, professional, and thorough. Found a small issue before it became a big problem. Worth every penny." },
              { name: "Tom H.", location: "Verona, NJ", text: "Been using Mechanical Enterprise for 5 years. Always on time, always professional. My system runs great." },
              { name: "Lisa P.", location: "Millburn, NJ", text: "Booked online, they called within an hour. Technician was knowledgeable and explained everything clearly." },
            ].map((review) => (
              <div key={review.name} className="bg-gray-50 rounded-xl p-5 shadow-sm">
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
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
          <Calendar className="h-12 w-12 text-[#ff6b35] mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Do Not Wait for the Summer Rush</h2>
          <p className="text-white/80 mb-6">
            Our schedule fills up fast in spring. Sign up for a maintenance plan now and lock in your first service.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Choose My Plan <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <a href="tel:+18624239396">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Phone className="h-5 w-5 mr-2" /> Call (862) 423-9396
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
