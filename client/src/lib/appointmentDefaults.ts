/**
 * Pure helpers for prefilling the AppointmentDialog `defaults` from a customer +
 * their properties. Kept framework-free so the prefill logic is unit-testable
 * without rendering CustomerDetail.
 */
import { formatPropertyAddress } from "@shared/address";

export { formatPropertyAddress };

export interface PropertyLike {
  id: number;
  isPrimary?: boolean | null;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface CustomerLike {
  id: number;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  type: "residential" | "commercial";
}

export interface AppointmentDefaults {
  customerId: number;
  fullName: string;
  phone: string;
  email: string;
  propertyType: "residential" | "commercial";
  propertyId?: number;
  propertyAddress: string;
}

/**
 * Choose which property to prefill. An explicitly selected property (by id) wins;
 * otherwise fall back to the primary property, then the first property. Returns
 * undefined when the customer has no properties.
 */
export function pickAppointmentProperty(
  properties: PropertyLike[],
  selectedPropertyId?: number | null,
): PropertyLike | undefined {
  if (selectedPropertyId != null) {
    const selected = properties.find(p => p.id === selectedPropertyId);
    if (selected) return selected;
  }
  return properties.find(p => p.isPrimary) ?? properties[0];
}

/**
 * Build the AppointmentDialog `defaults` for a customer. Prefills contact fields,
 * the linked propertyId, and the full property address — deferring to an
 * explicitly selected property when one is passed, without overwriting it.
 */
export function customerAppointmentDefaults(
  customer: CustomerLike,
  properties: PropertyLike[],
  selectedPropertyId?: number | null,
): AppointmentDefaults {
  const prop = pickAppointmentProperty(properties, selectedPropertyId);
  return {
    customerId: customer.id,
    fullName: customer.displayName,
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    propertyType: customer.type,
    propertyId: prop?.id,
    propertyAddress: formatPropertyAddress(prop),
  };
}

export interface LeadAppointmentDefaults {
  fullName: string;
  phone: string;
  email: string;
  issueDescription: string;
  customerId?: number;
}

/**
 * Build the AppointmentDialog `defaults` for scheduling from a lead:
 *  - carry the lead's requested service into the appointment's job description
 *  - pass customerId only when the lead is already converted (so the appointment
 *    links directly); leave it undefined otherwise so the server keeps
 *    auto-linking unconverted leads by phone/email.
 */
export function leadAppointmentDefaults(args: {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  requestedService: string;
  customerId?: number | null;
}): LeadAppointmentDefaults {
  return {
    fullName: args.fullName,
    phone: args.phone ?? "",
    email: args.email ?? "",
    issueDescription: args.requestedService,
    customerId: args.customerId ?? undefined,
  };
}
