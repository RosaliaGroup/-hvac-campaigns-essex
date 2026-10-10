/**
 * Portfolio pricing request form (docs/positioning-warranty-spec.md §9d) —
 * form_type `portfolio_pricing_request`. Same three-layer spam defence and
 * lead-capture/conversion contract as InlineLeadCapture.tsx, but with the
 * extra structured fields §9d calls for (company, properties, unit counts by
 * type, current maintenance arrangement, contract start) — different enough
 * in shape from InlineLeadCapture's simple name/phone/zip/email card to
 * warrant its own component rather than another InlineLeadVariant.
 */
import { useState, useRef } from "react";
import { captureContext } from "@/lib/captureContext";
import { trackConversion, resolveFormConversion, fbLeadEvent } from "@/lib/conversions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import HoneypotFields, { type HoneypotValues } from "@/components/HoneypotFields";
import { TcpaDisclosure } from "@/components/TcpaDisclosure";
import { TCPA_FORM_VERSION } from "@shared/leadFormVersion";
import { VERIFIED_FACTS } from "@shared/verifiedFacts";

export interface PortfolioPricingRequestFormProps {
  /** Human-readable page identifier for CRM attribution — never sent to GA4. */
  pageContext: string;
  className?: string;
  audienceMode?: "portfolio" | "project";
}

export default function PortfolioPricingRequestForm({ pageContext, className, audienceMode = "portfolio" }: PortfolioPricingRequestFormProps) {
  const unitTypes = VERIFIED_FACTS.portfolioSla.unitTypes;

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    properties: "",
    currentMaintenanceArrangement: "",
    contractStart: "",
  });
  const [unitCounts, setUnitCounts] = useState<Record<string, string>>(() => Object.fromEntries(unitTypes.map((t) => [t, ""])));
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState<HoneypotValues>({ website: "", company_url: "" });
  const [turnstileToken, setTurnstileToken] = useState("");
  const loadedAt = useRef(Date.now());
  const pendingRef = useRef<{ key: string } | null>(null);

  const createCapture = trpc.leadCaptures.create.useMutation({
    onSuccess: () => {
      const pending = pendingRef.current;
      if (pending) {
        const mapping = resolveFormConversion({ service: "Portfolio Pricing" });
        trackConversion(
          mapping.event,
          {
            form_type: "portfolio_pricing_request",
            service_category: mapping.service_category,
            customer_segment: "commercial",
            lead_source_surface: `portfolio:${pageContext}`,
          },
          { dedupeKey: pending.key },
        );
        fbLeadEvent({ content_name: pageContext, content_category: "portfolio_pricing" });
      }
      toast.success("Got it! Our commercial team will follow up with pricing.");
      setSubmitted(true);
    },
    onError: (error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone && !formData.email) {
      toast.error("Please provide a phone number or email so we can follow up.");
      return;
    }

    pendingRef.current = { key: `portfolio_pricing_request-${pageContext}-${Date.now()}-${Math.floor(Math.random() * 1e9)}` };

    const unitCountLines = unitTypes
      .map((t) => `${t}: ${unitCounts[t] || "not provided"}`)
      .join(", ");

    createCapture.mutate({
      name: formData.contactName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      captureType: "inline_form",
      ...captureContext(),
      message:
        `${audienceMode === "portfolio" ? "Portfolio pricing request" : "Commercial project or partnership inquiry"}\n` +
        `Page: ${pageContext}\n` +
        `Company: ${formData.companyName || "not provided"}\n` +
        `Properties: ${formData.properties || "not provided"}\n` +
        (audienceMode === "portfolio" ? `Unit counts by type: ${unitCountLines}\n` : "") +
        `Current maintenance arrangement: ${formData.currentMaintenanceArrangement || "not provided"}\n` +
        `Desired contract start: ${formData.contractStart || "not provided"}`,
      website: honeypot.website || undefined,
      company_url: honeypot.company_url || undefined,
      _ts: loadedAt.current,
      cfTurnstileResponse: turnstileToken || undefined,
      formVersion: TCPA_FORM_VERSION,
    });
  };

  if (submitted) {
    return (
      <div className={`rounded-lg overflow-hidden border-2 border-[#1e3a5f]/30 bg-white shadow-lg ${className ?? ""}`}>
        <div className="p-6 text-center">
          <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#0a1628] mb-2">Request Received</h3>
          <p className="text-sm text-gray-600">Our commercial team will follow up with pricing shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border-2 border-[#1e3a5f]/30 bg-white shadow-lg ${className ?? ""}`}>
      <div className="bg-gradient-to-r from-[#0a1628] to-[#1e3a5f] text-white p-4 rounded-t-lg">
        <h3 className="text-xl font-bold">{audienceMode === "portfolio" ? "Request Portfolio Pricing" : "Request a Commercial Consultation"}</h3>
        <p className="text-sm text-white/90 mt-1">{audienceMode === "portfolio" ? "Fixed per-unit pricing, quoted for your whole portfolio." : "Tell us about your property, bid or partnership."}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3 bg-white">
        <HoneypotFields values={honeypot} onChange={setHoneypot} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ppr-company" className="text-xs">Company</Label>
            <Input id="ppr-company" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} placeholder="Property management company" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ppr-name" className="text-xs">Contact name</Label>
            <Input id="ppr-name" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} placeholder="Your name" autoComplete="name" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ppr-phone" className="text-xs">Phone</Label>
            <Input id="ppr-phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(862) 555-1234" autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ppr-email" className="text-xs">Email</Label>
            <Input id="ppr-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@company.com" autoComplete="email" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ppr-properties" className="text-xs">{audienceMode === "portfolio" ? "Properties in your portfolio" : "Project or property details"}</Label>
          <Textarea id="ppr-properties" value={formData.properties} onChange={(e) => setFormData({ ...formData, properties: e.target.value })} placeholder={audienceMode === "portfolio" ? "Number of buildings/units, locations" : "Location, project scope and building type"} rows={2} />
        </div>

        {audienceMode === "portfolio" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Unit counts by type</Label>
          <div className="grid grid-cols-2 gap-3">
            {unitTypes.map((t) => (
              <div key={t} className="space-y-1">
                <Label htmlFor={`ppr-unit-${t}`} className="text-[10px] text-muted-foreground">{t}</Label>
                <Input
                  id={`ppr-unit-${t}`}
                  inputMode="numeric"
                  value={unitCounts[t] ?? ""}
                  onChange={(e) => setUnitCounts({ ...unitCounts, [t]: e.target.value })}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ppr-maintenance" className="text-xs">{audienceMode === "portfolio" ? "Current maintenance arrangement" : "Additional requirements (optional)"}</Label>
          <Textarea id="ppr-maintenance" value={formData.currentMaintenanceArrangement} onChange={(e) => setFormData({ ...formData, currentMaintenanceArrangement: e.target.value })} placeholder="e.g. in-house staff, another vendor, no current plan" rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ppr-start" className="text-xs">{audienceMode === "portfolio" ? "Desired contract start" : "Project timeline"}</Label>
          <Input id="ppr-start" value={formData.contractStart} onChange={(e) => setFormData({ ...formData, contractStart: e.target.value })} placeholder="e.g. next quarter, ASAP" />
        </div>}

        <Turnstile className="flex justify-center" onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />

        <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white text-base py-6" disabled={createCapture.isPending}>
          {createCapture.isPending ? "Submitting..." : audienceMode === "portfolio" ? "Request Portfolio Pricing" : "Request Commercial Consultation"}
        </Button>

        <TcpaDisclosure />
      </form>
    </div>
  );
}
