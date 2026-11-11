/**
 * Qualify Landing Page — free in-home assessment booking (Jessica's booking-link destination).
 * Homeowners enter home details → pick a preferred time → book a free assessment.
 * Owner decision Nov 10 2026: no rebate amounts, out-of-pocket estimates or income questions.
 */
import { useState, useRef } from "react";
import { captureContext } from "@/lib/captureContext";
import Turnstile from "@/components/Turnstile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, ArrowRight, Phone, Home } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import HoneypotFields, { type HoneypotValues } from "@/components/HoneypotFields";
import { trackConversion } from "@/lib/conversions";
import { TcpaDisclosure } from "@/components/TcpaDisclosure";
import { TCPA_FORM_VERSION } from "@shared/leadFormVersion";

type Step = "details" | "book";

export default function Qualify() {
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    zip: "",
    homeType: "",
    sqft: "",
    currentSystem: "",
    replacing: "",
    timing: "",
    ownOrRent: "",
  });
  const [bookingForm, setBookingForm] = useState({
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [honeypot, setHoneypot] = useState<HoneypotValues>({ website: "", company_url: "" });
  const loadedAt = useRef(Date.now());

  const canContinue =
    form.firstName && form.phone && form.zip && form.homeType && form.currentSystem && form.replacing && form.ownOrRent;

  const captureLead = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      setSubmitting(false);
      setSubmitted(true);
      setSubmitError(false);
      setTurnstileToken(""); // single-use token
      // Confirmed-success only — fires once per submission via dedupeKey.
      // form_type=assessment per PR-1; event bucket is residential_quote_request,
      // the closest existing category (this page is the residential
      // assessment booking funnel). GTM migration is tracked for PR-2.
      trackConversion(
        "residential_quote_request",
        { form_type: "assessment", service_category: "assessment", customer_segment: "residential" },
        { dedupeKey: `qualify:${loadedAt.current}` },
      );
    },
    onError: () => {
      setSubmitting(false);
      setSubmitError(true);
      // Turnstile tokens are single-use — don't resend a possibly-already-consumed
      // token on retry. Clearing it makes the server fall back to the Layer-1
      // content guard (see Turnstile.tsx) rather than resubmitting a stale token.
      setTurnstileToken("");
    },
  });

  function handleSubmitBooking() {
    setSubmitting(true);
    setSubmitError(false);
    captureLead.mutate({
      name: `${form.firstName} ${form.lastName}`.trim() || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      captureType: "qualify_form",
      ...captureContext(),
      message: `Service: Free In-Home Assessment\nReplacing: ${form.replacing}\nTiming: ${form.timing || "Not specified"}\nHome Type: ${form.homeType}\nSq Ft: ${form.sqft || "Not specified"}\nCurrent System: ${form.currentSystem}\nOwn/Rent: ${form.ownOrRent}\nZIP: ${form.zip}\nPreferred Date: ${bookingForm.preferredDate || "Not specified"}\nPreferred Time: ${bookingForm.preferredTime || "Not specified"}\nNotes: ${bookingForm.notes || "None"}`,
      website: honeypot.website || undefined,
      company_url: honeypot.company_url || undefined,
      _ts: loadedAt.current,
      cfTurnstileResponse: turnstileToken || undefined,
      formVersion: TCPA_FORM_VERSION,
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-10 pb-10">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">You're All Set, {form.firstName}!</h2>
            <p className="text-gray-600 mb-6">
              Our team will call you within 24 hours to confirm your FREE assessment. Check your phone for a confirmation text.
            </p>
            <p className="text-sm text-gray-500">
              Questions? Call us at{" "}
              <a href="tel:+18624191763" className="text-[#ff6b35] font-semibold">(862) 419-1763</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5a8f] text-white py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Home className="h-6 w-6 text-[#ff6b35]" />
            <span className="text-sm font-semibold text-[#ff6b35] uppercase tracking-wide">Mechanical Enterprise</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Book Your Free In-Home Assessment
          </h1>
          <p className="text-white/80 text-lg">
            We size the new system to your home and give you a written quote before you decide.
            Takes about 60 seconds to book.
          </p>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {(["details", "book"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s ? "bg-[#ff6b35] text-white" :
                  step === "book" && i === 0 ? "bg-white/30 text-white" : "bg-white/10 text-white/50"
                }`}>
                  {step === "book" && i === 0 ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                {i < 1 && <div className="w-8 h-0.5 bg-white/20" />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-12 mt-1 text-xs text-white/60">
            <span>Your Home</span>
            <span>Pick a Time</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* STEP 1: Details */}
        {step === "details" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1e3a5f]">Tell Us About Your Home</CardTitle>
              <p className="text-sm text-gray-500">Takes about 60 seconds — no commitment required</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input
                    placeholder="Ana"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    placeholder="Haynes"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    placeholder="(862) 419-1763"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>ZIP Code *</Label>
                  <Input
                    placeholder="07105"
                    value={form.zip}
                    onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Email (optional)</Label>
                <Input
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <Label>Home Type *</Label>
                <Select value={form.homeType} onValueChange={v => setForm(f => ({ ...f, homeType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select home type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single-Family Home</SelectItem>
                    <SelectItem value="multi">Multi-Family (2–4 units)</SelectItem>
                    <SelectItem value="condo">Condo / Townhouse</SelectItem>
                    <SelectItem value="mobile">Mobile / Manufactured Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Approximate Square Footage</Label>
                <Select value={form.sqft} onValueChange={v => setForm(f => ({ ...f, sqft: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="800">Under 1,000 sq ft</SelectItem>
                    <SelectItem value="1500">1,000 – 2,000 sq ft</SelectItem>
                    <SelectItem value="2500">2,000 – 3,000 sq ft</SelectItem>
                    <SelectItem value="3500">Over 3,000 sq ft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Current Heating System *</Label>
                <Select value={form.currentSystem} onValueChange={v => setForm(f => ({ ...f, currentSystem: v }))}>
                  <SelectTrigger><SelectValue placeholder="What heats your home now?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oil">Oil / Fuel Oil</SelectItem>
                    <SelectItem value="gas">Natural Gas</SelectItem>
                    <SelectItem value="propane">Propane</SelectItem>
                    <SelectItem value="electric">Electric Baseboard / Resistance</SelectItem>
                    <SelectItem value="heatpump">Existing Heat Pump</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>What Do You Want to Replace? *</Label>
                <Select value={form.replacing} onValueChange={v => setForm(f => ({ ...f, replacing: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select what to replace" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heating-and-cooling">Heating and cooling</SelectItem>
                    <SelectItem value="heating">Heating only</SelectItem>
                    <SelectItem value="cooling">Central AC only</SelectItem>
                    <SelectItem value="not-sure">Not sure yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>When Are You Planning to Replace?</Label>
                <Select value={form.timing} onValueChange={v => setForm(f => ({ ...f, timing: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select timing" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asap">As soon as possible</SelectItem>
                    <SelectItem value="1-3-months">In the next 1–3 months</SelectItem>
                    <SelectItem value="3-plus-months">In 3+ months</SelectItem>
                    <SelectItem value="researching">Just researching</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Do You Own or Rent? *</Label>
                <Select value={form.ownOrRent} onValueChange={v => setForm(f => ({ ...f, ownOrRent: v }))}>
                  <SelectTrigger><SelectValue placeholder="Own or rent?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">I Own My Home</SelectItem>
                    <SelectItem value="rent">I Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.ownOrRent === "rent" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  Replacement decisions are usually made by the owner. If you rent, we're happy to talk with your landlord — just let us know in the notes.
                </div>
              )}

              <Button
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold text-lg py-6"
                disabled={!canContinue}
                onClick={() => setStep("book")}
              >
                Continue <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <p className="text-xs text-center text-gray-400">
                No commitment. No spam. Your info is only used to schedule your free assessment.
              </p>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Book */}
        {step === "book" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1e3a5f]">Book Your FREE Assessment</CardTitle>
              <p className="text-sm text-gray-500">
                Our technician will visit your home, check your current system and walk you through the installation plan — no cost, no obligation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Preferred Date</Label>
                <Input
                  type="date"
                  value={bookingForm.preferredDate}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                  onChange={e => setBookingForm(b => ({ ...b, preferredDate: e.target.value }))}
                />
              </div>

              <div>
                <Label>Preferred Time</Label>
                <Select value={bookingForm.preferredTime} onValueChange={v => setBookingForm(b => ({ ...b, preferredTime: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a time window" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8am – 12pm)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12pm – 4pm)</SelectItem>
                    <SelectItem value="evening">Evening (4pm – 7pm)</SelectItem>
                    <SelectItem value="flexible">I'm flexible — any time works</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Anything else we should know? (optional)</Label>
                <Input
                  placeholder="e.g. gate code, parking notes, specific concerns..."
                  value={bookingForm.notes}
                  onChange={e => setBookingForm(b => ({ ...b, notes: e.target.value }))}
                />
              </div>

              <HoneypotFields values={honeypot} onChange={setHoneypot} />

              <Turnstile className="flex justify-center" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                  <p className="font-semibold mb-1">We couldn't submit your request — please try again.</p>
                  <p className="text-red-700">
                    Your info hasn't been saved yet. Tap "Try Again" below, or call us directly and we'll book your
                    free assessment over the phone: {" "}
                    <a href="tel:+18624191763" className="font-semibold underline">(862) 419-1763</a>.
                  </p>
                </div>
              )}

              <Button
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold text-lg py-6"
                disabled={submitting}
                onClick={handleSubmitBooking}
              >
                {submitting ? "Submitting..." : submitError ? "Try Again" : "Confirm My FREE Assessment"} <CheckCircle className="ml-2 h-5 w-5" />
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Phone className="h-4 w-4" />
                <span>Or call us directly: </span>
                <a href="tel:+18624191763" className="text-[#ff6b35] font-semibold">(862) 419-1763</a>
              </div>

              <TcpaDisclosure className="text-xs text-center text-gray-400" />
            </CardContent>
          </Card>
        )}

        {/* What you get */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#1e3a5f]">Free</p>
            <p className="text-xs text-gray-500">In-home assessment</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#1e3a5f]">Written</p>
            <p className="text-xs text-gray-500">Quote before you decide</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#1e3a5f]">Optional</p>
            <p className="text-xs text-gray-500">10-year parts &amp; labor coverage</p>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to mechanicalenterprise.com</Link>
        </div>
      </div>
    </div>
  );
}
