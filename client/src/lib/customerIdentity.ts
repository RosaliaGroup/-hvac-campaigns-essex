import { parseQboCompositeName } from "@shared/qboCompositeName";

/**
 * DISPLAY-ONLY identity resolver for the customer profile.
 *
 * Prefers structured fields (companyName → given+family → displayName) and falls
 * back to the composite QBO DisplayName parser only when a name is still a
 * composite ("PN#132 I PDC I 828 Summer Ave …"). It NEVER writes: production
 * customer fields (displayName/firstName/lastName/companyName/quickbooksCustomerId)
 * are untouched — this only decides what to render. Repairing the stored fields is
 * a separate, approved write-mode step.
 */
export interface CustomerIdentityInput {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  quickbooksRawDisplayName?: string | null;
}

export interface ResolvedCustomerIdentity {
  name: string;
  projectReference: string | null;
  serviceAddress: string | null;
  /** True when the name had to be recovered from a composite QBO DisplayName. */
  derivedFromComposite: boolean;
}

function joinName(first?: string | null, last?: string | null): string {
  return [first, last].filter((s) => s && s.trim()).map((s) => s!.trim()).join(" ").trim();
}

export function resolveCustomerIdentity(c: CustomerIdentityInput): ResolvedCustomerIdentity {
  const source = c.quickbooksRawDisplayName?.trim() || c.displayName?.trim() || "";
  const parsed = source ? parseQboCompositeName(source) : null;

  if (parsed?.isComposite) {
    const name =
      parsed.companyName?.trim() ||
      parsed.customerDisplayName?.trim() ||
      joinName(parsed.firstName, parsed.lastName) ||
      c.companyName?.trim() ||
      c.displayName?.trim() ||
      "Unknown";
    const serviceAddress =
      [parsed.serviceAddressLine1, parsed.serviceCity, parsed.serviceState, parsed.servicePostalCode]
        .filter((s) => s && String(s).trim())
        .join(", ") || null;
    return { name, projectReference: parsed.projectReference, serviceAddress, derivedFromComposite: true };
  }

  const name =
    c.companyName?.trim() || joinName(c.firstName, c.lastName) || c.displayName?.trim() || "Unknown";
  return { name, projectReference: null, serviceAddress: null, derivedFromComposite: false };
}
