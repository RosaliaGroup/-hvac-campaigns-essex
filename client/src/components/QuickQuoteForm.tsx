import { useState, useRef } from "react";
import { captureContext } from "@/lib/captureContext";
import { trackConversion, resolveQuickQuoteConversion, type QuickQuoteSource } from "@/lib/conversions";
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
  /**
   * Where this form is placed. Pass `"contact"` on the Contact page so a generic
   * submission (no specific service picked) resolves to the `contact_form_submit`
   * conversion. A deliberately-picked high-value service still resolves to its own
   * event (e.g. replacement/installation) — see `resolveQuickQuoteConversion`.
   */
  source?: QuickQuoteSource;
}

export default function QuickQuoteForm({
  title = "Get a Free Quote",
  description = "Tell us about your HVAC needs and we'll get back to you within 24 hours",
  defaultService,
  source,
}: QuickQuoteFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service: defaultService || "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  // Holds the current submission's idempotency key + the service picked at
  // submit time, so the GA4 conversion fires once with the right (non-PII)
  // classification even though formData is reset inside onSuccess.
  const pendingRef = useRef<{ key: string; service: string; source: QuickQuoteSource } | null>(null);

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      // Confirmed success (CRM lead persisted). Fire exactly one GA4 conversion,
      // keyed on this submission so retries/double-clicks/re-renders can't dupe.
      const pending = pendingRef.current;
      if (pending) {
        const mapping = resolveQuickQuoteConversion(pending.source, pending.service);
        trackConversion(
          mapping.event,
          {
            form_type: "quick_quote_form",
            service_category: mapping.service_category,
            customer_segment: mapping.customer_segment,
            lead_source_surface: pending.source === "contact" ? "contact_page" : "quick_quote_form",
          },
          { dedupeKey: pending.key },
        );
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
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email && !formData.phone) {
      toast.error("Please provide either email or phone number");
      return;
    }

    // Fresh idempotency key per submit attempt; consumed once in onSuccess.
    pendingRef.current = {
      key: `quick_quote-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
      service: formData.service,
      source,
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
                  <SelectItem value="HVAC System Replacement">HVAC System Replacement</SelectItem>
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
