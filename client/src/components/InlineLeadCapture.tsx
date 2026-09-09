/**
 * InlineLeadCapture — a compact, intent-aware lead-capture card designed to sit
 * INLINE inside high-traffic SEO pages (blog posts, city pages, direct-install
 * pages, service pages, luxury-area pages). Fixes the "249 pages, zero inline
 * form" problem: previously the only conversion path from these pages was a
 * bottom CTA that punted to /contact.
 *
 * Contract mirrors QuickQuoteForm.tsx exactly:
 *   - Uses `trpc.leadCaptures.create` with `captureType: "inline_form"` (enum
 *     value already whitelisted in server/routers.ts — verified before shipping).
 *   - Cloudflare Turnstile token, HoneypotFields, and _ts (page-load epoch-ms)
 *     for the same three-layer spam defence.
 *   - captureContext() supplies pageUrl + document.referrer for attribution.
 *   - trackConversion() fires exactly one GA4/Ads event on confirmed success,
 *     with a fresh dedupeKey per submit attempt.
 *   - Also fires the Meta Pixel `Lead` event (fbLeadEvent) — a no-op until Ana
 *     pastes her Pixel ID in client/index.html.
 *
 * PII goes to the CRM only; the analytics payload is built from a strict
 * allowlist inside conversions.ts.
 */
import { useState, useRef } from "react";
import { captureContext } from "@/lib/captureContext";
import {
  trackConversion,
  resolveFormConversion,
  fbLeadEvent,
} from "@/lib/conversions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle, Phone, DollarSign, Flame } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import HoneypotFields, { type HoneypotValues } from "@/components/HoneypotFields";

export type InlineLeadVariant = "residential" | "commercial" | "emergency" | "rebate";

export interface InlineLeadCaptureProps {
  variant: InlineLeadVariant;
  /**
   * Human-readable page identifier used ONLY on the CRM message field so leads
   * can be attributed back to the URL that produced them. Never sent to GA4.
   * Examples: "blog:nj-heat-pump-rebates-2026", "city:newark",
   * "direct-install:restaurants".
   */
  pageContext: string;
  defaultService?: string;
  /**
   * Parent opt-in for `position: sticky` behaviour — off by default so an inline
   * placement does not accidentally start scrolling with the viewport. Only the
   * desktop right-rail should pass `sticky`.
   */
  sticky?: boolean;
  /** Optional heading override; each variant has a sensible default. */
  title?: string;
  /** Optional subtitle override. */
  subtitle?: string;
  className?: string;
}

interface VariantConfig {
  cardClass: string;
  headerClass: string;
  titleClass: string;
  buttonClass: string;
  buttonLabel: string;
  defaultTitle: string;
  defaultSubtitle: string;
  successMessage: string;
  showBadge?: boolean;
  badgeText?: string;
  icon?: React.ReactNode;
}

const VARIANTS: Record<InlineLeadVariant, VariantConfig> = {
  residential: {
    cardClass: "border-2 border-[#ff6b35]/30 bg-white shadow-lg",
    headerClass: "bg-gradient-to-r from-[#ff6b35] to-[#e8813a] text-white p-4 rounded-t-lg",
    titleClass: "text-xl font-bold",
    buttonClass: "w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white text-base py-6",
    buttonLabel: "Get My Free Assessment",
    defaultTitle: "Get Your Free Assessment",
    defaultSubtitle: "See every NJ rebate you qualify for — no cost, no obligation.",
    successMessage: "Tech will call you in under 60 seconds",
  },
  commercial: {
    cardClass: "border-2 border-[#1e3a5f]/30 bg-white shadow-lg",
    headerClass: "bg-gradient-to-r from-[#0a1628] to-[#1e3a5f] text-white p-4 rounded-t-lg",
    titleClass: "text-xl font-bold",
    buttonClass: "w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white text-base py-6",
    buttonLabel: "Get My Free Assessment",
    defaultTitle: "Free Commercial Assessment",
    defaultSubtitle: "NJ Direct Install can cover up to 80% of your HVAC upgrade.",
    successMessage: "Our commercial team will call you shortly",
  },
  emergency: {
    cardClass: "border-2 border-red-500 bg-white shadow-xl",
    headerClass: "bg-gradient-to-r from-red-600 to-red-500 text-white p-4 rounded-t-lg",
    titleClass: "text-xl font-bold",
    buttonClass: "w-full bg-red-600 hover:bg-red-700 text-white text-base py-6",
    buttonLabel: "Call Tech Now",
    defaultTitle: "Emergency HVAC Service",
    defaultSubtitle: "Same-day service across Northern NJ. Real technician, real fast.",
    successMessage: "Tech will call you in under 60 seconds",
    showBadge: true,
    badgeText: "Available Now",
    icon: <Flame className="h-5 w-5" />,
  },
  rebate: {
    cardClass: "border-2 border-green-500/40 bg-white shadow-lg",
    headerClass: "bg-gradient-to-r from-green-600 to-green-500 text-white p-4 rounded-t-lg",
    titleClass: "text-xl font-bold",
    buttonClass: "w-full bg-green-600 hover:bg-green-700 text-white text-base py-6",
    buttonLabel: "Check My Rebate Amount",
    defaultTitle: "Check Your NJ Rebate",
    defaultSubtitle: "See exactly what you qualify for — up to $16,000 in NJ rebates.",
    successMessage: "We'll email your rebate breakdown shortly",
    icon: <DollarSign className="h-5 w-5" />,
  },
};

