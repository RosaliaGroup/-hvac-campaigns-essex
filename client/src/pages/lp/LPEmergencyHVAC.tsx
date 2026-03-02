import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Clock, Zap, Shield, Star, AlertTriangle, Award } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

export default function LPEmergencyHVAC() {
  const { toast } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", { send_to: "AW-17768263516/emergency_lp" });
      }
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Call us now: (862) 419-1763", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone && !form.email) {
      toast({ title: "Please enter your phone number", variant: "destructive" });
      return;
    }
    captureLead.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      captureType: "exit_popup",
      pageUrl: window.location.href,
      message: "Google Ads LP: Emergency HVAC Service",
    });
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Urgent Top Bar */}
      <div className="bg-red-600 text-white py-3 px-4 text-center font-bold text-sm animate-pulse">
        🚨 HVAC EMERGENCY? Call Now: (862) 419-1763 — Same-Day Service Available
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-[#1e3a5f] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-red-500 text-white text-xs px-3 py-1">24/7 Emergency Service · Same-Day Response</Badge>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                <span className="text-red-400">Emergency HVAC</span> Service in Essex County NJ
              </h1>
              <p className="text-lg text-white/90 mb-6">
                HVAC breakdown? No heat in winter? AC out in summer? Mechanical Enterprise dispatches certified technicians same-day across 15 NJ counties.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  "Same-day emergency dispatch",
                  "Available 24 hours, 7 days a week",
                  "All makes and models serviced",
                  "Upfront pricing — no hidden fees",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              {/* Urgent Call CTA */}
              <a href="tel:+18624191763">
                <Button size="lg" className="bg-red-500 hover:bg-red-600 text-white font-bold text-lg px-8 py-4 w-full md:w-auto">
                  <Phone className="h-5 w-5 mr-2" /> Call Now: (862) 419-1763
                </Button>
              </a>
            </div>

            {/* Lead Form */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
              {submitted ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">We're On It!</h3>
                  <p className="text-gray-600 mb-4">A technician will call you within 30 minutes to confirm your appointment.</p>
                  <a href="tel:+18624191763">
                    <Button className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3">
                      <Phone className="h-4 w-4 mr-2" /> Call Now for Faster Service
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <h2 className="text-xl font-bold text-[#1e3a5f]">Request Emergency Service</h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Technician dispatched within 2 hours of confirmation</p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                      <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <Input type="tel" placeholder="Phone Number *" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Input type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Button type="submit" disabled={captureLead.isPending} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 text-base">
                      {captureLead.isPending ? "Sending..." : "🚨 Request Emergency Service"}
                    </Button>
                  </form>
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4 text-red-500" /> Average response time: under 2 hours
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Response Time Promise */}
      <section className="py-10 px-4 bg-red-50 border-y border-red-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { icon: Phone, value: "< 30 min", label: "Call Back Time", color: "text-red-500" },
              { icon: Clock, value: "Same Day", label: "Dispatch Available", color: "text-red-500" },
              { icon: Zap, value: "24/7", label: "Emergency Line", color: "text-red-500" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm">
                <stat.icon className={`h-8 w-8 ${stat.color} mx-auto mb-2`} />
                <div className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-gray-600 text-sm font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Common Emergencies */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">We Handle All HVAC Emergencies</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "No heat in winter — furnace or heat pump failure",
              "No AC in summer — compressor or refrigerant issues",
              "Strange noises — banging, grinding, or squealing",
              "Water leaks — condensate drain or refrigerant lines",
              "Electrical issues — tripped breakers, burning smell",
              "Thermostat failure — system not responding",
              "Poor air quality — mold, dust, or odors",
              "Commercial system breakdown — urgent business needs",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6 text-center">
            {[
              { icon: Shield, label: "Licensed & Insured", sub: "NJ State Certified" },
              { icon: Star, label: "4.9★ Rating", sub: "500+ Reviews" },
              { icon: Award, label: "WMBE/SBE Certified", sub: "Minority-Owned Business" },
              { icon: Clock, label: "20+ Years", sub: "Serving NJ" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl p-5 shadow-sm">
                <item.icon className="h-8 w-8 text-[#ff6b35] mx-auto mb-2" />
                <div className="font-bold text-[#1e3a5f]">{item.label}</div>
                <div className="text-xs text-gray-500">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 px-4 bg-red-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3">Don't Wait — Call Now</h2>
          <p className="text-white/90 mb-6">Every hour without HVAC costs you comfort and potentially damages your system further.</p>
          <a href="tel:+18624191763">
            <Button size="lg" className="bg-white text-red-600 hover:bg-gray-100 font-bold text-xl px-12 py-5">
              <Phone className="h-6 w-6 mr-2" /> (862) 419-1763
            </Button>
          </a>
          <p className="text-white/60 text-xs mt-4">Serving 15 NJ Counties · Licensed & Insured · Available 24/7</p>
        </div>
      </section>
    </div>
  );
}
