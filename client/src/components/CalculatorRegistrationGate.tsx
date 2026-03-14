/**
 * CalculatorRegistrationGate
 * Shown when a homeowner visits /rebate-calculator without a valid token.
 * Collects personal details, calls calculator.register, then shows a
 * confirmation screen telling them to check their phone and email.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Mail, MessageSquare, Calculator, Shield, Zap, Award } from "lucide-react";

interface Props {
  /** Called after successful registration so the parent can show a "check your messages" screen */
  onRegistered?: (email: string, phone: string) => void;
}

export default function CalculatorRegistrationGate({ onRegistered }: Props) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const register = trpc.rebateCalculator.register.useMutation();

  function validate() {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Valid email is required";
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10)
      e.phone = "Valid 10-digit phone number is required";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    try {
      await register.mutateAsync({
        ...form,
        origin: window.location.origin,
      });
      setSubmitted(true);
      onRegistered?.(form.email, form.phone);
    } catch (err) {
      console.error("Registration error:", err);
      setErrors({ submit: "Something went wrong. Please try again." });
    }
  }

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
    };
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f] flex items-center justify-center px-4 py-16">
        <Card className="max-w-lg w-full text-center shadow-2xl">
          <CardContent className="pt-10 pb-10 px-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#1e3a5f] mb-3">
              You're registered, {form.firstName}!
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              We've sent your personalized Rebate Calculator link to both your phone and email. Click the link to open your calculator — it's pre-filled with your details.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3">
                <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-800">Text sent to</p>
                  <p className="text-sm text-blue-600">{form.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-orange-50 rounded-lg px-4 py-3">
                <Mail className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-orange-800">Email sent to</p>
                  <p className="text-sm text-orange-600">{form.email}</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Didn't receive it? Check your spam folder or call us at{" "}
              <a href="tel:+18624191763" className="text-[#ff6b35] font-medium">
                (862) 419-1763
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2a5a8f]">
      {/* Hero */}
      <div className="pt-16 pb-10 px-4 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-6 text-sm font-medium">
          <Calculator className="w-4 h-4" />
          Free NJ Clean Heat Rebate Calculator
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
          See How Much You Can Save<br className="hidden md:block" /> on a New Heat Pump
        </h1>
        <p className="text-white/80 text-lg max-w-2xl mx-auto">
          Enter your details below and we'll send you a personalized link to your rebate estimate — up to <strong className="text-white">$16,000</strong> in NJ Clean Heat rebates available.
        </p>
      </div>

      {/* Benefits bar */}
      <div className="flex flex-wrap justify-center gap-6 px-4 pb-10 text-white/90 text-sm">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#ff6b35]" />
          No obligation
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#ff6b35]" />
          Results in 60 seconds
        </div>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#ff6b35]" />
          WMBE/SBE certified contractor
        </div>
      </div>

      {/* Registration form */}
      <div className="max-w-xl mx-auto px-4 pb-20">
        <Card className="shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl text-[#1e3a5f]">Create Your Free Account</CardTitle>
            <CardDescription>
              We'll text and email you a personalized link to your calculator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Jane"
                    value={form.firstName}
                    onChange={set("firstName")}
                    className={errors.firstName ? "border-red-500" : ""}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-500">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Smith"
                    value={form.lastName}
                    onChange={set("lastName")}
                    className={errors.lastName ? "border-red-500" : ""}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-500">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={set("email")}
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <Label htmlFor="phone">Mobile Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(201) 555-0100"
                  value={form.phone}
                  onChange={set("phone")}
                  className={errors.phone ? "border-red-500" : ""}
                />
                {errors.phone && (
                  <p className="text-xs text-red-500">{errors.phone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  We'll text your personalized calculator link here.
                </p>
              </div>

              {/* Address (optional) */}
              <div className="space-y-1">
                <Label htmlFor="address">
                  Property Address{" "}
                  <span className="text-muted-foreground font-normal">(optional — speeds up your estimate)</span>
                </Label>
                <Input
                  id="address"
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={set("address")}
                />
              </div>

              {/* City + Zip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Newark"
                    value={form.city}
                    onChange={set("city")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="07102"
                    value={form.zip}
                    onChange={set("zip")}
                    maxLength={10}
                  />
                </div>
              </div>

              {errors.submit && (
                <p className="text-sm text-red-500 text-center">{errors.submit}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-semibold h-12 text-base"
                disabled={register.isPending}
              >
                {register.isPending ? "Sending your link…" : "Get My Free Rebate Estimate →"}
              </Button>

              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                By submitting, you agree to receive a one-time text message with your calculator link. Reply STOP to opt out. No spam — ever.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