export default function InlineLeadCapture({
  variant,
  pageContext,
  defaultService,
  sticky = false,
  title,
  subtitle,
  className,
}: InlineLeadCaptureProps) {
  const cfg = VARIANTS[variant];

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    zip: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState<HoneypotValues>({ website: "", company_url: "" });
  const [turnstileToken, setTurnstileToken] = useState("");
  // Page/form-load time; a submit <4s later is treated as robotic server-side.
  const loadedAt = useRef(Date.now());
  // Holds the current submission's dedupe key + the service used to classify
  // the conversion event. Consumed once in onSuccess so retries / re-renders /
  // StrictMode double-invocation can never double-fire GA4.
  const pendingRef = useRef<{ key: string; service: string } | null>(null);

  // Service string used for GA4 classification. Prefer the caller's
  // defaultService; otherwise infer from variant so `mapServiceToConversion`
  // picks the correct event (emergency/repair, commercial, etc.).
  const serviceForConversion =
    defaultService ??
    (variant === "emergency"
      ? "Emergency Repair"
      : variant === "commercial"
      ? "Commercial HVAC"
      : variant === "rebate"
      ? "Rebate Consultation"
      : "Residential HVAC");

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      const pending = pendingRef.current;
      if (pending) {
        const mapping = resolveFormConversion({ service: pending.service });
        trackConversion(
          mapping.event,
          {
            form_type: "inline_lead_capture",
            service_category: mapping.service_category,
            customer_segment: mapping.customer_segment,
            lead_source_surface: `inline:${variant}`,
          },
          { dedupeKey: pending.key },
        );
        // Fire the Meta Pixel Lead event (no-op until Ana pastes her Pixel ID).
        fbLeadEvent({ content_name: pageContext, content_category: variant });
      }
      toast.success("Got it! A tech will call you shortly.");
      setSubmitted(true);
      setFormData({ name: "", email: "", phone: "", zip: "" });
      setTurnstileToken("");
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone) {
      toast.error("Please enter a phone number so we can call you back.");
      return;
    }

    pendingRef.current = {
      key: `inline_form-${pageContext}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
      service: serviceForConversion,
    };

    createCapture.mutate({
      name: formData.name || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      captureType: "inline_form",
      ...captureContext(),
      message:
        `Inline lead capture\n` +
        `Page: ${pageContext}\n` +
        `Variant: ${variant}\n` +
        `Service: ${serviceForConversion}\n` +
        `ZIP: ${formData.zip || "not provided"}`,
      website: honeypot.website || undefined,
      company_url: honeypot.company_url || undefined,
      _ts: loadedAt.current,
      cfTurnstileResponse: turnstileToken || undefined,
    });
  };

  const wrapperClass = [
    "rounded-lg overflow-hidden",
    cfg.cardClass,
    sticky ? "lg:sticky lg:top-[100px]" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (submitted) {
    return (
      <div className={wrapperClass}>
        <div className="p-6 text-center">
          <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#0a1628] mb-2">Request Received</h3>
          <p className="text-sm text-gray-600">{cfg.successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass} data-inline-lead-capture={variant} data-page-context={pageContext}>
      <div className={cfg.headerClass}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {cfg.icon}
            <h3 className={cfg.titleClass}>{title ?? cfg.defaultTitle}</h3>
          </div>
          {cfg.showBadge && (
            <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {cfg.badgeText}
            </span>
          )}
        </div>
        <p className="text-sm text-white/90 mt-1">{subtitle ?? cfg.defaultSubtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3 bg-white">
        <HoneypotFields values={honeypot} onChange={setHoneypot} />

        <div className="space-y-1.5">
          <Label htmlFor={`ilc-name-${pageContext}`} className="text-xs">
            Name
          </Label>
          <Input
            id={`ilc-name-${pageContext}`}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`ilc-phone-${pageContext}`} className="text-xs">
            Phone *
          </Label>
          <Input
            id={`ilc-phone-${pageContext}`}
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(862) 555-1234"
            required
            autoComplete="tel"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`ilc-zip-${pageContext}`} className="text-xs">
              ZIP
            </Label>
            <Input
              id={`ilc-zip-${pageContext}`}
              value={formData.zip}
              onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
              placeholder="07102"
              inputMode="numeric"
              maxLength={10}
              autoComplete="postal-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ilc-email-${pageContext}`} className="text-xs">
              Email
            </Label>
            <Input
              id={`ilc-email-${pageContext}`}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="optional"
              autoComplete="email"
            />
          </div>
        </div>

        <Turnstile
          className="flex justify-center"
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
        />

        <Button type="submit" className={cfg.buttonClass} disabled={createCapture.isPending}>
          {createCapture.isPending ? (
            "Submitting..."
          ) : (
            <>
              {variant === "emergency" && <Phone className="mr-2 h-4 w-4" />}
              {cfg.buttonLabel}
            </>
          )}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground leading-tight">
          By submitting, you agree to receive SMS/calls about your request. Msg &amp; data rates
          may apply. Reply STOP to opt out.{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            Privacy
          </a>
          .
        </p>
      </form>
    </div>
  );
}
