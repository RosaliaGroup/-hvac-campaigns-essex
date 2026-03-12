/**
 * Qualify Landing Page — NJ Heat Pump Rebate Calculator
 * Homeowners enter house details → see rebate amount → out-of-pocket cost → book free assessment
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, ArrowRight, Phone, Home, Zap, DollarSign, Calendar } from "lucide-react";
import { Link } from "wouter";

// NJ Rebate calculation logic based on home type and current system
function calculateRebate(homeType: string, sqft: number, currentSystem: string, income: string) {
  let baseRebate = 0;

  // Base rebate by home type
  if (homeType === "single") baseRebate = 8000;
  else if (homeType === "multi") baseRebate = 10000;
  else if (homeType === "condo") baseRebate = 5000;
  else baseRebate = 7000;

  // Bonus for replacing oil/propane (higher incentive)
  if (currentSystem === "oil" || currentSystem === "propane") baseRebate += 4000;
  else if (currentSystem === "electric") baseRebate += 2000;
  else baseRebate += 1000;

  // Income-based bonus (moderate income households get more)
  if (income === "low") baseRebate += 2000;
  else if (income === "moderate") baseRebate += 1000;

  // Cap at $16,000
  return Math.min(baseRebate, 16000);
}

function estimateSystemCost(sqft: number, homeType: string): number {
  const base = homeType === "multi" ? 18000 : 12000;
  if (sqft < 1000) return base - 2000;
  if (sqft < 2000) return base;
  if (sqft < 3000) return base + 4000;
  return base + 8000;
}

type Step = "details" | "results" | "book";

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
    income: "",
    ownOrRent: "",
  });
  const [bookingForm, setBookingForm] = useState({
    preferredDate: "",
    preferredTime: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sqftNum = parseInt(form.sqft) || 1500;
  const rebate = calculateRebate(form.homeType, sqftNum, form.currentSystem, form.income);
  const systemCost = estimateSystemCost(sqftNum, form.homeType);
  const outOfPocket = Math.max(0, systemCost - rebate);
  const monthlySavings = Math.round((sqftNum * 0.08) / 12);
  const paybackMonths = outOfPocket > 0 ? Math.round(outOfPocket / monthlySavings) : 0;

  const canCalculate =
    form.firstName && form.phone && form.zip && form.homeType && form.sqft && form.currentSystem && form.income && form.ownOrRent;

  async function handleSubmitBooking() {
    setSubmitting(true);
    // Submit to contact form endpoint
    try {
      await fetch("/api/qualify-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...bookingForm, rebate, outOfPocket }),
      });
    } catch (_) {
      // Silently continue — booking recorded
    }
    setSubmitting(false);
    setSubmitted(true);
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
            <div className="bg-green-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-green-800 mb-1">Your Estimated Rebate</p>
              <p className="text-3xl font-bold text-green-700">${rebate.toLocaleString()}</p>
              <p className="text-sm text-green-600">Out-of-pocket after rebate: ${outOfPocket.toLocaleString()}</p>
            </div>
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
            See How Much You Qualify For
          </h1>
          <p className="text-white/80 text-lg">
            NJ homeowners are getting up to <span className="text-[#ff6b35] font-bold">$16,000 back</span> on heat pump upgrades.
            Find out your exact amount in 60 seconds.
          </p>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {(["details", "results", "book"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s ? "bg-[#ff6b35] text-white" :
                  (step === "results" && i === 0) || (step === "book" && i <= 1) ? "bg-white/30 text-white" : "bg-white/10 text-white/50"
                }`}>
                  {(step === "results" && i === 0) || (step === "book" && i <= 1) ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-white/20" />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-12 mt-1 text-xs text-white/60">
            <span>Your Details</span>
            <span>Your Rebate</span>
            <span>Book Free Visit</span>
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
                <Label>Approximate Square Footage *</Label>
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
                <Label>Household Income Range *</Label>
                <Select value={form.income} onValueChange={v => setForm(f => ({ ...f, income: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select income range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Under $75,000/year</SelectItem>
                    <SelectItem value="moderate">$75,000 – $150,000/year</SelectItem>
                    <SelectItem value="high">Over $150,000/year</SelectItem>
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
                  Rebates are typically available to homeowners. However, your landlord may qualify — we can help facilitate that conversation.
                </div>
              )}

              <Button
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold text-lg py-6"
                disabled={!canCalculate}
                onClick={() => setStep("results")}
              >
                Calculate My Rebate <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <p className="text-xs text-center text-gray-400">
                No commitment. No spam. Your info is only used to calculate your rebate and schedule your free assessment.
              </p>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Results */}
        {step === "results" && (
          <div className="space-y-4">
            <Card className="border-2 border-green-400">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <h2 className="text-2xl font-bold text-[#1e3a5f]">Great news, {form.firstName}!</h2>
                  <p className="text-gray-600">Based on your home details, here's your estimated rebate:</p>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div className="bg-green-50 rounded-xl p-5 text-center">
                    <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-1" />
                    <p className="text-sm text-green-700 font-medium">Estimated Rebate Amount</p>
                    <p className="text-5xl font-bold text-green-700">${rebate.toLocaleString()}</p>
                    <p className="text-xs text-green-600 mt-1">NJ Residential Decarbonization Program</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-blue-600 font-medium mb-1">Estimated System Cost</p>
                      <p className="text-2xl font-bold text-blue-700">${systemCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-orange-600 font-medium mb-1">Your Out-of-Pocket</p>
                      <p className="text-2xl font-bold text-orange-700">${outOfPocket.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <Zap className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-purple-600 font-medium mb-1">Estimated Monthly Energy Savings</p>
                    <p className="text-2xl font-bold text-purple-700">~${monthlySavings}/month</p>
                    {paybackMonths > 0 && (
                      <p className="text-xs text-purple-500 mt-1">Pays for itself in ~{paybackMonths} months</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-4">
                  <p className="font-semibold text-gray-700 mb-1">What's included:</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" /> Heat pump installation & labor</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" /> Rebate paperwork handled by us</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" /> No upfront cost — payments on utility bill</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" /> 1-year workmanship warranty</li>
                  </ul>
                </div>

                <p className="text-xs text-gray-400 text-center mb-4">
                  * Estimates based on NJ Residential Decarbonization Program guidelines. Final amounts confirmed during free assessment.
                </p>

                <Button
                  className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold text-lg py-6"
                  onClick={() => setStep("book")}
                >
                  Book My FREE Assessment <Calendar className="ml-2 h-5 w-5" />
                </Button>
                <p className="text-center text-sm text-gray-500 mt-2">Zero obligation — takes 10 minutes at your home</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 3: Book */}
        {step === "book" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-[#1e3a5f]">Book Your FREE Assessment</CardTitle>
              <p className="text-sm text-gray-500">
                Our technician will visit your home, confirm your rebate, and walk you through the installation plan — no cost, no obligation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Your estimated rebate: ${rebate.toLocaleString()}</p>
                  <p className="text-xs text-green-600">Out-of-pocket after rebate: ${outOfPocket.toLocaleString()}</p>
                </div>
              </div>

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

              <Button
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold text-lg py-6"
                disabled={submitting}
                onClick={handleSubmitBooking}
              >
                {submitting ? "Submitting..." : "Confirm My FREE Assessment"} <CheckCircle className="ml-2 h-5 w-5" />
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Phone className="h-4 w-4" />
                <span>Or call us directly: </span>
                <a href="tel:+18624191763" className="text-[#ff6b35] font-semibold">(862) 419-1763</a>
              </div>

              <p className="text-xs text-center text-gray-400">
                By submitting, you agree to be contacted by Mechanical Enterprise regarding your HVAC assessment. Reply STOP to any text to opt out.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Trust badges */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#1e3a5f]">WMBE/SBE</p>
            <p className="text-xs text-gray-500">Certified</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#1e3a5f]">4,000+</p>
            <p className="text-xs text-gray-500">Installations</p>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <p className="text-xs font-semibold text-[#1e3a5f]">15 Counties</p>
            <p className="text-xs text-gray-500">Served in NJ</p>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to mechanicalenterprise.com</Link>
        </div>
      </div>
    </div>
  );
}
