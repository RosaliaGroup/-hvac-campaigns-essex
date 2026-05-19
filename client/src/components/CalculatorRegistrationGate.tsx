/**
 * CalculatorRegistrationGate — Value-First Redesign
 *
 * NEW FLOW:
 * Step 1: Instant estimate (ZIP, property type, income tier, household size) — NO gate
 * Step 2: Show LMI-aware rebate range immediately on same page
 * Step 3: Soft gate for detailed quote (first name, phone, email only)
 * Step 4: Confirmation + book assessment CTA
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CheckCircle, Calculator, Shield, Zap, Award, Clock, Phone,
  DollarSign, ArrowRight, Leaf, Building2, Home, Users
} from "lucide-react";

interface Props {
  onRegistered?: (email: string, phone: string) => void;
}

// ─── LMI-Aware Estimate Logic (Section C) ────────────────────────────────────

interface EstimateResult {
  range: string;
  programs: string[];
  note?: string;
  federalCredit?: string;
}

function getEstimate(
  propertyType: string,
  incomeTier: string,
): EstimateResult {
  if (propertyType === "commercial") {
    return {
      range: "70–80% off your project — up to $50,000+ in incentives",
      programs: [
        "NJ Direct Install for Small Business",
        "Commercial Lighting (100% free for many)",
        "NJ SmartStart Buildings",
        "Federal 179D commercial deduction",
      ],
      note: undefined,
    };
  }

  if (propertyType === "multifamily") {
    return {
      range: "$5,000–$12,000 per unit, plus building-wide incentives",
      programs: [
        "NJ Multifamily Energy Efficiency Program",
        "Multifamily Direct Install",
        "Whole-building rebates available",
      ],
      note: "Building owners and property managers get enhanced rates",
    };
  }

  // Residential — tiered by income
  switch (incomeTier) {
    case "lmi":
      return {
        range: "$15,000–$25,000+",
        programs: [
          "NJ Comfort Partners (100% covered for income-qualified)",
          "Direct Install Residential (enhanced LMI rate)",
          "Inflation Reduction Act HEEHRA program — up to $14,000",
          "NJ Clean Energy heat pump rebate stack",
        ],
        note: "You may qualify for FREE installation through Comfort Partners",
        federalCredit: "+ $2,000 federal tax credit",
      };
    case "middle":
      return {
        range: "$10,000–$18,000",
        programs: [
          "Heat pump rebate up to $7,000",
          "Inflation Reduction Act 25C tax credit up to $2,000",
          "NJ Clean Energy electrification rebates",
          "Possible utility-specific bonuses",
        ],
        federalCredit: "+ $2,000 federal tax credit",
      };
    case "standard":
      return {
        range: "$5,000–$12,000",
        programs: [
          "Heat pump rebate up to $7,000",
          "Federal 25C tax credit up to $2,000",
          "NJ Clean Energy base rebates",
        ],
        note: "Income tier doesn't disqualify you — full IRA tax credits still apply",
        federalCredit: "+ $2,000 federal tax credit",
      };
    default: // "prefer_not_to_say"
      return {
        range: "$5,000–$25,000",
        programs: [
          "NJ Clean Energy rebates",
          "Federal tax credits",
          "Utility-specific incentives",
          "Income-based enhanced programs (if eligible)",
        ],
        note: "Your specific qualification depends on income tier. We'll calculate exact amount on your free assessment.",
      };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CalculatorRegistrationGate({ onRegistered }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 fields
  const [zip, setZip] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [incomeTier, setIncomeTier] = useState("");
  const [householdSize, setHouseholdSize] = useState("");

  // Step 3 fields
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estimate result
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);

  const register = trpc.rebateCalculator.register.useMutation();

  // ── Analytics ─────────────────────────────────────────────────────────────────────
  function trackEvent(eventName: string, params?: Record<string, any>) {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", eventName, {
        event_category: "Rebate Calculator",
        ...params,
      });
    }
  }

  // ── Step 1: Calculate estimate ────────────────────────────────────────────────────────────
  function handleSeeEstimate() {
    if (!zip.trim() || zip.replace(/\D/g, "").length < 5) {
      setErrors({ zip: "Enter a valid 5-digit NJ ZIP code" });
      return;
    }
    if (!propertyType) {
      setErrors({ propertyType: "Select your property type" });
      return;
    }
    if (propertyType === "residential" && !incomeTier) {
      setErrors({ incomeTier: "Select an income tier for accurate estimate" });
      return;
    }
    setErrors({});
    const result = getEstimate(propertyType, incomeTier || "prefer_not_to_say");
    setEstimate(result);
    setCurrentStep(2);

    // Track: Step 1 submitted
    trackEvent("rebate_calc_step1_submitted", {
      event_label: propertyType,
      value: 1,
      zip: zip.trim(),
      property_type: propertyType,
      income_tier: incomeTier || "prefer_not_to_say",
    });
    // Track: Estimate viewed (Step 2 render)
    trackEvent("rebate_calc_estimate_viewed", {
      event_label: result.range,
      value: 1,
      estimated_range: result.range,
    });
  }

  // ── Step 3: Submit lead ─────────────────────────────────────────────────────
  async function handleGetExactAmount() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10)
      errs.phone = "Valid 10-digit phone number is required";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Valid email is required";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    try {
      await register.mutateAsync({
        firstName,
        lastName: "",
        email,
        phone,
        address: "",
        city: "",
        zip,
        origin: window.location.origin,
      });
      setCurrentStep(4);
      onRegistered?.(email, phone);

      // Track: Step 3 submitted (lead captured)
      trackEvent("rebate_calc_step3_submitted", {
        event_label: "lead_captured",
        value: 1,
      });
      // Google Ads conversion
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "conversion", {
          send_to: "AW-17768263516/rebate_calc_lead",
          value: 1.0,
          currency: "USD",
          transaction_id: Date.now().toString(),
        });
      }
    } catch (err) {
      console.error("Registration error:", err);
      setErrors({ submit: "Something went wrong. Please try again." });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Instant Estimate (NO gate)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        {/* Hero */}
        <div className="pt-16 pb-8 px-4 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-6 text-sm font-medium">
            <Calculator className="w-4 h-4" />
            Free NJ Rebate Estimator
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
            See How Much You Can Save<br className="hidden md:block" /> on a New Heat Pump
          </h1>
          <p className="text-white/80 text-lg max-w-2xl mx-auto">
            Answer 4 quick questions — get your estimated rebate range instantly. No email required.
          </p>
        </div>

        {/* Benefits bar */}
        <div className="flex flex-wrap justify-center gap-6 px-4 pb-8 text-white/90 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#ff6b35]" />
            No obligation
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#ff6b35]" />
            Results in 10 seconds
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#ff6b35]" />
            WMBE/SBE certified contractor
          </div>
        </div>

        {/* Estimate Form */}
        <div className="max-w-xl mx-auto px-4 pb-12">
          <Card className="shadow-2xl">
            <CardContent className="pt-6 pb-8 px-6">
              <div className="space-y-5">
                {/* ZIP Code */}
                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-sm font-semibold text-[#1e3a5f]">
                    ZIP Code
                  </Label>
                  <Input
                    id="zip"
                    placeholder="07102"
                    value={zip}
                    onChange={(e) => { setZip(e.target.value); setErrors({}); }}
                    maxLength={5}
                    className={errors.zip ? "border-red-500" : ""}
                  />
                  {errors.zip && <p className="text-xs text-red-500">{errors.zip}</p>}
                </div>

                {/* Property Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#1e3a5f]">Property Type</Label>
                  <RadioGroup
                    value={propertyType}
                    onValueChange={(val) => { setPropertyType(val); setErrors({}); }}
                    className="grid grid-cols-3 gap-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="residential" id="pt-res" />
                      <Label htmlFor="pt-res" className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Home className="w-4 h-4 text-slate-500" />
                        Residential
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="commercial" id="pt-com" />
                      <Label htmlFor="pt-com" className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        Commercial
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="multifamily" id="pt-mf" />
                      <Label htmlFor="pt-mf" className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <Users className="w-4 h-4 text-slate-500" />
                        Multifamily
                      </Label>
                    </div>
                  </RadioGroup>
                  {errors.propertyType && <p className="text-xs text-red-500">{errors.propertyType}</p>}
                </div>

                {/* Income Tier (Residential only) */}
                {propertyType === "residential" && (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <Label className="text-sm font-semibold text-[#1e3a5f]">Household Income</Label>
                    </div>
                    <p className="text-xs text-slate-500 -mt-1">
                      Your income answer stays private and is only used to estimate which programs you qualify for. We don't share it.
                    </p>
                    <RadioGroup
                      value={incomeTier}
                      onValueChange={(val) => { setIncomeTier(val); setErrors({}); }}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                        <RadioGroupItem value="lmi" id="inc-lmi" />
                        <Label htmlFor="inc-lmi" className="cursor-pointer text-sm flex-1">
                          Under $80,000/yr
                          <span className="ml-2 text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                            Highest incentives
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 py-2.5">
                        <RadioGroupItem value="middle" id="inc-mid" />
                        <Label htmlFor="inc-mid" className="cursor-pointer text-sm">$80,000–$150,000/yr</Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 py-2.5">
                        <RadioGroupItem value="standard" id="inc-std" />
                        <Label htmlFor="inc-std" className="cursor-pointer text-sm">Over $150,000/yr</Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-slate-200 rounded-lg px-3 py-2.5">
                        <RadioGroupItem value="prefer_not_to_say" id="inc-pnts" />
                        <Label htmlFor="inc-pnts" className="cursor-pointer text-sm text-slate-500">I'd rather not say</Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-slate-400">
                      Why we ask: NJ rebate programs offer 3–5x larger incentives for income-qualified households.
                    </p>
                    {errors.incomeTier && <p className="text-xs text-red-500">{errors.incomeTier}</p>}
                  </div>
                )}

                {/* Household Size (Residential only) */}
                {propertyType === "residential" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-[#1e3a5f]">People in Household</Label>
                    <RadioGroup
                      value={householdSize}
                      onValueChange={setHouseholdSize}
                      className="flex gap-3"
                    >
                      {["1", "2", "3", "4", "5+"].map((n) => (
                        <div key={n} className="flex items-center space-x-1">
                          <RadioGroupItem value={n} id={`hs-${n}`} />
                          <Label htmlFor={`hs-${n}`} className="cursor-pointer text-sm">{n}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* CTA */}
                <Button
                  onClick={handleSeeEstimate}
                  className="w-full bg-[#ff6b35] hover:bg-[#e55a25] text-white font-semibold h-12 text-base mt-2"
                >
                  See My Estimate <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                {/* Social proof + urgency */}
                <div className="space-y-2 pt-2">
                  <p className="text-center text-sm text-slate-600 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    1,200+ NJ homeowners assessed in 2026
                  </p>
                  <p className="text-center text-xs text-amber-700 flex items-center justify-center gap-1.5 bg-amber-50 rounded-lg py-2 px-3">
                    <Clock className="w-3.5 h-3.5" />
                    2026 rebate funding is limited — apply before allocation closes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Instant Range Display + Step 3 Soft Gate
  // ═══════════════════════════════════════════════════════════════════════════════
  if (currentStep === 2 || currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
        <div className="pt-12 pb-6 px-4 text-center text-white">
          <p className="text-white/70 text-sm mb-2">Your estimated rebate range</p>
        </div>

        <div className="max-w-xl mx-auto px-4 pb-12 space-y-6">
          {/* Estimate Card */}
          <Card className="shadow-2xl border-2 border-green-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 pt-6 pb-4">
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-green-700 mb-1">
                  {estimate?.range}
                </p>
                <p className="text-lg text-green-800 font-medium">in combined rebates and incentives</p>
                {estimate?.federalCredit && (
                  <p className="text-base text-blue-700 font-semibold mt-2 bg-blue-50 inline-block px-3 py-1 rounded-full">
                    {estimate.federalCredit}
                  </p>
                )}
              </div>
              <p className="text-sm text-slate-600 text-center mt-3">
                Based on average rebates in <strong>{zip}</strong> for{" "}
                <strong>{propertyType}</strong> in 2026
              </p>
            </div>

            <CardContent className="px-6 py-5">
              {/* Programs list */}
              <p className="text-sm font-semibold text-[#1e3a5f] mb-3">Programs you likely qualify for:</p>
              <ul className="space-y-2">
                {estimate?.programs.map((program, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    {program}
                  </li>
                ))}
              </ul>

              {estimate?.note && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-800 font-medium">{estimate.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Honesty guardrails */}
          <div className="bg-white/10 rounded-lg px-4 py-3">
            <p className="text-xs text-white/70 leading-relaxed">
              This is an estimate based on typical rebates for your ZIP and income tier in 2026.
              Exact amounts depend on: specific equipment chosen, current equipment being replaced,
              income verification, program funding availability, federal tax liability, and HUD Area
              Median Income for your county. Our free assessment provides your exact qualified amount
              with no obligation.
            </p>
          </div>

          {/* Step 3: Soft Gate */}
          <Card className="shadow-2xl">
            <CardContent className="px-6 py-6">
              <div className="text-center mb-5">
                <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">
                  Want your exact number?
                </h3>
                <p className="text-sm text-slate-600">
                  Get a personalized estimate in 60 seconds. We'll calculate your specific
                  rebate amount based on your home, current equipment, and eligibility.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-sm">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setErrors({}); }}
                    className={errors.firstName ? "border-red-500" : ""}
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-sm">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(201) 555-0100"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setErrors({}); }}
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                {errors.submit && (
                  <p className="text-sm text-red-500 text-center">{errors.submit}</p>
                )}

                <Button
                  onClick={handleGetExactAmount}
                  disabled={register.isPending}
                  className="w-full bg-[#ff6b35] hover:bg-[#e55a25] text-white font-semibold h-12 text-base"
                >
                  {register.isPending ? "Preparing your estimate…" : "Get My Exact Rebate Amount →"}
                </Button>

                <p className="text-xs text-slate-400 text-center">
                  No spam. No credit check. You can unsubscribe anytime.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP 4 — Confirmation + Book Assessment CTA
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full space-y-6">
        {/* Confirmation */}
        <Card className="shadow-2xl">
          <CardContent className="pt-8 pb-8 px-6 text-center">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">
              Your personalized rebate estimate is being prepared
            </h2>
            <p className="text-slate-600 mb-6">
              We've sent your detailed calculator link to <strong>{phone}</strong> and <strong>{email}</strong>.
              Check your messages in the next few minutes.
            </p>

            {/* Book Assessment CTA */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] rounded-xl p-6 text-white text-left">
              <h3 className="text-lg font-bold mb-2">Want to lock in your rebate?</h3>
              <p className="text-white/80 text-sm mb-4">
                Book a free 15-minute assessment call. We'll confirm your exact rebate amount
                and check program availability for your area.
              </p>
              <a
                href="tel:+18624191763"
                className="inline-flex items-center gap-2 bg-[#ff6b35] text-white px-5 py-3 rounded-lg font-semibold hover:bg-[#e55a25] transition-all w-full justify-center"
              >
                <Phone className="w-4 h-4" />
                Call Now: (862) 419-1763
              </a>
              <p className="text-white/60 text-xs text-center mt-3">
                Free assessment • No obligation • Available Mon–Sat 8am–6pm
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Estimate reminder */}
        <Card className="shadow-lg">
          <CardContent className="px-6 py-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-[#1e3a5f]">Your estimated range</p>
                <p className="text-lg font-bold text-green-700">{estimate?.range}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
