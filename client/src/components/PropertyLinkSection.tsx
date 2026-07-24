import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Home, Building2, Plus, Link2, ExternalLink, AlertTriangle } from "lucide-react";
import { parseFreeTextAddress, isCompleteAddress } from "@shared/address";

/**
 * Shared Property section for an appointment, used identically on the Lead card,
 * the Appointment detail, and the Customer reconciliation card. Two states:
 *  - LINKED   → address + type + "Open Property"
 *  - UNLINKED → "No Property Linked" + "Link Existing Property" + "Create Property
 *               from Appointment Address"
 * All writes go through the server-validated `appointments.linkProperty` mutation
 * (same-customer, deduped, idempotent). Never creates/links silently — every action
 * is an explicit click. When no owning customer can be resolved, actions are hidden
 * and a hint is shown instead (no ambiguous guesses).
 */
export interface PropertyLinkAppointment {
  id: number;
  customerId?: number | null;
  propertyId?: number | null;
  propertyAddress?: string | null;
  propertyType?: "residential" | "commercial" | null;
}

interface PropertyLinkSectionProps {
  appointment: PropertyLinkAppointment;
  /** Owning customer for link/create actions; falls back to appointment.customerId. */
  customerId?: number | null;
  /** Called after a successful link/create so the parent can refetch. */
  onChanged?: () => void;
  /** Hide the "Property" heading (when the parent already renders one). */
  hideHeading?: boolean;
  className?: string;
}

export default function PropertyLinkSection({
  appointment,
  customerId,
  onChanged,
  hideHeading,
  className,
}: PropertyLinkSectionProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const ownerId = customerId ?? appointment.customerId ?? null;
  const isLinked = appointment.propertyId != null;
  // An unlinked appointment whose free-text address can't be parsed into a
  // complete (Street+City+State+ZIP) address — i.e. the booking flow could not
  // safely auto-create a Property, so it awaits explicit reconciliation.
  const hasAddress = Boolean(appointment.propertyAddress?.trim());
  const addressIncomplete = hasAddress && !isCompleteAddress(parseFreeTextAddress(appointment.propertyAddress));

  const [mode, setMode] = useState<null | "link" | "create">(null);
  const [pickPropertyId, setPickPropertyId] = useState<string>("");
  const [form, setForm] = useState(() => parseFreeTextAddress(appointment.propertyAddress));

  const utils = trpc.useUtils();
  const existing = trpc.customers.listProperties.useQuery(
    { customerId: ownerId ?? 0 },
    { enabled: mode === "link" && ownerId != null },
  );

  const linkProperty = trpc.appointments.linkProperty.useMutation({
    onSuccess: res => {
      toast({
        title: res.createdProperty ? "Property created & linked" : "Property linked",
        description: res.linkedCustomer ? "The appointment was also linked to the customer." : undefined,
      });
      setMode(null);
      // Refresh anything that reads this customer's properties.
      if (ownerId != null) void utils.customers.getById.invalidate({ id: ownerId });
      void utils.customers.listProperties.invalidate();
      onChanged?.();
    },
    onError: err => toast({ title: "Could not link property", description: err.message, variant: "destructive" }),
  });

  const heading = hideHeading ? null : (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      <MapPin className="h-3.5 w-3.5" /> Property
    </div>
  );

  // ── LINKED ──────────────────────────────────────────────────────────────
  if (isLinked) {
    return (
      <div className={`space-y-2 ${className ?? ""}`}>
        {heading}
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0 text-sm">
            <div className="flex items-center gap-2 font-medium">
              {appointment.propertyType === "commercial" ? (
                <Building2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Home className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="break-words">{appointment.propertyAddress || "Linked property"}</span>
            </div>
            {appointment.propertyType && (
              <Badge variant="secondary" className="mt-1 capitalize">{appointment.propertyType}</Badge>
            )}
          </div>
          {ownerId != null && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => navigate(`/customers/${ownerId}`)}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Property
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── UNLINKED ────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {heading}
      <div className="rounded-lg border border-dashed p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" /> No Property Linked
          {addressIncomplete && (
            <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
              <AlertTriangle className="h-3 w-3" /> Incomplete address
            </Badge>
          )}
          {appointment.propertyAddress && (
            <span className="text-xs">· appointment address: <span className="break-words">{appointment.propertyAddress}</span></span>
          )}
        </div>
        {addressIncomplete && ownerId != null && (
          <p className="text-xs text-muted-foreground">
            This appointment’s address is missing City, State, or ZIP, so no property was created automatically.
            Complete it below to create &amp; link a property.
          </p>
        )}

        {ownerId == null ? (
          <p className="text-xs text-muted-foreground">
            Link this record to a customer first to add or link a property.
          </p>
        ) : mode === null ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode("link")}>
              <Link2 className="h-3.5 w-3.5 mr-1" /> Link Existing Property
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setForm(parseFreeTextAddress(appointment.propertyAddress)); setMode("create"); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Property from Appointment Address
            </Button>
          </div>
        ) : mode === "link" ? (
          <div className="space-y-2">
            <Label className="text-xs">Choose one of this customer's properties</Label>
            <Select value={pickPropertyId} onValueChange={setPickPropertyId}>
              <SelectTrigger><SelectValue placeholder={existing.isLoading ? "Loading…" : "Select a property"} /></SelectTrigger>
              <SelectContent>
                {(existing.data?.properties ?? []).map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.address || p.addressLine1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existing.data && existing.data.properties.length === 0 && (
              <p className="text-xs text-muted-foreground">This customer has no properties yet — use “Create” instead.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMode(null)} disabled={linkProperty.isPending}>Cancel</Button>
              <Button
                size="sm"
                disabled={!pickPropertyId || linkProperty.isPending}
                onClick={() => linkProperty.mutate({ appointmentId: appointment.id, propertyId: Number(pickPropertyId) })}
              >
                {linkProperty.isPending ? "Linking…" : "Link Property"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Street address</Label>
                <Input value={form.addressLine1} onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Unit / line 2</Label>
                <Input value={form.addressLine2} onChange={e => setForm(f => ({ ...f, addressLine2: e.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">State</Label>
                  <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="NJ" />
                </div>
                <div>
                  <Label className="text-xs">ZIP</Label>
                  <Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setMode(null)} disabled={linkProperty.isPending}>Cancel</Button>
              <Button
                size="sm"
                disabled={!form.addressLine1.trim() || linkProperty.isPending}
                onClick={() =>
                  linkProperty.mutate({
                    appointmentId: appointment.id,
                    create: {
                      addressLine1: form.addressLine1.trim(),
                      addressLine2: form.addressLine2.trim() || null,
                      city: form.city.trim() || null,
                      state: form.state.trim() || null,
                      zip: form.zip.trim() || null,
                      propertyType: appointment.propertyType ?? undefined,
                    },
                  })
                }
              >
                {linkProperty.isPending ? "Creating…" : "Create & Link"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
