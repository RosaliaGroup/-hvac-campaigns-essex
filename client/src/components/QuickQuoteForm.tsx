import { useRef, useState } from "react";
import { captureContext } from "@/lib/captureContext";
import { trackLeadConversion } from "@/lib/conversions";
import { toPagePath } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

interface QuickQuoteFormProps {
  title?: string;
  description?: string;
  defaultService?: string;
  /** Marks this instance as the Contact page form → fires `contact_form_submit`. */
  source?: "contact";
  /**
   * Page-level intent (e.g. a ServicePage `service + slug`) used to resolve the
   * conversion event. Takes precedence over the service select so a per-service
   * page always attributes to its own event. When absent, the select drives it.
   */
  conversionIntent?: string;
}

/** Best-effort unique token per submission (falls back when crypto is absent). */
function newSubmissionToken(): string {
  try {
    const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Current path incl. query/hash — the conversions helper strips query/hash. */
function currentPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const l = window.location;
  return `${l.pathname}${l.search}${l.hash}`;
}

export default function QuickQuoteForm({
  title = "Get a Free Quote",
  description = "Tell us about your HVAC needs and we'll get back to you within 24 hours",
  defaultService,
  source,
  conversionIntent,
}: QuickQuoteFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service: defaultService || "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  // Conversion state captured at submit time (so a form reset in onSuccess can't
  // race it) and a one-shot guard so a re-invoked onSuccess never double-fires.
  const pendingConversion = useRef<{ token: string; intent: string; source?: "contact" } | null>(null);

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      // Fire ONLY here — after the CRM leadCapture is confirmed persisted.
      const pending = pendingConversion.current;
      if (pending) {
        pendingConversion.current = null; // guard: at most one fire per submission
        trackLeadConversion({
          source: pending.source,
          intent: pending.intent,
          dedupeKey: `lead:${pending.token}`,
          pagePath: currentPath(),
        });
      }

      toast.success("Quote request received! We'll contact you within 24 hours.");
      setSubmitted(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        service: defaultService || "",
        message: "",
      });
    },
    onError: (error) => {
      // No conversion on failure. Clear the pending token so a later success of
      // a *different* submission can't reuse it.
      pendingConversion.current = null;
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email && !formData.phone) {
      // Validation failure — no conversion, no pending token.
      toast.error("Please provide either email or phone number");
      return;
    }

    // Capture conversion context now; nothing is emitted until onSuccess.
    const resolvedSource =
      source ?? (currentPath() && toPagePath(window.location.pathname) === "/contact" ? "contact" : undefined);
    pendingConversion.current = {
      token: newSubmissionToken(),
      intent: conversionIntent ?? formData.service,
      source: resolvedSource,
    };

    createCapture.mutate({
      name: formData.name || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      captureType: "quick_quote",
      ...captureContext(),
      message: `Service: ${formData.service}\\n\\n${formData.message}`,
    });
  };

  if (submitted) {
    return (
      <Card className="border-green-500/50 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-green-800 mb-2">Request Received!</h3>
            <p className="text-green-700">
              Thank you for your interest. Our team will review your request and contact you within 24 hours.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setSubmitted(false)}
            >
              Submit Another Request
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl text-[#1e3a5f]">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote-name">Name *</Label>
              <Input
                id="quote-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-email">Email *</Label>
              <Input
                id="quote-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote-phone">Phone Number</Label>
              <Input
                id="quote-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(862) 555-1234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-service">Service Needed *</Label>
              <Select
                value={formData.service}
                onValueChange={(value) => setFormData({ ...formData, service: value })}
              >
                <SelectTrigger id="quote-service">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Emergency Repair">Emergency Repair</SelectItem>
                  <SelectItem value="Heat Pump Installation">Heat Pump Installation</SelectItem>
                  <SelectItem value="AC Installation">AC Installation</SelectItem>
                  <SelectItem value="Heating Installation">Heating Installation</SelectItem>
                  <SelectItem value="VRF/VRV System">VRF/VRV System</SelectItem>
                  <SelectItem value="Maintenance Subscription">Maintenance Subscription</SelectItem>
                  <SelectItem value="Commercial HVAC">Commercial HVAC</SelectItem>
                  <SelectItem value="Residential HVAC">Residential HVAC</SelectItem>
                  <SelectItem value="Rebate Consultation">Rebate Consultation</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-message">Tell us about your project</Label>
            <Textarea
              id="quote-message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Describe your HVAC needs, property details, timeline, etc."
              rows={4}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90"
            disabled={createCapture.isPending}
          >
            {createCapture.isPending ? "Submitting..." : "Get Free Quote"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By submitting, you agree to receive text messages from Mechanical Enterprise about
            your request. Msg &amp; data rates may apply. Reply STOP to opt out. See our{" "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
