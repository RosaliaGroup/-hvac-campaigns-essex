import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Clock, Wrench, Star, Shield, ArrowRight, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

export default function LPMaintenanceOffer() {
  const { toast } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitted, setSubmitted] = useState(false);

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please call (862) 419-1763", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone && !form.email) {
      toast({ title: "Please enter your phone or email", variant: "destructive" });
      return;
    }
    captureLead.mutate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      captureType: "inline_form",
      pageUrl: window.location.href,
      message: "SMS/Email LP: Maintenance Tune-Up Offer",
    });
  };

  const included = [
    "Full system inspection (heating & cooling)",
    "Filter replacement (standard 1\" filter)",
    "Coil cleaning and refrigerant check",
    "Thermostat calibration",
    "Electrical connections tightened",
    "Written report with recommendations",
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="bg-[#ff6b35] text-white py-2 px-4 text-center text-sm font-bold">
        ⏰ LIMITED TIME OFFER — Spring Tune-Up Special: Book This Week & Save
      </div>

      {/* Hero */}
      <section className="py-12 px-4 bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge className="mb-4 bg-[#ff6b35] text-white">Spring Special — Limited Availability</Badge>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                HVAC Tune-Up Special — <span className="text-[#ff6b35]">Book Now</span> Before Summer Rush
              </h1>
              <p className="text-lg text-white/90 mb-6">
                A properly maintained HVAC system runs 15–20% more efficiently. Book your spring tune-up now and avoid the summer rush — our schedule fills fast.
              </p>

              <div className="bg-white/10 rounded-xl p-4 mb-6">
                <div className="text-center mb-3">
                  <div className="text-4xl font-bold text-[#ff6b35]">$89</div>
                  <div className="text-sm text-white/70 line-through">Regular price: $149</div>
                  <div className="text-sm font-semibold text-green-400">You save $60 — Limited time offer</div>
                </div>
                <div className="text-xs text-white/60 text-center">Valid for residential systems only · One system per address</div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> 4.9★ Rating</span>
                <span className="flex items-center gap-1"><Shield className="h-4 w-4" /> Licensed & Insured</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> 24-hr Scheduling</span>
              </div>
            </div>

            {/* Booking Form */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-gray-900">
              {submitted ? (
                <div className="text-center py-8">
                  <Calendar className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-[#1e3a5f] mb-2">You're Booked!</h3>
                  <p className="text-gray-600 mb-4">We'll call you within 2 hours to confirm your appointment time.</p>
                  <a href="tel:+18624191763">
                    <Button className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold">
                      <Phone className="h-4 w-4 mr-2" /> Call to Schedule Immediately
                    </Button>
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-[#1e3a5f] mb-1">Book Your Tune-Up</h2>
                  <p className="text-sm text-gray-500 mb-4">We'll call to confirm your preferred date and time</p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                      <Input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <Input type="tel" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <Input type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <Button type="submit" disabled={captureLead.isPending} className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold py-4 text-base">
                      {captureLead.isPending ? "Booking..." : "Book My $89 Tune-Up →"}
                    </Button>
                    <p className="text-xs text-gray-400 text-center">We'll call within 2 hours to confirm your appointment</p>
                  </form>
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4 text-[#ff6b35]" /> Limited spots — book before they fill up
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">What's Included in Your Tune-Up</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {included.map((item) => (
              <div key={item} className="flex items-start gap-3 bg-white rounded-lg p-4 shadow-sm">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">Plus: If we find any issues, we'll provide a written estimate with no pressure to proceed.</p>
          </div>
        </div>
      </section>

      {/* Why Tune-Up Matters */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1e3a5f] text-center mb-8">Why Regular Maintenance Matters</h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { icon: Wrench, stat: "15–20%", label: "More Efficient", desc: "Properly maintained systems use significantly less energy" },
              { icon: Clock, stat: "5–7 Years", label: "Longer Lifespan", desc: "Regular tune-ups extend your system's life by years" },
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
      <section className="py-12 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Karen B.", location: "West Orange, NJ", text: "Quick, professional, and thorough. Found a small issue before it became a big problem. Worth every penny." },
              { name: "Tom H.", location: "Verona, NJ", text: "Been using Mechanical Enterprise for 5 years. Always on time, always professional. My system runs great." },
              { name: "Lisa P.", location: "Millburn, NJ", text: "Booked online, they called within an hour. Technician was knowledgeable and explained everything clearly." },
            ].map((review) => (
              <div key={review.name} className="bg-white rounded-xl p-5 shadow-sm">
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
          <h2 className="text-3xl font-bold mb-3">Don't Wait for the Summer Rush</h2>
          <p className="text-white/80 mb-6">Our schedule fills up fast in spring. Book your $89 tune-up now and lock in your spot.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold px-8" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Book $89 Tune-Up <ArrowRight className="h-5 w-5 ml-2" />
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
